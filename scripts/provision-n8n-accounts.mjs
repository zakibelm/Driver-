// Account storage and transactional mail for the registration/reset flows requested by the owner.
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
process.loadEnvFile(new URL('../.env.local',import.meta.url));
const statePath=new URL('../audit/n8n-connexion.json',import.meta.url);
const state=JSON.parse(await readFile(statePath,'utf8'));
if(!process.env.N8N_SETUP_API_KEY)throw new Error('Clé API temporaire requise.');
async function api(path,method='GET',body){const r=await fetch(state.instance+'/api/v1'+path,{method,headers:{'X-N8N-API-KEY':process.env.N8N_SETUP_API_KEY,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error(`n8n ${method} ${path}: HTTP ${r.status}`);return d;}
const tables=await api('/data-tables?limit=100');
async function table(name,columns){const old=tables.data.find(t=>t.name===name);if(old)return old.id;return (await api('/data-tables','POST',{name,columns:columns.map(([name,type])=>({name,type}))})).id;}
state.accountsTableId=await table('drivepilot_accounts',[['account_id','string'],['username','string'],['email','string'],['display_name','string'],['salt','string'],['password_hash','string'],['role','string'],['verified','boolean'],['auth_version','string'],['last_mail_at','number']]);
state.actionTokensTableId=await table('drivepilot_account_tokens',[['token_hash','string'],['account_id','string'],['email','string'],['purpose','string'],['expires_at','number'],['used','boolean'],['auth_version','string']]);
const tokenTable=await api('/data-tables/'+state.actionTokensTableId);
if(!tokenTable.columns.some(column=>column.name==='auth_version'))await api('/data-tables/'+state.actionTokensTableId+'/columns','POST',{name:'auth_version',type:'string'});
await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
const nodes=[],connections={};
const link=(a,b,o=0)=>{connections[a]??={main:[]};connections[a].main[o]??=[];connections[a].main[o].push({node:b,type:'main',index:0});};
function node(name,type,parameters,x,y,extra={}){nodes.push({name,id:name.toLowerCase().replaceAll(' ','-'),type:'n8n-nodes-base.'+type,typeVersion:type==='code'?2:type==='webhook'?2:type==='dataTable'?1.1:type==='if'?2.2:type==='emailSend'?2.1:1.4,parameters,position:[x,y],...extra});}
const common=`function obj(v,keys){if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error("invalid");}function str(v,n){if(typeof v!=="string"||!v.trim()||v.length>n)throw Error("text");return v.trim();}function hex(v,n){if(typeof v!=="string"||v.length!==n||!/^[a-f0-9]+$/.test(v))throw Error("hex");return v;}function uuid(v){if(typeof v!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v))throw Error("id");return v;}function email(v){v=str(v,254).toLowerCase();if(!/^[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}$/i.test(v))throw Error("email");return v;}`;
const eq=(keyName,keyValue)=>({keyName,condition:'eq',keyValue});
const tableRef=id=>({__rl:true,mode:'id',value:id});
const good='return [{json:{success:true}}];';
const specs=[
 {name:'Account Get',method:'GET',path:'get',operation:'get',table:state.accountsTableId,match:'anyCondition',check:'obj(input.query,["identifier"]);const data={identifier:str(input.query.identifier,254).toLowerCase()};',filters:[eq('email','={{ $json.data.identifier }}'),eq('username','={{ $json.data.identifier }}')],format:'const rows=$input.all().map(x=>x.json).filter(x=>x.account_id);const verified=rows.filter(x=>x.verified);const candidates=verified.length?verified:rows;return [{json:{success:true,account:candidates.length===1?candidates[0]:null,conflict:candidates.length>1}}];'},
 {name:'Account Create',method:'POST',path:'create',operation:'insert',table:state.accountsTableId,check:'obj(input.body,["id","username","email","name","salt","passwordHash","role","verified","authVersion"]);const b=input.body;if(!["admin","chauffeur"].includes(b.role)||typeof b.verified!=="boolean")throw Error("role");const data={account_id:uuid(b.id),username:str(b.username,254).toLowerCase(),email:email(b.email),display_name:str(b.name,100),salt:hex(b.salt,48),password_hash:hex(b.passwordHash,128),role:b.role,verified:b.verified,auth_version:hex(b.authVersion,64),last_mail_at:0};',format:good},
 {name:'Account Verify',method:'POST',path:'verify',operation:'update',table:state.accountsTableId,check:'obj(input.body,["id"]);const data={id:uuid(input.body.id)};',filters:[eq('account_id','={{ $json.data.id }}')],values:{verified:true},format:good},
 {name:'Password Update',method:'POST',path:'password',operation:'update',table:state.accountsTableId,check:'obj(input.body,["id","salt","passwordHash","authVersion"]);const b=input.body;const data={id:uuid(b.id),salt:hex(b.salt,48),passwordHash:hex(b.passwordHash,128),authVersion:hex(b.authVersion,64)};',filters:[eq('account_id','={{ $json.data.id }}')],values:{salt:'={{ $json.data.salt }}',password_hash:'={{ $json.data.passwordHash }}',auth_version:'={{ $json.data.authVersion }}'},format:good},
 {name:'Token Create',method:'POST',path:'token/create',operation:'insert',table:state.actionTokensTableId,check:'obj(input.body,["hash","id","email","purpose","expires","authVersion"]);const b=input.body;if(!["verify","reset"].includes(b.purpose)||!Number.isFinite(b.expires)||b.expires<=Date.now()||b.expires>Date.now()+86500000)throw Error("expiry");const data={token_hash:hex(b.hash,64),account_id:uuid(b.id),email:email(b.email),purpose:b.purpose,expires_at:b.expires,used:false,auth_version:hex(b.authVersion,64)};',format:good},
 {name:'Token Consume',method:'POST',path:'token/consume',operation:'update',table:state.actionTokensTableId,check:'obj(input.body,["hash","purpose"]);if(!["verify","reset"].includes(input.body.purpose))throw Error("purpose");const data={hash:hex(input.body.hash,64),purpose:input.body.purpose};',filters:[eq('token_hash','={{ $json.data.hash }}'),eq('purpose','={{ $json.data.purpose }}'),eq('used',false),{keyName:'expires_at',condition:'gt',keyValue:'={{ Date.now() }}'}],values:{used:true},format:'const row=$input.all().map(x=>x.json).find(x=>x.account_id&&x.used===true);return [{json:{success:true,token:row?{accountId:row.account_id,email:row.email,purpose:row.purpose,authVersion:row.auth_version}:null}}];'},
];
function start(name,method,path,check,y){
 node('Webhook '+name,'webhook',{httpMethod:method,path:'drivepilot-app/api/accounts/'+path,authentication:'headerAuth',responseMode:'responseNode',options:{}},0,y,{webhookId:randomUUID(),credentials:{httpHeaderAuth:{id:state.credentialId,name:'DrivePilot application - webhook dédié'}}});
 node('Validate '+name,'code',{jsCode:common+'const input=$input.first().json;try{'+check+'return [{json:{valid:true,data}}];}catch{return [{json:{valid:false}}];}'},220,y);
 node('Valid '+name,'if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'valid',leftValue:'={{ $json.valid }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},440,y);
 node('Bad '+name,'respondToWebhook',{respondWith:'json',responseBody:'={{ {error:"Entrée invalide."} }}',options:{responseCode:400}},660,y+120);
 link('Webhook '+name,'Validate '+name);link('Validate '+name,'Valid '+name);link('Valid '+name,'Bad '+name,1);
}
for(const [i,s] of specs.entries()){
 const y=i*300;start(s.name,s.method,s.path,s.check,y);
 const p={resource:'row',operation:s.operation,dataTableId:tableRef(s.table)};let previous='Valid '+s.name;
 if(s.operation==='insert'){node('Prepare '+s.name,'code',{jsCode:'return [{json:$input.first().json.data}];'},660,y);link(previous,'Prepare '+s.name);previous='Prepare '+s.name;p.columns={mappingMode:'autoMapInputData',value:{}};}
 else {p.matchType=s.match||'allConditions';p.filters={conditions:s.filters};if(s.operation==='get'){p.returnAll=false;p.limit=20;}else p.columns={mappingMode:'defineBelow',value:s.values};}
 node('Store '+s.name,'dataTable',p,880,y,{alwaysOutputData:true});link(previous,'Store '+s.name);
 node('Format '+s.name,'code',{jsCode:s.format},1100,y);link('Store '+s.name,'Format '+s.name);
 node('Respond '+s.name,'respondToWebhook',{respondWith:'json',responseBody:'={{ $json }}',options:{responseCode:200}},1320,y);link('Format '+s.name,'Respond '+s.name);
}
const mailY=1900;
start('Send Email','POST','email','obj(input.body,["id","subject","message"]);const b=input.body;const subject=str(b.subject,120);if(/[\\r\\n]/.test(subject))throw Error("subject");const data={id:uuid(b.id),subject,message:str(b.message,4000)};',mailY);
node('Claim Email Slot','dataTable',{resource:'row',operation:'update',dataTableId:tableRef(state.accountsTableId),matchType:'allConditions',filters:{conditions:[eq('account_id','={{ $json.data.id }}'),{keyName:'last_mail_at',condition:'lt',keyValue:'={{ Date.now() - 300000 }}'}]},columns:{mappingMode:'defineBelow',value:{last_mail_at:'={{ Date.now() }}'}}},660,mailY,{alwaysOutputData:true});link('Valid Send Email','Claim Email Slot');
node('Prepare Email','code',{jsCode:'const account=$input.first().json;const input=$("Validate Send Email").first().json.data;return [{json:{send:!!account.account_id,to:account.email||"",subject:input.subject,message:input.message}}];'},880,mailY);link('Claim Email Slot','Prepare Email');
node('Should Send Email','if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'send',leftValue:'={{ $json.send }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},1100,mailY);link('Prepare Email','Should Send Email');
node('SMTP Email','emailSend',{fromEmail:'DrivePilot <noreply@partageons.net>',toEmail:'={{ $json.to }}',subject:'={{ $json.subject }}',emailFormat:'text',text:'={{ $json.message }}',options:{appendAttribution:false}},1320,mailY,{credentials:{smtp:{id:'JyRII45z5beOX6PX',name:'DrivePilot SMTP'}}});link('Should Send Email','SMTP Email');
node('Email Response','respondToWebhook',{respondWith:'json',responseBody:'={{ {success:true} }}',options:{responseCode:200}},1540,mailY);link('SMTP Email','Email Response');link('Should Send Email','Email Response',1);
nodes.push({id:'cleanup-account-tokens',name:'Cleanup expired tokens',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[0,2200],parameters:{rule:{interval:[{field:'hours',hoursInterval:1}]}}});
node('Remove Expired Tokens','dataTable',{resource:'row',operation:'deleteRows',dataTableId:tableRef(state.actionTokensTableId),matchType:'allConditions',filters:{conditions:[{keyName:'expires_at',condition:'lt',keyValue:'={{ Date.now() }}'}]},options:{dryRun:false}},440,2200);link('Cleanup expired tokens','Remove Expired Tokens');
const workflow={name:'DrivePilot - Comptes et récupération',nodes,connections,settings:{executionOrder:'v1',timezone:'America/Toronto',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false}};
for(const n of nodes.filter(n=>n.type.endsWith('.code')))new Function('$input','$',n.parameters.jsCode);
const validateMail=nodes.find(n=>n.name==='Validate Send Email');
if(!new Function('$input',validateMail.parameters.jsCode)({first:()=>({json:{body:{id:randomUUID(),subject:'Confirmation DrivePilot',message:'Message technique'} }})})[0].json.valid)throw Error('Validation du courriel incohérente.');
if(state.accountsWorkflowId){const old=await api('/workflows/'+state.accountsWorkflowId);if(old.active)await api('/workflows/'+state.accountsWorkflowId+'/deactivate','POST',{});await api('/workflows/'+state.accountsWorkflowId,'PUT',workflow);}else{state.accountsWorkflowId=(await api('/workflows','POST',workflow)).id;await writeFile(statePath,JSON.stringify(state,null,2)+'\n');}
await api('/workflows/'+state.accountsWorkflowId+'/activate','POST',{});
await writeFile(new URL('../n8n_workflows/08-accounts-workflow.json',import.meta.url),JSON.stringify({...workflow,active:false},null,2)+'\n');
async function call(path,method='GET',body){const r=await fetch(process.env.N8N_URL+'/'+path,{method,headers:{'X-DrivePilot-Token':process.env.N8N_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||d.success!==true)throw Error('Webhook comptes HTTP '+r.status);return d;}
const admin=JSON.parse(process.env.ADMIN_AUTH_JSON);
if(!(await call('api/accounts/get?identifier='+encodeURIComponent(admin.email))).account)await call('api/accounts/create','POST',{id:admin.id,username:admin.username,email:admin.email,name:admin.username==='admin'?'Administrateur':admin.username,salt:admin.salt,passwordHash:admin.passwordHash,role:'admin',verified:true,authVersion:createHash('sha256').update(admin.salt+':'+admin.passwordHash).digest('hex')});
let config=await readFile(new URL('../.env.local',import.meta.url),'utf8');
for(const [name,value] of Object.entries({ACCOUNT_STORE:'n8n',PUBLIC_APP_URL:'https://drivepilot-zaks-projects-f05d04ab.vercel.app'})){const pattern=new RegExp('^'+name+'=.*$','m'),line=name+'='+value;config=pattern.test(config)?config.replace(pattern,line):config.trimEnd()+'\n'+line+'\n';}
await writeFile(new URL('../.env.local',import.meta.url),config,{mode:0o600});
await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({accountsWorkflowId:state.accountsWorkflowId,active:true,adminSeeded:true,emailsSent:0}));
