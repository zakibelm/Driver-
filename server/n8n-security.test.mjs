import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createN8nSecurity } from './n8n-security.mjs';
import { createAuthMiddleware } from './auth.mjs';
import { jsonBody } from './http.mjs';

test('shared n8n sessions work across instances and logout revokes both',async()=>{
 const sessions=new Map(),requests=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url);const body=options.body?JSON.parse(options.body):null;requests.push({url,body});
  let result={success:true};
  if(u.pathname.endsWith('/session/create')) sessions.set(body.hash,{user:body.user,expires:body.expires});
  if(u.pathname.endsWith('/session/get')) result.session=sessions.get(u.searchParams.get('hash')) || null;
  if(u.pathname.endsWith('/session/delete')) sessions.delete(body.hash);
  if(u.pathname.endsWith('/rate/check')) result.retryAfter=0;
  return {ok:true,json:async()=>result};
 };
 const env={N8N_URL:'https://n8n.example.test/webhook/drivepilot-app',N8N_TOKEN:'fixture-secret',ADMIN_AUTH_JSON:JSON.stringify({id:'a',username:'admin',email:'admin@example.test',salt:'fixture',passwordHash:scryptSync('fixture-password','fixture',64).toString('hex'),role:'admin'})};
 const security=createN8nSecurity(env,fetcher);
 const a=createAuthMiddleware(undefined,env,{sessionStore:security.sessions,limiter:security.limiter});
 const b=createAuthMiddleware(undefined,env,{sessionStore:security.sessions,limiter:security.limiter});
 const server=createServer((req,res)=>a(req,res,()=>res.end()));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const login=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'admin',password:'fixture-password'})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const req={headers:{cookie}};
  assert.equal((await b.getUser(req)).role,'admin');
  assert.equal(JSON.stringify(requests).includes(cookie.split('=')[1]),false);
  assert.equal(JSON.stringify(requests.filter(r=>r.url.includes('/rate/'))).includes('admin@example.test'),false);
  await security.sessions.delete(cookie.split('=')[1]);
  assert.equal(await a.getUser(req),null);
  assert.equal(await b.getUser(req),null);
 } finally {await new Promise(r=>server.close(r));}
});

test('pre-parsed serverless JSON retains the request size limit',async()=>{
 const headers={'content-type':'application/json'};
 assert.deepEqual(await jsonBody({headers,body:{message:'hello'}},100),{message:'hello'});
 await assert.rejects(jsonBody({headers,body:{message:'x'.repeat(200)}},100),e=>e.status===413);
});

test('shared login throttling enforces backoff and resets on success',()=>{
 const workflow=JSON.parse(readFileSync('n8n_workflows/07-auth-production-workflow.json'));
 const code=workflow.nodes.find(n=>n.name==='Format Rate Check').parameters.jsCode;
 const now=1000000,identity={ip:'ip',account:'account'};
 const run=rows=>new Function('$input','$','Date',code)({all:()=>rows.map(json=>({json}))},()=>({first:()=>({json:{data:identity}})}),{now:()=>now})[0].json;
 const failure={ip_hash:'ip',account_hash:'account',created_ms:now,successful:false};
 assert.equal(run([failure]).retryAfter,1);
 assert.equal(run([failure,{...failure,created_ms:now+1,successful:true}]).retryAfter,0);
 assert.equal(run(Array.from({length:1000},()=>failure)).retryAfter,60);
});
