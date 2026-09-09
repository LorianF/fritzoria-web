import type {Address,Profile,State} from '@/lib/store/types';
import {getSupabaseBrowserClient} from './client';

type ProfileRow={id:string;email:string;name:string;phone:string;role:'customer'|'admin'};
type AddressRow={id:string;label:string;recipient_name:string;phone:string;city:string;province:string;postal_code:string;street:string;is_primary:boolean};

const addressFromRow=(row:AddressRow,email:string):Address=>({
  id:row.id,email,label:row.label,name:row.recipient_name,phone:row.phone,
  city:row.city,province:row.province,postal:row.postal_code,
  street:row.street,primary:row.is_primary,
});

export async function loadRemoteUserState(){
  const supabase=getSupabaseBrowserClient();
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user?.email)return null;

  const [profileResult,addressResult,wishlistResult]=await Promise.all([
    supabase.from('profiles').select('id,email,name,phone,role').eq('id',user.id).single(),
    supabase.from('addresses').select('id,label,recipient_name,phone,city,province,postal_code,street,is_primary').order('created_at'),
    supabase.from('wishlists').select('book_id'),
  ]);
  if(profileResult.error)throw profileResult.error;
  if(addressResult.error)throw addressResult.error;
  if(wishlistResult.error)throw wishlistResult.error;

  const ids=(wishlistResult.data||[]).map(row=>row.book_id);
  let wish:string[]=[];
  if(ids.length){
    const books=await supabase.from('books').select('slug').in('id',ids);
    if(books.error)throw books.error;
    wish=(books.data||[]).map(row=>row.slug);
  }
  const row=profileResult.data as ProfileRow;
  const profile:Profile={email:row.email,name:row.name||row.email.split('@')[0],phone:row.phone||''};
  return {
    userId:user.id,email:user.email,profile,isAdmin:row.role==='admin',wish,
    addresses:(addressResult.data as AddressRow[]).map(item=>addressFromRow(item,user.email!)),
  };
}

export async function syncRemoteUserState(previous:State,next:State){
  if(!next.session)return;
  const supabase=getSupabaseBrowserClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user?.email||user.email!==next.session)return;

  const beforeProfile=previous.profiles.find(profile=>profile.email===user.email);
  const afterProfile=next.profiles.find(profile=>profile.email===user.email);
  const sessionChanged=previous.session!==next.session;
  const jobs:PromiseLike<unknown>[]=[];

  if(afterProfile&&(sessionChanged||beforeProfile?.name!==afterProfile.name||beforeProfile?.phone!==afterProfile.phone)){
    jobs.push(supabase.from('profiles').update({name:afterProfile.name,phone:afterProfile.phone}).eq('id',user.id));
  }

  const beforeAddresses=previous.addresses.filter(address=>address.email===user.email);
  const afterAddresses=next.addresses.filter(address=>address.email===user.email);
  if(sessionChanged||JSON.stringify(beforeAddresses)!==JSON.stringify(afterAddresses)){
    const removed=beforeAddresses.filter(address=>!afterAddresses.some(item=>item.id===address.id)).map(address=>address.id);
    if(removed.length)jobs.push(supabase.from('addresses').delete().in('id',removed));
    if(afterAddresses.length){
      await supabase.from('addresses').update({is_primary:false}).eq('user_id',user.id);
      jobs.push(supabase.from('addresses').upsert(afterAddresses.map(address=>({
        id:address.id,user_id:user.id,label:address.label,recipient_name:address.name,
        phone:address.phone,city:address.city,province:address.province,
        postal_code:address.postal,street:address.street,is_primary:address.primary,
        updated_at:new Date().toISOString(),
      }))));
    }
  }

  const added=next.wish.filter(slug=>sessionChanged||!previous.wish.includes(slug));
  const removed=previous.wish.filter(slug=>!next.wish.includes(slug));
  if(added.length){
    const result=await supabase.from('books').select('id').in('slug',added);
    if(result.error)throw result.error;
    if(result.data.length)jobs.push(supabase.from('wishlists').upsert(result.data.map(book=>({user_id:user.id,book_id:book.id}))));
  }
  if(removed.length){
    const result=await supabase.from('books').select('id').in('slug',removed);
    if(result.error)throw result.error;
    if(result.data.length)jobs.push(supabase.from('wishlists').delete().eq('user_id',user.id).in('book_id',result.data.map(book=>book.id)));
  }

  const results=await Promise.all(jobs);
  const error=results.map(result=>(result as {error?:Error|null})?.error).find(Boolean);
  if(error)throw error;
}
