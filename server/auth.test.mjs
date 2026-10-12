import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createAuthMiddleware } from './auth.mjs';
test('real session cookie, rejection, rate limit isolation and logout',async()=>{
 let time=100000;
 const password='test-only-password';
 const passwordHash=(await promisify(scrypt)(password,'test-salt',64)).toString('hex');
 const auth=createAuthMiddleware(undefined,{NODE_ENV:'production'},{now:()=>time,loadAccounts:async()=>[{id:'test',username:'admin',email:'admin@example.test',salt:'test-salt',passwordHash}]});
 const server=createServer((req,res)=>auth(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const login=(identifier,password)=>fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password})});
 try {
  { const r=await fetch(base+'/api/auth/session'); assert.equal(r.status,200); assert.equal((await r.json()).user,null); }
  assert.equal((await login('unknown','bad')).status,401);
  assert.equal((await login('unknown','bad')).status,429);
  const response=await login(' ADMIN@EXAMPLE.TEST ',password);
  assert.equal(response.status,200);
  assert.equal((await response.json()).user.role,'admin');
  const cookie=response.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/Secure/);
  const headers={Cookie:cookie.split(';')[0]};
  assert.equal((await fetch(base+'/api/auth/session',{headers})).status,200);
  assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers})).status,200);
  { const r=await fetch(base+'/api/auth/session',{headers}); assert.equal(r.status,200); assert.equal((await r.json()).user,null); }
  time+=2000;assert.equal((await login('unknown','bad')).status,401);
  assert.equal((await login('admin','bad')).status,401);
  assert.equal((await login('admin',password)).status,429);
  time+=2000;assert.equal((await login('admin',password)).status,200);
  assert.equal((await login('admin','x'.repeat(257))).status,400);
 } finally { await new Promise(r=>server.close(r)); }
});
