# DrivePilot — rapport de durcissement

Branche : `fix/security-hardening`. Les changements de marque, de démarrage et de connexion déjà présents avant la mission sont conservés dans le premier commit. Le fichier `admin-auth.local` n'est ni lu, ni modifié, ni ajouté à Git pendant cette mission.

## Chantier 1 — webhooks

Authentification Header Auth référencée par nom de credential sur cinq endpoints ; validation stricte avant accès aux Data Tables ; branches HTTP 400 ; suppression avec UUID et propriétaire ; liste complète réservée au proxy serveur. Les Data Tables remplacent les anciens nœuds `dataStore` et nécessitent leurs identifiants après import. Aucune credential réelle incluse.

Vérification : tests locaux de structure et exécution des validations, pas un appel à une instance n8n déployée. HTTP 401 natif Header Auth à confirmer après configuration de la credential.

Premier échec de `npm test` : trois hypothèses examinées avant correction : (1) Node 24 résout `server/` comme module et non comme glob, (2) mauvais répertoire courant, (3) mauvais exécutable Node/npm. La sortie confirme (1) et le chemin correct exclut (2). Ajout d'un point d'entrée de tests pour conserver exactement `node --test server/`. Aucun retour arrière.

Fichiers : workflow CRUD, création des tables, générateur, validation et tests dans `server/`, `.gitignore`, `.env.example`, script npm test.

## Chantier 2 — API de courses et isolation

Problème : identité client et repli silencieux local. Action : `/api/services` GET/POST et DELETE `/api/services/:id`, session obligatoire, propriétaire dérivé du serveur, filtrage serveur supplémentaire même si n8n retourne trop de lignes, suppression propriétaire+UUID. n8n est abstrait dans `server/providers/n8n.mjs` ; HTTPS distant, délai 10 s et redirections refusées. Démo séparée, bannière et clés de stockage dédiées. Les réglages fournisseurs du navigateur sont retirés. La séparation de loginDemo (chantier 8) et les UUID de ses nouveaux objets sont avancés car nécessaires à cette isolation.

Preuves : `chantier-2-test.txt` (5 tests verts), `chantier-2-build.txt`, TypeScript sans erreur. Tests : 401 sans session, autre propriétaire invisible et non supprimable, courriel client rejeté, admin voit toutes les lignes, backend absent = 503. Fournisseur simulé, pas de n8n réel connecté.

Fichiers : `server/{http,services,plugin}.mjs`, provider n8n et tests, auth getUser, `services/storage.ts`, `types.ts`, App, Services, Settings, config Vite.

## Chantier 3 — transport et en-têtes

Cookie Secure en production ou HTTPS transmis, y compris expiration. CSP, nosniff, Referrer-Policy, frame-ancestors et HSTS production. Écoute 127.0.0.1 par défaut, HOST surchargeable. Les domaines CDN restent provisoirement autorisés jusqu’au chantier 7. Preuves : chantier-3-test.txt (7 tests verts) et chantier-3-build.txt. Fichiers : server/security.mjs et son test, auth, plugin et vite.config.ts.


## Chantier 4 — Vite et fichiers privés

Vite 6.4.4 était déjà installé et est la dernière 6.x retournée par npm ; version désormais exacte et pnpm-lock.yaml ajouté. `npm ls vite` complet a signalé des dépendances de développement imbriquées de la disposition pnpm ; `npm ls vite --depth=0` confirme la dépendance directe valide. La création d’un verrou npm échouait sur workspace:* : hypothèses considérées : layout pnpm, dépendance projet workspace, registre ; le manifeste ne contient aucun workspace, conservation du gestionnaire pnpm existant et création réussie de son verrou.

ADMIN_AUTH_FILE obligatoire, absolu, résolu hors projet ; aucun repli sur le fichier local. Préfiltre HTTP avant Vite et fs.deny renforcé. Suppression de l’injection GEMINI dans le bundle anticipée pour garantir l’absence de secrets frontend. Preuves : chantier-4-version.txt, chantier-4-http.txt (quatre requêtes 403, corps non lus), chantier-4-test.txt (8 tests verts), chantier-4-build.txt. Les tests de chemins rejettent avant accès disque ; aucun contenu du compte n’a été lu.

Fichiers : server/files.mjs et tests, plugin, config Vite, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, README.

