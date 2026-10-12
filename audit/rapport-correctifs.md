# DrivePilot â€” rapport de durcissement

Branche : `fix/security-hardening`. Les changements de marque, de dÃ©marrage et de connexion dÃ©jÃ  prÃ©sents avant la mission sont conservÃ©s dans le premier commit. Le fichier `admin-auth.local` n'est ni lu, ni modifiÃ©, ni ajoutÃ© Ã  Git pendant cette mission.

## Chantier 1 â€” webhooks

Authentification Header Auth rÃ©fÃ©rencÃ©e par nom de credential sur cinq endpoints ; validation stricte avant accÃ¨s aux Data Tables ; branches HTTP 400 ; suppression avec UUID et propriÃ©taire ; liste complÃ¨te rÃ©servÃ©e au proxy serveur. Les Data Tables remplacent les anciens nÅ“uds `dataStore` et nÃ©cessitent leurs identifiants aprÃ¨s import. Aucune credential rÃ©elle incluse.

VÃ©rification : tests locaux de structure et exÃ©cution des validations, pas un appel Ã  une instance n8n dÃ©ployÃ©e. HTTP 401 natif Header Auth Ã  confirmer aprÃ¨s configuration de la credential.

Premier Ã©chec de `npm test` : trois hypothÃ¨ses examinÃ©es avant correction : (1) Node 24 rÃ©sout `server/` comme module et non comme glob, (2) mauvais rÃ©pertoire courant, (3) mauvais exÃ©cutable Node/npm. La sortie confirme (1) et le chemin correct exclut (2). Ajout d'un point d'entrÃ©e de tests pour conserver exactement `node --test server/`. Aucun retour arriÃ¨re.

Fichiers : workflow CRUD, crÃ©ation des tables, gÃ©nÃ©rateur, validation et tests dans `server/`, `.gitignore`, `.env.example`, script npm test.

## Chantier 2 — API de courses et isolation

Problème : identité client et repli silencieux local. Action : `/api/services` GET/POST et DELETE `/api/services/:id`, session obligatoire, propriétaire dérivé du serveur, filtrage serveur supplémentaire même si n8n retourne trop de lignes, suppression propriétaire+UUID. n8n est abstrait dans `server/providers/n8n.mjs` ; HTTPS distant, délai 10 s et redirections refusées. Démo séparée, bannière et clés de stockage dédiées. Les réglages fournisseurs du navigateur sont retirés. La séparation de loginDemo (chantier 8) et les UUID de ses nouveaux objets sont avancés car nécessaires à cette isolation.

Preuves : `chantier-2-test.txt` (5 tests verts), `chantier-2-build.txt`, TypeScript sans erreur. Tests : 401 sans session, autre propriétaire invisible et non supprimable, courriel client rejeté, admin voit toutes les lignes, backend absent = 503. Fournisseur simulé, pas de n8n réel connecté.

Fichiers : `server/{http,services,plugin}.mjs`, provider n8n et tests, auth getUser, `services/storage.ts`, `types.ts`, App, Services, Settings, config Vite.

## Chantier 3 â€” transport et en-tÃªtes

Cookie Secure en production ou HTTPS transmis, y compris expiration. CSP, nosniff, Referrer-Policy, frame-ancestors et HSTS production. Ã‰coute 127.0.0.1 par dÃ©faut, HOST surchargeable. Les domaines CDN restent provisoirement autorisÃ©s jusquâ€™au chantier 7. Preuves : chantier-3-test.txt (7 tests verts) et chantier-3-build.txt. Fichiers : server/security.mjs et son test, auth, plugin et vite.config.ts.


## Chantier 4 — Vite et fichiers privés

Vite 6.4.4 était déjà installé et est la dernière 6.x retournée par npm ; version désormais exacte et pnpm-lock.yaml ajouté. `npm ls vite` complet a signalé des dépendances de développement imbriquées de la disposition pnpm ; `npm ls vite --depth=0` confirme la dépendance directe valide. La création d’un verrou npm échouait sur workspace:* : hypothèses considérées : layout pnpm, dépendance projet workspace, registre ; le manifeste ne contient aucun workspace, conservation du gestionnaire pnpm existant et création réussie de son verrou.

