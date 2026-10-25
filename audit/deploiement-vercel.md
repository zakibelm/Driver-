# Déploiement DrivePilot — 25 octobre 2026

- Projet Vercel : `drivepilot`, `prj_3ZGOiqAKxnmAfa4DZnuSoroykpEg`.
- Équipe : `zaks-projects-f05d04ab`.
- Version déployée : commit `3a62ed1` de `fix/security-hardening`.
- Déploiement : `dpl_FcJPtHV36rfo3zSBBPXmoFzXJyfK`, état READY, environnement production.
- Adresse principale : https://drivepilot-zaks-projects-f05d04ab.vercel.app/
- Interface React/Vite et fonction API Node.js 24.

## Réinitialisation

Les anciennes données et conversations de démonstration du navigateur ont été effacées par la migration locale, et la génération des trois courses fictives a été supprimée. Les courses de test créées dans n8n ont été supprimées et leur absence confirmée. Aucune course réelle n’a été supprimée.

## Connexion réelle

Le compte administrateur est configuré dans une variable Vercel secrète avec son empreinte scrypt. Le mot de passe en clair n’est stocké ni dans le code, ni dans les fichiers publiés, ni dans GitHub. Les sessions et limitations de connexion sont partagées dans n8n. Le jeton du cookie n’est pas stocké en clair dans les tables de sessions.

## Vérifications

- 27 tests locaux réussis, vérification TypeScript et compilation réussies.
- Aucun jeton n8n ni compte administrateur dans le JavaScript destiné au navigateur.
- Vérifications réelles sur Vercel : connexion HTTP 200, session persistante HTTP 200, course invalide refusée sans écriture HTTP 400, fichier privé refusé HTTP 403, route API inconnue HTTP 404, déconnexion HTTP 200 et session révoquée HTTP 401.
- Rapport détaillé sans secrets : `vercel-production-check.json`.
- Scan des logs d’erreur du déploiement : aucun résultat pendant la vérification.

## Choix en attente d’autorisation

- Vercel Authentication protège encore les adresses de production. La connexion Vercel s’ajoute donc à la connexion DrivePilot. Le passage au mode standard, qui rend seulement l’adresse principale accessible avec la connexion DrivePilot tout en protégeant les URLs de test, a été refusé par le contrôle automatique faute d’autorisation explicite ; une question a été soumise à l’utilisateur.
- L’assistant reste sur le fournisseur OpenRouter d’origine, sans clé configurée. Le remplacement par Vercel AI Gateway n’a pas été appliqué : le contrôle automatique exige l’accord explicite pour l’envoi des messages et statistiques agrégées à ce fournisseur ; une question a été soumise à l’utilisateur.

Les captures locales, workflows, scripts d’administration, tests et secrets sont exclus des fichiers publiés grâce à `.vercelignore`.
