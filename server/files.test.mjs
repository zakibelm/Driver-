import test from 'node:test';
import assert from 'node:assert/strict';
import { privateFiles, externalAccountFile } from './files.mjs';
test('private path variants are rejected before filesystem access',()=>{
 for(const url of ['/admin-auth.local?raw','/@fs/C:/project/admin-auth.local','/admin-auth.local?raw??','/admin-auth.local%5c','/%61dmin-auth.local','/.env.production','/server/auth.mjs']) {
  let next=false; const res={statusCode:200,end(){}};
  privateFiles({url},res,()=>{next=true;});
  assert.equal(res.statusCode,403,url);assert.equal(next,false,url);
 }
 assert.equal(externalAccountFile(undefined,process.cwd()),undefined);
 assert.equal(externalAccountFile('relative.json',process.cwd()),undefined);
 assert.equal(externalAccountFile(new URL('./files.test.mjs',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),process.cwd()),undefined);
});
