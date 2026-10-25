# Audit du parcours chauffeur

Date de la première version : 11 octobre 2026 (Toronto). Mise à jour après le durcissement.

## Historique
- **Blocage initial (corrigé)** : `index.html` ne chargeait pas `index.tsx`, la page restait vide (`01-demarrage-bloque.png`). La balise `<script type="module" src="/index.tsx">` est maintenant présente ; captures de l'écran fonctionnel : `02-demarrage-corrige.png`, `03-compte-admin.png`, `04-drivepilot.png`.

## État du parcours
| Étape | Statut |
| --- | --- |
| Ouverture de l'application | Fonctionnelle (captures 02 à 04). |
| Connexion en mode démo | Couverte par `demo.test.mjs` (CRUD local, aucune requête serveur) ; parcours visuel complet **à refaire**. |
| Tableau de bord | Indicateurs calculés sur les courses chargées ; vérification visuelle **à refaire**. |
| Ajout puis historique d'une course | Couvert en logique par les tests de services ; vérification visuelle **à refaire**. |
| Connexion réelle | Impossible tant que `ADMIN_AUTH_FILE` n'est pas configuré hors du projet (réponse 503 voulue). |

## Limites
Aucune conclusion visuelle, responsive ou d'accessibilité n'est établie par ce rapport : les captures du parcours démo complet n'ont pas été reprises depuis le correctif. Les tests automatiques (20 verts, `chantier-9-test.txt`) portent sur le serveur et la logique, pas sur le rendu.

Rapport détaillé des correctifs : `rapport-correctifs.md`.
