// Isolated HTTP test server; no external traffic or real database writes.
import {user} from './qa-fixtures.mjs';
const original=globalThis.fetch,orders=new Map(),sessions=new Map();
globalThis.fetch=async(input,init)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 const h=new Headers(init?.headers),method=init?.method||'GET';
 if(u.pathname==='/auth/v1/user')return Response.json(user);
 if(u.pathname==='/rest/v1/profiles')return Response.json({role:h.get('authorization')==='Bearer customer'?'customer':'admin'});
 if(u.pathname==='/rest/v1/books')return Response.json([{slug:'uji',title:'Buku Uji',physical_price:100000,stock:5,hidden:false,preorder:false}]);
 if(u.pathname==='/rest/v1/simulation_orders'){
  const id=u.searchParams.get('id')?.slice(3);
  if(method==='POST'){
   const row=JSON.parse(init.body);if(orders.has(row.id))return Response.json({message:'duplicate'},{status:409});
   const saved={...row,created_at:new Date().toISOString(),session_id:null,setup_error:''};orders.set(row.id,saved);return Response.json(saved);
  }
  if(method==='PATCH'){const row=orders.get(id);Object.assign(row,JSON.parse(init.body));return Response.json(row);}
  return Response.json(id?orders.get(id)||null:[...orders.values()]);
 }
 if(u.hostname==='api.xendit.co'){
  if(method==='POST'){
   const p=JSON.parse(init.body);
   if(p.amount!==218000||p.items.reduce((n,i)=>n+i.quantity*i.net_unit_amount,0)!==p.amount||p.customer.email||p.customer.mobile_number)throw new Error('Unsafe sandbox quote');
   const id='ps-'+String(sessions.size+1).padStart(24,'0');
   const s={...p,payment_session_id:id,payment_link_url:'https://dev.xen.to/test',status:'ACTIVE'};sessions.set(id,s);return Response.json(s);
  }
  return Response.json({...sessions.get(u.pathname.split('/').at(-1)),status:'COMPLETED'});
 }
 if(!['127.0.0.1','localhost'].includes(u.hostname))throw new Error('External traffic blocked');
 return original(input,init);
};