Source sécurité : https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff ; version corrigée de la série 6.x supérieure à 6.4.2.

## Chantier 5 — scrypt et tentatives

Hachage asynchrone ; maximum huit dérivations simultanées ; délais exponentiels de 1 à 60 secondes par IP+identifiant avec Retry-After et expiration 15 minutes. X-Forwarded-For ignoré sauf TRUST_PROXY=1. Les autres identifiants derrière le même proxy ne subissent pas de verrouillage collectif. Sessions et compteurs bornés en mémoire. Configuration de comptes multiples possible avec rôles de confiance dans le fichier externe. Tests uniquement avec comptes synthétiques injectés, aucun accès au compte réel.

Preuves : chantier-5-test.txt (9 tests verts) et chantier-5-build.txt. Fichiers : auth.mjs, limiter.mjs et tests. Limite : stockage de session et quotas mono-processus ; Redis sera requis pour plusieurs instances.


## Chantier 6 — proxy IA

/api/chat exige une session, limite le message à 2 000 caractères et le débit à 10 requêtes/minute/compte. OpenRouter est encapsulé côté serveur avec OPENROUTER_API_KEY et OPENROUTER_MODEL ; aucune clé ou URL fournisseur dans le front. Réponses rendues en texte React échappé, aucun outil ni exécution de réponse. Les anciennes clés user_settings sont retirées du navigateur lors du chargement des préférences.

Les descriptions, identifiants et courriels des courses ne sont jamais transmis : seuls compte, total et types de courses validés entrent dans un bloc « DONNÉES, PAS INSTRUCTIONS » du message utilisateur. Cela élimine le canal d’injection par description, sans prétendre garantir le comportement général d’un LLM.

Modèle : openrouter/free confirmé gratuit par le catalogue public HTTP 200 et https://openrouter.ai/openrouter/free. Preuve chantier-6-modeles.txt. Aucune clé serveur disponible : inférence réelle non testée, à réaliser après configuration ; aucun modèle payant présumé ni clé recherchée ailleurs.

Preuves : chantier-6-test.txt (11 tests verts, exclusion d’une description malveillante, quota et propriétaire), chantier-6-build.txt. Fichiers : server/chat.mjs, providers/openrouter.mjs, leurs tests, plugin, services/storage.ts et Chat.tsx.

## Chantier 7 — dépendances locales

Importmap esm.sh, CDN Tailwind et Google Fonts retirés. Tailwind 3.4.19 compilé par PostCSS ; Inter 5.3.0 fourni par @fontsource/inter et embarqué dans dist. CSP sans domaine externe, script-src self en production ; l’exception inline en développement sert uniquement au préambule React/Vite, styles inline nécessaires aux graphiques. Preuves : chantier-7-build.txt (CSS et huit fichiers de police locaux), chantier-7-test.txt (11 tests verts, CSP sans domaine HTTP externe). Fichiers : index.html, index.tsx, styles.css, configs Tailwind/PostCSS, package.json, pnpm-lock.yaml, security et test.


## Chantier 8 — qualité, marque et documentation

UUID pour les messages temporaires ; aucun Math.random dans le code produit. Liens inertes de connexion retirés. DrivePilot partout dans l’interface. Les indicateurs du tableau de bord et sa courbe utilisent les courses réelles chargées ; aucun revenu fixe, pourcentage fictif ou statut PAYÉ inventé. Dates de formulaire interprétées à midi local pour éviter le décalage de jour au Canada. Formulaire mobile défilant, labels reliés et noms accessibles ajoutés. README réécrit, variables et limites documentées, aucune bannière AI Studio ni GEMINI.

loginDemo n’appelle plus logout depuis le chantier 2. Les préférences et fournisseurs retirés par dépendance des chantiers 2/6 sont vérifiés ici.

Écart explicite : n8n Header Auth natif renvoie 403 sans jeton (source : https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Webhook/utils.ts). Le fragment deployment/n8n-header-auth.conf permet 401 sans jeton au reverse proxy. Non déployé ; pas de test prétendu en production.

Preuves : chantier-8-test.txt (11 tests verts), chantier-8-build.txt. Fichiers : App, Sidebar, Login, Chat, Dashboard, Services, README et fragment nginx.

## Chantier 9 — tests, hygiène et documentation

