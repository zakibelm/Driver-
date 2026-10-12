# Audit du parcours chauffeur — blocage initial

Date : 11 octobre 2026 (Toronto).

Périmètre prévu : connexion en mode démo, consultation du tableau de bord, ajout d’une course et vérification de son apparition dans l’historique.

## Résultat

L’audit UX est bloqué dès le démarrage. Le serveur Vite répond et le navigateur affiche le titre « Co-op Taxi Terrebonne », mais le contenu de la page reste vide. La capture ci-dessous documente le blocage ; elle ne constitue pas une capture acceptée d’un écran fonctionnel.

![Démarrage bloqué](01-demarrage-bloque.png)

## Étapes

1. Ouverture de l’application — **bloquée** : page vide, aucun contrôle accessible.
2. Connexion en mode démo — **non vérifiable** : écran inaccessible.
3. Consultation du tableau de bord — **non vérifiable** : écran inaccessible.
4. Ajout et vérification d’une course — **non vérifiable** : parcours inaccessible.

## Cause identifiée dans le dépôt

`index.html` contient le conteneur `<div id="root"></div>`, mais aucune balise de script module ne charge `index.tsx`. Le fichier `index.tsx` est présent dans le dépôt. Le point d’entrée React n’est donc pas exécuté par cette page.

Correction recommandée : ajouter `<script type="module" src="/index.tsx"></script>` dans le corps de `index.html`, puis vérifier le démarrage et reprendre les captures du parcours.

## Limites

Aucune conclusion sur la qualité visuelle des écrans, les interactions, le responsive ou la conformité d’accessibilité ne peut être établie à partir de cet écran vide. Le code produit n’a pas été modifié. Les dépendances locales ont été installées pour lancer l’aperçu.
