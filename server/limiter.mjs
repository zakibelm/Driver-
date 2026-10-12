import { isIP } from 'node:net';
export function clientIP(req, env = process.env) {
 if(env.TRUST_PROXY==='1') {
  // Only enable behind a reverse proxy which OVERWRITES X-Forwarded-For.
  const value=req.headers['x-forwarded-for']?.split(',')[0].trim();
  if(value && isIP(value)) return value;
 }
 return req.socket.remoteAddress || 'local';
}
export function createLoginLimiter(now = Date.now) {
 const entries=new Map();
 function cleanup() { for(const [key,value] of entries) if(value.expires<=now()) entries.delete(key); }
 return {
  retryAfter(key) { cleanup();return Math.max(0,Math.ceil(((entries.get(key)?.next || 0)-now())/1000)); },
  failure(key) {
   cleanup();
   if(entries.size>=10000) entries.delete(entries.keys().next().value);
   const count=(entries.get(key)?.count || 0)+1;
   entries.set(key,{count,next:now()+Math.min(60000,1000*2**Math.min(count-1,6)),expires:now()+15*60*1000});
  },
  success(key) { entries.delete(key); }
 };
}
