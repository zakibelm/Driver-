import { randomBytes, randomUUID, scrypt, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, jsonBody, reply, sameOrigin, validate } from './http.mjs';
import { object, text } from './validation.mjs';
import { clientIP } from './limiter.mjs';
const derive=promisify(scrypt);
const trialEmail='test@drivepilot.com';
const genericRegistration='Si cette inscription peut être créée, vous recevrez un courriel de confirmation. Consultez aussi vos indésirables.';
const genericRecovery='Si un compte correspond à ce courriel, un lien vous sera envoyé. Consultez aussi vos indésirables.';
export const accountVersion=(salt,passwordHash)=>createHash('sha256').update(salt+':'+passwordHash).digest('hex');
const tokenHash=token=>createHash('sha256').update(token).digest('hex');
function accountEmail(value) {
 const email=text(value,254).toLowerCase();
 if(!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email))throw new Error('email');
 return email;
}
function newPassword(value) {
 if(typeof value!=='string'||value.length<12||value.length>256)throw new Error('password');
 return value;
}
function actionToken(value) {
 if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new Error('token');
 return value;
}
function mapAccount(row) {
 if(!row)return null;
 return {id:row.account_id,username:row.username,email:row.email,name:row.display_name,salt:row.salt,passwordHash:row.password_hash,role:row.role,verified:row.verified===true,authVersion:row.auth_version};
}
export function createAccountStore(request) {
 return {
  async find(identifier){const d=await request('api/accounts/get?identifier='+encodeURIComponent(identifier));if(d.conflict)throw new HttpError(503,'Le compte nécessite une vérification par un administrateur.');return mapAccount(d.account);},
  async create(account){return request('api/accounts/create','POST',account);},
  async verify(id){return request('api/accounts/verify','POST',{id});},
  async password(id,value){return request('api/accounts/password','POST',{id,...value});},
  async token(value){return request('api/accounts/token/create','POST',value);},
  async consume(hash,purpose){return (await request('api/accounts/token/consume','POST',{hash,purpose})).token;},
  async mail(account,subject,message){return request('api/accounts/email','POST',{id:account.id,subject,message});},
 };
}
export function createAccountMiddleware({accounts,limiter,env,now=Date.now}) {
 const paths=new Set(['/api/auth/register','/api/auth/verify','/api/auth/forgot-password','/api/auth/reset-password']);
 let active=0;
 async function mailLink(account,purpose) {
  const root=new URL(env.PUBLIC_APP_URL || 'https://drivepilot-zaks-projects-f05d04ab.vercel.app');
  if(root.protocol!=='https:'||root.username||root.password)throw new HttpError(503,'Adresse de l’application non configurée.');
  const token=randomBytes(32).toString('hex');
  const ttl=purpose==='verify'?86400000:1800000;
  await accounts.token({hash:tokenHash(token),id:account.id,email:account.email,purpose,expires:now()+ttl,authVersion:account.authVersion});
  root.hash=new URLSearchParams({[purpose]:token}).toString();
  const title=purpose==='verify'?'Confirmez votre compte DrivePilot':'Réinitialisez votre mot de passe DrivePilot';
  const message=(purpose==='verify'?'Confirmez votre adresse pour activer votre compte :':'Vous avez demandé à changer votre mot de passe. Ouvrez ce lien :')+'\n\n'+root.href+'\n\nCe lien est à usage unique et expire '+(purpose==='verify'?'dans 24 heures.':'dans 30 minutes.')+'\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.\n\nDrivePilot';
  await accounts.mail(account,title,message);
 }
 return async(req,res,next)=>{
  const url=new URL(req.url,'http://local');if(!paths.has(url.pathname))return next();
  try {
   if(req.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');
   if(url.search)throw new HttpError(400,'Paramètres non autorisés.');
   sameOrigin(req);
   if(!accounts)throw new HttpError(503,'La gestion des comptes est temporairement indisponible.');
   const body=await jsonBody(req,4096);
   const input=validate(()=>{
    if(url.pathname.endsWith('/register')){object(body,['name','email','password']);return {name:text(body.name,100),email:accountEmail(body.email),password:newPassword(body.password)};}
    if(url.pathname.endsWith('/forgot-password')){object(body,['email']);return {email:accountEmail(body.email)};}
    if(url.pathname.endsWith('/verify')){object(body,['token']);return {token:actionToken(body.token)};}
    object(body,['token','password']);return {token:actionToken(body.token),password:newPassword(body.password)};
   });
   const rateKey=clientIP(req,env)+'|'+url.pathname+':'+(input.email||tokenHash(input.token));
   const wait=await limiter.retryAfter(rateKey);if(wait){res.setHeader('Retry-After',String(wait));throw new HttpError(429,'Veuillez patienter avant de réessayer.');}
   if(active>=8)throw new HttpError(503,'Serveur occupé. Réessayez.');
   await limiter.failure(rateKey);active++;
   try {
    if(url.pathname.endsWith('/register')) {
     if(input.email===trialEmail)return reply(res,202,{message:genericRegistration});
     let account=await accounts.find(input.email);
     if(!account) {
      const salt=randomBytes(24).toString('hex');const hash=(await derive(input.password,salt,64)).toString('hex');
      const id=randomUUID();
      await accounts.create({id,username:input.email,email:input.email,name:input.name,salt,passwordHash:hash,role:'chauffeur',verified:false,authVersion:accountVersion(salt,hash)});
      account={id,email:input.email,verified:false,authVersion:accountVersion(salt,hash)};
     }
     if(!account.verified){try{await mailLink(account,'verify');}catch{console.error('DrivePilot verification email failed');}}
     return reply(res,202,{message:genericRegistration});
    }
    if(url.pathname.endsWith('/forgot-password')) {
     const account=input.email===trialEmail?null:await accounts.find(input.email);
     if(account){try{await mailLink(account,account.verified?'reset':'verify');}catch{console.error('DrivePilot recovery email failed');}}
     return reply(res,202,{message:genericRecovery});
    }
    const purpose=url.pathname.endsWith('/verify')?'verify':'reset';
    const token=await accounts.consume(tokenHash(input.token),purpose);
    if(!token)throw new HttpError(400,'Ce lien est invalide, expiré ou déjà utilisé.');
    const account=await accounts.find(token.email);
    if(!account||account.id!==token.accountId||account.authVersion!==token.authVersion)throw new HttpError(400,'Ce lien est invalide, expiré ou déjà utilisé.');
    if(purpose==='verify'){await accounts.verify(token.accountId);return reply(res,200,{message:'Votre adresse est confirmée. Vous pouvez vous connecter.'});}
    const salt=randomBytes(24).toString('hex');const hash=(await derive(input.password,salt,64)).toString('hex');
    await accounts.password(token.accountId,{salt,passwordHash:hash,authVersion:accountVersion(salt,hash)});
    return reply(res,200,{message:'Votre mot de passe a été modifié. Reconnectez-vous avec le nouveau mot de passe.'});
   } finally {active--;}
  }catch(error){reply(res,error.status||500,{error:error.status?error.message:'Une erreur est survenue. Réessayez.'});}
 };
}
