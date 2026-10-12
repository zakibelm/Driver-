import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { serviceInput } from './validation.mjs';
test('webhook credential references and validation before data access', () => {
 const workflow = JSON.parse(readFileSync('n8n_workflows/05-crud-operations-workflow.json'));
 const hooks=workflow.nodes.filter(n=>n.type.endsWith('.webhook'));
 assert.equal(hooks.length,5);
 for(const hook of hooks) {
  assert.equal(hook.parameters.authentication,'headerAuth');
  assert.deepEqual(hook.credentials,{httpHeaderAuth:{name:'DrivePilot Header Auth'}});
  const next=workflow.connections[hook.name].main[0][0].node;
  const validation=workflow.nodes.find(n=>n.name===next);
  const run=new Function('$input',validation.parameters.jsCode);
  assert.equal(run({first:()=>({json:{body:{unknown:true},params:{},query:{bad:1}}})})[0].json.valid,false);
  const bad=workflow.nodes.find(n=>n.name===hook.name.replace('Webhook','Bad'));
  assert.equal(bad.parameters.options.responseCode,400);
 }
});
test('service types workflow: authenticated, validated, append-only',()=>{
 const workflow = JSON.parse(readFileSync('n8n_workflows/06-service-types-workflow.json'));
 const hooks=workflow.nodes.filter(n=>n.type.endsWith('.webhook'));
 assert.deepEqual(hooks.map(h=>h.parameters.httpMethod+' '+h.parameters.path).sort(),['GET api/service-types/all','POST api/service-types/save']);
 for(const hook of hooks) {
  assert.equal(hook.parameters.authentication,'headerAuth');
  assert.deepEqual(hook.credentials,{httpHeaderAuth:{name:'DrivePilot Header Auth'}});
  assert.doesNotMatch(hook.parameters.path,/:/);
 }
 const ops=workflow.nodes.filter(n=>n.type.endsWith('.dataTable')).map(n=>n.parameters.operation).sort();
 assert.deepEqual(ops,['get','insert']);
 const run=name=>{ const code=workflow.nodes.find(n=>n.name===name).parameters.jsCode; return body=>new Function('$input',code)({first:()=>({json:{body,query:{},params:{}}})})[0].json; };
 const save=run('Validate Save Type');
 assert.deepEqual(save({name:'  Navette  Aéroport ',active:true}),{valid:true,data:{name:'Navette Aéroport',active:true}});
 for(const bad of [{name:'<x>',active:true},{name:'Ok',active:'true'},{name:'Ok'},{name:'Ok',active:true,role:'admin'},{name:'x'.repeat(41),active:false}]) assert.equal(save(bad).valid,false);
 const create=new Function('$input',JSON.parse(readFileSync('n8n_workflows/05-crud-operations-workflow.json')).nodes.find(n=>n.name==='Validate Create Service').parameters.jsCode);
 const ride=type=>create({first:()=>({json:{body:{type,amount:10,date:'2026-10-12T12:00:00Z',driver_email:'a@example.test'},query:{},params:{}}})})[0].json.valid;
 assert.equal(ride('Navette Aéroport'),true);
 assert.equal(ride('<script>'),false);
});
test('mail workflow: authenticated, single recipient, no header injection',()=>{
 const workflow = JSON.parse(readFileSync('n8n_workflows/07-send-mail-workflow.json'));
 const hook=workflow.nodes.find(n=>n.type.endsWith('.webhook'));
 assert.equal(hook.parameters.path,'api/mail/send');
 assert.equal(hook.parameters.httpMethod,'POST');
 assert.deepEqual(hook.credentials,{httpHeaderAuth:{name:'DrivePilot Header Auth'}});
 const send=workflow.nodes.find(n=>n.type==='n8n-nodes-base.emailSend');
 assert.deepEqual(send.credentials,{smtp:{name:'DrivePilot SMTP'}});
 const code=workflow.nodes.find(n=>n.name==='Validate Send Mail').parameters.jsCode;
 const run=(body,query={})=>new Function('$input',code)({first:()=>({json:{body,query}})})[0].json.valid;
 const ok={to:'a@example.test',subject:'Sujet',text:'Texte'};
 assert.equal(run(ok),true);
 for(const bad of [{...ok,to:'a@x.test, b@y.test'},{...ok,to:'<a@x.test>'},{...ok,subject:'S\r\nBcc: x@y.test'},{...ok,text:'x'.repeat(5001)},{...ok,cc:'x@y.test'},{to:ok.to,subject:ok.subject}]) assert.equal(run(bad),false);
 assert.equal(run(ok,{x:1}),false);
});
test('n8n code nodes never load Node modules (disallowed by the n8n task runner)',()=>{
 for(const file of ['05-crud-operations-workflow.json','06-service-types-workflow.json','07-send-mail-workflow.json']) {
  const workflow=JSON.parse(readFileSync('n8n_workflows/'+file));
  for(const n of workflow.nodes.filter(n=>n.type.endsWith('.code'))) assert.doesNotMatch(n.parameters.jsCode,/\brequire\s*\(/,file+' / '+n.name);
 }
});
test('n8n expressions never close early on an inner "}}"',()=>{
 for(const file of ['05-crud-operations-workflow.json','06-service-types-workflow.json','07-send-mail-workflow.json']) {
  const visit=(v,where)=>{
   if(typeof v==='string' && v.startsWith('=')) {
    // Chaque {{ … }} doit se refermer exactement là où l'auteur l'a prévu : aucun '}}' à l'intérieur.
    let rest=v.slice(1);
    for(let i=rest.indexOf('{{'); i!==-1; i=rest.indexOf('{{')) {
     const end=rest.indexOf('}}',i+2);
     assert.notEqual(end,-1,file+' / '+where);
     const inner=rest.slice(i+2,end);
     const opens=(inner.match(/[{(\[]/g)||[]).length, closes=(inner.match(/[})\]]/g)||[]).length;
     assert.equal(opens,closes,file+' / '+where+' : '+v);
     rest=rest.slice(end+2);
    }
   } else if(v && typeof v==='object') for(const [k,x] of Object.entries(v)) visit(x,where+'.'+k);
  };
  for(const n of JSON.parse(readFileSync('n8n_workflows/'+file,'utf8')).nodes) visit(n.parameters,n.name);
 }
});
test('strict service validation and canonical service types',()=>{
 const value={type:'Regular',amount:25,date:'2026-10-12T12:00:00.000Z',description:'ok'};
 assert.equal(serviceInput(value).amount,25);
 for(const patch of [{amount:0},{amount:10001},{amount:'25'},{amount:Infinity},{date:'2026-02-30T00:00:00Z'},{type:'<inconnu>'},{description:'x'.repeat(501)},{driver_email:'other@example.test'}]) assert.throws(()=>serviceInput({...value,...patch}));
});
