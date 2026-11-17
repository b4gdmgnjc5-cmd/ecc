// Catalogue fictif — boutique militante non officielle.
// type: tee | hoodie | tote | cap | flag | poster
// print: lines of text drawn on the garment, ink = print colour

export const COLORS = {
  noir: '#141414',
  rouge: '#E3201B',
  creme: '#EFE7D6',
  violet: '#4B2E83',
  vert: '#1F5C3A',
  blanc: '#F7F5F0',
};

export const SECTIONS = [
  { id: 'tees', label: 'T-SHIRTS', from: 0 },
  { id: 'sweats', label: 'SWEATS', from: 5 },
  { id: 'acc', label: 'ACCESSOIRES', from: 8 },
];

export const PRODUCTS = [
  {
    id: 'avenir', type: 'tee', name: "T-shirt L'Avenir en commun", price: 25,
    fabric: COLORS.noir, ink: COLORS.rouge, sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    print: ["L'AVENIR", 'EN', 'COMMUN'], tag: 'Coton bio · Imprimé en France',
  },
  {
    id: 'insoumis', type: 'tee', name: 'T-shirt Insoumis·e', price: 25,
    fabric: COLORS.rouge, ink: COLORS.creme, sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    print: ['INSOU', 'MIS·E'], tag: 'Coupe unisexe · 180 g/m²',
  },
  {
    id: 'climat', type: 'tee', name: 'T-shirt Planification écologique', price: 28,
    fabric: COLORS.creme, ink: COLORS.vert, sizes: ['S', 'M', 'L', 'XL'],
    print: ['FIN DU', 'MONDE', 'FIN DU', 'MOIS', 'MÊME', 'COMBAT'], tag: 'Coton recyclé · Encres à l’eau',
  },
  {
    id: 'sixieme', type: 'tee', name: 'T-shirt 6ᵉ République', price: 25,
    fabric: COLORS.violet, ink: COLORS.blanc, sizes: ['XS', 'S', 'M', 'L', 'XL'],
    print: ['6', 'ÈME', 'RÉPU', 'BLIQUE'], tag: 'Édition constituante',
  },
  {
    id: 'richesses', type: 'tee', name: 'T-shirt Partagez les richesses', price: 25,
    fabric: COLORS.blanc, ink: COLORS.noir, sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    print: ['PARTA', 'GEZ LES', 'RICHE', 'SSES'], tag: 'Coton bio · Fabriqué au Portugal',
  },
  {
    id: 'lacherien', type: 'hoodie', name: 'Hoodie On lâche rien', price: 55,
    fabric: COLORS.noir, ink: COLORS.creme, sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    print: ['ON', 'LÂCHE', 'RIEN'], tag: 'Molleton gratté · 350 g/m²',
  },
  {
    id: 'peuple', type: 'hoodie', name: 'Hoodie La force du peuple', price: 55,
    fabric: COLORS.rouge, ink: COLORS.noir, sizes: ['S', 'M', 'L', 'XL'],
    print: ['LA', 'FORCE', 'DU', 'PEUPLE'], tag: 'Molleton bio · Poche kangourou',
  },
  {
    id: 'retraite', type: 'hoodie', name: 'Hoodie Retraite à 60', price: 58,
    fabric: COLORS.creme, ink: COLORS.violet, sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    print: ['RETRAITE', '60', 'ANS'], tag: 'Édition limitée · Brodé',
  },
  {
    id: 'tote', type: 'tote', name: 'Tote bag Union populaire', price: 15,
    fabric: COLORS.creme, ink: COLORS.rouge, sizes: ['Unique'],
    print: ['UNION', 'POPU', 'LAIRE'], tag: 'Toile épaisse 340 g/m²',
  },
  {
    id: 'casquette', type: 'cap', name: 'Casquette Insoumise', price: 22,
    fabric: COLORS.rouge, ink: COLORS.blanc, sizes: ['Unique'],
    print: ['INSOUMISE'], tag: 'Sangle réglable · Coton sergé',
  },
  {
    id: 'drapeau', type: 'flag', name: 'Drapeau de manif', price: 12,
    fabric: COLORS.violet, ink: COLORS.creme, sizes: ['90×60 cm'],
    print: ['ON', 'EST', 'LÀ'], tag: 'Polyester recyclé · Œillets',
  },
  {
    id: 'affiche', type: 'poster', name: 'Affiche Prenez le pouvoir', price: 10,
    fabric: COLORS.rouge, ink: COLORS.noir, sizes: ['A2', 'A1'],
    print: ['PRE', 'NEZ', 'LE', 'POU', 'VOIR'], tag: 'Sérigraphie · Papier 250 g',
  },
];