ADMIN_AUTH_FILE obligatoire, absolu, résolu hors projet ; aucun repli sur le fichier local. Préfiltre HTTP avant Vite et fs.deny renforcé. Suppression de l’injection GEMINI dans le bundle anticipée pour garantir l’absence de secrets frontend. Preuves : chantier-4-version.txt, chantier-4-http.txt (quatre requêtes 403, corps non lus), chantier-4-test.txt (8 tests verts), chantier-4-build.txt. Les tests de chemins rejettent avant accès disque ; aucun contenu du compte n’a été lu.

Fichiers : server/files.mjs et tests, plugin, config Vite, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, README.

Source sécurité : https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff ; version corrigée de la série 6.x supérieure à 6.4.2.

## Chantier 5 â€” scrypt et tentatives

Hachage asynchrone ; maximum huit dÃ©rivations simultanÃ©es ; dÃ©lais exponentiels de 1 Ã  60 secondes par IP+identifiant avec Retry-After et expiration 15 minutes. X-Forwarded-For ignorÃ© sauf TRUST_PROXY=1. Les autres identifiants derriÃ¨re le mÃªme proxy ne subissent pas de verrouillage collectif. Sessions et compteurs bornÃ©s en mÃ©moire. Configuration de comptes multiples possible avec rÃ´les de confiance dans le fichier externe. Tests uniquement avec comptes synthÃ©tiques injectÃ©s, aucun accÃ¨s au compte rÃ©el.

Preuves : chantier-5-test.txt (9 tests verts) et chantier-5-build.txt. Fichiers : auth.mjs, limiter.mjs et tests. Limite : stockage de session et quotas mono-processus ; Redis sera requis pour plusieurs instances.


## Chantier 6 — proxy IA

/api/chat exige une session, limite le message à 2 000 caractères et le débit à 10 requêtes/minute/compte. OpenRouter est encapsulé côté serveur avec OPENROUTER_API_KEY et OPENROUTER_MODEL ; aucune clé ou URL fournisseur dans le front. Réponses rendues en texte React échappé, aucun outil ni exécution de réponse. Les anciennes clés user_settings sont retirées du navigateur lors du chargement des préférences.

Les descriptions, identifiants et courriels des courses ne sont jamais transmis : seuls compte, total et types de courses validés entrent dans un bloc « DONNÉES, PAS INSTRUCTIONS » du message utilisateur. Cela élimine le canal d’injection par description, sans prétendre garantir le comportement général d’un LLM.

Modèle : openrouter/free confirmé gratuit par le catalogue public HTTP 200 et https://openrouter.ai/openrouter/free. Preuve chantier-6-modeles.txt. Aucune clé serveur disponible : inférence réelle non testée, à réaliser après configuration ; aucun modèle payant présumé ni clé recherchée ailleurs.

Preuves : chantier-6-test.txt (11 tests verts, exclusion d’une description malveillante, quota et propriétaire), chantier-6-build.txt. Fichiers : server/chat.mjs, providers/openrouter.mjs, leurs tests, plugin, services/storage.ts et Chat.tsx.

## Chantier 7 â€” dÃ©pendances locales

Importmap esm.sh, CDN Tailwind et Google Fonts retirÃ©s. Tailwind 3.4.19 compilÃ© par PostCSS ; Inter 5.3.0 fourni par @fontsource/inter et embarquÃ© dans dist. CSP sans domaine externe, script-src self en production ; lâ€™exception inline en dÃ©veloppement sert uniquement au prÃ©ambule React/Vite, styles inline nÃ©cessaires aux graphiques. Preuves : chantier-7-build.txt (CSS et huit fichiers de police locaux), chantier-7-test.txt (11 tests verts, CSP sans domaine HTTP externe). Fichiers : index.html, index.tsx, styles.css, configs Tailwind/PostCSS, package.json, pnpm-lock.yaml, security et test.

