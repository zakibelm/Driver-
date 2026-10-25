# Connexion DrivePilot à n8n — 25 octobre 2026

## Configuration appliquée après autorisation « oui go »

- Instance : https://n8n.xtream.space/
- Accès API authentifié : HTTP 200.
- Table des courses : `drivepilot_services` (`k7qrYzRHXLi0Yf9K`).
- Table des chauffeurs : `drivepilot_drivers` (`nIUs2pnr1KHF40on`).
- Table des types : `drivepilot_service_types` (`Jo7y6ihg1ygZmMbS`).
- Plusieurs workflows historiques `td - Authenticated CRUD` sont désactivés. Le workflow inspecté utilise une ancienne validation qui ne prend pas en charge les nouveaux types personnalisés.
- Aucune ligne de course existante n’a été consultée ou modifiée.
- La clé API de gestion reste temporaire et n’est pas sauvegardée. L’URL des webhooks et leur jeton dédié sont sauvegardés dans `.env.local`, exclu de Git.

## Résultat appliqué

`n8n_workflows/06-connexion-application-workflow.json` correspond au nouveau workflow `DrivePilot - Courses (connexion application)`, ID `QOK1JPfNkWDUob5A`, activé. Il utilise uniquement la table des courses, accepte « Régulier » et les noms personnalisés, avec des routes séparées sous `/webhook/drivepilot-app/api/…`.

## Compatibilité corrigée

- Routes fixes pour lire et supprimer les courses : les routes paramétrées n’étaient pas reconnues par cette instance.
- UUID des courses générés côté serveur, sans import de `crypto` dans les nœuds Code du workflow connecté.
- Réponses JSON préparées dans un nœud Code pour éviter les erreurs de syntaxe des expressions avec décomposition d’objet.
- Identifiant Header Auth dédié : `DrivePilot application - webhook dédié`.

## Vérifications réelles réussies

- Requêtes sans jeton et avec mauvais jeton refusées : HTTP 403.
- Création puis relecture d’une course fictive de 1,23 $ avec un type personnalisé.
- Isolation entre deux propriétaires de test uniques vérifiée.
- Suppression de la course fictive confirmée par relecture.
- La course fictive créée pendant le diagnostic a aussi été récupérée depuis sa propre exécution puis supprimée.
- Aucun nettoyage de test en attente. Preuves sans secret : `audit/n8n-connexion.json`.
- 24 tests locaux réussis.

## Limite restante pour l’usage réel

L’aperçu est encore en mode démo. Le compte de connexion réelle exige aussi `ADMIN_AUTH_FILE`, pointant vers un fichier de compte privé hors du projet. Il faut configurer ce compte sans publier d’identifiants. L’import du workflow seul ne transforme pas une session démo en session réelle.
