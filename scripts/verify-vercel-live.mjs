// Uses the authenticated CLI. Credentials and cookies go through stdin only.
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const cli=process.env.VERCEL_CLI_PATH,base=process.env.DRIVEPILOT_DEPLOYMENT_URL;
if(!cli||!base||!process.env.DRIVEPILOT_ADMIN_PASSWORD)throw new Error('Configuration de vérification temporaire requise.');
process.loadEnvFile(new URL('../.env.local',import.meta.url));
const account=JSON.parse(process.env.ADMIN_AUTH_JSON);
const checks=[];let cookie;
function request(path,method='GET',body,useCookie=false) {
 const lines=[`request = ${JSON.stringify(method)}`];
 if(body)lines.push('header = "Content-Type: application/json"',`data-binary = ${JSON.stringify(JSON.stringify(body))}`);
 if(useCookie&&cookie)lines.push(`header = ${JSON.stringify('Cookie: '+cookie)}`);
 const result=spawnSync(process.execPath,[cli,'curl',path,'--deployment',base,'--scope','zaks-projects-f05d04ab','--','--silent','--show-error','--include','--config','-'],{input:lines.join('\n')+'\n',encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});
 if(result.status!==0)throw new Error('La requête Vercel a échoué : '+path);
 const raw=result.stdout,split=raw.indexOf('\r\n\r\n')>=0?'\r\n\r\n':'\n\n';
 const boundary=raw.indexOf(split);const headers=raw.slice(0,boundary);const bodyText=raw.slice(boundary+split.length);
 const status=Number(headers.match(/HTTP\/[\d.]+\s+(\d+)/)?.[1]);
 let data;try{data=JSON.parse(bodyText);}catch{}
 return {status,headers,data};
}
try {
 let r=request('/api/auth/session');checks.push({test:'unauthenticated-session',status:r.status,ok:r.status===401});
 r=request('/api/auth/login','POST',{identifier:account.email,password:process.env.DRIVEPILOT_ADMIN_PASSWORD});
 checks.push({test:'production-login',status:r.status,ok:r.status===200});
 if(r.status!==200)throw new Error('Connexion de production refusée.');
 cookie=r.headers.match(/set-cookie:\s*(taxi_session=[a-f0-9]+)/i)?.[1];
 if(!cookie)throw new Error('Cookie de session absent.');
 checks.push({test:'secure-session-cookie',ok:/set-cookie:[^\r\n]*HttpOnly/i.test(r.headers)&&/set-cookie:[^\r\n]*Secure/i.test(r.headers)});
 r=request('/api/auth/session','GET',null,true);checks.push({test:'persistent-production-session',status:r.status,ok:r.status===200&&r.data?.user?.email===account.email});
 r=request('/api/services','POST',{type:'Régulier',amount:0,date:new Date().toISOString()},true);checks.push({test:'invalid-course-rejected-without-write',status:r.status,ok:r.status===400});
 r=request('/.env.local');checks.push({test:'private-config-blocked',status:r.status,ok:r.status===403});
 r=request('/api/unknown');checks.push({test:'unknown-api-is-not-spa',status:r.status,ok:r.status===404});
} catch(error) { checks.push({test:'verification',ok:false,message:error.message}); }
finally {
 if(cookie) {
  let r=request('/api/auth/logout','POST',null,true);checks.push({test:'production-logout',status:r.status,ok:r.status===200});
  r=request('/api/auth/session','GET',null,true);checks.push({test:'session-revoked-after-logout',status:r.status,ok:r.status===401});
 }
 await writeFile(new URL('../audit/vercel-production-check.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),base,checks},null,2)+'\n');
 console.log(JSON.stringify(checks,null,2));
}
if(checks.some(c=>!c.ok))process.exitCode=1;
