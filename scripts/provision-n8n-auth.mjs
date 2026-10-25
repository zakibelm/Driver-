// Provision only DrivePilot production sessions and login throttling. Never saves the management key.
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const statePath=new URL('../audit/n8n-connexion.json',import.meta.url);
const state=JSON.parse(await readFile(statePath,'utf8'));
const key=process.env.N8N_SETUP_API_KEY;
if(!key) throw new Error('Clé API temporaire requise.');
async function api(path,method='GET',body) {
 const r=await fetch(state.instance+'/api/v1'+path,{method,headers:{'X-N8N-API-KEY':key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok) throw new Error(`n8n ${method} ${path}: HTTP ${r.status}`);
 return data;
}
const tables=await api('/data-tables?limit=100');
async function table(name,columns) {
 const existing=tables.data.find(t=>t.name===name);
 if(existing) return existing.id;
 const result=await api('/data-tables','POST',{name,columns:columns.map(([name,type])=>({name,type}))});
 return result.id;
}
state.sessionsTableId=await table('drivepilot_sessions',[['session_hash','string'],['user_json','string'],['expires_at','number']]);
state.loginAttemptsTableId=await table('drivepilot_login_attempts',[['ip_hash','string'],['account_hash','string'],['successful','boolean'],['created_ms','number']]);
await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
const nodes=[],connections={};
const link=(a,b,output=0)=>{connections[a]??={main:[]};connections[a].main[output]??=[];connections[a].main[output].push({node:b,type:'main',index:0});};
function node(name,type,parameters,x,y,extra={}) {nodes.push({name,id:name.toLowerCase().replaceAll(' ','-'),type:'n8n-nodes-base.'+type,typeVersion:type==='code'?2:type==='webhook'?2:type==='dataTable'?1.1:type==='if'?2.2:1.4,parameters,position:[x,y],...extra});}
const common=`function obj(v,keys){if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error("invalid");}function hash(v){if(typeof v!=="string"||!/^[a-f0-9]{64}$/.test(v))throw Error("hash");return v;}`;
const condition=(keyName,keyValue)=>({keyName,condition:'eq',keyValue});
const specs=[
 {name:'Session Create',method:'POST',path:'session/create',table:state.sessionsTableId,operation:'insert',check:`obj(input.body,["hash","user","expires","authVersion"]);const b=input.body;obj(b.user,["id","email","name","role"]);if(!["admin","chauffeur"].includes(b.user.role)||!["string","number"].includes(typeof b.user.id)||typeof b.user.email!=="string"||typeof b.user.name!=="string"||!b.user.name||b.user.name.length>100||!Number.isFinite(b.expires)||b.expires<=Date.now()||b.expires>Date.now()+28900000)throw Error("session");const data={session_hash:hash(b.hash),user_json:JSON.stringify(b.authVersion?{user:b.user,authVersion:hash(b.authVersion)}:b.user),expires_at:b.expires};`,format:'return [{json:{success:true}}];'},
 {name:'Session Get',method:'GET',path:'session/get',table:state.sessionsTableId,operation:'get',check:'obj(input.query,["hash"]);const data={hash:hash(input.query.hash)};',filters:[condition('session_hash','={{ $json.data.hash }}')],format:`const row=$input.all().map(x=>x.json).find(x=>x.session_hash&&x.expires_at>Date.now());const value=row?JSON.parse(row.user_json):null;return [{json:{success:true,session:row?{user:value.user||value,expires:row.expires_at,...(value.authVersion?{authVersion:value.authVersion}:{})}:null}}];`},
 {name:'Session Delete',method:'DELETE',path:'session/delete',table:state.sessionsTableId,operation:'deleteRows',check:'obj(input.body,["hash"]);const data={hash:hash(input.body.hash)};',filters:[condition('session_hash','={{ $json.data.hash }}')],format:'return [{json:{success:true}}];'},
 {name:'Rate Check',method:'GET',path:'rate/check',table:state.loginAttemptsTableId,operation:'get',matchType:'anyCondition',check:'obj(input.query,["ip","account"]);const data={ip:hash(input.query.ip),account:hash(input.query.account)};',filters:[condition('ip_hash','={{ $json.data.ip }}'),condition('account_hash','={{ $json.data.account }}')],format:`const identity=$("Validate Rate Check").first().json.data;const now=Date.now();const raw=$input.all().map(x=>x.json);if(raw.length>=1000)return [{json:{success:true,retryAfter:60}}];const rows=raw.filter(x=>Number.isFinite(x.created_ms)&&x.created_ms>now-900000);const success=rows.filter(x=>x.successful);const lastAccount=Math.max(0,...success.filter(x=>x.account_hash===identity.account).map(x=>x.created_ms));const lastPair=Math.max(0,...success.filter(x=>x.account_hash===identity.account&&x.ip_hash===identity.ip).map(x=>x.created_ms));const failures=rows.filter(x=>!x.successful);const pair=failures.filter(x=>x.account_hash===identity.account&&x.ip_hash===identity.ip&&x.created_ms>lastPair);const ip=failures.filter(x=>x.ip_hash===identity.ip);const account=failures.filter(x=>x.account_hash===identity.account&&x.created_ms>lastAccount);function next(items,free){return items.length<=free?0:Math.max(...items.map(x=>x.created_ms))+Math.min(60000,1000*2**Math.min(items.length-free-1,6));}const retryAfter=Math.max(0,Math.min(60,Math.ceil((Math.max(next(pair,0),next(ip,20),next(account,30))-now)/1000)));return [{json:{success:true,retryAfter}}];`},
 {name:'Rate Record',method:'POST',path:'rate/record',table:state.loginAttemptsTableId,operation:'insert',check:'obj(input.body,["ip","account","successful"]);if(typeof input.body.successful!=="boolean")throw Error("record");const data={ip_hash:hash(input.body.ip),account_hash:hash(input.body.account),successful:input.body.successful,created_ms:Date.now()};',format:'return [{json:{success:true}}];'},
];
for(const [i,s] of specs.entries()) {
 const y=i*300;
 node('Webhook '+s.name,'webhook',{httpMethod:s.method,path:'drivepilot-app/api/auth/'+s.path,authentication:'headerAuth',responseMode:'responseNode',options:{}},0,y,{webhookId:randomUUID(),credentials:{httpHeaderAuth:{id:state.credentialId,name:'DrivePilot application - webhook dédié'}}});
 node('Validate '+s.name,'code',{jsCode:common+'const input=$input.first().json;try{'+s.check+'return [{json:{valid:true,data}}];}catch{return [{json:{valid:false}}];}'},220,y);
 node('Valid '+s.name,'if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'valid',leftValue:'={{ $json.valid }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},440,y);
 node('Bad '+s.name,'respondToWebhook',{respondWith:'json',responseBody:'={{ {error:"Entrée invalide."} }}',options:{responseCode:400}},660,y+120);
 link('Webhook '+s.name,'Validate '+s.name);link('Validate '+s.name,'Valid '+s.name);link('Valid '+s.name,'Bad '+s.name,1);
 const p={resource:'row',operation:s.operation,dataTableId:{__rl:true,mode:'id',value:s.table}};
 let previous='Valid '+s.name;
 if(s.operation==='insert') {
  node('Prepare '+s.name,'code',{jsCode:'return [{json:$input.first().json.data}];'},660,y);link(previous,'Prepare '+s.name);previous='Prepare '+s.name;
  p.columns={mappingMode:'autoMapInputData',value:{}};
 } else {
  p.matchType=s.matchType||'allConditions';p.filters={conditions:s.filters};
  if(s.operation==='get') {p.returnAll=false;p.limit=1000;}
  else p.options={dryRun:false};
 }
 node('Store '+s.name,'dataTable',p,880,y,{alwaysOutputData:true});link(previous,'Store '+s.name);
 node('Format '+s.name,'code',{jsCode:s.format},1100,y);link('Store '+s.name,'Format '+s.name);
 node('Respond '+s.name,'respondToWebhook',{respondWith:'json',responseBody:'={{ $json }}',options:{responseCode:200}},1320,y);link('Format '+s.name,'Respond '+s.name);
}
nodes.push({id:'cleanup-hourly',name:'Cleanup hourly',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[0,1700],parameters:{rule:{interval:[{field:'hours',hoursInterval:1}]}}});
for(const [name,tableId,column,age,y] of [['Expired sessions',state.sessionsTableId,'expires_at',0,1700],['Old login attempts',state.loginAttemptsTableId,'created_ms',900000,1900]]) {
 node(name,'dataTable',{resource:'row',operation:'deleteRows',dataTableId:{__rl:true,mode:'id',value:tableId},matchType:'allConditions',filters:{conditions:[{keyName:column,condition:'lt',keyValue:`={{ Date.now() - ${age} }}`}]},options:{dryRun:false}},440,y);
 link('Cleanup hourly',name);
}
const workflow={name:'DrivePilot - Authentification production',nodes,connections,settings:{executionOrder:'v1',timezone:'America/Toronto',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false}};
if(state.authWorkflowId) {
 const current=await api('/workflows/'+state.authWorkflowId);
 if(current.active)await api('/workflows/'+state.authWorkflowId+'/deactivate','POST',{});
 await api('/workflows/'+state.authWorkflowId,'PUT',workflow);
} else {
 const created=await api('/workflows','POST',workflow);state.authWorkflowId=created.id;
 await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
}
await api('/workflows/'+state.authWorkflowId+'/activate','POST',{});
await writeFile(new URL('../n8n_workflows/07-auth-production-workflow.json',import.meta.url),JSON.stringify({...workflow,active:false},null,2)+'\n');
await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({authWorkflowId:state.authWorkflowId,active:true,sharedSessions:true,sharedLoginThrottling:true}));
