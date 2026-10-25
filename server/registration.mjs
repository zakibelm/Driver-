import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, jsonBody, reply, sameOrigin, validate } from './http.mjs';
import { object, text, email as emailValue } from './validation.mjs';
import { clientIP } from './limiter.mjs';
import { hashToken, newToken, normalizeEmail, adminEmails, publicAccount, STATUSES } from './accounts.mjs';
import { mails } from './mailer.mjs';

const derive = promisify(scrypt);
const HOUR = 60 * 60 * 1000;
export const PASSWORD_MIN = 10;
const GENERIC = 'Si l’adresse est valide, un courriel vient d’être envoyé. Vérifiez aussi vos indésirables.';

/** Quota simple sur fenêtre glissante : protège la boîte de réception et le serveur sans bloquer un usage normal. */
export function createQuota(now = Date.now, windowMs = 15 * 60 * 1000, maxKeys = 20000) {
 const hits = new Map();
 return (key, limit) => {
  const t = now(), list = (hits.get(key) || []).filter(x => x > t - windowMs);
  if(list.length >= limit) return Math.ceil((list[0] + windowMs - t) / 1000);
  if(!hits.has(key) && hits.size >= maxKeys) { for(const [k, v] of hits) if(!v.some(x => x > t - windowMs)) hits.delete(k); if(hits.size >= maxKeys) return 60; }
  list.push(t); hits.set(key, list); return 0;
 };
}
const LIMITS = { register: [10, 3], forgot: [10, 3], verify: [20], reset: [20] }; // [par IP, par courriel]

export async function hashPassword(password) {
 const salt = randomBytes(16).toString('hex');
 return { salt, passwordHash: (await derive(password, salt, 64)).toString('hex') };
}
function password(value) {
 if(typeof value !== 'string' || value.length < PASSWORD_MIN || value.length > 256) throw new Error('password');
 return value;
}
const token = value => { if(typeof value !== 'string' || !/^[A-Za-z0-9_-]{30,100}$/.test(value)) throw new Error('token'); return value; };

/**
 * Inscription, confirmation du courriel, mot de passe oublié et gestion des utilisateurs (admin).
 * - Les réponses publiques sont identiques que le compte existe ou non (pas d'énumération).
 * - Un courriel de ADMIN_EMAILS devient admin actif après confirmation ; les autres attendent l'approbation.
 */
