import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIP, createLoginLimiter } from './limiter.mjs';
test('progressive cooldown isolates identifiers and distrusts forwarded IP by default',()=>{
 let time=1000;const limit=createLoginLimiter(()=>time);
 limit.failure('ip|attacker');assert.equal(limit.retryAfter('ip|attacker'),1);
 assert.equal(limit.retryAfter('ip|admin'),0);
 time+=1000;limit.failure('ip|attacker');assert.equal(limit.retryAfter('ip|attacker'),2);
 limit.success('ip|attacker');assert.equal(limit.retryAfter('ip|attacker'),0);
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'203.0.113.10'}};
 assert.equal(clientIP(req,{}),'127.0.0.1');
 assert.equal(clientIP(req,{TRUST_PROXY:'1'}),'203.0.113.10');
});
