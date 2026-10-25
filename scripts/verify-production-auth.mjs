import { createServer } from 'node:http';
import { createAuthMiddleware } from '../server/auth.mjs';
import { createN8nSecurity } from '../server/n8n-security.mjs';
import { writeFile } from 'node:fs/promises';
process.loadEnvFile(new URL('../.env.local',import.meta.url));
if(!process.env.DRIVEPILOT_ADMIN_PASSWORD) throw new Error('Mot de passe de vérification temporaire requis.');
const account=JSON.parse(process.env.ADMIN_AUTH_JSON);
const env={...process.env,NODE_ENV:'production'};
const security=createN8nSecurity(env);
const a=createAuthMiddleware(undefined,env,{sessionStore:security.sessions,limiter:security.limiter});
const b=createAuthMiddleware(undefined,env,{sessionStore:security.sessions,limiter:security.limiter});
const server=createServer((req,res)=>a(req,res,()=>{res.statusCode=404;res.end();}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let cookie;const checks=[];
try {
 const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:account.email,password:process.env.DRIVEPILOT_ADMIN_PASSWORD})});
 checks.push({test:'real-account-login',status:response.status,ok:response.status===200});
 if(response.status!==200) throw new Error('La connexion réelle a échoué.');
 cookie=response.headers.get('set-cookie').split(';')[0];
 checks.push({test:'secure-cookie',ok:/HttpOnly/.test(response.headers.get('set-cookie'))&&/Secure/.test(response.headers.get('set-cookie'))});
 const user=await b.getUser({headers:{cookie}});
 checks.push({test:'session-visible-on-second-instance',ok:user?.email===account.email&&user.role==='admin'});
} finally {
 if(cookie) {
  const response=await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie}});
  checks.push({test:'logout',ok:response.status===200});
  checks.push({test:'revoked-on-both-instances',ok:await a.getUser({headers:{cookie}})===null&&await b.getUser({headers:{cookie}})===null});
 }
 await new Promise(r=>server.close(r));
 await writeFile(new URL('../audit/production-auth-check.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),checks},null,2)+'\n');
 console.log(JSON.stringify(checks,null,2));
}
if(checks.some(c=>!c.ok)) process.exitCode=1;
