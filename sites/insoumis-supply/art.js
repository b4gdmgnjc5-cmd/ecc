// Procedural canvas textures: logo, typographic memes, tricolour tags, light cones.
import * as THREE from 'three';
import { LOGO_MODE } from './config.js';
import { TRICOLORE } from './products.js';

const SERIF = "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif";
let maxAniso = 4;
export function setMaxAnisotropy(v) { maxAniso = v; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = false, color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// The brand mark, drawn with paths so it never depends on a font's Greek glyphs.
export function drawMark(ctx, cx, cy, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (LOGO_MODE === 'phi') {
    const stroke = h * 0.1;
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.ellipse(cx, cy, h * 0.3, h * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(cx - stroke / 2, cy - h / 2, stroke, h);
  } else {
    ctx.font = `700 ${h * 0.62}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MI', cx, cy + h * 0.04);
    ctx.lineWidth = h * 0.03;
    ctx.strokeRect(cx - h * 0.55, cy - h * 0.42, h * 1.1, h * 0.84);
  }
  ctx.restore();
}

export function tricolourRule(ctx, cx, y, w, h) {
  const seg = w / 3;
  [TRICOLORE.bleu, TRICOLORE.blanc, TRICOLORE.rouge].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(cx - w / 2 + seg * i, y, seg, h);
  });
}

// Logo print: the mark alone, plenty of air around it.
export function logoTexture(ink, size = 512) {
  const [c, ctx] = canvas(size, size);
  drawMark(ctx, size / 2, size / 2, size * 0.78, ink);
  return toTexture(c);
}

// Meme print: one quote, set like a magazine cover line, with a small tricolour rule.
export function memeTexture(lines, ink, { italic = false, w = 1024, h = 1024 } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const weight = italic ? 'italic 500' : '800';
  const maxW = w * 0.9;
  const sizes = lines.map((l) => {
    ctx.font = `${weight} 100px ${SERIF}`;
    return Math.min(h * 0.3, (maxW / (ctx.measureText(l).width || 1)) * 100);
  });
  const size = Math.min(...sizes); // same size for every line: calmer than fitted blocks
  const lead = size * 1.02;
  const block = lead * lines.length;
  let y = (h - block) / 2 - h * 0.05 + size * 0.82;
  lines.forEach((l) => {
    ctx.font = `${weight} ${size}px ${SERIF}`;
    ctx.fillText(l, w / 2, y);
    y += lead;
  });
  tricolourRule(ctx, w / 2, y - lead + size * 0.45, w * 0.16, h * 0.012);
  return toTexture(c);
}

export function tagTexture() {
  const [c, ctx] = canvas(96, 64);
  tricolourRule(ctx, 48, 0, 96, 64);
  return toTexture(c);
}

export function fabricTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.025 + Math.random() * 0.025})`;
    ctx.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 3000; i++) {
    const g = 215 + Math.random() * 40;
    ctx.fillStyle = `rgba(${g},${g},${g},.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const t = toTexture(c, { repeat: true });
  t.repeat.set(4, 4);
  return t;
}

// Soft vertical gradient used as alpha for the fake volumetric light cones.
export function beamTexture() {
  const [c, ctx] = canvas(8, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.15, 'rgba(255,255,255,.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  return toTexture(c, { color: false });
}

// Back wall: the mark in fine brass line, a tricolour hairline beneath.
export function finaleTexture() {
  const [c, ctx] = canvas(2048, 1152);
  ctx.fillStyle = '#0c0c0d';
  ctx.fillRect(0, 0, 2048, 1152);
  ctx.globalAlpha = 0.9;
  drawMark(ctx, 1024, 520, 560, '#b8996a');
  ctx.globalAlpha = 1;
  tricolourRule(ctx, 1024, 900, 360, 8);
  return toTexture(c);
}
