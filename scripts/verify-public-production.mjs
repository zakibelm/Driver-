// Checks the public production alias with no Vercel bypass; does not create courses or send mail.
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
process.loadEnvFile(new URL('../.env.local',import.meta.url));
const base=process.env.PUBLIC_APP_URL;
if(!base||new URL(base).protocol!=='https:'||!process.env.DRIVEPILOT_ADMIN_PASSWORD)throw Error('Configuration de vérification temporaire requise.');
const account=JSON.parse(process.env.ADMIN_AUTH_JSON);let cookie;const checks=[];
async function request(path,method='GET',body,authenticated=false){
 const res=await fetch(new URL(path,base),{method,redirect:'manual',headers:{...(body?{'Content-Type':'application/json'}:{}),...(authenticated&&cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 const raw=await res.text();let data;try{data=JSON.parse(raw);}catch{}
 return {status:res.status,headers:res.headers,data,raw};
}
try {
 let r=await request('/');checks.push({test:'public-login-page',status:r.status,ok:r.status===200&&r.raw.includes('DrivePilot')});
 r=await request('/api/auth/session');checks.push({test:'unauthenticated-api-protected',status:r.status,ok:r.status===401});
 r=await request('/api/auth/login','POST',{identifier:account.email,password:process.env.DRIVEPILOT_ADMIN_PASSWORD});checks.push({test:'real-account-login',status:r.status,ok:r.status===200});
 if(r.status!==200)throw Error('La connexion réelle a échoué.');
 cookie=r.headers.get('set-cookie')?.match(/taxi_session=[a-f0-9]+/)?.[0];if(!cookie)throw Error('Cookie absent.');
 checks.push({test:'secure-cookie',ok:/HttpOnly/i.test(r.headers.get('set-cookie'))&&/Secure/i.test(r.headers.get('set-cookie'))});
 r=await request('/api/auth/session','GET',null,true);checks.push({test:'persistent-session',status:r.status,ok:r.status===200&&r.data?.user?.email===account.email});
 r=await request('/api/services','POST',{type:'Régulier',amount:0,date:new Date().toISOString()},true);checks.push({test:'invalid-course-rejected-without-write',status:r.status,ok:r.status===400});
 r=await request('/api/auth/register','POST',{name:'Fixture',email:'test@drivepilot.com',password:'fixture-password-12345',role:'admin'});checks.push({test:'registration-role-injection-refused',status:r.status,ok:r.status===400});
 r=await request('/api/auth/forgot-password','POST',{email:`unknown-${randomUUID()}@example.test`});checks.push({test:'forgot-password-generic-response-no-mail',status:r.status,ok:r.status===202});
 r=await request('/api/auth/reset-password','POST',{token:'0'.repeat(64),password:'fixture-new-password-12345'});checks.push({test:'invalid-reset-link-refused',status:r.status,ok:r.status===400});
 r=await request('/api/chat','POST',{message:'Réponds uniquement par le mot OK.',includeServices:false},true);checks.push({test:'authorized-ai-gateway',status:r.status,ok:r.status===200&&typeof r.data?.response==='string'&&r.data.response.trim().length>0});
 r=await request('/.env.local');checks.push({test:'private-files-blocked',status:r.status,ok:r.status===403});
}catch(error){checks.push({test:'verification',ok:false,message:error.message});}
finally{
 if(cookie){let r=await request('/api/auth/logout','POST',null,true);checks.push({test:'logout',status:r.status,ok:r.status===200});r=await request('/api/auth/session','GET',null,true);checks.push({test:'session-revoked',status:r.status,ok:r.status===401});}
 await writeFile(new URL('../audit/public-production-check.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),base,checks,emailsSent:0,coursesCreated:0},null,2)+'\n');
 console.log(JSON.stringify(checks,null,2));
}
if(checks.some(check=>!check.ok))process.exitCode=1;
