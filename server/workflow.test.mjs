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
test('strict service validation and canonical service types',()=>{
 const value={type:'Regular',amount:25,date:'2026-10-12T12:00:00.000Z',description:'ok'};
 assert.equal(serviceInput(value).amount,25);
 assert.equal(serviceInput(value).type, 'Régulier');
 assert.equal(serviceInput({...value,type:' Transport aéroport '}).type,'Transport aéroport');
 for(const patch of [{amount:0},{amount:10001},{amount:'25'},{amount:Infinity},{date:'2026-02-30T00:00:00Z'},{type:''},{type:' '.repeat(4)},{type:'x'.repeat(81)},{type:'Autres'},{type:'__other__'},{type:'Taxi\nTest'},{description:'x'.repeat(501)},{driver_email:'other@example.test'}]) assert.throws(()=>serviceInput({...value,...patch}));
});

test('server UUID is validated only on the trusted n8n input',()=>{
 const value={type:'Transport aéroport',amount:10,date:'2026-10-25T12:00:00.000Z',driver_email:'test@example.test',service_id:'11111111-1111-4111-8111-111111111111'};
 assert.equal(serviceInput(value,true).service_id,value.service_id);
 assert.throws(()=>serviceInput(value));
 assert.throws(()=>serviceInput({...value,service_id:'invalid'},true));
});

test('connected workflow uses static routes and formats responses outside expressions',()=>{
 const workflow=JSON.parse(readFileSync('n8n_workflows/06-connexion-application-workflow.json'));
 const hooks=workflow.nodes.filter(n=>n.type.endsWith('.webhook'));
 assert.equal(hooks.length,4);
 for(const hook of hooks) {
  assert.equal(hook.parameters.path.includes(':'),false);
  assert.equal(hook.parameters.authentication,'headerAuth');
 }
 for(const code of workflow.nodes.filter(n=>n.type.endsWith('.code'))) assert.equal(code.parameters.jsCode.includes("require('crypto')"),false);
 const row={service_id:'11111111-1111-4111-8111-111111111111',type:'Régulier',amount:10};
 const input={first:()=>({json:row}),all:()=>[{json:row}]};
 const format=name=>new Function('$input',workflow.nodes.find(n=>n.name===name).parameters.jsCode)(input)[0].json;
 assert.equal(format('Format Create Service').service.id,row.service_id);
 assert.equal(format('Format List Services').services[0].id,row.service_id);
 assert.deepEqual(format('Format Delete Service'),{success:true});
});
