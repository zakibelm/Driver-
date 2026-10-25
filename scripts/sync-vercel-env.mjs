// Pipe only the required variables into the authenticated CLI. Never print secret values.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
process.loadEnvFile(new URL('../.env.local',import.meta.url));
const cli=process.env.VERCEL_CLI_PATH;
if(!cli)throw new Error('VERCEL_CLI_PATH requis.');
const project=JSON.parse(readFileSync(new URL('../.vercel/project.json',import.meta.url),'utf8'));
if(project.projectId!=='prj_3ZGOiqAKxnmAfa4DZnuSoroykpEg'||project.orgId!=='team_EndMEA9hbrmj92cWFT0quuYF')throw new Error('Projet Vercel inattendu.');
const keys=['N8N_URL','N8N_TOKEN','ADMIN_AUTH_JSON','AUTH_SESSION_STORE'];
if(process.env.OPENROUTER_API_KEY)keys.push('OPENROUTER_API_KEY');
for(const name of keys) {
 if(!process.env[name])throw new Error('Variable manquante : '+name);
 const secret=['N8N_TOKEN','ADMIN_AUTH_JSON','OPENROUTER_API_KEY'].includes(name);
 const args=[cli,'env','add',name,'production','--scope','zaks-projects-f05d04ab',...(secret?['--sensitive']:[])];
 const result=spawnSync(process.execPath,args,{input:process.env[name]+'\n',encoding:'utf8',windowsHide:true,timeout:120000});
 if(result.status!==0) {
  let message=String(result.stderr||result.error?.message||'');
  for(const key of keys)if(process.env[key])message=message.replaceAll(process.env[key],'[secret]');
  console.error(name+': '+message.slice(-500));process.exit(1);
 }
 console.log(name+': configurée en production'+(secret?' (secrète)':''));
}
