# DrivePilot — rapport de durcissement

Branche : `fix/security-hardening`. Les changements de marque, de démarrage et de connexion déjà présents avant la mission sont conservés dans le premier commit. Le fichier `admin-auth.local` n'est ni lu, ni modifié, ni ajouté à Git pendant cette mission.

## Chantier 1 — webhooks

Authentification Header Auth référencée par nom de credential sur cinq endpoints ; validation stricte avant accès aux Data Tables ; branches HTTP 400 ; suppression avec UUID et propriétaire ; liste complète réservée au proxy serveur. Les Data Tables remplacent les anciens nœuds `dataStore` et nécessitent leurs identifiants après import. Aucune credential réelle incluse.

Vérification : tests locaux de structure et exécution des validations, pas un appel à une instance n8n déployée. HTTP 401 natif Header Auth à confirmer après configuration de la credential.

Premier échec de `npm test` : trois hypothèses examinées avant correction : (1) Node 24 résout `server/` comme module et non comme glob, (2) mauvais répertoire courant, (3) mauvais exécutable Node/npm. La sortie confirme (1) et le chemin correct exclut (2). Ajout d'un point d'entrée de tests pour conserver exactement `node --test server/`. Aucun retour arrière.

Fichiers : workflow CRUD, création des tables, générateur, validation et tests dans `server/`, `.gitignore`, `.env.example`, script npm test.
