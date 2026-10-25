import { createApiMiddlewares } from '../server/plugin.mjs';
import { reply } from '../server/http.mjs';

const env={...process.env,NODE_ENV:'production',AUTH_SESSION_STORE:'n8n',TRUST_PROXY:'1'};
const middlewares=createApiMiddlewares(undefined,env);
export default function handler(req,res) {
  return new Promise(resolve=>{
    res.once('finish',resolve);
    res.once('close',resolve);
    let index=0;
    const next=error=>{
      if(error) { console.error('DrivePilot API middleware failed'); return reply(res,500,{error:'Erreur interne.'}); }
      const middleware=middlewares[index++];
      if(!middleware) return reply(res,404,{error:'Introuvable.'});
      try { Promise.resolve(middleware(req,res,next)).catch(next); } catch(error) { next(error); }
    };
    next();
  });
}
