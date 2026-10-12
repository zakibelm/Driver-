# Audit UX — DrivePilot (parcours chauffeur, mode démo)

- Branche : `fix/security-hardening-snapshot` (commit a6184c0)
- Date : 2026-10-11
- Environnement : `vite` 6.4.4 en local (127.0.0.1:3000), Chromium headless, 1366×850 (bureau) et 390×844 (mobile)

## Résultat du parcours

| Étape | Bureau | Mobile | Capture |
|---|---|---|---|
| 1. Ouverture / écran de connexion | OK | OK | `desktop-01-login.png` |
| 2. Connexion démo | OK, avec un bandeau « données fictives » | OK | — |
| 3. Tableau de bord | OK | OK | `desktop-02-dashboard.png`, `mobile-02-dashboard.png` |
| 4. Ajout d'une course | OK : champ montant obligatoire, la course apparaît tout de suite | OK | `mobile-05-form-filled.png` |
| 5. Historique | OK : tri du plus récent au plus ancien, filtre par type | OK, avec un défilement horizontal | `desktop-06-history.png`, `mobile-06-history.png` |
| 6. Persistance après rechargement | OK : la session démo et la course sont conservées | OK | — |
| 7. Suppression | OK, après une confirmation | OK | — |

Le blocage de démarrage (page blanche sur `main`) est corrigé sur cette branche. Le parcours fonctionne de bout en bout.

## Constats (Problème → Action → Résultat)

| # | Gravité | Problème | Action | Résultat |
|---|---|---|---|---|
| 1 | Moyenne | **Le bouton « Ajouter une course » du tableau de bord n'ouvre pas le formulaire.** Il mène à la liste des services, et il faut cliquer une 2ᵉ fois sur « Ajouter une course ». | Passer un paramètre `onNavigate('services', { openForm: true })` et ouvrir la fenêtre au montage. | La saisie en fin de course prend 1 clic au lieu de 2. C'est l'action la plus fréquente du chauffeur. |
| 2 | Moyenne | **Les dates ne sont pas au même format.** Le tableau de bord affiche `10/11/2026` (format US, ambigu au Québec : 10 nov. ou 11 oct. ?), alors que l'historique affiche `2026-10-11`. | Une seule fonction `formatDate` avec `toLocaleDateString('fr-CA')`, ce qui donne `2026-10-11`. | Plus d'erreur de lecture sur la date d'une course. |
| 3 | Moyenne | **L'activité récente affiche l'UUID complet** (`#4BE30A2A-CD00-…`). Il est illisible et n'apporte rien au chauffeur. | Afficher le type et la note, ou au besoin les 6 premiers caractères. | Une liste lisible d'un coup d'œil. |
| 4 | Moyenne (a11y) | **Le bouton de suppression n'a pas de nom accessible** (icône seule, sans `aria-label`), et son contraste est très faible (`slate-300` sur blanc, ≈ 1,5:1). | Ajouter `aria-label="Supprimer la course du {date}"` et passer à `slate-500` (≥ 3:1 pour une icône). | Le bouton est utilisable au lecteur d'écran et visible en plein soleil dans un véhicule. |
| 5 | Moyenne (a11y) | **La touche Échap ne ferme pas la fenêtre « Nouvelle course »**, et le focus n'est pas placé dans le formulaire à l'ouverture. | Gérer `keydown` Escape, mettre le focus sur le champ Montant à l'ouverture et le rendre au bouton déclencheur à la fermeture. | La fenêtre suit le comportement attendu d'un dialogue (WCAG 2.1.2 et 2.4.3). |
| 6 | Faible | **Sur mobile, l'historique défile horizontalement.** La colonne de suppression est hors écran et la date se coupe sur 2 lignes. | Sous 640 px, afficher l'historique en cartes (date et montant sur une ligne, type et note en dessous, suppression par icône). | Toutes les actions sont visibles sans défilement latéral. |
| 7 | Faible | **Deux erreurs 401 apparaissent dans la console à chaque chargement** (`/api/auth/session` quand personne n'est connecté). | Retourner `200 { session: null }` quand il n'y a pas de session, et garder 401 pour les routes protégées. | La console reste propre et les vraies erreurs ressortent. |
| 8 | Faible | **Le message de validation vient du navigateur** (« Please fill out this field » dans Chromium anglais). | Ajouter un message en français sous le champ montant (`setCustomValidity` ou validation React). | Un message cohérent avec la langue de l'application. |

## Hors périmètre / non vérifié

- **Connexion admin réelle** : non testée, car elle exige `ADMIN_AUTH_FILE`.
- **Mode n8n** : non testé, car il exige `N8N_URL` et `N8N_TOKEN`.
- **Assistant IA** : non testé, car il exige `OPENROUTER_API_KEY`.
- **Audit WCAG complet** (lecteur d'écran, zoom 200 %) : non réalisé. Seuls les constats 4 et 5 ont été vérifiés par script.

## Priorités

1. Constats 1 et 2 : ils touchent directement la saisie quotidienne.
2. Constats 4 et 5 : accessibilité, environ 30 min de travail.
3. Constats 3, 6, 7 et 8 : finition.

## Statut des correctifs (2026-10-11)

Les 8 constats sont corrigés. Ils ont été vérifiés par script Playwright (bureau 1366 px et mobile 390 px) : 21 contrôles sur 21 passent.

| # | Correctif | Fichiers |
|---|---|---|
| 1 | Le bouton « Ajouter » du tableau de bord ouvre directement le formulaire (`onNavigate('services', { openForm: true })`). | `App.tsx`, `pages/Dashboard.tsx`, `pages/Services.tsx` |
| 2 | Toutes les dates passent par `formatDate` (format fr-CA, AAAA-MM-JJ). | `utils/date.ts`, `pages/Dashboard.tsx`, `pages/Services.tsx` |
| 3 | L'activité récente affiche la note, ou le type par défaut, à la place de l'UUID. | `pages/Dashboard.tsx` |
| 4 | Le bouton de suppression a un `aria-label` descriptif et une icône `slate-500`. | `pages/Services.tsx` |
| 5 | Échap ferme le formulaire, tout comme un clic à l'extérieur. Le focus va au montant à l'ouverture et revient au déclencheur à la fermeture. | `pages/Services.tsx` |
| 6 | Sous 768 px, l'historique s'affiche en cartes, sans défilement horizontal. | `pages/Services.tsx` |
| 7 | `GET /api/auth/session` répond `200 { user: null }` quand personne n'est connecté : la console ne montre plus d'erreur 401. | `server/auth.mjs`, `services/storage.ts`, tests |
| 8 | Les messages de validation du montant et de la date sont en français, avec une aide sous le champ. | `pages/Services.tsx` |
| — | Retrait de la cloche de notifications inerte et de sa fausse pastille. | `pages/Dashboard.tsx` |

Vérifications : `npm test` (20/20), `tsc --noEmit` et `vite build` passent tous les trois.
