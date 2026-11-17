# Motif Studio

Application web (PWA) pour créer et modifier des designs sur des objets : T-shirts, sweats,
casquettes, mugs, tote bags, coques, affiches, coussins, stickers, ou n'importe quel objet à partir
d'une photo. Elle fonctionne sur mobile et sur PC. La version PC est plus complète, surtout pour
ce qu'elle peut exporter.

## Lancer l'application

Les bibliothèques (Fabric.js, Three.js, jsPDF) et les polices sont chargées depuis un CDN :
une connexion internet est nécessaire au premier lancement.

```bash
# depuis la racine du dépôt
npx serve design-studio        # ou : python3 -m http.server -d design-studio 8080
```

Ouvre ensuite l'adresse indiquée. Sur mobile, « Ajouter à l'écran d'accueil » installe l'application.

Pour obtenir un seul fichier HTML à partager :

```bash
node design-studio/build.js    # crée design-studio/dist/motif-studio.html
```

## Fonctions

### Objets et formes

| Objet | Faces | Options de forme |
|-------|-------|------------------|
| T-shirt | devant, dos | encolure (ronde, ras du cou, V, échancrée), manches (courtes, longues, débardeur), coupe (ajustée, classique, oversize) |
| Sweat à capuche | devant, dos | coupe, poche kangourou, cordons |
| Sweat col rond | devant, dos | coupe |
| Casquette | face, arrière | visière incurvée ou plate |
| Mug | face A, face B | anse à gauche ou à droite |
| Tote bag | recto, verso | |
| Coque | dos de coque | standard ou grand modèle |
| Affiche | affiche | A4, A3, A2, 50 × 70, carré, paysage, story ; cadre noir, blanc ou bois |
| Coussin | recto, verso | carré ou rond |
| Sticker | sticker | rond, carré arrondi, rectangle ; largeur en cm |
| Mon objet | 2 vues | photo de ton objet, teinte, zone d'impression et largeur réelle réglables |

- Couleur principale et couleur des finitions (col, bords-côtes, visière, anse…), 16 teintes textile
  prêtes à l'emploi ou couleur libre.
- Matière (coton, chiné, lisse, brillant) et ombres réalistes (plis, volume du mug, rondeur du coussin).
- Chaque objet garde son propre design ; un objet ouvert pour la première fois reprend le design en cours,
  recadré dans sa zone d'impression.

### Édition

- Texte : 30 polices Google Fonts, taille, gras, italique, souligné, majuscules, alignement,
  espacement des lettres, interligne, texte courbé en arc ou en creux, styles prêts à l'emploi
  (titre, signature, rétro, badge rond, maillot nom + numéro, néon, dégradé).
- Images : PNG, JPG, WebP et SVG vectoriel ; glisser-déposer et coller. Luminosité, contraste,
  saturation, teinte, flou, grain, pixellisation, noir et blanc, sépia, négatif, et retrait du fond
  (couleur et tolérance réglables). La qualité d'impression en DPI s'affiche pour chaque image.
- Formes (rectangle, coins arrondis, cercle, ellipse, triangle, étoile et polygone paramétrables,
  cœur, ligne, flèche), 20 pictos et 32 emojis.
- Dessin à main levée : crayon, aérographe, points, épaisseur, lueur.
- Remplissage uni ou dégradé (linéaire, radial), contour (épaisseur, tirets), ombre et lueur,
  opacité, 16 modes de fusion, miroir, rotation, inclinaison.
- Position et taille en centimètres réels, magnétisme sur le centre et les bords de la zone
  d'impression, grille en cm.
- Calques : réordonner par glisser-déposer, renommer, masquer, verrouiller ; grouper, dégrouper,
  masque (découper un calque avec une forme), recoloration des SVG couleur par couleur.
- Annuler / rétablir par face, copier, coller, dupliquer, raccourcis clavier (touche `?`).
- Sauvegarde automatique dans le navigateur, et projet `.json` à enregistrer et rouvrir.

### Exports

| Format | Mobile | PC |
|--------|:------:|:--:|
| Maquette PNG (objet + design, fond au choix) | 1200 px | jusqu'à 4000 px, toutes les faces |
| Maquette JPG | | oui |
| Fichier d'impression PNG transparent à la taille réelle, DPI inscrit dans le fichier | | 150, 300 ou 600 DPI |
| SVG vectoriel (design seul à la taille réelle, ou maquette complète) | | oui |
| PDF imprimeur (taille réelle, traits de coupe, fiche technique avec maquettes) | | oui |
| Projet `.json` | oui | oui |

La version PC ajoute aussi l'aperçu 3D (rotation, zoom, fonds studio, capture PNG).

## Mobile et PC

L'interface choisit le mode selon l'écran. Le menu **Projet → Basculer mode PC / mobile** force l'un
ou l'autre. Sur mobile, les outils s'ouvrent en panneaux depuis la barre du bas et les réglages avancés
sont masqués pour garder l'édition simple au doigt.

## Structure

```text
design-studio/
├── index.html          interface
├── css/app.css         thème clair / sombre, mise en page PC et mobile
├── js/products.js      catalogue d'objets, formes, rendu 2D et ombrage
├── js/assets.js        polices, styles de texte, formes, pictos, emojis
├── js/editor.js        moteur d'édition (Fabric.js), historique, calques, rendu hors écran
├── js/inspector.js     panneau de propriétés et liste des calques
├── js/exporter.js      PNG, JPG, impression DPI, SVG, PDF, projet
├── js/preview3d.js     aperçu 3D (Three.js)
├── js/app.js           panneaux, raccourcis, sauvegarde, PWA
├── sw.js, manifest.webmanifest, icon.svg
└── build.js            génère la version en un seul fichier HTML
```
