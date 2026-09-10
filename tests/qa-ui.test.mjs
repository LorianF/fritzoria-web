import test, {after,before} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
import {books,user} from './qa-fixtures.mjs';

const base='http://127.0.0.1:5175';
let server,browser,logs='';
before(async()=>{
  server=spawn(process.execPath,['--import','./tests/qa-server-fixture.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5175'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stdout.on('data',b=>{logs+=b;});server.stderr.on('data',b=>{logs+=b;});
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.equal(server.exitCode,null,logs);
  browser=await chromium.launch({channel:'msedge',headless:true});
});
after(async()=>{await browser?.close();server?.kill();});

async function context(admin=false){
  const c=await browser.newContext();
  await c.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===base)return route.continue();
    if(!u.pathname.startsWith('/rest/v1/')&&!u.pathname.startsWith('/auth/v1/'))return route.abort();
    let data=[];
    if(u.pathname.endsWith('/books'))data=books;
    else if(u.pathname.endsWith('/addresses'))assert.equal(u.searchParams.get('user_id'),'eq.'+user.id,'account addresses must be scoped to the signed-in user, including admins');
    else if(u.pathname.endsWith('/user'))data=user;
    else if(u.pathname.endsWith('/profiles'))data=u.searchParams.has('id')?{...user,name:'QA Admin',phone:'',role:'admin'}:[{...user,name:'QA Admin',phone:'',role:'admin'},{id:'00000000-0000-4000-8000-000000000002',name:'Pelanggan Lain',email:'buyer@example.test',phone:'',role:'customer'}];
    else if(u.pathname.endsWith('/categories'))data=[...new Set(books.map(b=>b.category))].map((name,i)=>({id:String(i),name}));
    return route.fulfill({json:data});
  });
  if(admin)await c.addInitScript(({user})=>{
    // The mocked auth server supplies identity; no real login or production token.
    const token={access_token:'qa-fixture-token',refresh_token:'qa-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
    // Discover the publishable client's project reference from script fetches is unnecessary:
    // getItem returns the fixture only for Supabase auth storage requests in this isolated context.
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){return /^sb-.*-auth-token$/.test(key)?JSON.stringify(token):get.call(this,key);};
  },{user});
  return c;
}

test('real HTTP 404 and metadata for absent products; valid product still 200',async()=>{
  for(const path of ['/buku/tidak-ada-qa','/qa-tidak-ada']){
    const r=await fetch(base+path);assert.equal(r.status,404);assert.match(await r.text(),/<title>Halaman tidak ditemukan \| Fritzoria<\/title>/);
  }
  const r=await fetch(base+'/buku/laut-bercerita');assert.equal(r.status,200);assert.match(await r.text(),/<title>Laut Bercerita/);
});
test('guest gates have h1, ebook add/buy disabled, promo has no unusable copy action',async()=>{
  const c=await context();const p=await c.newPage();
  for(const path of ['/akun','/pesanan','/checkout']){await p.goto(base+path);await p.locator('main h1').waitFor();assert.equal(await p.locator('main h1').count(),1);}
  await p.goto(base+'/buku/laut-bercerita');await p.getByRole('radio',{name:'E-book',exact:true}).check();
  assert.ok(await p.getByRole('button',{name:'Tambah ke keranjang',exact:true}).first().isDisabled());
  assert.ok(await p.getByRole('button',{name:'Beli sekarang',exact:true}).isDisabled());
  await p.goto(base+'/promo');await p.getByRole('heading',{name:'Harga pilihan hari ini'}).waitFor();assert.equal(await p.getByRole('button',{name:'Salin kode'}).count(),0);
  await p.goto(base+'/baca/pride-and-prejudice');await p.locator('.reading-page h1').waitFor();assert.ok(!(await p.locator('.reading-page > p').allTextContents()).includes(']'));
  await c.close();
});
test('admin product layout fits mobile/tablet/desktop and customers load remotely',async()=>{
  const c=await context(true);const p=await c.newPage();
  for(const width of [375,768,1440]){
    await p.setViewportSize({width,height:900});await p.goto(base+'/admin/produk');await p.getByRole('button',{name:'Tambah buku',exact:true}).waitFor();
    const size=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.admin-main > *, .admin-main .catalog-tools > *, .admin-header')].map(e=>({cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth)}));assert.ok(size.scroll<=size.width,JSON.stringify(size));
  }
  await p.goto(base+'/admin/pelanggan');await p.getByRole('cell',{name:'Pelanggan Lain',exact:true}).waitFor();
  await c.close();
});
test('admin loads another customer order, calls COD RPC and refreshes status',async()=>{
  const c=await context(true);const p=await c.newPage();let status='Menunggu pembayaran',rpcCalls=0;
  const order={order_number:'FR-QA-ORDER',created_at:'2026-09-11T00:00:00Z',subtotal:100000,discount:0,shipping:18000,total:118000,courier:'Reguler',payment_method:'COD',customer_note:'',address_snapshot:null,return_reason:'',profiles:{email:'buyer@example.test',name:'Pelanggan Lain'},order_items:[{slug:books[0].slug,title:books[0].title,author:books[0].author,cover_url:books[0].cover_url,format:'fisik',quantity:1,unit_price:100000}]};
  await c.route('**/rest/v1/orders?*',route=>{
    assert.equal(new URL(route.request().url()).searchParams.has('user_id'),false,'admin query must not filter orders to self');
    return route.fulfill({json:[{...order,status,order_status_history:[{status,created_at:order.created_at}]}]});
  });
  await c.route('**/rest/v1/rpc/transition_cod_order',route=>{
    const body=route.request().postDataJSON();assert.equal(body.p_number,order.order_number);assert.equal(body.p_expected,status);
    status=body.p_status;rpcCalls++;return route.fulfill({json:null});
  });
  await p.goto(base+'/admin/pesanan');await p.getByRole('cell',{name:'Pelanggan Lain'}).waitFor();
  await p.getByRole('button',{name:'Kelola',exact:true}).click();
  await p.getByRole('button',{name:'Proses pesanan COD',exact:true}).click();
  await p.getByRole('button',{name:'Tandai dikirim',exact:true}).waitFor();assert.equal(status,'Diproses');assert.equal(rpcCalls,1);
  await p.getByRole('button',{name:'Tandai dikirim',exact:true}).click();
  await p.getByRole('button',{name:'Konfirmasi diterima & COD dibayar',exact:true}).waitFor();assert.equal(status,'Dikirim');assert.equal(rpcCalls,2);
  await c.close();
});
