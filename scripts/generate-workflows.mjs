import { readFileSync, writeFileSync } from 'node:fs';
const validation = readFileSync(new URL('../server/validation.mjs', import.meta.url), 'utf8').replaceAll('export ', '');
const nodes = [], connections = {};
function node(name, type, parameters, x, y, extra = {}) {
  nodes.push({ name, id: name.toLowerCase().replaceAll(' ', '-'), type: `n8n-nodes-base.${type}`, typeVersion: type === 'code' ? 2 : type === 'if' ? 2.2 : type === 'dataTable' ? 1.1 : type === 'webhook' ? 2 : 1.4, parameters, position: [x,y], ...extra });
}
function link(from, to, output = 0) {
  connections[from] ??= { main: [] };
  connections[from].main[output] ??= [];
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}
const table = kind => ({ __rl: true, mode: 'id', value: `={{ $vars.DRIVEPILOT_${kind.toUpperCase()}_TABLE_ID }}` });
const condition = (keyName, keyValue) => ({ keyName, condition: 'eq', keyValue });
const specs = [
 ['Create Driver','POST','api/drivers/create', 'const data = driverInput(input.body);', 'drivers', 'insert'],
 ['Create Service','POST','api/services/create', 'const data = serviceInput(input.body, true);', 'services','insert'],
 // Chemins fixes : n8n préfixe d'un UUID les chemins à paramètres ; courriel et id passent dans le corps (hors journaux d'URL).
 ['List Services','POST','api/services/list', 'object(input.query ?? {}, []); object(input.body, ["email"]); const data = {email:email(input.body.email)};','services','get'],
 ['List All Services','GET','api/services/all', 'object(input.query ?? {}, []); const data = {};','services','get'],
 ['Delete Service','DELETE','api/services/delete', 'object(input.query ?? {}, []); object(input.body, ["id","driver_email"]); const data = { id:serviceId(input.body.id), driver_email:email(input.body.driver_email) };','services','deleteRows'],
];
for (const [i,[name,method,path,check,kind,operation]] of specs.entries()) {
 const y = i * 320;
 node(`Webhook ${name}`, 'webhook', { httpMethod:method, path, authentication:'headerAuth', responseMode:'responseNode', options:{} },0,y,{credentials:{httpHeaderAuth:{name:'DrivePilot Header Auth'}}});
 node(`Validate ${name}`,'code',{jsCode:validation+'\nconst input = $input.first().json;\ntry { '+check+' return [{json:{valid:true,data}}]; } catch { return [{json:{valid:false,error:"Entrée invalide."}}]; }'},220,y);
 node(`Valid ${name}`,'if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'valid',leftValue:'={{ $json.valid }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},440,y);
 node(`Bad ${name}`,'respondToWebhook',{respondWith:'json',responseBody:'={{ { error: "Entrée invalide." } }}',options:{responseCode:400}},660,y+140);
 link(`Webhook ${name}`,`Validate ${name}`);link(`Validate ${name}`,`Valid ${name}`);link(`Valid ${name}`,`Bad ${name}`,1);
 let prep = `Valid ${name}`;
 if(operation === 'insert') {
   node(`Prepare ${name}`,'code',{jsCode:`const randomUUID = () => globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); return [{json:{...$input.first().json.data, ${kind === 'services'?'service_id':'driver_id'}:randomUUID(), created_at:new Date().toISOString(), updated_at:new Date().toISOString()${kind === 'drivers'?", status:'active'":''}}}];`},660,y);
   link(prep,`Prepare ${name}`);prep=`Prepare ${name}`;
 }
 const params={resource:'row',operation,dataTableId:table(kind)};
 if(operation==='insert') params.columns={mappingMode:'autoMapInputData',value:{}};
 else {
   params.matchType='allConditions';
   params.filters={conditions:name==='List Services'?[condition('driver_email','={{ $json.data.email }}')]:operation==='deleteRows'?[condition('service_id','={{ $json.data.id }}'),condition('driver_email','={{ $json.data.driver_email }}')]:[]};
   if(operation==='get') params.returnAll=true;
   if(operation==='deleteRows') params.options={dryRun:false};
 }
 node(`Store ${name}`,'dataTable',params,880,y,{alwaysOutputData:true});link(prep,`Store ${name}`);
 let body = operation==='deleteRows' ? '({success:true})' : operation==='get' ? '({success:true,services:$input.all().map(x=>x.json).filter(x=>x.service_id).map(x=>({...x,id:x.service_id}))})' : kind==='services' ? '({ success: true, service: { ...$json, id: $json.service_id } })' : '({ success: true, driver: { id: $json.driver_id, email: $json.email } })';
 node(`Respond ${name}`,'respondToWebhook',{respondWith:'json',responseBody:`={{ ${body} }}`,options:{responseCode:operation==='insert'?201:200}},1100,y);link(`Store ${name}`,`Respond ${name}`);
}
writeFileSync('n8n_workflows/05-crud-operations-workflow.json',JSON.stringify({name:'DrivePilot - Authenticated CRUD',nodes,connections,settings:{executionOrder:'v1'},active:false},null,2)+'\n');
for (const [filename,kind,fields] of [
 ['01-create-drivers-table.json','drivers',['driver_id','email','first_name','last_name','phone','license_number','status','created_at','updated_at']],
 ['02-create-services-table.json','services',['service_id','driver_email','type','amount','date','description','created_at','updated_at']]]) {
 writeFileSync(`n8n_workflows/${filename}`,JSON.stringify({name:`DrivePilot - Create ${kind}`,nodes:[{id:'manual',name:'Manual Trigger',type:'n8n-nodes-base.manualTrigger',typeVersion:1,parameters:{},position:[0,0]},{id:'create-table',name:'Create Table',type:'n8n-nodes-base.dataTable',typeVersion:1.1,position:[250,0],parameters:{resource:'table',operation:'create',tableName:`drivepilot_${kind}`,columns:{column:fields.map(name=>({name,type:name==='amount'?'number':'string'}))},options:{createIfNotExists:true}}}],connections:{'Manual Trigger':{main:[[{node:'Create Table',type:'main',index:0}]]}},active:false},null,2)+'\n');
}
