import test from 'node:test';
import assert from 'node:assert/strict';
import { testKey, testPayload, publicTestSession, TEST_CHANNELS, requireTestAdmin, xenditRequest } from '../lib/payments/xendit-test.ts';

const user='00000000-0000-4000-8000-000000000001';
const session={payment_session_id:'ps-661f87c614802d6c402cd82d',payment_link_url:'https://checkout-staging.xendit.co/sessions/test',amount:10000,currency:'IDR',status:'ACTIVE',allowed_payment_channels:['DANA'],metadata:{fritzoria_mode:'sandbox',fritzoria_user_id:user}};

test('sandbox fails closed for production, local environments, missing and live keys',()=>{
  for(const VERCEL_ENV of ['production','development',undefined])assert.throws(()=>testKey({VERCEL_ENV,XENDIT_SECRET_KEY:'xnd_development_fixture'}));
  for(const XENDIT_SECRET_KEY of ['',undefined,'xnd_production_fixture','xnd_public_development_fixture'])assert.throws(()=>testKey({VERCEL_ENV:'preview',XENDIT_SECRET_KEY}));
  assert.equal(testKey({VERCEL_ENV:'preview',XENDIT_SECRET_KEY:'xnd_development_fixture'}),'xnd_development_fixture');
});
test('fixed sandbox amount, no QRIS or client-selected unsupported channel, no real customer PII',()=>{
  assert.ok(!TEST_CHANNELS.includes('QRIS'));
  for(const channel of TEST_CHANNELS){const p=testPayload(user,channel,'FRTEST-fixture');assert.equal(p.amount,10000);assert.deepEqual(p.allowed_payment_channels,[channel]);assert.equal(p.customer.email,undefined);assert.equal(p.customer.mobile_number,undefined);assert.equal(p.metadata.fritzoria_mode,'sandbox');}
  for(const channel of ['QRIS','CARDS','',null,undefined])assert.throws(()=>testPayload(user,channel,'test'));
});
test('only owned sandbox sessions are disclosed; provider secrets are not forwarded',()=>{
  const publicData=publicTestSession({...session,secret:'do-not-forward'},user);
  assert.deepEqual(Object.keys(publicData).sort(),['amount','channel','id','status','url']);
  for(const metadata of [null,{}, {...session.metadata,fritzoria_mode:'live'}, {...session.metadata,fritzoria_user_id:'other'}])assert.throws(()=>publicTestSession({...session,metadata},user));
});
test('live checkout, arbitrary redirect URLs and unexpected amount/channel are rejected',()=>{
  for(const payment_link_url of ['https://checkout.xendit.co/test','https://evil.test','javascript:alert(1)','https://checkout-staging.xendit.co.evil.test','https://user:pass@dev.xen.to/test'])assert.throws(()=>publicTestSession({...session,payment_link_url},user));
  for(const change of [{amount:9999},{currency:'USD'},{allowed_payment_channels:[]},{allowed_payment_channels:['QRIS']},{status:'PAID'},{payment_session_id:'../escape'}])assert.throws(()=>publicTestSession({...session,...change},user));
  for(const status of ['ACTIVE','COMPLETED','EXPIRED','CANCELED'])assert.equal(publicTestSession({...session,status},user).status,status);
});
test('auth rejects absent bearer before any external request',async()=>{
  await assert.rejects(requireTestAdmin(new Request('https://preview.test/api/payments/test')),e=>e.status===401);
});
test('Xendit API uses Basic server auth, no-store and refuses raw error disclosure',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.xendit.co/sessions');assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Basic '+Buffer.from('xnd_development_fixture:').toString('base64'));return Response.json(session);};
    assert.deepEqual(await xenditRequest('xnd_development_fixture','/sessions',testPayload(user,'DANA','fixture')),session);
    globalThis.fetch=async()=>Response.json({message:'secret-should-not-leak'},{status:403});
    await assert.rejects(xenditRequest('fixture','/sessions'),e=>e.status===502&&!e.message.includes('secret-should-not-leak'));
    globalThis.fetch=async()=>{throw new Error('secret-network-info');};
    await assert.rejects(xenditRequest('fixture','/sessions'),e=>e.status===502&&!e.message.includes('secret-network-info'));
  }finally{globalThis.fetch=original;}
});
