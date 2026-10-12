// Recette des webhooks DrivePilot contre une instance n8n réelle.
// Usage : N8N_URL=https://n8n.exemple.ca/webhook N8N_TOKEN=... node scripts/recette-n8n.mjs [--dry-run]
// Crée puis supprime une seule course de test (recette@example.test). Aucun secret n'est affiché.
const dry = process.argv.includes('--dry-run');
const url = process.env.N8N_URL, token = process.env.N8N_TOKEN;
const OWNER = 'recette@example.test';
function fail(message) { console.error(message); process.exit(2); }
if(!dry) {
 if(!url || !token) fail('N8N_URL et N8N_TOKEN sont requis (voir README).');
 let base; try { base = new URL(url); } catch { fail('N8N_URL invalide.'); }
 if(base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) fail('HTTPS requis hors boucle locale.');
}
const root = (url || 'https://n8n.example/webhook').replace(/\/$/, '');
const valid = { type: 'Regular', amount: 12.5, date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), description: 'recette automatique', driver_email: OWNER };
const results = [];
let createdId;
async function call(name, expected, path, { method = 'GET', headers = { 'X-DrivePilot-Token': token }, body } = {}) {
 const accepted = Array.isArray(expected) ? expected : [expected];
 if(dry) { results.push({ name, attendu: accepted.join('/'), obtenu: '(dry-run)', ok: true }); return null; }
 let status = 0, data = null;
 try {
  const response = await fetch(`${root}/${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(10000),
   headers: { 'Content-Type': 'application/json', ...(headers || {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  status = response.status; data = await response.json().catch(() => null);
 } catch { status = 0; }
 results.push({ name, attendu: accepted.join('/'), obtenu: status || 'réseau', ok: accepted.includes(status) });
 return { status, data };
}
// Sans jeton / mauvais jeton : n8n natif répond 403 ; le fragment nginx répond 401 si le jeton est absent.
await call('liste sans jeton', [401, 403], 'api/services/list', { method: 'POST', headers: {}, body: { email: OWNER } });
await call('liste mauvais jeton', [401, 403], 'api/services/list', { method: 'POST', headers: { 'X-DrivePilot-Token': 'invalide' }, body: { email: OWNER } });
await call('création sans jeton', [401, 403], 'api/services/create', { method: 'POST', headers: {}, body: valid });
// Entrées invalides : 400 attendu avant tout accès aux tables.
await call('montant négatif', 400, 'api/services/create', { method: 'POST', body: { ...valid, amount: -5 } });
await call('type au format invalide', 400, 'api/services/create', { method: 'POST', body: { ...valid, type: '<script>' } });
// Types de service : lecture authentifiée et validation stricte (aucune écriture pendant la recette).
await call('types sans jeton', [401, 403], 'api/service-types/all', { headers: {} });
await call('liste des types', 200, 'api/service-types/all');
await call('enregistrement de type invalide', 400, 'api/service-types/save', { method: 'POST', body: { name: '<x>', active: true } });
await call('champ inconnu', 400, 'api/services/create', { method: 'POST', body: { ...valid, role: 'admin' } });
await call('courriel invalide', 400, 'api/services/list', { method: 'POST', body: { email: 'pas-un-courriel' } });
await call('identifiant de suppression invalide', 400, 'api/services/delete', { method: 'DELETE', body: { id: '1', driver_email: OWNER } });
// Cycle nominal.
const created = await call('création valide', [200, 201], 'api/services/create', { method: 'POST', body: valid });
createdId = created?.data?.service?.id;
if(!dry) results.push({ name: 'création : id UUID renvoyé', attendu: 'uuid', obtenu: createdId ? 'présent' : 'absent', ok: /^[0-9a-f-]{36}$/i.test(createdId || '') });
const listed = await call('liste du propriétaire', 200, 'api/services/list', { method: 'POST', body: { email: OWNER } });
if(!dry) results.push({ name: 'liste : course créée présente', attendu: 'oui', obtenu: listed?.data?.services?.some(s => s.id === createdId) ? 'oui' : 'non', ok: !!listed?.data?.services?.some(s => s.id === createdId) });
const other = await call('liste d’un autre propriétaire', 200, 'api/services/list', { method: 'POST', body: { email: 'autre@example.test' } });
if(!dry) results.push({ name: 'isolation : aucune ligne de recette chez un autre', attendu: 'oui', obtenu: (other?.data?.services || []).some(s => s.id === createdId) ? 'fuite' : 'oui', ok: !(other?.data?.services || []).some(s => s.id === createdId) });
await call('liste complète (serveur)', 200, 'api/services/all');
await call('suppression avec un mauvais propriétaire', [200, 404], 'api/services/delete', { method: 'DELETE', body: { id: createdId || '00000000-0000-4000-8000-000000000000', driver_email: 'autre@example.test' } });
if(!dry) {
 const still = await call('course toujours présente après suppression refusée', 200, 'api/services/list', { method: 'POST', body: { email: OWNER } });
 results.push({ name: 'suppression par un autre propriétaire sans effet', attendu: 'oui', obtenu: still?.data?.services?.some(s => s.id === createdId) ? 'oui' : 'non', ok: !!still?.data?.services?.some(s => s.id === createdId) });
}
await call('suppression par le propriétaire', 200, 'api/services/delete', { method: 'DELETE', body: { id: createdId || '00000000-0000-4000-8000-000000000000', driver_email: OWNER } });
if(!dry) {
 const gone = await call('liste après suppression', 200, 'api/services/list', { method: 'POST', body: { email: OWNER } });
 results.push({ name: 'course supprimée', attendu: 'oui', obtenu: gone?.data?.services?.some(s => s.id === createdId) ? 'non' : 'oui', ok: !gone?.data?.services?.some(s => s.id === createdId) });
}
console.table(results.map(r => ({ test: r.name, attendu: r.attendu, obtenu: r.obtenu, résultat: r.ok ? 'OK' : 'ÉCHEC' })));
const failed = results.filter(r => !r.ok).length;
console.log(dry ? 'Simulation terminée : aucune requête envoyée.' : failed ? `${failed} échec(s).` : 'Recette complète : tous les cas sont conformes.');
process.exit(failed ? 1 : 0);