Problème : aucune preuve d'exécution pour les derniers fichiers modifiés ; rapport d'audit périmé ; README cité « neuf chantiers » pour huit sections.
Action : rapport de chantier 9 rédigé, `audit/rapport.md` mis à jour, scripts `start`, `recette:n8n` et `typecheck` ajoutés, README complété.
Résultat : 20 tests verts (`audit/chantier-9-test.txt`). Limite : exécutés sous Linux/Node 22, build Vite et `tsc` non relancés ; à refaire avec `scripts/check.ps1 9` sur le poste.
`dist/` et `.pnpm-store/` restent présents : leur suppression demande une autorisation de suppression sur le dossier ; ils sont ignorés par Git et régénérables.

## Passe de revue (R1 à R5)

**R1 — Compte administrateur.** Problème : `admin-auth.local` se trouvait encore à la racine du projet et son contenu (sel et empreinte) a été affiché lors du premier audit. Action : le code refuse déjà tout compte dans le projet ; il reste à déplacer le fichier hors du projet, définir `ADMIN_AUTH_FILE` et régénérer le mot de passe (14 caractères minimum). Résultat : connexion réelle possible et empreinte exposée neutralisée. Action manuelle, non faite ici.

**R2 — Serveur de production.** Problème : l'API n'existait que comme plugin Vite (`vite preview` n'est pas un serveur de production). Action : `server/main.mjs` sert `dist/` et l'API avec les mêmes middlewares (liste partagée dans `plugin.mjs`), GET/HEAD seulement, repli SPA, refus de la traversée de chemin, des liens symboliques sortants et des chemins privés, `/api/*` inconnu en 404 JSON, délais d'attente, `NODE_ENV=production` par défaut. Résultat : `npm run build && npm start` derrière un proxy HTTPS ; test `main.test.mjs` (statique, SPA, API, en-têtes, 9 chemins hostiles, lien symbolique, connexion sans compte = 503).

**R3 — Limiteur de connexions.** Problème : un compteur IP+identifiant seul laissait une IP changer d'identifiant sans délai, saturer les huit dérivations scrypt, et l'éviction du plus ancien effaçait le délai d'un compte ciblé. Action : trois compteurs (IP+identifiant, IP seule après 20 échecs, identifiant seul après 30 échecs, plafond 60 s) et refus 60 s des clés inconnues quand une table est pleine, au lieu d'évincer. Résultat : trois nouveaux tests dont l'inondation des tables. Comptes mal formés (sans courriel, identifiant numérique, entrée nulle) : 401 au lieu d'une erreur 500 (`auth-hardening.test.mjs`).

**R4 — Données personnelles envoyées à l'assistant.** Problème : le texte libre du chauffeur part chez un fournisseur externe. Action : refus serveur (400) avant tout appel externe d'un message contenant courriel, téléphone nord-américain, suite de 10 chiffres ou numéro de carte valide (Luhn) ; avertissement visible dans l'écran de l'assistant. Résultat : `privacy.test.mjs` (identifiants détectés, montants et dates non bloqués, fournisseur jamais appelé). Limite : noms et adresses postales ne sont pas détectés.

**R5 — Recette n8n.** Problème : workflows jamais exercés contre un n8n. Action : `scripts/recette-n8n.mjs` (jeton absent ou invalide, 5 entrées invalides, création, isolation entre propriétaires, suppression refusée à un autre propriétaire, suppression puis disparition ; mode `--dry-run`). Résultat : script validé contre un n8n simulé (21 contrôles OK) ; **non exécuté contre une vraie instance** : à lancer après import et configuration de la credential.

Fichiers : server/{limiter,auth,plugin,chat,main,privacy}.mjs, tests associés, scripts/recette-n8n.mjs, pages/Chat.tsx, package.json, README.md.

## Reste à faire par vous
1. Déplacer `admin-auth.local` hors du projet, définir `ADMIN_AUTH_FILE`, régénérer le mot de passe.
2. Importer les workflows dans n8n, créer la credential Header Auth, définir `N8N_URL` et `N8N_TOKEN`, puis `npm run recette:n8n`.
3. Définir `OPENROUTER_API_KEY`, tester une question sans donnée personnelle.
4. Sur le poste : `scripts/check.ps1 9` (build + tests), puis refaire le parcours chauffeur avec captures.
5. Mettre le serveur derrière HTTPS (`TRUST_PROXY=1` seulement si le proxy remplace `X-Forwarded-For`).