export function createRegistrationMiddleware({ store, mailer, auth, env = process.env, now = Date.now }) {
 const quota = createQuota(now);
 const admins = adminEmails(env);
 const isAdminEmail = e => admins.has(normalizeEmail(e));
 const publicUrl = req => {
  if(env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, '');
  if(env.NODE_ENV === 'production') throw new HttpError(503, 'PUBLIC_URL non configurée.');
  return `http://${req.headers.host}`;
 };
 const throttle = (req, action, id = '') => {
  const [perIp, perId] = LIMITS[action];
  const wait = quota(`${action}|ip|${clientIP(req, env)}`, perIp) || (id && perId ? quota(`${action}|id|${id}`, perId) : 0);
  if(wait) throw Object.assign(new HttpError(429, 'Trop de demandes. Réessayez plus tard.'), { retryAfter: wait });
 };
 const purge = data => { data.tokens = data.tokens.filter(t => t.expires > now()); };
 const issue = (data, account, type, ttl) => {
  data.tokens = data.tokens.filter(t => !(t.account_id === account.id && t.type === type));
  const value = newToken();
  data.tokens.push({ hash: hashToken(value), type, account_id: account.id, expires: now() + ttl });
  return value;
 };
 const consume = (data, value, type) => {
  const found = data.tokens.find(t => t.hash === hashToken(value) && t.type === type && t.expires > now());
  if(!found) return null;
  data.tokens = data.tokens.filter(t => t !== found);
  return data.accounts.find(a => a.id === found.account_id) || null;
 };
 const notifyAdmins = async (req, accountEmail) => {
  for(const to of admins) { try { await mailer.send({ to, ...mails.pending(accountEmail, publicUrl(req)) }); } catch { /* best effort */ } }
 };

 const routes = {
  // Inscription : nom + courriel seulement. Le mot de passe est choisi APRÈS le clic sur le lien,
  // donc uniquement par le propriétaire de la boîte (personne ne peut pré-définir le mot de passe d'un autre).
  async register(req, body) {
   const input = validate(() => { object(body, ['email', 'name']); return { email: emailValue(body.email), name: text(body.name, 60) }; });
   throttle(req, 'register', input.email);
   const base = publicUrl(req);
   const mail = await store.mutate(data => {
    purge(data);
    const existing = data.accounts.find(a => a.email === input.email);
    if(existing && existing.status !== 'unverified') return { to: existing.email, ...mails.exists(existing.username, `${base}/?mode=forgot`) };
    const account = existing || { id: randomUUID(), email: input.email, username: input.name, role: 'chauffeur', status: 'unverified', created_at: new Date(now()).toISOString() };
    if(!existing) data.accounts.push(account);
    const value = issue(data, account, 'verify', 24 * HOUR);
    return { to: account.email, ...mails.verify(account.username, `${base}/?verify=${value}`) };
   });
   await mailer.send(mail);
   return [202, { message: GENERIC }];
  },
  // Confirmation : le lien prouve la possession de la boîte ; on y choisit le mot de passe.
  async verify(req, body) {
   const input = validate(() => { object(body, ['token', 'password']); return { token: token(body.token), password: password(body.password) }; });
   throttle(req, 'verify');
   const secret = await hashPassword(input.password);
   const result = await store.mutate(data => {
    purge(data);
    const account = consume(data, input.token, 'verify');
    if(!account || account.status === 'disabled') return null;
    Object.assign(account, secret);
    if(isAdminEmail(account.email)) Object.assign(account, { role: 'admin', status: 'active' });
    else if(account.status === 'unverified') account.status = 'pending';
    account.updated_at = new Date(now()).toISOString();
    return { status: account.status, email: account.email };
   });
   if(!result) throw new HttpError(400, 'Lien invalide ou expiré. Recommencez l’inscription pour en recevoir un nouveau.');
   if(result.status === 'pending') await notifyAdmins(req, result.email);
   return [200, { status: result.status, message: result.status === 'active'
    ? 'Compte activé. Vous pouvez vous connecter.'
    : 'Adresse confirmée. Votre compte doit maintenant être approuvé par l’administrateur.' }];
  },
  async forgot(req, body) {
   const address = validate(() => { object(body, ['email']); return emailValue(body.email); });
   throttle(req, 'forgot', address);
   const base = publicUrl(req);
   const mail = await store.mutate(data => {
    purge(data);
    const account = data.accounts.find(a => a.email === address);
    if(!account || account.status === 'disabled') return null;
    if(account.status === 'unverified') return { to: account.email, ...mails.verify(account.username, `${base}/?verify=${issue(data, account, 'verify', 24 * HOUR)}`) };
    return { to: account.email, ...mails.reset(account.username, `${base}/?reset=${issue(data, account, 'reset', HOUR)}`) };
   });
   if(mail) await mailer.send(mail);
   return [202, { message: GENERIC }];
  },
  async reset(req, body) {
   const input = validate(() => { object(body, ['token', 'password']); return { token: token(body.token), password: password(body.password) }; });
   throttle(req, 'reset');
   const secret = await hashPassword(input.password);
   const id = await store.mutate(data => {
    purge(data);
    const account = consume(data, input.token, 'reset');
    if(!account || account.status === 'disabled') return null;
    Object.assign(account, secret, { updated_at: new Date(now()).toISOString() });
    data.tokens = data.tokens.filter(t => t.account_id !== account.id);
    return account.id;
   });
   if(!id) throw new HttpError(400, 'Lien invalide ou expiré. Refaites une demande « Mot de passe oublié ».');
   auth.revokeUser?.(id);
   return [200, { message: 'Mot de passe modifié. Vous pouvez vous connecter.' }];
  }
 };

 return async (req, res, next) => {
  const url = new URL(req.url, 'http://local');
  const action = url.pathname.match(/^\/api\/auth\/(register|verify|forgot|reset)$/)?.[1];
  const isUsers = url.pathname === '/api/admin/users';
  if(!action && !isUsers) return next();
  try {
   if(url.search) throw new HttpError(400, 'Paramètres non autorisés.');
   if(action) {
    if(req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
    sameOrigin(req);
    const [status, data] = await routes[action](req, await jsonBody(req, 4096));
    return reply(res, status, data);
   }
   // --- Administration des utilisateurs ---
   const user = auth.getUser(req);
   if(!user) throw new HttpError(401, 'Connexion requise.');
   if(user.role !== 'admin') throw new HttpError(403, 'Réservé à l’administrateur.');
   sameOrigin(req);
   if(req.method === 'GET') {
    const data = await store.load();
    const order = { pending: 0, active: 1, unverified: 2, disabled: 3 };
    return reply(res, 200, { users: data.accounts.map(publicAccount).sort((a, b) => order[a.status] - order[b.status] || a.email.localeCompare(b.email)) });
   }
   if(req.method !== 'PUT') throw new HttpError(405, 'Méthode non autorisée.');
   const body = await jsonBody(req, 2048);
   const input = validate(() => {
    object(body, ['id', 'status', 'role']);
    if(typeof body.id !== 'string' || !body.id) throw new Error('id');
    if(body.status !== undefined && !['active', 'disabled'].includes(body.status)) throw new Error('status');
    if(body.role !== undefined && !['admin', 'chauffeur'].includes(body.role)) throw new Error('role');
    if(body.status === undefined && body.role === undefined) throw new Error('empty');
    return body;
   });
   const result = await store.mutate(data => {
    const account = data.accounts.find(a => a.id === input.id);
    if(!account) return { error: [404, 'Utilisateur introuvable.'] };
    if(account.id === user.id || isAdminEmail(account.email)) return { error: [400, 'Ce compte est protégé : il ne peut pas être modifié ici.'] };
    if(account.status === 'unverified' && input.status === 'active') return { error: [400, 'Le courriel de ce compte n’est pas encore confirmé.'] };
    if(input.status) account.status = input.status;
    if(input.role) account.role = input.role;
    account.updated_at = new Date(now()).toISOString();
    return { account: publicAccount(account) };
   });
   if(result.error) throw new HttpError(...result.error);
   auth.revokeUser?.(result.account.id); // les droits changent : la session doit être rouverte
   return reply(res, 200, { user: result.account });
  } catch(error) {
   if(error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
   reply(res, error.status || 500, { error: error.status ? error.message : 'Erreur interne.' });
  }
 };
}

export { STATUSES };
