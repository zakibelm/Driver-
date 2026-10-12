import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAuthMiddleware } from './auth.mjs';
import { createRegistrationMiddleware } from './registration.mjs';
import { createMemoryAccountStore, createFileAccountStore, externalDataFile } from './accounts.mjs';
import { createMailer } from './mailer.mjs';

const ENV = { ADMIN_EMAILS: 'boss@example.test', PUBLIC_URL: 'https://drivepilot.example.test' };
async function setup(env = ENV, store = createMemoryAccountStore()) {
 const outbox = [];
 const mailer = { async send(mail) { outbox.push(mail); } };
 let clock = Date.now(); // chaque appel avance de 5 s : simule le délai normal entre deux tentatives
 const auth = createAuthMiddleware(undefined, env, { store, now: () => (clock += 5000) });
 const reg = createRegistrationMiddleware({ store, mailer, auth, env });
 const server = createServer((req, res) => reg(req, res, () => auth(req, res, () => { res.statusCode = 404; res.end(); })));
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 const base = `http://127.0.0.1:${server.address().port}`;
 const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
 const link = kind => { const m = outbox.at(-1)?.text.match(new RegExp(`\\?${kind}=([A-Za-z0-9_-]+)`)); return m && m[1]; };
 const login = async (identifier, password) => { const r = await post('/api/auth/login', { identifier, password }); return { r, cookie: r.headers.get('set-cookie')?.split(';')[0], data: await r.json() }; };
 return { server, base, post, outbox, link, login, store, close: () => new Promise(r => server.close(r)) };
}

test('admin email: register, choose password via link, log in as admin', async () => {
 const t = await setup();
 try {
  const r = await t.post('/api/auth/register', { email: ' Boss@Example.test ', name: 'Zaki' });
  assert.equal(r.status, 202);
  assert.equal(t.outbox.length, 1);
  assert.equal(t.outbox[0].to, 'boss@example.test');
  assert.match(t.outbox[0].text, /^Bonjour Zaki/);
  assert.match(t.outbox[0].text, /https:\/\/drivepilot\.example\.test\/\?verify=/);
  // Pas de connexion avant d'avoir choisi le mot de passe via le lien.
  assert.equal((await t.login('boss@example.test', 'anything-long')).r.status, 401);
  assert.equal((await t.post('/api/auth/verify', { token: t.link('verify'), password: 'court' })).status, 400);
  const v = await t.post('/api/auth/verify', { token: t.link('verify'), password: 'zakibelm@1' });
  assert.equal(v.status, 200);
  assert.equal((await v.json()).status, 'active');
  // Le lien ne sert qu'une fois.
  assert.equal((await t.post('/api/auth/verify', { token: t.link('verify'), password: 'zakibelm@1' })).status, 400);
  const { r: lr, data } = await t.login('BOSS@example.test', 'zakibelm@1');
  assert.equal(lr.status, 200);
  assert.equal(data.user.role, 'admin');
  assert.equal(data.user.name, 'Zaki');
 } finally { await t.close(); }
});

test('nobody can pre-set the password of someone else’s address', async () => {
 const t = await setup();
 try {
  // Un tiers inscrit l'adresse admin : il ne fournit aucun mot de passe et le lien part dans la boîte du titulaire.
  assert.equal((await t.post('/api/auth/register', { email: 'boss@example.test', name: 'Intrus', password: 'pirate-password' })).status, 400);
  assert.equal((await t.post('/api/auth/register', { email: 'boss@example.test', name: 'Intrus' })).status, 202);
  assert.equal(t.outbox.at(-1).to, 'boss@example.test');
  // Le titulaire s'inscrit ensuite : un nouveau lien remplace l'ancien.
  const first = t.link('verify');
  await t.post('/api/auth/register', { email: 'boss@example.test', name: 'Zaki' });
  assert.notEqual(t.link('verify'), first);
  assert.equal((await t.post('/api/auth/verify', { token: first, password: 'pirate-password' })).status, 400);
 } finally { await t.close(); }
});

test('driver: pending until approved by admin; admins notified; approval, disable, protection', async () => {
 const t = await setup();
 try {
  await t.post('/api/auth/register', { email: 'boss@example.test', name: 'Zaki' });
  await t.post('/api/auth/verify', { token: t.link('verify'), password: 'admin-password-1' });
  await t.post('/api/auth/register', { email: 'driver@example.test', name: 'Ali' });
  const v = await t.post('/api/auth/verify', { token: t.link('verify'), password: 'driver-password' });
  assert.equal((await v.json()).status, 'pending');
  assert.equal(t.outbox.at(-1).to, 'boss@example.test');
  assert.match(t.outbox.at(-1).text, /driver@example\.test/);
  const pending = await t.login('driver@example.test', 'driver-password');
  assert.equal(pending.r.status, 403);
  assert.match(pending.data.error, /approbation/);
  // Mauvais mot de passe : réponse générique, l'état du compte n'est pas révélé.
  assert.equal((await t.login('driver@example.test', 'wrong-password')).r.status, 401);

  const admin = await t.login('boss@example.test', 'admin-password-1');
  const H = { Cookie: admin.cookie, 'Content-Type': 'application/json' };
  const users = (await (await fetch(t.base + '/api/admin/users', { headers: H })).json()).users;
  assert.equal(users[0].status, 'pending');
  assert.equal(JSON.stringify(users).includes('passwordHash'), false);
  assert.equal(JSON.stringify(users).includes('salt'), false);
  const driverId = users.find(u => u.email === 'driver@example.test').id;
  const bossId = users.find(u => u.email === 'boss@example.test').id;
  const put = body => fetch(t.base + '/api/admin/users', { method: 'PUT', headers: H, body: JSON.stringify(body) });
  assert.equal((await put({ id: bossId, status: 'disabled' })).status, 400);
  assert.equal((await put({ id: driverId, status: 'nope' })).status, 400);
  assert.equal((await put({ id: driverId, status: 'active' })).status, 200);
  const driver = await t.login('driver@example.test', 'driver-password');
  assert.equal(driver.r.status, 200);
  assert.equal(driver.data.user.role, 'chauffeur');
  // Un chauffeur n'administre pas.
  assert.equal((await fetch(t.base + '/api/admin/users', { headers: { Cookie: driver.cookie } })).status, 403);
  // Désactivation : la session ouverte est fermée immédiatement.
  assert.equal((await put({ id: driverId, status: 'disabled' })).status, 200);
  assert.equal((await (await fetch(t.base + '/api/auth/session', { headers: { Cookie: driver.cookie } })).json()).user, null);
  assert.equal((await t.login('driver@example.test', 'driver-password')).r.status, 403);
  assert.equal((await fetch(t.base + '/api/admin/users')).status, 401);
 } finally { await t.close(); }
});

