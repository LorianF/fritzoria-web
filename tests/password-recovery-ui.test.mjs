import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const base='http://127.0.0.1:5176';
let server,browser,logs='';

before(async()=>{
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5176'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stdout.on('data',b=>{logs+=b;});server.stderr.on('data',b=>{logs+=b;});
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.equal(server.exitCode,null,logs);
  browser=await chromium.launch({channel:'msedge',headless:true});
});

after(async()=>{await browser?.close();server?.kill();});

test('forgot-password sends the dedicated recovery URL without exposing account existence',async()=>{
  const context=await browser.newContext();
  let redirectTo='';
  await context.route('**/auth/v1/recover*',async route=>{
    redirectTo=new URL(route.request().url()).searchParams.get('redirect_to')||'';
    return route.fulfill({status:200,json:{}});
  });
  const page=await context.newPage();
  await page.goto(base+'/lupa-sandi');
  await page.getByLabel('Email').fill('nobody@example.test');
  await page.getByRole('button',{name:'Kirim tautan pemulihan'}).click();
  await page.getByRole('status').waitFor();
  assert.equal(redirectTo,base+'/atur-ulang-sandi');
  assert.match(await page.getByRole('status').textContent(),/Jika email tersebut terdaftar/);
  await context.close();
});

test('password page rejects visits without a recovery token',async()=>{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base+'/atur-ulang-sandi');
  const error=page.locator('.auth-form .form-error');
  await error.waitFor();
  assert.match(await error.textContent(),/tidak valid atau sudah kedaluwarsa/);
  assert.equal(await page.getByLabel('Sandi baru').count(),0);
  await context.close();
});

test('valid recovery session enforces confirmation and updates the password',async()=>{
  const context=await browser.newContext();
  const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'reader@example.test',user_metadata:{}};
  await context.addInitScript(({user})=>{
    const token={access_token:'recovery-fixture-token',refresh_token:'recovery-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){return /^sb-.*-auth-token$/.test(key)?JSON.stringify(token):get.call(this,key);};
  },{user});
  let updatedPassword='';
  await context.route('**/auth/v1/user',async route=>{
    if(route.request().method()==='PUT')updatedPassword=route.request().postDataJSON().password;
    return route.fulfill({status:200,json:user});
  });
  await context.route('**/auth/v1/logout*',route=>route.fulfill({status:204,body:''}));
  const page=await context.newPage();
  await page.goto(base+'/atur-ulang-sandi#type=recovery&access_token=recovery-fixture-token');
  await page.getByLabel('Sandi baru',{exact:true}).waitFor();
  await page.getByLabel('Sandi baru',{exact:true}).fill('sandi-baru-aman');
  await page.getByLabel('Ulangi sandi baru').fill('berbeda1');
  await page.getByRole('button',{name:'Simpan sandi baru'}).click();
  assert.match(await page.locator('.auth-form .form-error').textContent(),/belum sama/);
  await page.getByLabel('Ulangi sandi baru').fill('sandi-baru-aman');
  await page.getByRole('button',{name:'Simpan sandi baru'}).click();
  await page.waitForURL('**/masuk?reset=berhasil');
  assert.equal(updatedPassword,'sandi-baru-aman');
  await context.close();
});
