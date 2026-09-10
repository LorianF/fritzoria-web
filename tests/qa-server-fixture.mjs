// Loaded only by the isolated regression server, never by the application build.
import {books} from './qa-fixtures.mjs';
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.pathname==='/rest/v1/books'){
    const slug=url.searchParams.get('slug')?.replace(/^eq\./,'');
    return Response.json(slug?books.filter(b=>b.slug===slug):books);
  }
  if(!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('External request blocked in QA fixture server');
  return original(input,init);
};
