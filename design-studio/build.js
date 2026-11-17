#!/usr/bin/env node
/* Builds a single self-contained HTML file of Motif Studio.
 *   node design-studio/build.js            -> design-studio/dist/motif-studio.html
 *   node design-studio/build.js --fragment -> body-only page for hosts that add their own <head>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fragment = process.argv.includes('--fragment');
const outArg = process.argv.find((a) => a.startsWith('--out='));

const html = read('index.html');
const css = read('css/app.css');
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => read(m[1]));
const app = html.split('<!--APP-START-->')[1].split('<!--APP-END-->')[0];
const libs = html.split('<!--LIBS-START-->')[1].split('<!--LIBS-END-->')[0].trim();
const fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]+>/) || [''])[0];
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('icon.svg')).toString('base64');
const js = scripts.map((s) => s.replace(/<\/script/gi, '<\\/script')).join('\n');

const head = `<title>Motif Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Atelier de personnalisation : designs sur T-shirts, sweats, casquettes, mugs, affiches et tout objet.">
${fonts}
<style>
${css}
</style>`;

const body = `${app}
${libs}
<script>
${js}
</script>`;

const out = fragment
  ? `${head}\n${body}\n`
  : `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1d2130">
<link rel="icon" href="${icon}">
${head}
</head>
<body>
${body}
</body>
</html>
`;

const dest = outArg ? path.resolve(outArg.slice(6)) : path.join(root, 'dist', fragment ? 'motif-studio.fragment.html' : 'motif-studio.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(`[build] ${path.relative(process.cwd(), dest)} (${(out.length / 1024).toFixed(1)} KB)`);
