import { HttpError } from './http.mjs';
// Couche d'envoi interchangeable : MAIL_PROVIDER=n8n (défaut) ou log (lien écrit dans le journal serveur,
// utile pour amorcer le premier compte avant la configuration SMTP).
export function createMailer(env = process.env, fetcher = fetch, logger = console) {
 const provider = env.MAIL_PROVIDER || 'n8n';
 if(provider === 'log') return { provider, async send({ to, subject, text }) { logger.warn(`[DrivePilot courriel → ${to}] ${subject}\n${text}`); } };
 return {
  provider: 'n8n',
  async send({ to, subject, text }) {
   if(!env.N8N_URL || !env.N8N_TOKEN) throw new HttpError(503, 'Envoi de courriels non configuré.');
   let response;
   try {
    response = await fetcher(`${env.N8N_URL.replace(/\/$/, '')}/api/mail/send`, {
     method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
     headers: { 'Content-Type': 'application/json', 'X-DrivePilot-Token': env.N8N_TOKEN },
     body: JSON.stringify({ to, subject, text })
    });
   } catch { throw new HttpError(502, 'Envoi du courriel impossible. Réessayez plus tard.'); }
   if(!response.ok) throw new HttpError(502, 'Envoi du courriel impossible. Réessayez plus tard.');
  }
 };
}

export const mails = {
 verify: (name, link) => ({ subject: 'DrivePilot : confirmez votre adresse courriel',
  text: `Bonjour ${name},\n\nConfirmez votre adresse et choisissez votre mot de passe DrivePilot :\n${link}\n\nCe lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce courriel.` }),
 reset: (name, link) => ({ subject: 'DrivePilot : réinitialisation du mot de passe',
  text: `Bonjour ${name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien :\n${link}\n\nCe lien expire dans 1 heure et ne fonctionne qu'une fois. Si vous n'avez rien demandé, ignorez ce courriel : votre mot de passe actuel reste valide.` }),
 exists: (name, link) => ({ subject: 'DrivePilot : vous avez déjà un compte',
  text: `Bonjour ${name},\n\nUne inscription a été tentée avec votre adresse, mais un compte existe déjà. Si vous avez oublié votre mot de passe, utilisez « Mot de passe oublié » :\n${link}` }),
 pending: (email, link) => ({ subject: 'DrivePilot : nouveau chauffeur à approuver',
  text: `Un nouveau compte attend votre approbation : ${email}\n\nApprouvez-le dans Paramètres > Utilisateurs :\n${link}` })
};
