import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAccountMiddleware } from './accounts.mjs';
import { createAuthMiddleware } from './auth.mjs';

test('registration requires email confirmation; reset tokens are one-use and revoke existing sessions',async()=>{
 const rows=new Map(),tokens=new Map(),mail=[];
 const accounts={
  async find(identifier){return rows.get(identifier)||null;},
  async create(value){rows.set(value.email,{...value});},
  async verify(id){for(const account of rows.values())if(account.id===id)account.verified=true;},
  async password(id,value){for(const account of rows.values())if(account.id===id)Object.assign(account,value);},
  async token(value){tokens.set(value.hash,value);},
  async consume(hash,purpose){const value=tokens.get(hash);if(!value||value.purpose!==purpose||value.expires<=Date.now())return null;tokens.delete(hash);return {accountId:value.id,email:value.email,purpose,authVersion:value.authVersion};},
  async mail(account,subject,message){mail.push({account,subject,message});},
 };
 const limiter={retryAfter:async()=>0,failure:async()=>{},success:async()=>{}};
 const env={PUBLIC_APP_URL:'https://drivepilot.example.test'};
 const routes=createAccountMiddleware({accounts,limiter,env});
 const auth=createAuthMiddleware(undefined,env,{accounts,limiter});
 const server=createServer((req,res)=>routes(req,res,()=>auth(req,res,()=>{res.statusCode=404;res.end();})));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,body,headers={})=>fetch(base+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const value={name:'Alice',email:'alice@example.test',password:'initial-password-12345'};
 const fromMail=purpose=>new URLSearchParams(mail.at(-1).message.match(/https:\/\/\S+/)[0].split('#')[1]).get(purpose);
 try {
  assert.equal((await post('register',{...value,role:'admin'})).status,400);
  assert.equal((await post('register',{...value,password:'short'})).status,400);
  assert.equal((await post('register',value,{'sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await post('register',value)).status,202);
  assert.equal(rows.get(value.email).role,'chauffeur');
  assert.equal(rows.get(value.email).password,undefined);
  assert.equal((await post('login',{identifier:value.email,password:value.password})).status,403);
  const verify=fromMail('verify');assert.match(verify,/^[a-f0-9]{64}$/);
  assert.equal((await post('verify',{token:verify})).status,200);
  assert.equal((await post('verify',{token:verify})).status,400);
  const login=await post('login',{identifier:value.email,password:value.password});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await auth.getUser({headers:{cookie}})).role,'chauffeur');
  const existing=await (await post('forgot-password',{email:value.email})).json();
  const olderReset=fromMail('reset');
  await post('forgot-password',{email:value.email});
  const unknown=await (await post('forgot-password',{email:'unknown@example.test'})).json();assert.deepEqual(existing,unknown);
  const reset=fromMail('reset');
  assert.equal((await post('reset-password',{token:reset,password:'updated-password-67890'})).status,200);
  assert.equal(await auth.getUser({headers:{cookie}}),null);
  assert.equal((await post('reset-password',{token:reset,password:'another-password-12345'})).status,400);
  assert.equal((await post('reset-password',{token:olderReset,password:'another-password-12345'})).status,400);
  assert.equal((await post('login',{identifier:value.email,password:value.password})).status,401);
  assert.equal((await post('login',{identifier:value.email,password:'updated-password-67890'})).status,200);
  assert.equal(mail.length,3);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
