# Calculateur de temps

Webapp / PWA de calculs de temps. **Zéro dépendance, zéro build** — du HTML/CSS/JS vanilla.

Deux modes :
- **Expression** (style Numi) — une ligne = un calcul, résultat en direct :
  ```
  1/1/2000 - 1/6/1990      → écart de dates
  1h -> s                  → conversion
  1h + 30min               → arithmétique de durées
  3h / 30min               → ratio
  today + 1mois            → arithmétique de calendrier
  1128 days in y           → 3 ans 1 mois 3 j
  ```
- **Formulaire** — onglets Écart / Conversion / Arithmétique.

Design Apple / iOS HIG (light + dark adaptatifs), animations natives.

## Lancer en local
- Calcul simple : ouvrir `app/index.html`.
- PWA complète (install + offline) : `cd app && python3 -m http.server` → http://localhost:8000

## Tests
- Unitaires : `npm run test:unit` (logique pure, sans navigateur)
- E2E : `npm run test:e2e` (Playwright)

## Déploiement
Site statique servi depuis `app/`. Publié via GitHub Actions sur GitHub Pages (`.github/workflows/deploy.yml`).
