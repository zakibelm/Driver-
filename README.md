# DrivePilot



Application React 19 / Vite 6 pour suivre les courses, consulter les statistiques et demander une analyse à un assistant. Le logo est fourni par Zaki.



## Démarrage



Node.js 22 ou 24. Les dépendances sont verrouillées dans `pnpm-lock.yaml` :



```sh

pnpm install --frozen-lockfile

npm run dev

```



Aperçu : http://127.0.0.1:3012. Le port est strict : aucune substitution silencieuse vers un autre port. `HOST` peut changer l’adresse d’écoute ; garder la boucle locale derrière un reverse proxy.



```sh

npm run build

npm test

npx tsc --noEmit

```



`npm test` exécute `node --test server/` via un point d’entrée compatible Node 24. Les tests utilisent des comptes et fournisseurs synthétiques, jamais le compte réel. Les répertoires dist et .pnpm-store sont régénérables.



## Configuration serveur



Copier `.env.example` vers `.env.local` et renseigner les variables sur la machine serveur. Aucun secret ne doit avoir le préfixe VITE_. Les fichiers `.env*` sont ignorés sauf le modèle vide. Ne jamais committer un jeton, mot de passe ou fichier de compte.



| Variable | Usage |

| --- | --- |

| ADMIN_AUTH_FILE | Facultatif. Compte historique en lecture seule (JSON), hors du projet. |
| ACCOUNTS_FILE | Chemin absolu du fichier des comptes inscrits (créé automatiquement, permissions 600). Le dossier doit exister et se trouver hors du projet, ex. `/var/lib/drivepilot/accounts.json`. Active l'inscription et « Mot de passe oublié ». |
| ADMIN_EMAILS | Courriels administrateurs, séparés par des virgules. Après confirmation du courriel, ces comptes sont admin actifs ; ils ne peuvent pas être rétrogradés depuis l'interface. |
| PUBLIC_URL | Adresse publique utilisée dans les liens des courriels, ex. `https://drivepilot.partageons.net`. Obligatoire en production. |
| MAIL_PROVIDER | `n8n` (défaut : workflow `07-send-mail`, credential SMTP « DrivePilot SMTP ») ou `log` (le lien est écrit dans le journal serveur, pour amorcer le premier compte). |

| N8N_URL | URL HTTPS de base, terminant généralement par /webhook. HTTP accepté uniquement en boucle locale. |

| N8N_TOKEN | Secret de la credential Header Auth, envoyé par le serveur dans X-DrivePilot-Token. |

| OPENROUTER_API_KEY | Clé privée serveur de l’assistant. |

| OPENROUTER_MODEL | Facultatif ; défaut openrouter/free, gratuit confirmé dans le catalogue au moment de l’audit. |

| HOST | 127.0.0.1 par défaut. |

| TRUST_PROXY | 0 par défaut ; 1 seulement derrière un proxy de confiance qui remplace X-Forwarded-For. |

| NODE_ENV | production pour cookies Secure, HSTS et CSP de production. HTTPS obligatoire dans ce mode. |



Déplacer manuellement le compte existant hors de Téléchargements, par exemple dans un répertoire privé du serveur. Le logiciel de configuration n’ouvre ni ne déplace ce fichier. Le chemin interne historique est refusé. Tant que ADMIN_AUTH_FILE n’est pas configuré correctement, la connexion réelle renvoie 503 ; la démo reste utilisable.



Le format existant d’un compte contient id, username, email, salt et passwordHash (scrypt, 64 octets, hexadécimal). Un tableau de comptes est également accepté ; role peut être admin ou chauffeur, défini uniquement dans ce fichier de confiance. Le compte unique historique est admin par défaut. La création d’un profil chauffeur dans n8n ne crée pas automatiquement des identifiants de connexion.



Sessions serveur en mémoire de huit heures, cookie HttpOnly/SameSite=Strict, Secure en production ou HTTPS transmis. Le redémarrage invalide les sessions. Limitation progressive à trois niveaux : IP+identifiant (dès le premier échec), IP seule (au-delà de 20 échecs, tous identifiants confondus) et identifiant seul (au-delà de 30 échecs, toutes IP confondues, délai plafonné à 60 s). Si les tables de suivi sont pleines, les clés inconnues sont refusées 60 s plutôt que d’effacer les plus anciennes. Choisir un mot de passe d’au moins 14 caractères : le délai maximal autorise environ 1 400 essais par jour et par couple IP+identifiant. Plusieurs instances nécessiteront un stockage partagé de sessions et quotas. Vite dev et `vite preview` sont réservés au développement et à la recette. **En production, lancer `npm run build` puis `npm start`** : `server/main.mjs` sert `dist/` et l’API avec les mêmes protections (en-têtes, fichiers privés, sessions), sans Vite. Il écoute sur `HOST`:`PORT` (127.0.0.1:3012 par défaut), passe en `NODE_ENV=production` si la variable est absente et doit toujours être placé derrière un reverse proxy HTTPS (`TRUST_PROXY=1` seulement si ce proxy remplace `X-Forwarded-For`).



