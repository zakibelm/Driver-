// Creates and removes only its own synthetic course; never lists real owners or all rows.
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createN8nProvider } from '../server/providers/n8n.mjs';

process.loadEnvFile(new URL('../.env.local', import.meta.url));
const provider = createN8nProvider(process.env);
const statePath = new URL('../audit/n8n-connexion.json', import.meta.url);
const state = JSON.parse(await readFile(statePath, 'utf8'));
const owner = `drivepilot-test-${randomUUID()}@example.test`;
const user = { role: 'chauffeur', email: owner };
const checks = [];
let created;
let cleanupConfirmed = false;
try {
  if (state.pendingTest) {
    const pending = state.pendingTest;
    if (!/^drivepilot-test-[a-f0-9-]+@example\.test$/.test(pending.owner)) throw new Error('Propriétaire de test inattendu : nettoyage refusé.');
    await provider.delete(pending.id, pending.owner);
    const leftovers = await provider.list({ role: 'chauffeur', email: pending.owner });
    if (leftovers.some(row => row.id === pending.id)) throw new Error('Le nettoyage de la course de test précédente a échoué.');
    delete state.pendingTest;
    await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
    checks.push({ test: 'cleanup-previous-test-only', ok: true });
  }
  for (const [name, headers] of [['missing-token', {}], ['invalid-token', { 'X-DrivePilot-Token': 'invalid' }]]) {
    const response = await fetch(`${process.env.N8N_URL}/api/services/list?email=${encodeURIComponent(owner)}`, {
      headers, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    checks.push({ test: name, status: response.status, ok: [401, 403].includes(response.status) });
  }
  created = await provider.create({
    type: 'Transport de test DrivePilot', amount: 1.23, date: new Date().toISOString(),
    description: 'Test technique autorisé : cette course sera supprimée automatiquement.', driver_email: owner,
  });
  if (!created?.id) throw new Error('La création ne renvoie pas un identifiant de course.');
  state.pendingTest = { id: created.id, owner };
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  checks.push({ test: 'create-custom-service', ok: created.type === 'Transport de test DrivePilot' && created.amount === 1.23 });
  const rows = await provider.list(user);
  checks.push({ test: 'read-created-course', ok: rows.some(row => row.id === created.id && row.driver_email === owner) });
  const other = await provider.list({ role: 'chauffeur', email: `other-${randomUUID()}@example.test` });
  checks.push({ test: 'owner-isolation', ok: !other.some(row => row.id === created.id) });
} catch (error) {
  checks.push({ test: 'connection', ok: false, message: error.message });
} finally {
  if (created?.id) {
    try {
      await provider.delete(created.id, owner);
      const remaining = await provider.list(user);
      cleanupConfirmed = !remaining.some(row => row.id === created.id);
      checks.push({ test: 'delete-created-test-only', ok: cleanupConfirmed });
      if (cleanupConfirmed) delete state.pendingTest;
    } catch (error) { checks.push({ test: 'cleanup', ok: false, message: error.message }); }
  }
  state.lastTest = { at: new Date().toISOString(), checks, cleanupConfirmed };
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
}
console.log(JSON.stringify(state.lastTest, null, 2));
if (checks.some(check => !check.ok)) process.exitCode = 1;
