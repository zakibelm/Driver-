import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createAuthMiddleware } from './auth.mjs';
import { createServicesMiddleware } from './services.mjs';
test('actual server sessions enforce ownership and admin role',async()=>{
 const passwordHash=(await promisify(scrypt)('fixture-password','fixture-salt',64)).toString('hex');
 const accounts=['alice','bob','admin'].map(username=>({id:username,username,email:username+'@example.test',role:username==='admin'?'admin':'chauffeur',salt:'fixture-salt',passwordHash}));
 const auth=createAuthMiddleware(undefined,{}, {loadAccounts:async()=>accounts});
 let rows=[{id:'11111111-1111-4111-8111-111111111111',driver_email:accounts[0].email},{id:'22222222-2222-4222-8222-222222222222',driver_email:accounts[1].email}];
 const api=createServicesMiddleware({getUser:auth.getUser,provider:{list:async()=>rows,create:async input=>input,delete:async(id)=>{rows=rows.filter(s=>s.id!==id);}}});
 const server=createServer((req,res)=>auth(req,res,()=>api(req,res,()=>{res.statusCode=404;res.end();})));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function login(identifier) {
  const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password:'fixture-password'})});
  assert.equal(r.status,200);return {Cookie:r.headers.get('set-cookie').split(';')[0]};
 }
 try {
  assert.equal((await fetch(base+'/api/services',{headers:{Cookie:'taxi_session=fake','x-role':'admin'}})).status,401);
  const alice=await login('alice');
  const list=await (await fetch(base+'/api/services',{headers:alice})).json();assert.equal(list.services.length,1);assert.equal(list.services[0].driver_email,'alice@example.test');
  assert.equal((await fetch(base+'/api/services/'+rows[1].id,{method:'DELETE',headers:alice})).status,404);
  const admin=await login('admin');assert.equal((await (await fetch(base+'/api/services',{headers:admin})).json()).services.length,2);
  assert.equal((await fetch(base+'/api/services/'+rows[1].id,{method:'DELETE',headers:admin})).status,200);
  await fetch(base+'/api/auth/logout',{method:'POST',headers:admin});
  assert.equal((await fetch(base+'/api/services',{headers:admin})).status,401);
 } finally { await new Promise(r=>server.close(r)); }
});
