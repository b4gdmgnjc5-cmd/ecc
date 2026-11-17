/* Motif Studio — fonts, text presets, shapes, pictograms and emoji. */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  // [family, mobile-friendly?]
  DS.FONTS = [
    ['Inter', 1], ['Montserrat', 1], ['Poppins', 1], ['Anton', 1], ['Bebas Neue', 1], ['Oswald', 1],
    ['Archivo Black', 1], ['Playfair Display', 1], ['Pacifico', 1], ['Permanent Marker', 1],
    ['Lobster', 0], ['Bangers', 0], ['Righteous', 0], ['Abril Fatface', 0], ['Dancing Script', 0], ['Caveat', 0],
    ['Rubik Mono One', 0], ['Black Ops One', 0], ['Press Start 2P', 0], ['Monoton', 0], ['Shrikhand', 0],
    ['Roboto Slab', 0], ['Cinzel', 0], ['Fredoka', 0], ['Bungee', 0], ['Satisfy', 0], ['Orbitron', 0],
    ['Russo One', 0], ['Lora', 0], ['Space Grotesk', 0],
  ];

  // Text presets: each returns an array of fabric object specs (built in editor.js).
  DS.TEXT_PRESETS = [
    { label: 'GROS TITRE', note: 'Anton, majuscules', font: 'Anton', items: [{ type: 'text', text: 'GROS TITRE', fontFamily: 'Anton', fontSize: 64, fill: '#16171b', charSpacing: 40 }] },
    { label: 'Signature', note: 'Script manuscrit', font: 'Pacifico', items: [{ type: 'text', text: 'Signature', fontFamily: 'Pacifico', fontSize: 52, fill: '#e83f6f' }] },
    { label: 'RÉTRO', note: 'Contour + ombre portée', font: 'Bungee', pro: true, items: [{ type: 'text', text: 'RÉTRO', fontFamily: 'Bungee', fontSize: 60, fill: '#ffbf00', stroke: '#16171b', strokeWidth: 3, paintFirst: 'stroke', shadow: { color: '#e83f6f', blur: 0, offsetX: 5, offsetY: 5 } }] },
    { label: 'Arc de cercle', note: 'Texte courbé', font: 'Montserrat', pro: true, items: [{ type: 'text', text: 'TEXTE EN ARC', fontFamily: 'Montserrat', fontWeight: 800, fontSize: 34, fill: '#2b45e0', dsCurve: 45 }] },
    { label: 'Badge rond', note: 'Cercle + texte courbé', font: 'Oswald', pro: true, items: [
      { type: 'circle', radius: 92, fill: 'transparent', stroke: '#16171b', strokeWidth: 6 },
      { type: 'text', text: 'MAISON FONDÉE', fontFamily: 'Oswald', fontWeight: 700, fontSize: 22, fill: '#16171b', charSpacing: 200, dsCurve: 62, dy: -8 },
      { type: 'text', text: '2026', fontFamily: 'Anton', fontSize: 44, fill: '#16171b', dy: 8 },
    ] },
    { label: 'NOM  10', note: 'Maillot : nom + numéro (dos)', font: 'Oswald', items: [
      { type: 'text', text: 'MARTIN', fontFamily: 'Oswald', fontWeight: 700, fontSize: 42, fill: '#16171b', charSpacing: 120, dy: -90 },
      { type: 'text', text: '10', fontFamily: 'Oswald', fontWeight: 700, fontSize: 170, fill: '#16171b', dy: 30 },
    ] },
    { label: 'Néon', note: 'Lueur colorée', font: 'Monoton', pro: true, items: [{ type: 'text', text: 'NÉON', fontFamily: 'Monoton', fontSize: 62, fill: '#fdf2ff', shadow: { color: '#ff2fb4', blur: 22, offsetX: 0, offsetY: 0 } }] },
    { label: 'Dégradé', note: 'Remplissage en dégradé', font: 'Archivo Black', pro: true, items: [{ type: 'text', text: 'DÉGRADÉ', fontFamily: 'Archivo Black', fontSize: 58, fill: { gradient: ['#ff7a18', '#af002d'], angle: 90 } }] },
  ];

  const star = (n, r1, r2) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? r2 : r1;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  };
  const poly = (n, r) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n - Math.PI / 2; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
    return pts;
  };
  DS.geom = { star, poly };

  DS.SHAPES = [
    { id: 'rect', label: 'Rectangle', svg: '<rect x="3" y="5" width="18" height="14" rx="1"/>' },
    { id: 'rrect', label: 'Rectangle arrondi', svg: '<rect x="3" y="5" width="18" height="14" rx="5"/>' },
    { id: 'circle', label: 'Cercle', svg: '<circle cx="12" cy="12" r="9"/>' },
    { id: 'ellipse', label: 'Ellipse', svg: '<ellipse cx="12" cy="12" rx="10" ry="6.5"/>' },
    { id: 'triangle', label: 'Triangle', svg: '<path d="M12 3 22 20H2z"/>' },
    { id: 'star', label: 'Étoile', svg: '<path d="m12 2 3 6.6 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.2l1.4-7L2 9.4l7-.8z"/>' },
    { id: 'poly', label: 'Hexagone', svg: '<path d="m12 2 8.7 5v10L12 22l-8.7-5V7z"/>' },
    { id: 'heart', label: 'Cœur', svg: '<path d="M12 21s-7-4.6-9.3-9C1.2 8.6 3 5 6.5 5c2 0 3.5 1.2 5.5 3.3C14 6.2 15.5 5 17.5 5 21 5 22.8 8.6 21.3 12c-2.3 4.4-9.3 9-9.3 9z"/>' },
    { id: 'line', label: 'Ligne', svg: '<path d="M3 12h18"/>' },
    { id: 'arrow', label: 'Flèche', svg: '<path d="M3 12h16m-5-5 5 5-5 5"/>' },
  ];
  DS.HEART = 'M12 21s-7-4.6-9.3-9C1.2 8.6 3 5 6.5 5c2 0 3.5 1.2 5.5 3.3C14 6.2 15.5 5 17.5 5 21 5 22.8 8.6 21.3 12c-2.3 4.4-9.3 9-9.3 9z';

  // Pictograms on a 24x24 grid. stroke:true = drawn as an outline.
  DS.CLIPART = [
    { id: 'bolt', label: 'Éclair', d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
    { id: 'crown', label: 'Couronne', d: 'M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4z' },
    { id: 'flame', label: 'Flamme', d: 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2.5 2.5 2.5 4.5C13 8 12 5 12 2z' },
    { id: 'leaf', label: 'Feuille', d: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15z' },
    { id: 'moon', label: 'Lune', d: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z' },
    { id: 'mountain', label: 'Montagne', d: 'M2 20 9 8l4 6 3-4 6 10z' },
    { id: 'wave', label: 'Vague', d: 'M2 13c3 0 3-4 6-4s3 4 6 4 3-4 6-4 2 1 2 1v10H2z' },
    { id: 'diamond', label: 'Diamant', d: 'M6 3h12l4 6-10 12L2 9z' },
    { id: 'music', label: 'Musique', d: 'M9 3v10.6A3.5 3.5 0 1 0 11 17V7h8v6.6A3.5 3.5 0 1 0 21 17V3z' },
    { id: 'cloud', label: 'Nuage', d: 'M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z' },
    { id: 'smile', label: 'Smiley', d: 'M12 2a10 10 0 1 0 .01 0zM8.5 7.5a1.5 1.5 0 1 0 .01 0zM15.5 7.5a1.5 1.5 0 1 0 .01 0zM7 13.5q5 5.5 10 0q-5 2.5-10 0z', evenodd: true },
    { id: 'paw', label: 'Patte', d: 'M12 12.5c-3 0-6 3-6 5.5S8 21 12 21s6-.5 6-3-3-5.5-6-5.5zM5 7a2.2 2.6 0 1 0 .01 0zM9.3 3a2.2 2.6 0 1 0 .01 0zM14.7 3a2.2 2.6 0 1 0 .01 0zM19 7a2.2 2.6 0 1 0 .01 0z' },
    { id: 'check', label: 'Validé', d: 'M4 12.5 9 17.5 20 6.5', stroke: true },
    { id: 'anchor', label: 'Ancre', d: 'M12 3.5a2 2 0 1 0 .01 0M12 7.5V21M5 13a7 7 0 0 0 14 0M8 10.5h8', stroke: true },
    { id: 'sun', label: 'Soleil', d: 'M12 7.5a4.5 4.5 0 1 0 .01 0M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1', stroke: true },
    { id: 'spark', label: 'Étincelle', d: 'M12 2c.8 5.2 4.8 9.2 10 10-5.2.8-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10 5.2-.8 9.2-4.8 10-10z' },
    { id: 'skate', label: 'Cible', d: 'M12 2a10 10 0 1 0 .01 0zM12 6a6 6 0 1 0 .01 0zM12 10a2 2 0 1 0 .01 0z', evenodd: true },
    { id: 'peace', label: 'Paix', d: 'M12 2.5a9.5 9.5 0 1 0 .01 0M12 2.5v19M12 12l-6.7 6.7M12 12l6.7 6.7', stroke: true },
    { id: 'drop', label: 'Goutte', d: 'M12 2.5S5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5z' },
    { id: 'flower', label: 'Fleur', d: 'M12 9.5a2.5 2.5 0 1 0 .01 0zM12 2a3.5 4.2 0 1 0 .01 0zM12 14.6a3.5 4.2 0 1 0 .01 0zM4.2 8.2a4.2 3.5 0 1 0 .01 0zM15.6 8.2a4.2 3.5 0 1 0 .01 0z' },
  ];

  DS.EMOJIS = ['🔥', '⚡', '⭐', '❤️', '😎', '🤘', '👑', '💀', '🌈', '🌊', '🌴', '🌸', '🍕', '🎸', '🎧', '🏀', '⚽', '🚀', '🛹', '🐯', '🦋', '🐶', '🐱', '🍀', '☕', '🎉', '💎', '✌️', '👀', '💯', '🌙', '☀️'];

  DS.TRIM_COLORS = ['#ffffff', '#16171b', '#a7abb3', '#1f2a4d', '#2f56c6', '#c8262e', '#e83f6f', '#f06a1d', '#d9a21f', '#21452f'];
})();
