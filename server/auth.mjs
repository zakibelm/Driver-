import { readFile } from 'node:fs/promises';

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import { promisify } from 'node:util';

import { sessionCookie } from './security.mjs';

import { HttpError, jsonBody, reply, sameOrigin, validate } from './http.mjs';

import { object, text } from './validation.mjs';

import { createLoginLimiter, clientIP } from './limiter.mjs';

import { adminEmails } from './accounts.mjs';

const derive = promisify(scrypt);

const lifetime = 8 * 60 * 60 * 1000;



export function createAuthMiddleware(accountFile, env = process.env, options = {}) {

 const sessions=new Map();

 const now=options.now || Date.now;

 const limiter=createLoginLimiter(now);

 const load=options.loadAccounts || (async()=>{

   // Comptes inscrits (magasin) + compte historique facultatif (ADMIN_AUTH_FILE, lecture seule).
   const registered=options.store ? (await options.store.load()).accounts : [];
   if(!accountFile) { if(options.store) return registered; throw new Error('not configured'); }
   const value=JSON.parse(await readFile(accountFile,'utf8'));
   return [...registered, ...(Array.isArray(value) ? value : [value])];

 });

 const admins=adminEmails(env);

 const getId=req=>(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('taxi_session='))?.slice(13);

 const getUser=req=>{ const session=sessions.get(getId(req));return session && session.expires>now() ? session.user : null; };

 let active=0;

 const middleware=async(req,res,next)=>{

  const url=new URL(req.url,'http://local');

  if(!url.pathname.startsWith('/api/auth/')) return next();

  try {

   for(const [id,session] of sessions) if(session.expires<=now()) sessions.delete(id);

   if(url.search) throw new HttpError(400,'Paramètres non autorisés.');

   if(req.method==='GET' && url.pathname==='/api/auth/session') {

    const user=getUser(req);

    return reply(res,200,{user:user||null});

   }

   if(req.method!=='POST') throw new HttpError(405,'Méthode non autorisée.');

   sameOrigin(req);

   if(url.pathname==='/api/auth/logout') {

    sessions.delete(getId(req));res.setHeader('Set-Cookie',sessionCookie(req,'',0,env));return reply(res,200,{success:true});

   }

   if(url.pathname!=='/api/auth/login') throw new HttpError(404,'Introuvable.');

   const body=await jsonBody(req,4096);

   const {identifier,password}=validate(()=>{

    object(body,['identifier','password']);

    const identifier=text(body.identifier,254).toLowerCase();

    if(typeof body.password!=='string' || !body.password.length || body.password.length>256) throw new Error('password');

    return {identifier,password:body.password};

   });

   const key=clientIP(req,env)+'|'+identifier;

   const wait=limiter.retryAfter(key);

   if(wait) { res.setHeader('Retry-After',String(wait));throw new HttpError(429,'Trop de tentatives. Réessayez après le délai indiqué.'); }

   // Bound expensive in-flight work; the remaining server stays responsive.

   if(active>=8 || sessions.size>=5000) throw new HttpError(503,'Serveur occupé. Réessayez.');

   active++;

   try {

    let accounts;

    try { accounts=await load(); } catch { throw new HttpError(503,'Compte non configuré sur ce serveur.'); }

    if(!Array.isArray(accounts)) throw new HttpError(503,'Configuration de compte invalide.');

    const norm=v=>typeof v==='string' ? v.trim().toLowerCase() : undefined;
    // Courriel d'abord ; le nom d'utilisateur n'est accepté que s'il est unique (les noms ne le sont pas forcément).
    const valid=accounts.filter(a=>a && typeof a==='object');
    const byName=valid.filter(a=>norm(a.username)===identifier);
    const account=valid.find(a=>norm(a.email)===identifier) || (byName.length===1 ? byName[0] : undefined);

    const validAccount=account && typeof account.email==='string' && typeof account.username==='string' && (typeof account.id==='string' || typeof account.id==='number') && typeof account.salt==='string' && account.salt.length<=256 && /^[a-f0-9]{128}$/i.test(account.passwordHash || '') && ['admin','chauffeur'].includes(account.role || 'admin');

    const expected=validAccount ? Buffer.from(account.passwordHash,'hex') : Buffer.alloc(64);

    const actual=await derive(password,validAccount?account.salt:'drivepilot-dummy-salt',64);

    if(!validAccount || !timingSafeEqual(expected,actual)) {

     limiter.failure(key);throw new HttpError(401,'Identifiant ou mot de passe incorrect.');

    }

    // Mot de passe correct : l'état du compte n'est révélé qu'au titulaire.
    if(account.status==='pending') throw new HttpError(403,'Votre compte attend l’approbation de l’administrateur.');
    if(account.status==='disabled') throw new HttpError(403,'Ce compte est désactivé. Contactez l’administrateur.');
    if(account.status && account.status!=='active') throw new HttpError(403,'Confirmez d’abord votre adresse courriel.');

    limiter.success(key);

    sessions.delete(getId(req));

    const id=randomBytes(32).toString('hex');

    const email=account.email.trim().toLowerCase();
    const user={id:account.id,email,name:account.username,role:admins.has(email) ? 'admin' : (account.role || 'admin')};

    sessions.set(id,{user,expires:now()+lifetime});

    res.setHeader('Set-Cookie',sessionCookie(req,id,lifetime/1000,env));

    return reply(res,200,{user});

   } finally { active--; }

  } catch(error) { reply(res,error.status || 500,{error:error.status ? error.message : 'Erreur interne.'}); }

 };

 middleware.getUser=getUser;
 // Ferme toutes les sessions d'un compte (mot de passe changé, droits modifiés, compte désactivé).
 middleware.revokeUser=id=>{ for(const [sid,session] of sessions) if(String(session.user.id)===String(id)) sessions.delete(sid); };

 return middleware;

}

