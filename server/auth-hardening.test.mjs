import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createAuthMiddleware } from './auth.mjs';
test('malformed account entries are rejected with 401, never a 500', async () => {
 const hash = (await promisify(scrypt)('pw-for-test', 'salt', 64)).toString('hex');
 const accounts = [null, 'texte', { id: 'a', username: 'noemail', salt: 'salt', passwordHash: hash },
  { id: 'b', email: 42, username: 'numeric', salt: 'salt', passwordHash: hash }, { email: 'noid@example.test', username: 'noid', salt: 'salt', passwordHash: hash }];
 const auth = createAuthMiddleware(undefined, {}, { loadAccounts: async () => accounts });
 const server = createServer((req, res) => auth(req, res, () => { res.statusCode = 404; res.end(); }));
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 const base = `http://127.0.0.1:${server.address().port}`;
 const login = identifier => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password: 'pw-for-test' }) });
 try { for (const id of ['noemail', 'numeric', 'noid', 'noid@example.test']) assert.equal((await login(id)).status, 401, id); }
 finally { await new Promise(r => server.close(r)); }
});
