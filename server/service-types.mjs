import { HttpError, jsonBody, reply, sameOrigin, validate } from './http.mjs';
import { object, typeName, currentServiceTypes } from './validation.mjs';
// GET  /api/service-types               -> liste courante (tout utilisateur connecté)
// POST /api/service-types {name}        -> ajoute un type ou réactive un type archivé (admin)
// PUT  /api/service-types {name,active} -> archive (active:false) ou réactive (admin)
// Aucun type n'est effacé : les anciennes courses gardent leur type et restent filtrables.
export function createServiceTypesMiddleware({ getUser, provider }) {
 return async (req,res,next) => {
  const url = new URL(req.url, 'http://local');
  if(url.pathname !== '/api/service-types') return next();
  try {
   const user = getUser(req);
   if(!user || !['admin','chauffeur'].includes(user.role)) throw new HttpError(401,'Connexion requise.');
   if(url.search) throw new HttpError(400,'Paramètres non autorisés.');
   sameOrigin(req);
   if(!provider.listTypes || !provider.saveType) throw new HttpError(503,'Gestion des types indisponible.');
   const load = async () => currentServiceTypes(await provider.listTypes());
   if(req.method==='GET') return reply(res,200,{types:await load()});
   if(!['POST','PUT'].includes(req.method)) throw new HttpError(405,'Méthode non autorisée.');
   if(user.role!=='admin') throw new HttpError(403,'Réservé à l’administrateur.');
   const body = await jsonBody(req);
   const types = await load();
   if(req.method==='POST') {
    const name = validate(()=>{ object(body,['name']); return typeName(body.name); });
    const existing = types.find(t=>t.name.toLowerCase()===name.toLowerCase());
    if(existing?.active) throw new HttpError(409,'Ce type existe déjà.');
    await provider.saveType(existing?.name ?? name, true);
    return reply(res,201,{types:await load()});
   }
   const input = validate(()=>{ object(body,['name','active']); if(typeof body.active!=='boolean') throw new Error('active doit être vrai ou faux.'); return { name:typeName(body.name), active:body.active }; });
   const existing = types.find(t=>t.name.toLowerCase()===input.name.toLowerCase());
   if(!existing) throw new HttpError(404,'Type introuvable.');
   if(existing.active===input.active) return reply(res,200,{types});
   if(!input.active && types.filter(t=>t.active).length<=1) throw new HttpError(400,'Au moins un type doit rester actif.');
   await provider.saveType(existing.name, input.active);
   return reply(res,200,{types:await load()});
  } catch(error) { reply(res,error.status || 500,error.status ? {error:error.message}:{error:'Erreur interne.'}); }
 };
}
