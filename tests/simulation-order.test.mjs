import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseSimulationLines,simulationQuote} from '../lib/payments/simulation-order.ts';
import {testPayload,publicTestSession} from '../lib/payments/xendit-test.ts';

test('simulation quote uses catalog prices and rejects invalid/duplicate/unavailable carts',()=>{
 const book={slug:'uji',title:'Uji',physical_price:100000,stock:5,hidden:false,preorder:false};
 const line={slug:'uji',qty:2,format:'fisik',price:1};
 const lines=parseSimulationLines([line]);
 assert.equal(simulationQuote(lines,[book],'Reguler').total,218000);
 assert.equal(simulationQuote(lines,[book],'Ekspres').total,230000);
 assert.equal(simulationQuote(parseSimulationLines([{...line,qty:3}]),[book],'Reguler').shipping,0);
 for(const cart of [[],[line,line],[{...line,qty:0}],[{...line,qty:1.5}],[{...line,format:'ebook'}]]) assert.throws(()=>parseSimulationLines(cart));
 for(const changed of [{hidden:true},{preorder:true},{stock:1},{physical_price:0}]) assert.throws(()=>simulationQuote(lines,[{...book,...changed}],'Reguler'));
 assert.throws(()=>simulationQuote(lines,[book],'invalid'));
 assert.notEqual(testPayload('user','DANA','attempt1').customer.reference_id,testPayload('user','DANA','attempt2').customer.reference_id);
 assert.equal(publicTestSession({metadata:{fritzoria_mode:'sandbox',fritzoria_user_id:'user'},amount:218000,currency:'IDR',allowed_payment_channels:['DANA'],payment_session_id:'ps-123456789012345678901234',status:'COMPLETED',payment_link_url:null},'user',218000).status,'COMPLETED');
});

test('sandbox migration enforces owner/admin RLS, immutable totals and unique retries',async()=>{
 const db=new PGlite();
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function public.is_admin() returns boolean language sql stable as $$select current_setting('test.admin',true)='yes'$$;
   create table public.profiles(id uuid primary key);
   insert into profiles values ('${owner}'),('${other}');
   grant usage on schema auth to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20260911092022_simulation_orders.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false); select set_config('test.admin','yes',false);`);
  const insert=()=>db.query(`insert into simulation_orders(id,user_id,channel,courier,items,subtotal,shipping,total) values ($1,$1,'DANA','Reguler','[{"slug":"uji"}]',100000,18000,118000)`,[owner]);
  await insert(); await assert.rejects(insert(),/duplicate key/);
  assert.equal((await db.query('select * from simulation_orders')).rows.length,1);
  await assert.rejects(db.exec('update simulation_orders set total=1'),/permission denied/);
  await db.exec(`update simulation_orders set session_id='ps-123456789012345678901234'`);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
  assert.equal((await db.query('select * from simulation_orders')).rows.length,0);
  await assert.rejects(insert(),/row-level security/);
  await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false); select set_config('test.admin','no',false);`);
  assert.equal((await db.query('select * from simulation_orders')).rows.length,0);
  await assert.rejects(insert(),/row-level security/);
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.exec('select * from simulation_orders'),/permission denied/);
 }finally{await db.close();}
});
