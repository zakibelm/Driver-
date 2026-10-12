import { sessionCookie } from './security.mjs';
import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const cookieName = 'taxi_session';
const lifetime = 8 * 60 * 60 * 1000;

export function createAuthMiddleware(accountFile, env = process.env) {
  const sessions = new Map();
  const attempts = new Map();
  const sessionId = (req) => (req.headers.cookie || '').split(';').map(v => v.trim())
    .find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);

  const middleware = async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith('/api/auth/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    const reply = (status, data) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    };
    const now = Date.now();
    for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id);
    for (const [ip, attempt] of attempts) if (attempt.expires <= now) attempts.delete(ip);
    if (req.method === 'GET' && path === '/api/auth/session') {
      const session = sessions.get(sessionId(req));
      return reply(session ? 200 : 401, session ? { user: session.user } : { error: 'Session expirée.' });
    }
    if (req.method !== 'POST') return reply(405, { error: 'Méthode non autorisée.' });
    // Browsers must submit credentials and logout requests from this same origin.
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) return reply(403, { error: 'Origine non autorisée.' });
      } catch { return reply(403, { error: 'Origine non autorisée.' }); }
    }
    if (path === '/api/auth/logout') {
      sessions.delete(sessionId(req));
      res.setHeader('Set-Cookie', sessionCookie(req, '', 0, env));
      return reply(200, { success: true });
    }
    if (path !== '/api/auth/login') return reply(404, { error: 'Introuvable.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Format non autorisé.' });
    const ip = req.socket.remoteAddress || 'local';
    const attempt = attempts.get(ip) || { count: 0, expires: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) return reply(429, { error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    let body;
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 4096) return reply(413, { error: 'Requête trop volumineuse.' });
      }
      body = JSON.parse(raw);
    } catch { return reply(400, { error: 'Requête invalide.' }); }
    let account;
    try { account = JSON.parse(readFileSync(accountFile, 'utf8')); }
    catch { return reply(503, { error: 'Compte administrateur non configuré sur ce serveur.' }); }
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const expected = Buffer.from(account.passwordHash, 'hex');
    const actual = scryptSync(password, account.salt, 64);
    if (![account.email.toLowerCase(), account.username.toLowerCase()].includes(identifier)
        || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      attempt.count++;
      attempts.set(ip, attempt);
      return reply(401, { error: 'Identifiant ou mot de passe incorrect.' });
    }
    attempts.delete(ip);
    sessions.delete(sessionId(req));
    const id = randomBytes(32).toString('hex');
    const user = { id: account.id, email: account.email, name: account.username, role: 'admin' };
    sessions.set(id, { user, expires: now + lifetime });
    res.setHeader('Set-Cookie', sessionCookie(req, id, lifetime / 1000, env));
    return reply(200, { user });
  };
  middleware.getUser = req => { const session = sessions.get(sessionId(req)); return session && session.expires > Date.now() ? session.user : null; };
  return middleware;
}

export function localAuthPlugin(accountFile) {
  const middleware = createAuthMiddleware(accountFile);
  return {
    name: 'local-admin-auth',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
