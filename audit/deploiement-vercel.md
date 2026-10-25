# Déploiement DrivePilot — 25 octobre 2026

- Version applicative : `bef04eb`, branche `fix/security-hardening`.
- Projet Vercel : `prj_3ZGOiqAKxnmAfa4DZnuSoroykpEg`.
- Déploiement : `dpl_2rc4iG5BWye1TUmfSwcHdKGkznCM`, READY, production.
- Adresse : https://drivepilot-zaks-projects-f05d04ab.vercel.app/
- Interface et API sur Vercel ; données persistantes dans les Data Tables n8n.

## Accès et données

Les courses fictives et les fixtures de vérification ont été supprimées. Aucune course réelle supprimée. Le bouton Mode Démo a été retiré. Les placeholders et le texte sous la connexion indiquent test@drivepilot.com / test1234 : cet accès ouvre un espace local vide, isolé des données réelles.

Le compte administrateur est enregistré avec une empreinte scrypt. Aucun mot de passe en clair dans GitHub ou les fichiers publiés. Les sessions et limitations de connexion sont partagées dans n8n ; les jetons de session sont conservés uniquement sous forme d’empreintes.

Inscription chauffeur avec confirmation du courriel, récupération avec lien à usage unique et expiration. Les liens sont stockés sous forme d’empreintes ; changer le mot de passe invalide les anciennes sessions. SMTP n8n configuré avec limitation des envois et sans conservation des exécutions contenant les liens.

## Protection et assistant

Après autorisation, protection Vercel standard : adresse principale publique avec connexion DrivePilot obligatoire pour les données ; URLs techniques et previews protégées par Vercel.

Vercel AI Gateway activé après consentement, avec identité OIDC et SDK officiel @vercel/oidc. Les noms de services personnalisés, notes et identifiants ne sont pas transmis. Les statistiques agrégées sont incluses uniquement si le partage est activé. Modèle nvidia/nemotron-3.5-lightning-free, sans bascule automatique payante.

## Vérifications

- Suite locale précédente : 29 tests réussis, TypeScript et compilation réussis. Après la correction serveur finale : les 5 tests comptes/assistant relancés avec succès. Compilation Vercel réussie.
- Aucun jeton n8n ni empreinte administrateur dans le JavaScript navigateur.
- 13 contrôles publics réussis : connexion réelle, session persistante, cookie sécurisé, accès anonyme refusé, requêtes invalides sans écriture, injection de rôle refusée, récupération générique, lien invalide refusé, réponse Gateway, fichiers privés bloqués, déconnexion et révocation.
- Stockage réel n8n vérifié : confirmation, consommation concurrente du jeton une seule fois, changement de mot de passe et invalidation de session. Fixtures supprimées.
- Contrôle visuel production : connexion, inscription, mot de passe oublié, espace d’essai vide, déconnexion.
- Rapports sans secrets : public-production-check.json et accounts-storage-check.json.
- Aucun courriel réel envoyé pendant les vérifications. La réception dans une boîte de messagerie reste à valider ; autorisation pour un courriel technique en attente.

Les secrets, captures, workflows, scripts administratifs et tests sont exclus du déploiement par .vercelignore.