## n8n



1. Importer les workflows de création des Data Tables dans `n8n_workflows/`, les exécuter pour créer drivepilot_drivers et drivepilot_services. Pas de migration destructive automatique des anciennes tables.

2. Renseigner dans n8n les variables non secrètes DRIVEPILOT_DRIVERS_TABLE_ID et DRIVEPILOT_SERVICES_TABLE_ID avec les identifiants créés (ou sélectionner les tables dans les nœuds si votre édition ne permet pas les variables).

3. Créer la credential **DrivePilot Header Auth**, nom d’en-tête **X-DrivePilot-Token**, valeur identique à N8N_TOKEN. L’associer aux cinq webhooks après import du workflow CRUD. Le JSON ne contient que le nom de credential.

4. Autoriser uniquement le module Node crypto pour les nœuds Code si la configuration du runner le requiert (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`).

5. Activer le workflow CRUD, puis définir N8N_URL/N8N_TOKEN sur le serveur DrivePilot.

6. Lancer la recette : `npm run recette:n8n` (contrôles : jeton absent ou invalide, entrées invalides, création, isolation entre propriétaires, suppression). `npm run recette:n8n -- --dry-run` liste les appels sans rien envoyer. Tester authentification et validations avant ouverture réseau. Header Auth n8n natif renvoie **403** pour jeton absent ou incorrect. Le fragment `deployment/n8n-header-auth.conf` ajoute **401 pour jeton absent** au reverse proxy ; une credential manquante dans n8n est une erreur de configuration (500), pas une réussite.



Les requêtes du navigateur vont seulement à /api/services. Le serveur impose le propriétaire ; le chauffeur ne voit que ses lignes, l’administrateur voit toutes les lignes. L’endpoint all est destiné exclusivement au serveur détenteur du jeton. La suppression utilise UUID ET propriétaire. Limites : montant numérique > 0 et <= 10 000, date ISO UTC, note <= 500 caractères, champs inconnus refusés. Le workflow se régénère avec `node scripts/generate-workflows.mjs` depuis la validation partagée.



Les workflows n’ont pas été activés ni testés contre une instance réelle par cette mission. Une recette d’import est indispensable pour la version installée de n8n. Les Data Tables et leur identifiant de course service_id sont nouveaux ; les anciennes lignes doivent être migrées explicitement si nécessaire.



## Assistant



/api/chat exige une session, limite les messages à 2 000 caractères et le débit à 10/minute/compte. Clé et choix du modèle restent côté serveur. Les descriptions libres, courriels et identifiants de courses sont exclus du prompt ; seules des statistiques validées, identifiées comme données non fiables, figurent dans le message utilisateur. Aucune donnée de course n’est une instruction système. Les réponses restent du texte échappé, sans HTML, outils ou action automatique.



Le catalogue public confirme openrouter/free ; aucune inférence réelle n’a été testée faute de clé configurée. Après configuration, vérifier une demande courte sans données personnelles. Le routeur choisit parmi les modèles gratuits disponibles, dont disponibilité, quotas et politiques peuvent varier. Les préférences permettent de ne pas joindre les statistiques. Le serveur refuse tout message contenant un courriel, un numéro de téléphone ou un numéro de carte valide (contrôle Luhn), et l’écran de l’assistant avertit que le texte est traité par un fournisseur externe. Ce filtre aide à la minimisation des données (Loi 25) sans la garantir : il ne détecte ni noms ni adresses postales.



## Démo et données



Mode Démo fonctionne sans fournisseur ni clé. Bandeau visible, stockage dédié `drivepilot_demo_services` / `drivepilot_demo_chat`. Entrer en démo ne déconnecte pas la session réelle du serveur. Les données démo ne sont jamais envoyées à n8n ou OpenRouter. La sessionStorage ne sélectionne que la démo ; la modifier ne crée pas de session serveur. Aucun repli local n’est autorisé pour les données réelles.



Les anciens réglages navigateur contenant une clé sont supprimés à l’initialisation des préférences. Les anciennes données locales ne sont ni migrées en données réelles ni effacées automatiquement. Tailwind, React, icônes, graphiques et Inter sont servis localement ; aucun CDN. Les graphiques représentent les courses chargées, sans nombres aléatoires ni revenu prérempli pour un compte réel.



## Recette et audit



`audit/rapport-correctifs.md` documente les chantiers 1 à 9 et la passe de revue R1 à R5, avec preuves et actions manuelles. `audit/rapport.md` et les captures retracent le parcours démo. Le fichier privé de compte est exclu des inspections et de Git.

