import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('checkout PostgreSQL transaction, ownership and retry behavior', async t => {
  const db = new PGlite();
  const user = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const address = '00000000-0000-4000-8000-000000000003';
  const key = '00000000-0000-4000-8000-000000000004';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;`);
    const core = await readFile(new URL('../supabase/migrations/202609090001_fritzoria_core.sql', import.meta.url), 'utf8');
    await db.exec(core.replace('create extension if not exists pgcrypto;', ''));
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text);
      alter table storage.objects enable row level security;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202609090002_admin_books.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202609090003_categories.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202609100001_checkout.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202609110001_qa_cod.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [user,'buyer@example.test',other,'other@example.test']);
    await db.query(`insert into public.addresses(id,user_id,label,recipient_name,phone,city,province,postal_code,street) values ($1,$2,'Rumah','Buyer','08123456789','Jakarta','Jakarta','12345','Jalan Uji')`, [address,user]);
    await db.exec(`insert into public.categories(name) values ('Fiksi');
      insert into public.books(slug,title,author,category,language,cover_url,source_url,summary,physical_price,original_price,stock)
      values ('uji','Buku Uji','Penulis','Fiksi','Indonesia','/cover.jpg','https://example.test','Buku untuk uji checkout',100000,100000,5);`);
    const lines = [{ slug:'uji', format:'fisik', qty:2 }];
    const call = (changes={}) => db.query('select public.create_cod_order($1,$2,$3::jsonb,$4,$5,$6) as number', [changes.key || key, changes.address || address, JSON.stringify(changes.lines || lines), changes.courier || 'Reguler', '', changes.total ?? 218000]);
    await t.test('rejects anonymous checkout', async () => { await assert.rejects(call(), /Masuk terlebih dahulu/); });
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
    await t.test('rejects another user address', async () => { await assert.rejects(call(), /Alamat belum tersimpan/); });
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
    await t.test('rejects tampered totals and invalid carts without stock changes', async () => {
      await assert.rejects(call({total:1}), /Harga buku berubah/);
      await assert.rejects(call({lines:[{slug:'uji',format:'fisik',qty:6}]}), /Stok tidak cukup/);
      await assert.rejects(call({lines:[...lines,...lines]}), /duplikat/);
      await assert.rejects(call({lines:[{slug:'uji',format:'ebook',qty:1}]}), /COD hanya/);
      await assert.rejects(call({lines:[{slug:'uji',format:'fisik',qty:1.5}]}), /COD hanya/);
      assert.equal((await db.query('select stock from books')).rows[0].stock,5);
      assert.equal((await db.query('select count(*)::integer as count from orders')).rows[0].count,0);
    });
    await db.exec('set role authenticated');
    await t.test('authenticated RPC creates unpaid COD and retries return the same order', async () => {
      const first = (await call()).rows[0].number;
      const retry = (await call()).rows[0].number;
      assert.equal(first,retry);
      assert.equal((await db.query('select count(*)::integer as count from orders')).rows[0].count,1);
      const order = (await db.query('select * from orders')).rows[0];
      assert.equal(order.status,'Menunggu pembayaran'); assert.equal(order.payment_method,'COD'); assert.equal(order.total,218000);
      assert.equal((await db.query('select stock from books')).rows[0].stock,3);
      assert.equal((await db.query('select quantity from order_items')).rows[0].quantity,2);
      assert.equal((await db.query('select count(*)::integer as count from order_status_history')).rows[0].count,1);
    });
    await t.test('RLS hides the order from another customer and direct writes remain denied', async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
      assert.equal((await db.query('select * from orders')).rows.length,0);
      assert.equal((await db.query('select * from order_items')).rows.length,0);
      await assert.rejects(db.query("update orders set status='Selesai'"), /permission denied/);
    });
    const admin = '00000000-0000-4000-8000-000000000005';
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email) values ($1,$2)',[admin,'admin@example.test']);
    await db.query("update profiles set role='admin' where id=$1",[admin]);
    const number = (await db.query('select order_number from orders')).rows[0].order_number;
    const change = (from,to,reason='',id=number) => db.query('select transition_cod_order($1,$2,$3,$4)',[id,from,to,reason]);
    const asUser = id => db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec('set role authenticated');
    await t.test('other customer cannot transition an order; owner cannot ship or skip statuses', async () => {
      await asUser(other);
      await assert.rejects(change('Menunggu pembayaran','Dibatalkan'),/akses ditolak/);
      await asUser(user);
      await assert.rejects(change('Menunggu pembayaran','Dikirim'),/tidak diizinkan/);
      await assert.rejects(change('Menunggu pembayaran','Selesai'),/tidak diizinkan/);
    });
    await t.test('admin sees customer ownership and processes COD without online payment', async () => {
      await asUser(admin);
      const rows = (await db.query('select o.user_id,p.email from orders o join profiles p on p.id=o.user_id')).rows;
      assert.equal(rows.length,1); assert.equal(rows[0].email,'buyer@example.test');
      await change('Menunggu pembayaran','Diproses');
      await assert.rejects(change('Menunggu pembayaran','Dikirim'),/Status sudah berubah/);
      await change('Diproses','Dikirim');
      await change('Diproses','Dikirim'); // retry must not duplicate history
      assert.equal((await db.query("select count(*)::int as n from order_status_history where status='Dikirim'")).rows[0].n,1);
    });
    await t.test('owner confirms delivery, submits validated return; only admin can restock', async () => {
      await asUser(user); await change('Dikirim','Selesai');
      await assert.rejects(change('Selesai','Retur diajukan','short'),/10–1000/);
      await change('Selesai','Retur diajukan','Buku rusak saat diterima');
      assert.equal((await db.query('select return_reason from orders')).rows[0].return_reason,'Buku rusak saat diterima');
      await assert.rejects(change('Retur diajukan','Dikembalikan'),/tidak diizinkan/);
      await asUser(admin); await change('Retur diajukan','Dikembalikan');
      await change('Retur diajukan','Dikembalikan');
      assert.equal((await db.query('select stock from books')).rows[0].stock,5);
      assert.equal((await db.query("select count(*)::int as n from order_status_history where status='Dikembalikan'")).rows[0].n,1);
      await assert.rejects(change('Dikembalikan','Diproses'),/tidak diizinkan/);
    });
    await t.test('owner cancellation restocks once and free shipping applies above threshold', async () => {
      await asUser(user);
      const newKey='00000000-0000-4000-8000-000000000006';
      const id=(await call({key:newKey,lines:[{slug:'uji',format:'fisik',qty:3}],total:300000})).rows[0].number;
      assert.equal((await db.query('select shipping from orders where order_number=$1',[id])).rows[0].shipping,0);
      await change('Menunggu pembayaran','Dibatalkan','',id);
      await change('Menunggu pembayaran','Dibatalkan','',id);
      assert.equal((await db.query('select stock from books')).rows[0].stock,5);
    });
  } finally { await db.close(); }
});
