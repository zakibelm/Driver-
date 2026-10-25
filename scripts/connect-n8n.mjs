// Management key is supplied temporarily in N8N_SETUP_API_KEY and is never saved.
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const instance = 'https://n8n.xtream.space';
const statePath = new URL('../audit/n8n-connexion.json', import.meta.url);
const configPath = new URL('../.env.local', import.meta.url);
const workflowPath = new URL('../n8n_workflows/06-connexion-application-workflow.json', import.meta.url);
const key = process.env.N8N_SETUP_API_KEY;
if (!key) throw new Error('N8N_SETUP_API_KEY doit être fourni temporairement.');
async function api(path, method = 'GET', body) {
  const response = await fetch(instance + '/api/v1' + path, {
    method, headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`API n8n ${method} ${path}: HTTP ${response.status}`);
  return data;
}
let config = await readFile(configPath, 'utf8').catch(() => '');
let state = JSON.parse(await readFile(statePath, 'utf8').catch(() => '{}'));
const saveState = () => writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
const setConfig = (name, value) => {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  config = pattern.test(config) ? config.replace(pattern, line) : config.replace(/\s*$/, '') + '\n' + line + '\n';
};
let token = config.match(/^N8N_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) token = randomBytes(32).toString('hex');
setConfig('N8N_URL', instance + '/webhook/drivepilot-app');
setConfig('N8N_TOKEN', token);
await writeFile(configPath, config.replace(/^\n/, ''), { mode: 0o600 });
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));
state.instance = instance;
state.webhookBase = instance + '/webhook/drivepilot-app';
state.servicesTableId = 'k7qrYzRHXLi0Yf9K';
state.driversTableId = 'nIUs2pnr1KHF40on';
if (!state.credentialId) {
  const credential = await api('/credentials', 'POST', {
    name: 'DrivePilot application - webhook dédié', type: 'httpHeaderAuth',
    data: { name: 'X-DrivePilot-Token', value: token },
  });
  state.credentialId = credential.id;
  await saveState();
}
for (const node of workflow.nodes) {
  if (node.type.endsWith('.webhook')) node.credentials = {
    httpHeaderAuth: { id: state.credentialId, name: 'DrivePilot application - webhook dédié' },
  };
}
if (!state.workflowId) {
  const created = await api('/workflows', 'POST', {
    name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: { executionOrder: 'v1' },
  });
  state.workflowId = created.id;
  state.workflowName = created.name;
  await saveState();
}
await writeFile(workflowPath, JSON.stringify(workflow, null, 2) + '\n');
const current = await api('/workflows/' + state.workflowId);
if (current.active) await api('/workflows/' + state.workflowId + '/deactivate', 'POST', {});
await api('/workflows/' + state.workflowId, 'PUT', {
  name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: { executionOrder: 'v1' },
});
await api('/workflows/' + state.workflowId + '/activate', 'POST', {});
const confirmed = await api('/workflows/' + state.workflowId);
state.active = confirmed.active;
state.verifiedAt = new Date().toISOString();
await saveState();
console.log(JSON.stringify({ instance, workflowId: state.workflowId, active: state.active, localConfigSaved: true }));
