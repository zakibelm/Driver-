// Sends exactly one authorized technical message; never changes credentials.
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createN8nSecurity } from '../server/n8n-security.mjs';
import { createAccountStore } from '../server/accounts.mjs';
process.loadEnvFile(new URL('../.env.local', import.meta.url));
const email = process.env.DRIVEPILOT_EMAIL_CHECK_RECIPIENT;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Destinataire autorisé requis dans une variable temporaire.');
const accounts = createAccountStore(createN8nSecurity(process.env).request);
const account = await accounts.find(email);
if (!account?.verified || account.email !== email) throw Error('Compte administrateur confirmé introuvable.');
const reference = 'DP-' + randomUUID().slice(0, 8);
const subject = 'DrivePilot — vérification de la messagerie — ' + reference;
const message = `Bonjour,\n\nCe courriel vérifie le fonctionnement de la messagerie DrivePilot, à votre demande.\n\nVotre compte est déjà confirmé. Aucune action n’est nécessaire : votre mot de passe et vos données restent inchangés.\n\nPour ouvrir DrivePilot : https://drivepilot-zaks-projects-f05d04ab.vercel.app/\n\nRéférence de vérification : ${reference}\n\nDrivePilot`;
const result = await accounts.mail(account, subject, message);
if (result.success !== true) throw Error('Envoi non confirmé par le workflow.');
const report = { at: new Date().toISOString(), reference, subject, workflowAccepted: true, requestsSent: 1, passwordChanged: false, inboxReceiptVerified: false };
await writeFile(new URL('../audit/production-email-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
