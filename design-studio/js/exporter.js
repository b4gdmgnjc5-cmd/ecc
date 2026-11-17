/* Motif Studio — exports: PNG/JPG mockups, print files with DPI, SVG, PDF and project files. */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  /* ---------- saving a file (browser download, or the host's save dialog when embedded) ---------- */
  let downloadsCap;
  async function hostDownloads() {
    if (downloadsCap !== undefined) return downloadsCap;
    downloadsCap = null;
    if (window.claude && typeof window.claude.use === 'function') {
      try { downloadsCap = await window.claude.use('downloads'); } catch (_e) { downloadsCap = null; }
    }
    return downloadsCap;
  }
  DS.saveFile = async function (filename, blob) {
    const host = await hostDownloads();
    if (host) {
      try { await host.save({ filename, data: blob }); return true; } catch (e) {
        if (e && e.code === 'declined') return false;
        if (e && e.code === 'rate_limited') { DS.toast('Une fenêtre d’enregistrement est déjà ouverte.'); return false; }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  };

  const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type || 'image/png', q));
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const baseName = (view) => `motif-studio-${slug(DS.product().name)}${view ? '-' + slug(viewLabel(view)) : ''}`;
  const viewLabel = (v) => (DS.product().views.find((x) => x[0] === v) || [v, v])[1];
  const viewsFor = (which) => (which === 'all' ? DS.product().views.map((v) => v[0]) : [DS.state.view]);

  /* ---------- PNG pHYs chunk so print shops read the right DPI ---------- */
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function withDpi(blob, dpi) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
    dv.setUint32(17, crc32(chunk.subarray(4, 17)));
    const at = 33; // signature (8) + IHDR chunk (25)
    const out = new Uint8Array(buf.length + chunk.length);
    out.set(buf.subarray(0, at), 0); out.set(chunk, at); out.set(buf.subarray(at), at + chunk.length);
    return new Blob([out], { type: 'image/png' });
  }

  /* ---------- individual exports ---------- */
  async function mockup(views, width, bg, jpg) {
    for (const v of views) {
      const c = await DS.composeView(v, width, { background: jpg && bg === 'transparent' ? '#ffffff' : bg });
      const blob = await toBlob(c, jpg ? 'image/jpeg' : 'image/png', 0.92);
      await DS.saveFile(baseName(v) + (jpg ? '.jpg' : '.png'), blob);
    }
  }
  function printScale(view, dpi) {
    const pa = DS.pa(view);
    let pxW = (pa.cmW / 2.54) * dpi, pxH = (pa.cmH / 2.54) * dpi;
    const maxSide = 14000, maxArea = 120e6;
    let f = Math.min(1, maxSide / Math.max(pxW, pxH), Math.sqrt(maxArea / (pxW * pxH)));
    pxW *= f; pxH *= f;
    return { k: pxW / pa.w, realDpi: Math.round(dpi * f), pxW: Math.round(pxW), pxH: Math.round(pxH), pa };
  }
  async function printFile(views, dpi) {
    for (const v of views) {
      const s = printScale(v, dpi);
      const c = await DS.renderDesign(v, s.k, 'pa', { clip: true });
      const blob = await withDpi(await toBlob(c, 'image/png'), s.realDpi);
      if (s.realDpi < dpi) DS.toast(`Résolution limitée à ${s.realDpi} DPI pour cette taille.`);
      await DS.saveFile(`${baseName(v)}-impression-${s.realDpi}dpi.png`, blob);
    }
  }

  function staticFor(view) {
    return new Promise((res) => {
      const sc = new fabric.StaticCanvas(null, { width: DS.W, height: DS.H, enableRetinaScaling: false, renderOnAddRemove: false });
      sc.loadFromJSON(DS.fromRefs(DS.designJSON(view)), () => {
        sc.getObjects().forEach((o) => {
          if (o.dsCurve && o.type === 'i-text') DS.applyCurve(o, o.dsCurve);
          if (o.dsGrad) DS.applyGradient(o, o.dsGrad);
        });
        res(sc);
      });
    });
  }
  function fontImport(sc) {
    const fams = new Set();
    const scan = (list) => list.forEach((o) => { if (o.fontFamily && DS.FONTS.some((f) => f[0] === o.fontFamily)) fams.add(o.fontFamily); if (o.getObjects) scan(o.getObjects()); });
    scan(sc.getObjects());
    if (!fams.size) return '';
    const q = [...fams].map((f) => 'family=' + f.replace(/ /g, '+')).join('&amp;');
    return `<style>@import url('https://fonts.googleapis.com/css2?${q}&amp;display=swap');</style>`;
  }
  const stripPreamble = (s) => s.replace(/<\?xml[^>]*>\s*/, '').replace(/<!DOCTYPE[^>]*>\s*/i, '');

  async function svg(views, mode) {
    for (const v of views) {
      const sc = await staticFor(v);
      const pa = DS.pa(v);
      let out;
      if (mode === 'design') {
        out = sc.toSVG({ viewBox: { x: pa.x, y: pa.y, width: pa.w, height: pa.h }, width: pa.cmW + 'cm', height: pa.cmH + 'cm' });
        out = out.replace('<defs>', '<defs>' + fontImport(sc));
      } else {
        const b = DS.built(v);
        const inner = stripPreamble(sc.toSVG({ viewBox: { x: 0, y: 0, width: DS.W, height: DS.H }, width: DS.W, height: DS.H }));
        out = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${DS.W} ${DS.H}" width="${DS.W}" height="${DS.H}">
<defs>${fontImport(sc)}<clipPath id="mainClip"><path d="${b.outline}"/></clipPath><clipPath id="paClip"><rect x="${pa.x}" y="${pa.y}" width="${pa.w}" height="${pa.h}"/></clipPath></defs>
<g id="produit">${DS.productSVG(b, DS.state.colors, false)}</g>
<g id="design" clip-path="${DS.state.clip ? 'url(#paClip)' : 'none'}">${inner}</g>
<g id="produit-dessus">${DS.productSVG(b, DS.state.colors, true)}</g>
</svg>`;
      }
      sc.dispose();
      await DS.saveFile(`${baseName(v)}${mode === 'design' ? '-vectoriel' : '-maquette'}.svg`, new Blob([out], { type: 'image/svg+xml' }));
    }
  }

  async function pdf(views, dpi) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { DS.toast('Le module PDF n’a pas pu se charger. Vérifie ta connexion.'); return; }
    let doc = null;
    const margin = 15; // mm
    for (const v of views) {
      const s = printScale(v, Math.min(dpi, 300));
      const pa = s.pa;
      const wmm = pa.cmW * 10, hmm = pa.cmH * 10;
      const pw = wmm + margin * 2, ph = hmm + margin * 2 + 10;
      const orient = pw > ph ? 'l' : 'p';
      if (!doc) doc = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: orient, compress: true });
      else doc.addPage([pw, ph], orient);
      const c = await DS.renderDesign(v, s.k, 'pa', { clip: true });
      doc.addImage(c.toDataURL('image/png'), 'PNG', margin, margin, wmm, hmm, undefined, 'FAST');
      // crop marks
      doc.setDrawColor(0); doc.setLineWidth(0.2);
      const L = 6, g = 2;
      [[margin, margin], [margin + wmm, margin], [margin, margin + hmm], [margin + wmm, margin + hmm]].forEach(([x, y], i) => {
        const sx = i % 2 ? 1 : -1, sy = i > 1 ? 1 : -1;
        doc.line(x + sx * g, y, x + sx * (g + L), y);
        doc.line(x, y + sy * g, x, y + sy * (g + L));
      });
      doc.setFontSize(8); doc.setTextColor(90);
      doc.text(`${DS.product().name} - ${viewLabel(v)} - ${DS.fmt(pa.cmW)} x ${DS.fmt(pa.cmH)} cm - ${s.realDpi} DPI`, margin, ph - 8);
    }
    // technical sheet
    doc.addPage('a4', 'p');
    const p = DS.product();
    doc.setTextColor(20); doc.setFontSize(18); doc.text('Fiche technique', 15, 22);
    doc.setFontSize(10); doc.setTextColor(70);
    const lines = [
      `Produit : ${p.name}`,
      `Couleur principale : ${DS.state.colors.main.toUpperCase()}   Finitions : ${DS.state.colors.trim.toUpperCase()}`,
      ...p.options.map((op) => {
        const val = DS.state.options[op.key];
        const label = op.type === 'select' ? ((op.choices.find((c) => c[0] === val) || [0, val])[1]) : `${val} ${op.unit || ''}`;
        return `${op.label} : ${label}`;
      }),
      `Date : ${new Date().toLocaleDateString('fr-FR')}`,
    ];
    lines.forEach((t, i) => doc.text(t, 15, 32 + i * 6));
    let y = 40 + lines.length * 6;
    const cols = Math.min(2, views.length);
    const cw = (180 - (cols - 1) * 8) / cols;
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const img = await DS.composeView(v, 900, { background: '#f2f3f6' });
      const h = cw * (DS.H / DS.W);
      const x = 15 + (i % cols) * (cw + 8);
      if (i && i % cols === 0) y += h + 16;
      if (y + h > 285) { doc.addPage('a4', 'p'); y = 20; }
      doc.addImage(img.toDataURL('image/jpeg', 0.88), 'JPEG', x, y, cw, h);
      const pa = DS.pa(v);
      doc.text(`${viewLabel(v)} - zone ${DS.fmt(pa.cmW)} x ${DS.fmt(pa.cmH)} cm`, x, y + h + 6);
    }
    await DS.saveFile(baseName() + '.pdf', doc.output('blob'));
  }

  async function project() {
    const data = JSON.stringify(DS.projectData());
    await DS.saveFile(baseName() + '.json', new Blob([data], { type: 'application/json' }));
  }
  DS.saveProjectFile = project;

  DS.runExport = async function (cfg) {
    const mobile = DS.isMobile;
    const views = mobile ? [DS.state.view] : viewsFor(cfg.views);
    DS.canvas.discardActiveObject(); DS.render();
    DS.toast('Export en cours…', 60000);
    try {
      switch (cfg.type) {
        case 'mockup': await mockup(views, mobile ? 1200 : +cfg.size, cfg.bg, false); break;
        case 'mockupjpg': await mockup(views, +cfg.size, cfg.bg, true); break;
        case 'print': await printFile(views, +cfg.dpi); break;
        case 'svg': await svg(views, cfg.svgMode); break;
        case 'pdf': await pdf(views, +cfg.dpi); break;
        case 'json': await project(); break;
        default: break;
      }
      DS.toast('Export terminé.');
    } catch (e) {
      console.error('[MotifStudio] export', e);
      DS.toast('L’export a échoué : ' + (e && e.message ? e.message : 'erreur inconnue'));
    }
  };

  DS.exportInfo = function (cfg) {
    const pa = DS.pa();
    if (cfg.type === 'print' || cfg.type === 'pdf') {
      const s = printScale(DS.state.view, +cfg.dpi);
      return `Zone ${DS.fmt(pa.cmW)} × ${DS.fmt(pa.cmH)} cm → ${s.pxW} × ${s.pxH} px à ${s.realDpi} DPI, fond transparent.`;
    }
    if (cfg.type === 'svg') return cfg.svgMode === 'design' ? `SVG à la taille réelle (${DS.fmt(pa.cmW)} × ${DS.fmt(pa.cmH)} cm). Les images importées restent en pixels.` : 'SVG de la maquette complète avec l’objet en vectoriel.';
    if (cfg.type === 'json') return 'Contient le produit, les couleurs, toutes les faces et les images importées.';
    const w = DS.isMobile ? 1200 : +cfg.size;
    return `${w} × ${Math.round(w * DS.H / DS.W)} px, avec ombres et matière.`;
  };
})();
