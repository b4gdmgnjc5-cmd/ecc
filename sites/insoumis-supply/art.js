// Procedural canvas textures: prints, fabric grain, floor, wall posters, signage.
import * as THREE from 'three';

const DISPLAY = 'Anton, Impact, sans-serif';
let maxAniso = 4;
export function setMaxAnisotropy(v) { maxAniso = v; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Stack lines of condensed type so each fills the width — brutalist block lettering.
export function drawStack(ctx, lines, x, y, w, h, color, { leading = 0.9, maxSize = 9999 } = {}) {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const sizes = lines.map((line) => {
    ctx.font = `100px ${DISPLAY}`;
    const m = ctx.measureText(line).width || 1;
    return Math.min(maxSize, (w / m) * 100);
  });
  let total = sizes.reduce((a, s) => a + s * leading, 0);
  const k = total > h ? h / total : 1;
  total *= k;
  let cy = y + (h - total) / 2;
  lines.forEach((line, i) => {
    const s = sizes[i] * k;
    cy += s * leading;
    ctx.font = `${s}px ${DISPLAY}`;
    ctx.fillText(line, x + w / 2, cy - s * 0.1);
  });
}

export function printTexture(lines, ink, { w = 1024, h = 1024, bg = null, brand = true } = {}) {
  const [c, ctx] = canvas(w, h);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  const pad = w * 0.04;
  drawStack(ctx, lines, pad, pad, w - pad * 2, h - pad * 2 - (brand ? h * 0.08 : 0), ink);
  if (brand) {
    ctx.font = `700 ${Math.round(h * 0.045)}px 'Space Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('★ INSOUMIS SUPPLY CO. ★', w / 2, h - pad * 0.8);
  }
  // Worn screen-print: knock out tiny specks.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2600; i++) {
    ctx.globalAlpha = Math.random() * 0.5;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(c);
}

export function fabricTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.03})`;
    ctx.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 4000; i++) {
    const g = 200 + Math.random() * 55;
    ctx.fillStyle = `rgba(${g},${g},${g},.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const t = toTexture(c, { repeat: true });
  t.repeat.set(3, 3);
  return t;
}

export function floorTexture() {
  const [c, ctx] = canvas(1024, 1024);
  ctx.fillStyle = '#d8d0c1';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 14000; i++) {
    const g = 150 + Math.random() * 90;
    ctx.fillStyle = `rgba(${g},${g - 6},${g - 14},.35)`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
  }
  ctx.strokeStyle = 'rgba(17,17,17,.28)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 1024; i += 256) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
  }
  // Painted aisle arrow
  ctx.fillStyle = '#E3201B';
  ctx.fillRect(492, 0, 40, 1024);
  return toTexture(c, { repeat: true });
}

const POSTERS = [
  ['#E3201B', '#111', ['ON', 'LÂCHE', 'RIEN']],
  ['#111', '#EFE7D6', ['GRÈVE', 'GÉNÉ', 'RALE']],
  ['#4B2E83', '#EFE7D6', ['6ÈME', 'RÉPU', 'BLIQUE']],
  ['#EFE7D6', '#E3201B', ['L\'AVENIR', 'EN', 'COMMUN']],
  ['#1F5C3A', '#EFE7D6', ['PLANI', 'FICATION', 'ÉCOLO']],
  ['#F7F5F0', '#111', ['UNION', 'POPU', 'LAIRE']],
  ['#E3201B', '#F7F5F0', ['SMIC', 'À', '1600']],
  ['#111', '#E3201B', ['RÉSIS', 'TANCE']],
];

export function wallTexture() {
  const W = 2048, H = 1024;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#cfc6b6';
  ctx.fillRect(0, 0, W, H);
  const cols = 8, rows = 2, pw = W / cols, ph = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const [bg, ink, lines] = POSTERS[(col * 3 + r * 5) % POSTERS.length];
      ctx.save();
      ctx.translate(col * pw + pw / 2, r * ph + ph / 2);
      ctx.rotate((Math.random() - 0.5) * 0.06);
      const w = pw * 0.86, h = ph * 0.86;
      ctx.fillStyle = bg;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      drawStack(ctx, lines, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28, ink);
      // tape
      ctx.fillStyle = 'rgba(240,230,200,.75)';
      ctx.fillRect(-30, -h / 2 - 10, 60, 22);
      ctx.restore();
    }
  }
  // grime
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(40,30,20,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
  return toTexture(c, { repeat: true });
}

export function signTexture(text, { bg = '#E3201B', ink = '#EFE7D6', sub = '' } = {}) {
  const [c, ctx] = canvas(2048, 256);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 2048, 256);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = `190px ${DISPLAY}`;
  ctx.fillText(text, 1024, 205);
  if (sub) {
    ctx.font = `700 34px 'Space Mono', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(sub, 30, 46);
    ctx.textAlign = 'right';
    ctx.fillText(sub, 2018, 46);
  }
  return toTexture(c);
}

export function finaleTexture() {
  const [c, ctx] = canvas(2048, 1152);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 2048, 1152);
  ctx.strokeStyle = 'rgba(239,231,214,.14)';
  ctx.lineWidth = 3;
  ctx.font = `150px ${DISPLAY}`;
  ctx.textAlign = 'left';
  for (let y = 140, row = 0; y < 1300; y += 150, row++) {
    ctx.strokeText('INSOUMIS ★ INSOUMISES ★ INSOUMIS ★ INSOUMISES ★', -200 + (row % 2) * 160, y);
  }
  ctx.fillStyle = '#E3201B';
  ctx.fillRect(0, 1092, 2048, 60);
  return toTexture(c);
}
