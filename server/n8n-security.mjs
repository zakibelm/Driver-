import { createHash, createHmac } from 'node:crypto';
import { HttpError } from './http.mjs';

export function createN8nSecurity(env, fetcher = fetch) {
  async function request(path, method='GET', body) {
    if(!env.N8N_URL || !env.N8N_TOKEN) throw new HttpError(503,'Authentification non configurée.');
    const base=new URL(env.N8N_URL);
    if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash) throw new HttpError(503,'Configuration d’authentification invalide.');
    try {
      const res=await fetcher(base.href.replace(/\/$/,'')+'/'+path,{method,headers:{'Content-Type':'application/json','X-DrivePilot-Token':env.N8N_TOKEN},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
      const data=await res.json();
      if(!res.ok || data.success!==true) throw new Error('upstream');
      return data;
    } catch { throw new HttpError(503,'Le service d’authentification est temporairement indisponible.'); }
  }
  const digest=value=>createHash('sha256').update(value).digest('hex');
  function identity(key) {
    const split=key.indexOf('|');
    const hash=value=>createHmac('sha256',env.N8N_TOKEN).update(value).digest('hex');
    return {ip:hash('ip:'+key.slice(0,split)),account:hash('account:'+key.slice(split+1))};
  }
  return {
    request,
    sessions:{
      async get(id) { return (await request('api/auth/session/get?hash='+digest(id))).session; },
      async set(id,session) { await request('api/auth/session/create','POST',{hash:digest(id),user:session.user,expires:session.expires,...(session.authVersion?{authVersion:session.authVersion}:{})}); },
      async delete(id) { if(/^[a-f0-9]{64}$/.test(id)) await request('api/auth/session/delete','DELETE',{hash:digest(id)}); },
    },
    limiter:{
      async retryAfter(key) { const value=identity(key); const result=await request(`api/auth/rate/check?ip=${value.ip}&account=${value.account}`); if(!Number.isFinite(result.retryAfter) || result.retryAfter<0 || result.retryAfter>60) throw new HttpError(503,'Réponse d’authentification invalide.'); return result.retryAfter; },
      async failure(key) { await request('api/auth/rate/record','POST',{...identity(key),successful:false}); },
      async success(key) { await request('api/auth/rate/record','POST',{...identity(key),successful:true}); },
    },
  };
}
