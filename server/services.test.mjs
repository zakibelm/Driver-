import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServicesMiddleware } from './services.mjs';
import { createN8nProvider } from './providers/n8n.mjs';
test('services deny unauthenticated access, ignore forged ownership and restrict deletion',async()=>{
 const own={id:'11111111-1111-4111-8111-111111111111',driver_email:'a@example.test'};
 const other={id:'22222222-2222-4222-8222-222222222222',driver_email:'b@example.test'};
 let created,deleted;
 const middleware=createServicesMiddleware({getUser:req=>req.headers['x-test-user'] ? {role:req.headers['x-test-user'],email:'a@example.test'}:null,provider:{list:async()=>[own,other],create:async data=>(created=data),delete:async(...args)=>{deleted=args;}}});
 const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/services`;
 const headers={'x-test-user':'chauffeur','Content-Type':'application/json'};
 try {
  for(const method of ['GET','POST','DELETE']) assert.equal((await fetch(base,{method})).status,401);
  assert.deepEqual((await (await fetch(base,{headers})).json()).services,[own]);
  assert.equal((await fetch(base+'?email=b@example.test',{headers})).status,400);
  assert.equal((await fetch(base+'/'+other.id,{method:'DELETE',headers})).status,404);
  assert.equal(deleted,undefined);
  assert.equal((await fetch(base+'/'+own.id,{method:'DELETE',headers})).status,200);
  assert.deepEqual(deleted,[own.id,own.driver_email]);
  const input={type:'Regular',amount:30,date:'2026-10-12T12:00:00.000Z'};
  assert.equal((await fetch(base,{method:'POST',headers,body:JSON.stringify({...input,driver_email:other.driver_email})})).status,400);
  assert.equal((await fetch(base,{method:'POST',headers,body:JSON.stringify(input)})).status,201);
  assert.equal(created.driver_email,own.driver_email);
  assert.equal((await (await fetch(base,{headers:{'x-test-user':'admin'}})).json()).services.length,2);
  assert.equal((await fetch(base+'/'+other.id,{method:'DELETE',headers:{'x-test-user':'admin'}})).status,200);
 } finally { await new Promise(r=>server.close(r)); }
});
test('n8n provider fails closed and scopes requests using server identity',async()=>{
 await assert.rejects(createN8nProvider({}).list({role:'admin'}),e=>e.status===503);
 let request;
 const provider=createN8nProvider({N8N_URL:'https://n8n.example.test/webhook',N8N_TOKEN:'test-token'},async(url,options)=>{request={url,options};return {ok:true,json:async()=>({success:true,services:[{driver_email:'other@example.test'}]})};});
 assert.deepEqual(await provider.list({role:'chauffeur',email:'a@example.test'}),[]);
 assert.match(request.url,/\/api\/services\/list$/);
 assert.equal(request.options.method,'POST');
 assert.deepEqual(JSON.parse(request.options.body),{email:'a@example.test'});
 await provider.delete('11111111-1111-4111-8111-111111111111','a@example.test');
 assert.match(request.url,/\/api\/services\/delete$/);
 assert.deepEqual(JSON.parse(request.options.body),{id:'11111111-1111-4111-8111-111111111111',driver_email:'a@example.test'});
 assert.equal(request.options.headers['X-DrivePilot-Token'],'test-token');
});
