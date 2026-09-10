import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
import {user,books} from './qa-fixtures.mjs';

const base='http://127.0.0.1:5176';
let server,browser,logs='';
before(async()=>{
  server=spawn(process.execPath,['--import','./tests/xendit-server-fixture.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5176'],{env:{...process.env,VERCEL_ENV:'preview',XENDIT_SECRET_KEY:'xnd_development_fixture'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.equal(server.exitCode,null,logs);
  browser=await chromium.launch({channel:'msedge',headless:true});
});
after(async()=>{await browser?.close();server?.kill();});

test('HTTP: admin-only POST, origin, validation, owner isolation, server amount and status',async()=>{
  const post=(token,body,origin=base)=>fetch(base+'/api/payments/test',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  assert.equal((await post(null,{channel:'DANA'})).status,401);
  assert.equal((await post('customer-fixture',{channel:'DANA'})).status,403);
  assert.equal((await post('admin-fixture',{channel:'DANA'},'https://evil.test')).status,403);
  assert.equal((await post('admin-fixture',{channel:'QRIS'})).status,400);
  const response=await post('admin-fixture',{channel:'BNI_VIRTUAL_ACCOUNT',amount:1});
  assert.equal(response.status,201,await response.clone().text());
  assert.equal(response.headers.get('cache-control'),'no-store');
  const session=await response.json();assert.equal(session.amount,10000);assert.equal(session.status,'ACTIVE');
  const get=id=>fetch(base+'/api/payments/test?id='+id,{headers:{Authorization:'Bearer admin-fixture'}});
  assert.equal((await (await get(session.id)).json()).status,'COMPLETED');
  assert.equal((await get('ps-otherowner000000000000')).status,404);
  assert.equal((await get('../escape')).status,400);
});

test('browser: admin simulation, no QRIS, verified result and responsive layout',async()=>{
  const c=await browser.newContext();
  await c.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin===base)return route.continue();
    if(u.pathname==='/auth/v1/user')return route.fulfill({json:user});
    if(u.pathname==='/rest/v1/profiles')return route.fulfill({json:{...user,role:'admin',name:'QA Admin',phone:''}});
    if(u.pathname==='/rest/v1/books')return route.fulfill({json:books});
    if(u.pathname.startsWith('/rest/v1/')){assert.ok(['GET','HEAD'].includes(route.request().method()),'no production write');return route.fulfill({json:[]});}
    return route.abort();
  });
  await c.addInitScript(({user})=>{
    const token={access_token:'admin-fixture',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){return /^sb-.*-auth-token$/.test(key)?JSON.stringify(token):get.call(this,key);};
  },{user});
  const p=await c.newPage();await p.goto(base+'/uji-pembayaran');
  await p.getByRole('button',{name:'Buat simulasi Rp10.000'}).waitFor();
  assert.equal(await p.locator('option[value="QRIS"]').count(),0);
  for(const width of [375,768,1440]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await p.getByRole('button',{name:'Buat simulasi Rp10.000'}).click();
  await p.getByRole('link',{name:'Buka pembayaran Mode Tes Xendit ↗'}).waitFor();
  await p.getByRole('button',{name:'Periksa status dari Xendit'}).click();
  await p.getByText('Simulasi selesai — bukan pembayaran asli',{exact:true}).waitFor();
  assert.equal(await p.getByRole('link',{name:'Buka pembayaran Mode Tes Xendit ↗'}).count(),0);
  await c.close();
});
