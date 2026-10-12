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
test('strict service validation and canonical service types',()=>{
 const value={type:'Regular',amount:25,date:'2026-10-12T12:00:00.000Z',description:'ok'};
 assert.equal(serviceInput(value).amount,25);
 for(const patch of [{amount:0},{amount:10001},{amount:'25'},{amount:Infinity},{date:'2026-02-30T00:00:00Z'},{type:'unknown'},{description:'x'.repeat(501)},{driver_email:'other@example.test'}]) assert.throws(()=>serviceInput({...value,...patch}));
});
