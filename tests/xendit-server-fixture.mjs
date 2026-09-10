// Test runner preload only. No real credentials or external network requests.
import './qa-server-fixture.mjs';
import { user } from './qa-fixtures.mjs';
const previous=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const headers=new Headers(init?.headers);
  if(url.pathname==='/auth/v1/user')return Response.json(user);
  if(url.pathname==='/rest/v1/profiles'){
    if(init?.method&&init.method!=='GET')throw new Error('Database mutation forbidden in sandbox');
    return Response.json({role:headers.get('authorization')==='Bearer customer-fixture'?'customer':'admin'});
  }
  if(url.hostname==='api.xendit.co'){
    if(init?.method==='POST'){
      const p=JSON.parse(init.body);
      if(p.amount!==10000||p.allowed_payment_channels.length!==1||p.allowed_payment_channels[0]==='QRIS')throw new Error('Unsafe payload');
      return Response.json({payment_session_id:'ps-661f87c614802d6c402cd82d',payment_link_url:'https://checkout-staging.xendit.co/sessions/test',amount:p.amount,currency:p.currency,status:'ACTIVE',allowed_payment_channels:p.allowed_payment_channels,metadata:p.metadata});
    }
    return Response.json({payment_session_id:'ps-661f87c614802d6c402cd82d',payment_link_url:'https://checkout-staging.xendit.co/sessions/test',amount:10000,currency:'IDR',status:'COMPLETED',allowed_payment_channels:['BNI_VIRTUAL_ACCOUNT'],metadata:{fritzoria_mode:'sandbox',fritzoria_user_id:url.pathname.endsWith('otherowner000000000000')?'other':user.id}});
  }
  return previous(input,init);
};
