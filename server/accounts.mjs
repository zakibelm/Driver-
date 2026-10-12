// Stockage des comptes inscrits (fichier JSON privé, hors du projet).
// Interface volontairement minimale pour pouvoir remplacer le fichier par une base (n8n Data Table, Postgres…)
// sans toucher aux routes : load(), mutate(fn).
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { realpathSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

export const STATUSES = ['unverified', 'pending', 'active', 'disabled'];

/** Chemin absolu dont le dossier parent existe et se trouve hors de la racine servie ; sinon undefined. */
export function externalDataFile(file, root) {
 if(!file || !path.isAbsolute(file)) return undefined;
 const dir = path.dirname(file);
 if(!existsSync(dir)) return undefined;
 const relative = path.relative(realpathSync(root), realpathSync(dir));
 if(!relative.startsWith('..') && !path.isAbsolute(relative)) return undefined; // dans le projet : refusé
 return path.join(realpathSync(dir), path.basename(file));
}

const empty = () => ({ accounts: [], tokens: [] });

/** Magasin mémoire (tests, démo). */
export function createMemoryAccountStore(initial = empty()) {
 let data = structuredClone(initial);
 let queue = Promise.resolve();
 return {
  async load() { return structuredClone(data); },
  mutate(fn) {
   const run = queue.then(async () => { const draft = structuredClone(data); const result = await fn(draft); data = draft; return result; });
   queue = run.catch(() => {});
   return run;
  }
 };
}

/** Magasin fichier : écritures sérialisées et atomiques (fichier temporaire puis rename), permissions 600. */
export function createFileAccountStore(file) {
 let queue = Promise.resolve();
 const read = async () => {
  try {
   const value = JSON.parse(await readFile(file, 'utf8'));
   return { accounts: Array.isArray(value.accounts) ? value.accounts : [], tokens: Array.isArray(value.tokens) ? value.tokens : [] };
  } catch(error) { if(error.code === 'ENOENT') return empty(); throw error; }
 };
 return {
  load: read,
  mutate(fn) {
   const run = queue.then(async () => {
    const draft = await read();
    const result = await fn(draft);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, JSON.stringify(draft), { mode: 0o600 });
    await rename(tmp, file);
    return result;
   });
   queue = run.catch(() => {});
   return run;
  }
 };
}

export const hashToken = token => createHash('sha256').update(String(token)).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const normalizeEmail = value => String(value).trim().toLowerCase();
/** Liste des courriels admin (ADMIN_EMAILS, séparés par des virgules). */
export const adminEmails = env => new Set(String(env.ADMIN_EMAILS || '').split(',').map(normalizeEmail).filter(Boolean));
/** Vue publique d'un compte : jamais de sel, d'empreinte ni de jeton. */
export const publicAccount = a => ({ id: a.id, email: a.email, username: a.username, role: a.role, status: a.status, created_at: a.created_at });