test('forgot password: generic answer, one-time link, sessions closed', async () => {
 const t = await setup();
 try {
  await t.post('/api/auth/register', { email: 'boss@example.test', name: 'Zaki' });
  await t.post('/api/auth/verify', { token: t.link('verify'), password: 'old-password-1' });
  const session = await t.login('boss@example.test', 'old-password-1');
  const sent = t.outbox.length;
  const unknown = await t.post('/api/auth/forgot', { email: 'nobody@example.test' });
  assert.equal(unknown.status, 202);
  assert.equal(t.outbox.length, sent);
  const known = await t.post('/api/auth/forgot', { email: 'boss@example.test' });
  assert.equal(known.status, 202);
  assert.deepEqual(await unknown.json(), await known.json());
  const token = t.link('reset');
  assert.ok(token);
  assert.equal((await t.post('/api/auth/reset', { token, password: 'new-password-2' })).status, 200);
  assert.equal((await t.post('/api/auth/reset', { token, password: 'new-password-3' })).status, 400);
  assert.equal((await (await fetch(t.base + '/api/auth/session', { headers: { Cookie: session.cookie } })).json()).user, null);
  assert.equal((await t.login('boss@example.test', 'old-password-1')).r.status, 401);
  assert.equal((await t.login('boss@example.test', 'new-password-2')).r.status, 200);
  // Inscription d'une adresse déjà active : courriel « compte existant », aucun nouveau compte.
  await t.post('/api/auth/register', { email: 'boss@example.test', name: 'X' });
  assert.match(t.outbox.at(-1).subject, /déjà un compte/);
 } finally { await t.close(); }
});

test('input validation, query strings, rate limiting', async () => {
 const t = await setup();
 try {
  assert.equal((await t.post('/api/auth/register', { email: 'pas-un-courriel', name: 'A' })).status, 400);
  assert.equal((await t.post('/api/auth/register', { email: 'a@example.test', name: 'A', role: 'admin' })).status, 400);
  assert.equal((await t.post('/api/auth/verify', { token: 'x', password: 'long-enough-1' })).status, 400);
  assert.equal((await fetch(t.base + '/api/auth/register?x=1', { method: 'POST' })).status, 400);
  assert.equal((await fetch(t.base + '/api/auth/register')).status, 405);
  let last;
  for(let i = 0; i < 30; i++) last = await t.post('/api/auth/forgot', { email: `x${i}@example.test` });
  assert.equal(last.status, 429);
 } finally { await t.close(); }
});

test('file store: atomic private file outside the project; mailer providers', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'dp-'));
 const file = path.join(dir, 'accounts.json');
 assert.equal(externalDataFile(file, process.cwd()), file);
 assert.equal(externalDataFile('relative.json', process.cwd()), undefined);
 assert.equal(externalDataFile(path.join(process.cwd(), 'accounts.json'), process.cwd()), undefined);
 const t = await setup(ENV, createFileAccountStore(file));
 try {
  await t.post('/api/auth/register', { email: 'boss@example.test', name: 'Zaki' });
  await t.post('/api/auth/verify', { token: t.link('verify'), password: 'file-password-1' });
  assert.equal(((await stat(file)).mode & 0o777).toString(8), '600');
  const saved = await readFile(file, 'utf8');
  assert.equal(saved.includes('file-password-1'), false);
  assert.equal((await t.login('boss@example.test', 'file-password-1')).r.status, 200);
 } finally { await t.close(); }
 const logs = []; await createMailer({ MAIL_PROVIDER: 'log' }, fetch, { warn: m => logs.push(m) }).send({ to: 'a@b.ca', subject: 'S', text: 'T' });
 assert.match(logs[0], /a@b\.ca/);
 let call; await createMailer({ N8N_URL: 'https://n8n.test/webhook/', N8N_TOKEN: 't' }, async (url, o) => { call = { url, o }; return { ok: true }; }).send({ to: 'a@b.ca', subject: 'S', text: 'T' });
 assert.equal(call.url, 'https://n8n.test/webhook/api/mail/send');
 assert.equal(call.o.headers['X-DrivePilot-Token'], 't');
 await assert.rejects(createMailer({}).send({ to: 'a@b.ca', subject: 'S', text: 'T' }), e => e.status === 503);
});
