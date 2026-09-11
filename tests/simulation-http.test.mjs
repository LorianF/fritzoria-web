import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const base='http://127.0.0.1:5177';let server,logs='';
before(async()=>{
 server=spawn(process.execPath,['--import','./tests/simulation-server-fixture.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5177'],{env:{...process.env,VERCEL_ENV:'preview',XENDIT_SECRET_KEY:'xnd_development_fixture'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.equal(server.exitCode,null,logs);
});
after(()=>server?.kill());
test('HTTP checkout sandbox: guards, server quote, one session per retry and verified history',async()=>{
 const body={key:crypto.randomUUID(),channel:'DANA',courier:'Reguler',lines:[{slug:'uji',format:'fisik',qty:2}],expectedTotal:218000};
 const post=(value=body,token='admin',origin=base)=>fetch(base+'/api/payments/test-orders',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(value)});
 assert.equal((await post(body,null)).status,401);
 assert.equal((await post(body,'customer')).status,403);
 assert.equal((await post(body,'admin','https://evil.test')).status,403);
 assert.equal((await post({...body,channel:'QRIS'})).status,400);
 assert.equal((await post({...body,expectedTotal:1})).status,409);
 const first=await post();assert.equal(first.status,201,await first.clone().text());
 const result=await first.json();assert.equal(result.order.total,218000);assert.equal(result.payment.status,'ACTIVE');
 const replay=await (await post()).json();assert.equal(replay.payment.id,result.payment.id);assert.equal(replay.payment.status,'COMPLETED');
 const get=path=>fetch(base+'/api/payments/test-orders'+path,{headers:{Authorization:'Bearer admin'}});
 assert.equal((await (await get('')).json()).orders.length,1);
 assert.equal((await (await get('?id='+body.key)).json()).payment.status,'COMPLETED');
 assert.equal((await get('?id=invalid')).status,400);
 assert.equal((await get('?id='+crypto.randomUUID())).status,404);
});
