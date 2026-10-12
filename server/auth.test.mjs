import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';

import { join } from 'node:path';
import { scryptSync } from 'node:crypto';
import { createAuthMiddleware } from './auth.mjs';

test('admin authentication, session, logout and rejection paths', async () => {
  const dir = mkdtempSync(join('dist/', 'taxi-auth-test-'));
  const file = join(dir, 'account.json');
  const password = 'test-only-password';
  writeFileSync(file, JSON.stringify({ id: 'test-admin', email: 'admin@example.test', username: 'admin',
    salt: 'test-salt', passwordHash: scryptSync(password, 'test-salt', 64).toString('hex') }));
  const middleware = createAuthMiddleware(file);
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (identifier, password, origin = base) => fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ identifier, password })
  });
  try {
    assert.equal((await fetch(`${base}/api/auth/session`)).status, 401);
    assert.equal((await login('admin', 'wrong')).status, 401);
    assert.equal((await login('stranger', password)).status, 401);
    assert.equal((await login('demo@cooptaxi.com', password)).status, 401);
    assert.equal((await login('admin', password, 'https://other.example')).status, 403);
    const response = await login(' ADMIN@EXAMPLE.TEST ', password);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.role, 'admin');
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const headers = { Cookie: cookie.split(';')[0] };
    assert.equal((await fetch(`${base}/api/auth/session`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })).status, 200);
    assert.equal((await fetch(`${base}/api/auth/session`, { headers })).status, 401);
    assert.equal((await login('admin', password)).status, 200);
    for (let i = 0; i < 10; i++) assert.equal((await login('admin', 'wrong')).status, 401);
    assert.equal((await login('admin', password)).status, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(file);
    rmdirSync(dir);
  }
});
