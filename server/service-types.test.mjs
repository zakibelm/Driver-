import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServiceTypesMiddleware } from './service-types.mjs';
import { createServicesMiddleware } from './services.mjs';
import { currentServiceTypes, typeName, DEFAULT_SERVICE_TYPES } from './validation.mjs';

function memoryProvider() {
 const events=[]; let clock=0;
 return { events,
  listTypes:async()=>events.map(e=>({...e})),
  saveType:async(name,active)=>{ events.push({name,active,changed_at:new Date(Date.UTC(2026,0,1,0,0,clock++)).toISOString()}); },
  list:async()=>[], create:async data=>data, delete:async()=>{} };
}
async function serve(middleware, fn) {
 const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(r=>server.close(r)); }
}
const as=role=>({'x-test-user':role,'Content-Type':'application/json'});
const getUser=req=>req.headers['x-test-user'] ? {role:req.headers['x-test-user'],email:'a@example.test'} : null;

test('current list: defaults active, history applied in order, case-insensitive, nothing erased',()=>{
 assert.deepEqual(currentServiceTypes([]).map(t=>t.name),DEFAULT_SERVICE_TYPES);
 const list=currentServiceTypes([
  {name:'Navette Aéroport',active:true,changed_at:'2026-01-01T00:00:01Z'},
  {name:'olymel',active:false,changed_at:'2026-01-01T00:00:02Z'},
  {name:'Navette aéroport',active:'false',changed_at:'2026-01-01T00:00:03Z'},
  {name:'<bad>'.repeat(20),active:true,changed_at:'x'}]);
 assert.equal(list.find(t=>t.name==='Olymel').active,false);
 assert.equal(list.find(t=>t.name==='Navette Aéroport').active,false);
 assert.equal(list.length,7);
 assert.equal(typeName('  Navette   Aéroport '),'Navette Aéroport');
 assert.equal(typeName('a\nb'),'a b');
 for(const bad of ['', ' ', 'x'.repeat(41), '<script>', '-début']) assert.throws(()=>typeName(bad));
});

test('service types API: read for all, write for admin only, archive and reactivate',async()=>{
 const provider=memoryProvider();
 await serve(createServiceTypesMiddleware({getUser,provider}),async base=>{
  const url=base+'/api/service-types';
  assert.equal((await fetch(url)).status,401);
  assert.equal((await (await fetch(url,{headers:as('chauffeur')})).json()).types.length,6);
  assert.equal((await fetch(url,{method:'POST',headers:as('chauffeur'),body:JSON.stringify({name:'Navette'})})).status,403);
  assert.equal(provider.events.length,0);
  assert.equal((await fetch(url,{method:'POST',headers:as('admin'),body:JSON.stringify({name:'<x>'})})).status,400);
  assert.equal((await fetch(url,{method:'POST',headers:as('admin'),body:JSON.stringify({name:'Navette',role:'x'})})).status,400);
  assert.equal((await fetch(url,{method:'POST',headers:as('admin'),body:JSON.stringify({name:' navette  aéroport '})})).status,201);
  assert.equal((await fetch(url,{method:'POST',headers:as('admin'),body:JSON.stringify({name:'NAVETTE AÉROPORT'})})).status,409);
  let types=(await (await fetch(url,{method:'PUT',headers:as('admin'),body:JSON.stringify({name:'olymel',active:false})})).json()).types;
  assert.equal(types.find(t=>t.name==='Olymel').active,false);
  // Réactivation par ajout du même nom : garde l'orthographe d'origine.
  types=(await (await fetch(url,{method:'POST',headers:as('admin'),body:JSON.stringify({name:'OLYMEL'})})).json()).types;
  assert.equal(types.find(t=>t.name==='Olymel').active,true);
  assert.equal(types.some(t=>t.name==='OLYMEL'),false);
  assert.equal((await fetch(url,{method:'PUT',headers:as('admin'),body:JSON.stringify({name:'Inconnu',active:false})})).status,404);
  assert.equal((await fetch(url,{method:'PUT',headers:as('admin'),body:JSON.stringify({name:'TCT',active:'non'})})).status,400);
  assert.equal((await fetch(url+'?x=1',{headers:as('admin')})).status,400);
  assert.equal((await fetch(url,{method:'DELETE',headers:as('admin')})).status,405);
 });
});

test('the last active type cannot be archived',async()=>{
 const provider=memoryProvider();
 for(const name of DEFAULT_SERVICE_TYPES.slice(1)) await provider.saveType(name,false);
 await serve(createServiceTypesMiddleware({getUser,provider}),async base=>{
  const res=await fetch(base+'/api/service-types',{method:'PUT',headers:as('admin'),body:JSON.stringify({name:'Regular',active:false})});
  assert.equal(res.status,400);
 });
});

test('a new ride only accepts an active type',async()=>{
 const provider=memoryProvider();
 await provider.saveType('Olymel',false);
 await provider.saveType('Navette',true);
 await serve(createServicesMiddleware({getUser,provider}),async base=>{
  const ride=type=>fetch(base+'/api/services',{method:'POST',headers:as('chauffeur'),body:JSON.stringify({type,amount:20,date:'2026-10-12T12:00:00.000Z'})});
  assert.equal((await ride('Olymel')).status,400);
  assert.equal((await ride('Navette')).status,201);
  assert.equal((await ride('Regular')).status,201);
  assert.equal((await ride('Pirate')).status,400);
 });
});
