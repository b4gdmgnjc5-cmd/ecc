// Collection Tricolore — 6 pièces. Boutique militante non officielle.
// print.kind: 'logo' (marque seule) | 'meme' (phrase culte en typographie)

export const TRICOLORE = { bleu: '#1F3FA6', blanc: '#F4F1EA', rouge: '#D52B3A' };

const SIZES = ['S', 'M', 'L', 'XL'];

export const PRODUCTS = [
  {
    id: 'signature-noir', type: 'tee', name: 'T-shirt Signature', price: 35,
    fabric: '#121213', ink: '#F1ECE1', sizes: SIZES,
    print: { kind: 'logo' }, detail: 'Coton bio 220 g · étiquette tricolore',
  },
  {
    id: 'republique', type: 'tee', name: 'T-shirt « La République, c’est moi »', price: 39,
    fabric: '#F1EEE6', ink: '#141414', sizes: SIZES,
    print: { kind: 'meme', lines: ['LA RÉPUBLIQUE,', 'C’EST MOI !'] }, detail: 'Édition perquisition',
  },
  {
    id: 'signature-marine', type: 'hoodie', name: 'Hoodie Signature Marine', price: 79,
    fabric: '#15203A', ink: '#F1ECE1', sizes: SIZES,
    print: { kind: 'logo' }, detail: 'Molleton 400 g · cordons bleu et rouge',
  },
  {
    id: 'fureur', type: 'hoodie', name: 'Hoodie « Le bruit et la fureur »', price: 85,
    fabric: '#0E0E0F', ink: '#E8E0CC', sizes: SIZES,
    print: { kind: 'meme', lines: ['Le bruit', 'et la fureur'], italic: true }, detail: 'Brodé main',
  },
  {
    id: 'casquette', type: 'cap', name: 'Casquette Signature', price: 29,
    fabric: '#ECE6D8', ink: '#15203A', sizes: ['Unique'],
    print: { kind: 'logo' }, detail: 'Sergé de coton · patch tricolore',
  },
  {
    id: 'peuple', type: 'tote', name: 'Tote « Je suis le peuple »', price: 22,
    fabric: '#E6DECB', ink: '#1F3FA6', sizes: ['Unique'],
    print: { kind: 'meme', lines: ['Je suis', 'le peuple'], italic: true }, detail: 'Toile 340 g · anses bleu et rouge',
  },
];
