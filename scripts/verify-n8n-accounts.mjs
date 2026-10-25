// Tests only a generated @example.test account; never sends mail and removes its own rows.
import { randomUUID, randomBytes, scryptSync, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createN8nSecurity } from '../server/n8n-security.mjs';
import { createAccountStore, accountVersion } from '../server/accounts.mjs';
import { createAuthMiddleware } from '../server/auth.mjs';
process.loadEnvFile(new URL('../.env.local',import.meta.url));
if(!process.env.N8N_SETUP_API_KEY)throw new Error('Clé API temporaire requise pour le nettoyage ciblé.');
const state=JSON.parse(await readFile(new URL('../audit/n8n-connexion.json',import.meta.url),'utf8'));
const id=randomUUID(),email=`account-check-${id}@example.test`,session=randomBytes(32).toString('hex');
const security=createN8nSecurity(process.env),accounts=createAccountStore(security.request);
const auth=createAuthMiddleware(undefined,process.env,{accounts,sessionStore:security.sessions,limiter:security.limiter});
const salt=randomBytes(24).toString('hex'),passwordHash=scryptSync('fixture-password-12345',salt,64).toString('hex');
const checks=[];
async function api(path,method='GET',body){const r=await fetch(state.instance+'/api/v1'+path,{method,headers:{'X-N8N-API-KEY':process.env.N8N_SETUP_API_KEY,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('API de nettoyage HTTP '+r.status);return d;}
const filter={type:'and',filters:[{columnName:'account_id',condition:'eq',value:id},{columnName:'email',condition:'eq',value:email}]};
try{
 await accounts.create({id,email,username:email,name:'Compte technique temporaire',salt,passwordHash,role:'chauffeur',verified:false,authVersion:accountVersion(salt,passwordHash)});
 let account=await accounts.find(email);checks.push({test:'unverified-account-stored',ok:account?.id===id&&!account.verified&&account.role==='chauffeur'});
 await accounts.verify(id);account=await accounts.find(email);checks.push({test:'account-email-confirmed',ok:account.verified});
 await security.sessions.set(session,{user:{id,email,name:'Compte technique temporaire',role:'chauffeur'},expires:Date.now()+60000,authVersion:account.authVersion});
 const req={headers:{cookie:'taxi_session='+session}};
 checks.push({test:'verified-account-session',ok:(await auth.getUser(req))?.id===id});
 const hash=createHash('sha256').update(randomBytes(32)).digest('hex');
 await accounts.token({hash,id,email,purpose:'reset',expires:Date.now()+300000,authVersion:account.authVersion});
 const consumed=await Promise.all([accounts.consume(hash,'reset'),accounts.consume(hash,'reset')]);
 checks.push({test:'reset-token-consumed-once-under-concurrency',ok:consumed.filter(Boolean).length===1});
 const nextSalt=randomBytes(24).toString('hex'),nextHash=scryptSync('updated-fixture-password-67890',nextSalt,64).toString('hex');
 await accounts.password(id,{salt:nextSalt,passwordHash:nextHash,authVersion:accountVersion(nextSalt,nextHash)});
 account=await accounts.find(email);checks.push({test:'password-updated',ok:account.passwordHash===nextHash&&account.salt===nextSalt});
 checks.push({test:'old-session-invalid-after-password-change',ok:await auth.getUser(req)===null});
}catch(error){checks.push({test:'account-storage',ok:false,message:error.message});}
finally{
 await security.sessions.delete(session);
 for(const table of [state.actionTokensTableId,state.accountsTableId]){
  await api('/data-tables/'+table+'/rows/delete?filter='+encodeURIComponent(JSON.stringify(filter))+'&returnData=false','DELETE');
  const remaining=await api('/data-tables/'+table+'/rows?filter='+encodeURIComponent(JSON.stringify(filter))+'&limit=1');
  checks.push({test:table===state.accountsTableId?'temporary-account-removed':'temporary-token-removed',ok:Array.isArray(remaining.data)&&remaining.data.length===0});
 }
 await writeFile(new URL('../audit/accounts-storage-check.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),checks,emailsSent:0},null,2)+'\n');
 console.log(JSON.stringify({checks,emailsSent:0},null,2));
}
if(checks.some(c=>!c.ok))process.exitCode=1;
