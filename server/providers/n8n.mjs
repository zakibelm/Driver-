import { HttpError } from '../http.mjs';
export function createN8nProvider(env = process.env, fetcher = fetch) {
  async function request(path, method = 'GET', body) {
    if(!env.N8N_URL || !env.N8N_TOKEN) throw new HttpError(503,'Le service de courses est non configuré. Le mode démo reste disponible.');
    let base;
    try { base = new URL(env.N8N_URL); } catch { throw new HttpError(503,'Configuration du service invalide.'); }
    if(base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname)))) throw new HttpError(503,'Une URL HTTPS est requise pour le service distant.');
    try {
      const response = await fetcher(`${base.href.replace(/\/$/,'')}/${path}`,{
        method, headers:{'Content-Type':'application/json','X-DrivePilot-Token':env.N8N_TOKEN},
        ...(body ? {body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(10000), redirect:'error'
      });
      if(!response.ok) throw new Error('upstream');
      const data = await response.json();
      if(data.success !== true) throw new Error('invalid response');
      return data;
    } catch { throw new HttpError(502,'Le service de courses est indisponible. Aucune donnée locale de remplacement.'); }
  }
  return {
    async list(user) {
      // Chemins fixes : n8n préfixe les chemins à paramètres d'un UUID, et le courriel ne doit pas apparaître dans l'URL (journaux).
      const data = user.role === 'admin' ? await request('api/services/all') : await request('api/services/list','POST',{email:user.email});
      if(!Array.isArray(data.services)) throw new HttpError(502,'Réponse du service invalide.');
      return data.services.filter(s=>user.role==='admin'||s.driver_email===user.email);
    },
    async create(data) { return (await request('api/services/create','POST',data)).service; },
    async delete(id, owner) { await request('api/services/delete','DELETE',{id,driver_email:owner}); }
  };
}
