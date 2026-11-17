/* Motif Studio — contextual properties panel and layer list. */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  const $ = (s, r) => (r || document).querySelector(s);

  let refreshers = [];
  let ratioLock = true;

  /* ---------- DOM builders ---------- */
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach((c) => c && e.appendChild(c));
    return e;
  }
  DS.el = el;
  let uid = 0;
  const nid = () => 'f' + (++uid);
  const icon = (id) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.innerHTML = `<use href="#i-${id}"/>`; return s; };
  DS.icon = icon;

  function section(title, pro) { return el('h4', { class: pro ? 'pro' : '', text: title }); }
  function range(label, get, set, min, max, step, o) {
    o = o || {};
    const id = nid();
    const out = el('output', { text: fmtv(get(), o) });
    const input = el('input', { type: 'range', id, min, max, step: step || 1, value: get() });
    input.addEventListener('input', () => { set(+input.value); out.textContent = fmtv(+input.value, o); DS.render(); });
    input.addEventListener('change', () => DS.debouncedPush());
    if (o.live) refreshers.push(() => { input.value = get(); out.textContent = fmtv(get(), o); });
    return el('div', { class: 'row' + (o.pro ? ' pro' : '') }, [el('label', { for: id }, [document.createTextNode(label), out]), input]);
  }
  const fmtv = (v, o) => (o.fmt ? o.fmt(v) : (Math.round(v * 100) / 100) + (o.unit || ''));
  function color(label, get, set, o) {
    o = o || {};
    const id = nid();
    const v = get();
    const input = el('input', { type: 'color', id, value: /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000' });
    input.addEventListener('input', () => { set(input.value); DS.render(); });
    input.addEventListener('change', () => DS.debouncedPush());
    return el('div', { class: 'row' + (o.pro ? ' pro' : '') }, [el('label', { for: id, text: label }), input]);
  }
  function select(label, get, set, choices, o) {
    o = o || {};
    const id = nid();
    const s = el('select', { id }, choices.map(([v, t, style]) => el('option', { value: v, text: t, style: style || false })));
    s.value = get();
    s.addEventListener('change', () => { set(s.value); DS.render(); DS.debouncedPush(); });
    return el('div', { class: 'row' + (o.pro ? ' pro' : '') }, [el('label', { for: id, text: label }), s]);
  }
  function toggle(label, get, set, o) {
    o = o || {};
    const id = nid();
    const c = el('input', { type: 'checkbox', id, class: 'switch' });
    c.checked = !!get();
    c.addEventListener('change', () => { set(c.checked); DS.render(); DS.debouncedPush(); });
    return el('div', { class: 'row' + (o.pro ? ' pro' : '') }, [el('label', { for: id, text: label }), c]);
  }
  function seg(items, o) {
    o = o || {};
    return el('div', { class: 'seg' + (o.pro ? ' pro' : '') }, items.map((it) => {
      const b = el('button', { type: 'button', title: it.title, 'aria-label': it.title, class: it.on ? 'on' : '', onclick: () => { it.fn(); if (it.toggle) b.classList.toggle('on'); } }, [it.icon ? icon(it.icon) : document.createTextNode(it.text)]);
      if (it.style) b.setAttribute('style', it.style);
      return b;
    }));
  }
  function num(label, get, set, unit) {
    const input = el('input', { type: 'number', step: '0.1', value: round(get()), 'aria-label': label });
    input.addEventListener('change', () => { set(+input.value); DS.render(); DS.pushHistory(); refresh(); });
    refreshers.push(() => { if (document.activeElement !== input) input.value = round(get()); });
    return el('label', { class: 'num' }, [el('span', { text: label }), input, unit ? el('em', { text: unit }) : null]);
  }
  const round = (v) => Math.round(v * 10) / 10;
  function refresh() { refreshers.forEach((f) => f()); }

  /* ---------- filters ---------- */
  const F = () => fabric.Image.filters;
  function getFilter(img, type) { return (img.filters || []).find((f) => f && f.type === type); }
  let filterRaf = 0;
  function setFilter(img, type, params) {
    img.filters = (img.filters || []).filter((f) => f && f.type !== type);
    if (params) img.filters.push(new (F()[type])(params));
    cancelAnimationFrame(filterRaf);
    filterRaf = requestAnimationFrame(() => { img.applyFilters(); DS.render(); });
  }

  /* ---------- property panel ---------- */
  function build() {
    const panel = $('#propsPanel');
    panel.innerHTML = '';
    panel.className = 'itab props';
    refreshers = [];
    const objs = DS.activeList();
    const o = DS.active();
    if (!o) { panel.appendChild(emptyState()); return; }
    const multi = o.type === 'activeSelection';
    const pro = !DS.isMobile;

    // header + quick actions
    const title = multi ? `${objs.length} éléments` : typeLabel(o);
    panel.appendChild(el('h4', { text: title }));
    panel.appendChild(seg([
      { icon: 'copy', title: 'Dupliquer (Ctrl+D)', fn: DS.duplicate },
      { icon: o.dsLocked ? 'unlock' : 'lock', title: o.dsLocked ? 'Déverrouiller' : 'Verrouiller', fn: () => objs.forEach((x) => DS.setLocked(x, !o.dsLocked)) },
      { text: '↑', title: 'Avancer d’un plan', fn: () => DS.order('up') },
      { text: '↓', title: 'Reculer d’un plan', fn: () => DS.order('down') },
      { icon: 'trash', title: 'Supprimer (Suppr)', fn: DS.remove, style: 'color:var(--danger)' },
    ]));

    // transform
    panel.appendChild(section('Position et taille'));
    if (pro && !multi) {
      const pa = () => DS.pa(), ppc = () => DS.pxPerCm();
      const br = () => o.getBoundingRect(true, true);
      panel.appendChild(el('div', { class: 'grid2' }, [
        num('X', () => (br().left - pa().x) / ppc(), (v) => { o.set('left', o.left + (v * ppc() + pa().x - br().left)); o.setCoords(); }, 'cm'),
        num('Y', () => (br().top - pa().y) / ppc(), (v) => { o.set('top', o.top + (v * ppc() + pa().y - br().top)); o.setCoords(); }, 'cm'),
        num('L', () => o.getScaledWidth() / ppc(), (v) => { const s = (v * ppc()) / o.width; const r = s / o.scaleX; o.set({ scaleX: s, scaleY: ratioLock ? o.scaleY * r : o.scaleY }); o.setCoords(); }, 'cm'),
        num('H', () => o.getScaledHeight() / ppc(), (v) => { const s = (v * ppc()) / o.height; const r = s / o.scaleY; o.set({ scaleY: s, scaleX: ratioLock ? o.scaleX * r : o.scaleX }); o.setCoords(); }, 'cm'),
      ]));
      panel.appendChild(toggle('Conserver les proportions', () => ratioLock, (v) => { ratioLock = v; }));
    } else {
      panel.appendChild(range('Taille', () => Math.round(o.scaleX * 100), (v) => { const r = v / 100 / o.scaleX; o.set({ scaleX: o.scaleX * r, scaleY: o.scaleY * r }); o.setCoords(); }, 5, 600, 1, { unit: ' %', live: true }));
    }
    panel.appendChild(range('Rotation', () => Math.round(o.angle || 0), (v) => { o.rotate(v); o.setCoords(); }, -180, 180, 1, { unit: '°', live: true }));
    if (!multi) {
      panel.appendChild(range('Inclinaison X', () => o.skewX || 0, (v) => { o.set('skewX', v); o.setCoords(); }, -60, 60, 1, { unit: '°', pro: true }));
      panel.appendChild(range('Inclinaison Y', () => o.skewY || 0, (v) => { o.set('skewY', v); o.setCoords(); }, -60, 60, 1, { unit: '°', pro: true }));
    }
    panel.appendChild(el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn sm', type: 'button', text: '⇋ Miroir H', onclick: () => { o.toggle('flipX'); DS.render(); DS.pushHistory(); } }),
      el('button', { class: 'btn sm', type: 'button', text: '⇵ Miroir V', onclick: () => { o.toggle('flipY'); DS.render(); DS.pushHistory(); } }),
      el('button', { class: 'btn sm', type: 'button', text: 'Ajuster à la zone', onclick: () => DS.fitToArea('fit') }),
    ]));

    // alignment
    panel.appendChild(section(multi ? 'Aligner la sélection' : 'Aligner sur la zone d’impression'));
    panel.appendChild(seg([
      { text: '⇤', title: 'Aligner à gauche', fn: () => DS.align('left') },
      { text: '↔', title: 'Centrer horizontalement', fn: () => DS.align('hcenter') },
      { text: '⇥', title: 'Aligner à droite', fn: () => DS.align('right') },
      { text: '⤒', title: 'Aligner en haut', fn: () => DS.align('top') },
      { text: '↕', title: 'Centrer verticalement', fn: () => DS.align('vcenter') },
      { text: '⤓', title: 'Aligner en bas', fn: () => DS.align('bottom') },
    ]));
    if (multi) {
      panel.appendChild(el('div', { class: 'btn-row pro', style: 'margin-top:8px' }, [
        el('button', { class: 'btn sm', type: 'button', text: 'Répartir horizontalement', onclick: () => DS.distribute('h') }),
        el('button', { class: 'btn sm', type: 'button', text: 'Répartir verticalement', onclick: () => DS.distribute('v') }),
        el('button', { class: 'btn sm', type: 'button', text: 'Grouper', onclick: DS.group }),
        el('button', { class: 'btn sm', type: 'button', text: 'Créer un masque', onclick: DS.mask }),
      ]));
    }

    // appearance
    panel.appendChild(section('Apparence'));
    panel.appendChild(range('Opacité', () => Math.round((o.opacity ?? 1) * 100), (v) => o.set('opacity', v / 100), 0, 100, 1, { unit: ' %' }));
    panel.appendChild(select('Mode de fusion', () => o.globalCompositeOperation || 'source-over', (v) => o.set('globalCompositeOperation', v), [
      ['source-over', 'Normal'], ['multiply', 'Produit'], ['screen', 'Superposition claire'], ['overlay', 'Incrustation'], ['darken', 'Obscurcir'], ['lighten', 'Éclaircir'],
      ['color-dodge', 'Densité couleur -'], ['color-burn', 'Densité couleur +'], ['hard-light', 'Lumière crue'], ['soft-light', 'Lumière tamisée'], ['difference', 'Différence'], ['exclusion', 'Exclusion'], ['hue', 'Teinte'], ['saturation', 'Saturation'], ['color', 'Couleur'], ['luminosity', 'Luminosité'],
    ], { pro: true }));

    if (multi) { panel.appendChild(groupColors(objs)); return; }

    if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') textSection(panel, o, pro);
    if (o.type === 'image') imageSection(panel, o, pro);
    if (o.type === 'group') {
      panel.appendChild(el('div', { class: 'btn-row', style: 'margin-top:10px' }, [el('button', { class: 'btn sm pro', type: 'button', text: 'Dégrouper', onclick: DS.ungroup })]));
      panel.appendChild(groupColors(o.getObjects()));
    }
    if (o.type !== 'image' && o.type !== 'group' && o.type !== 'line') fillSection(panel, o, pro);
    if (o.type !== 'image' && o.type !== 'group') strokeSection(panel, o);
    shapeSection(panel, o);
    shadowSection(panel, o);
    if (o.clipPath) {
      panel.appendChild(section('Masque'));
      panel.appendChild(el('button', { class: 'btn sm', type: 'button', text: 'Retirer le masque', onclick: () => DS.unmask(o) }));
    }
  }

  function emptyState() {
    const b = DS.built(), p = DS.product();
    return el('div', { class: 'empty' }, [
      el('b', { text: 'Aucun élément sélectionné' }),
      el('p', { text: `${p.name} : zone d’impression ${DS.fmt(b.pa.cmW)} × ${DS.fmt(b.pa.cmH)} cm. Ajoute un texte, une image ou une forme, puis touche-le pour le régler.` }),
      el('div', { class: 'btn-row', style: 'justify-content:center' }, [
        el('button', { class: 'btn sm', type: 'button', text: '+ Texte', onclick: () => DS.addText({}) }),
        el('button', { class: 'btn sm', type: 'button', text: '+ Image', onclick: () => $('#imageFile').click() }),
      ]),
    ]);
  }

  function typeLabel(o) {
    if (o.type === 'i-text') return o.dsName && o.dsName.startsWith('Emoji') ? 'Emoji' : 'Texte';
    return ({ image: 'Image', group: 'Groupe / vecteur', rect: 'Rectangle', circle: 'Cercle', ellipse: 'Ellipse', triangle: 'Triangle', polygon: 'Polygone', path: o.dsName || 'Tracé', line: 'Ligne' })[o.type] || 'Élément';
  }

  function textSection(panel, o, pro) {
    panel.appendChild(section('Texte'));
    const ta = el('textarea', { 'aria-label': 'Contenu du texte' });
    ta.value = o.text;
    ta.addEventListener('input', () => { o.set('text', ta.value); if (o.dsCurve) DS.applyCurve(o, o.dsCurve); DS.render(); DS.debouncedPush(); DS.emit('layers'); });
    panel.appendChild(ta);
    const fonts = DS.FONTS.filter((f) => pro || f[1]).map(([f]) => [f, f, `font-family:'${f}'`]);
    if (!fonts.find((f) => f[0] === o.fontFamily)) fonts.unshift([o.fontFamily, o.fontFamily.replace(/"/g, '')]);
    panel.appendChild(select('Police', () => o.fontFamily, (v) => DS.ensureFont(v).then(() => { o.set('fontFamily', v); if (o.dsCurve) DS.applyCurve(o, o.dsCurve); DS.render(); }), fonts));
    panel.appendChild(range('Taille', () => o.fontSize, (v) => { o.set('fontSize', v); if (o.dsCurve) DS.applyCurve(o, o.dsCurve); }, 8, 300, 1, { unit: ' pt' }));
    panel.appendChild(seg([
      { text: 'G', title: 'Gras', on: o.fontWeight === 'bold' || o.fontWeight >= 700, toggle: true, style: 'font-weight:800', fn: () => { o.set('fontWeight', o.fontWeight === 'bold' || o.fontWeight >= 700 ? 'normal' : 'bold'); reCurve(o); } },
      { text: 'I', title: 'Italique', on: o.fontStyle === 'italic', toggle: true, style: 'font-style:italic', fn: () => { o.set('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic'); reCurve(o); } },
      { text: 'S', title: 'Souligné', on: o.underline, toggle: true, style: 'text-decoration:underline', fn: () => { o.set('underline', !o.underline); reCurve(o); } },
      { text: 'Aa', title: 'Majuscules', fn: () => { o.set('text', o.text === o.text.toUpperCase() ? o.text.toLowerCase() : o.text.toUpperCase()); ta.value = o.text; reCurve(o); } },
    ]));
    panel.appendChild(el('div', { style: 'height:8px' }));
    panel.appendChild(seg(['left', 'center', 'right'].map((a) => ({ text: { left: '⯇ Gauche', center: 'Centre', right: 'Droite ⯈' }[a], title: 'Aligner ' + a, on: o.textAlign === a, fn: () => { o.set('textAlign', a); reCurve(o); build(); } }))));
    panel.appendChild(range('Espacement lettres', () => o.charSpacing || 0, (v) => { o.set('charSpacing', v); if (o.dsCurve) DS.applyCurve(o, o.dsCurve); }, -100, 800, 5, { pro: true }));
    panel.appendChild(range('Interligne', () => o.lineHeight || 1.1, (v) => o.set('lineHeight', v), 0.6, 3, 0.05, { pro: true }));
    panel.appendChild(range('Courbure', () => o.dsCurve || 0, (v) => DS.applyCurve(o, v), -100, 100, 1, { pro: true, fmt: (v) => (v === 0 ? 'droit' : (v > 0 ? 'arc ' : 'creux ') + Math.abs(v)) }));
  }
  function reCurve(o) { if (o.dsCurve) DS.applyCurve(o, o.dsCurve); DS.render(); DS.debouncedPush(); }

  function fillSection(panel, o, pro) {
    panel.appendChild(section('Remplissage'));
    const g = o.dsGrad;
    const solid = () => (typeof o.fill === 'string' && o.fill ? o.fill : '#000000');
    if (!g) panel.appendChild(color('Couleur', solid, (v) => o.set('fill', v)));
    if (pro) {
      panel.appendChild(select('Type', () => (g ? g.type : (o.fill ? 'solid' : 'none')), (v) => {
        if (v === 'solid') DS.applyGradient(o, null);
        else if (v === 'none') { o.dsGrad = null; o.set('fill', ''); }
        else DS.applyGradient(o, { type: v, c1: g ? g.c1 : solid(), c2: g ? g.c2 : '#e83f6f', angle: g ? g.angle : 90 });
        build();
      }, [['solid', 'Couleur unie'], ['linear', 'Dégradé linéaire'], ['radial', 'Dégradé radial'], ['none', 'Aucun (contour seul)']]));
      if (g) {
        panel.appendChild(color('Couleur 1', () => g.c1, (v) => { g.c1 = v; DS.applyGradient(o, g); }));
        panel.appendChild(color('Couleur 2', () => g.c2, (v) => { g.c2 = v; DS.applyGradient(o, g); }));
        if (g.type === 'linear') panel.appendChild(range('Angle', () => g.angle, (v) => { g.angle = v; DS.applyGradient(o, g); }, 0, 360, 1, { unit: '°' }));
      }
    }
  }
  function strokeSection(panel, o) {
    const isLine = o.type === 'line' || (o.type === 'path' && !o.fill);
    panel.appendChild(section(isLine ? 'Trait' : 'Contour', !isLine));
    panel.appendChild(color('Couleur', () => o.stroke || '#16171b', (v) => { o.set('stroke', v); if (!o.strokeWidth) o.set('strokeWidth', 2); }, { pro: !isLine }));
    panel.appendChild(range('Épaisseur', () => o.strokeWidth || 0, (v) => { o.set({ strokeWidth: v, stroke: o.stroke || '#16171b' }); if (o.dsCurve) DS.applyCurve(o, o.dsCurve); }, 0, isLine ? 60 : 30, 0.5, { pro: !isLine, unit: ' px' }));
    panel.appendChild(select('Style', () => (o.strokeDashArray ? o.strokeDashArray.join(',') : ''), (v) => o.set('strokeDashArray', v ? v.split(',').map(Number) : null), [['', 'Plein'], ['12,8', 'Tirets'], ['2,8', 'Pointillés'], ['24,8,4,8', 'Mixte']], { pro: true }));
    if (o.type === 'i-text') panel.appendChild(select('Contour', () => o.paintFirst || 'fill', (v) => o.set('paintFirst', v), [['fill', 'Par-dessus'], ['stroke', 'Derrière (épais)']], { pro: true }));
  }
  function shapeSection(panel, o) {
    if (o.type === 'rect') {
      panel.appendChild(section('Forme'));
      panel.appendChild(range('Coins arrondis', () => o.rx || 0, (v) => o.set({ rx: v, ry: v }), 0, Math.min(o.width, o.height) / 2, 1, { unit: ' px' }));
    }
    if (o.type === 'polygon' && o.dsShape) {
      panel.appendChild(section('Forme'));
      if (o.dsShape.kind === 'star') {
        panel.appendChild(range('Branches', () => o.dsShape.n, (v) => DS.regenShape(o, { n: v }), 3, 24, 1));
        panel.appendChild(range('Creux', () => o.dsShape.inner, (v) => DS.regenShape(o, { inner: v }), 10, 95, 1, { unit: ' %' }));
      } else panel.appendChild(range('Côtés', () => o.dsShape.n, (v) => DS.regenShape(o, { n: v }), 3, 16, 1));
    }
  }
  function shadowSection(panel, o) {
    const sh = o.shadow;
    panel.appendChild(section('Ombre et lueur', true));
    panel.appendChild(toggle('Activer', () => !!o.shadow, (v) => { o.set('shadow', v ? new fabric.Shadow({ color: 'rgba(0,0,0,0.45)', blur: 12, offsetX: 6, offsetY: 6 }) : null); build(); }, { pro: true }));
    if (sh) {
      const upd = (patch) => { o.set('shadow', new fabric.Shadow(Object.assign({ color: sh.color, blur: sh.blur, offsetX: sh.offsetX, offsetY: sh.offsetY }, patch))); Object.assign(sh, patch); o.dirty = true; };
      panel.appendChild(color('Couleur', () => toHex(sh.color), (v) => upd({ color: v }), { pro: true }));
      panel.appendChild(range('Flou', () => sh.blur, (v) => upd({ blur: v }), 0, 80, 1, { pro: true }));
      panel.appendChild(range('Décalage X', () => sh.offsetX, (v) => upd({ offsetX: v }), -60, 60, 1, { pro: true }));
      panel.appendChild(range('Décalage Y', () => sh.offsetY, (v) => upd({ offsetY: v }), -60, 60, 1, { pro: true }));
    }
  }
  function toHex(c) {
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    try { return '#' + new fabric.Color(c).toHex(); } catch (_e) { return '#000000'; }
  }

  function imageSection(panel, o, pro) {
    const ppc = DS.pxPerCm();
    const wcm = o.getScaledWidth() / ppc;
    const dpi = Math.round((o.width / wcm) * 2.54);
    const cls = dpi >= 240 ? 'good' : dpi >= 150 ? 'mid' : 'bad';
    const msg = dpi >= 240 ? 'Qualité d’impression excellente' : dpi >= 150 ? 'Qualité correcte' : 'Image trop petite : risque de flou';
    const badge = el('span', { class: 'badge ' + cls, text: `≈ ${dpi} DPI · ${msg}` });
    panel.appendChild(section('Qualité'));
    panel.appendChild(badge);
    refreshers.push(() => {
      const d = Math.round((o.width / (o.getScaledWidth() / DS.pxPerCm())) * 2.54);
      badge.className = 'badge ' + (d >= 240 ? 'good' : d >= 150 ? 'mid' : 'bad');
      badge.textContent = `≈ ${d} DPI · ${d >= 240 ? 'Qualité d’impression excellente' : d >= 150 ? 'Qualité correcte' : 'Image trop petite : risque de flou'}`;
    });
    panel.appendChild(el('div', { class: 'btn-row', style: 'margin-top:8px' }, [
      el('button', { class: 'btn sm', type: 'button', text: 'Ajuster', onclick: () => DS.fitToArea('fit') }),
      el('button', { class: 'btn sm', type: 'button', text: 'Remplir la zone', onclick: () => DS.fitToArea('fill') }),
    ]));

    panel.appendChild(section('Réglages image'));
    const val = (type, key, def) => { const f = getFilter(o, type); return f ? f[key] : def; };
    panel.appendChild(range('Luminosité', () => Math.round(val('Brightness', 'brightness', 0) * 100), (v) => setFilter(o, 'Brightness', v ? { brightness: v / 100 } : null), -100, 100, 1));
    panel.appendChild(range('Contraste', () => Math.round(val('Contrast', 'contrast', 0) * 100), (v) => setFilter(o, 'Contrast', v ? { contrast: v / 100 } : null), -100, 100, 1));
    panel.appendChild(range('Saturation', () => Math.round(val('Saturation', 'saturation', 0) * 100), (v) => setFilter(o, 'Saturation', v ? { saturation: v / 100 } : null), -100, 100, 1));
    panel.appendChild(range('Teinte', () => Math.round(val('HueRotation', 'rotation', 0) * 180), (v) => setFilter(o, 'HueRotation', v ? { rotation: v / 180 } : null), -180, 180, 1, { pro: true, unit: '°' }));
    panel.appendChild(range('Flou', () => Math.round(val('Blur', 'blur', 0) * 100), (v) => setFilter(o, 'Blur', v ? { blur: v / 100 } : null), 0, 100, 1, { pro: true }));
    panel.appendChild(range('Grain', () => val('Noise', 'noise', 0), (v) => setFilter(o, 'Noise', v ? { noise: v } : null), 0, 400, 5, { pro: true }));
    panel.appendChild(range('Pixellisation', () => val('Pixelate', 'blocksize', 1), (v) => setFilter(o, 'Pixelate', v > 1 ? { blocksize: v } : null), 1, 40, 1, { pro: true }));
    panel.appendChild(el('div', { class: 'btn-row pro', style: 'margin-top:6px' }, [
      ['Grayscale', 'Noir & blanc'], ['Sepia', 'Sépia'], ['Invert', 'Négatif'],
    ].map(([t, label]) => el('button', { type: 'button', class: 'btn sm' + (getFilter(o, t) ? ' on' : ''), text: label, onclick: (e) => { const on = !getFilter(o, t); setFilter(o, t, on ? {} : null); e.currentTarget.classList.toggle('on', on); DS.debouncedPush(); } }))));

    panel.appendChild(section('Détourage'));
    panel.appendChild(toggle('Retirer le fond', () => !!getFilter(o, 'RemoveColor'), (v) => { setFilter(o, 'RemoveColor', v ? { color: pickCorner(o), distance: 0.18 } : null); build(); }));
    const rc = getFilter(o, 'RemoveColor');
    if (rc) {
      panel.appendChild(color('Couleur retirée', () => toHex(rc.color), (v) => setFilter(o, 'RemoveColor', { color: v, distance: rc.distance })));
      panel.appendChild(range('Tolérance', () => Math.round(rc.distance * 100), (v) => setFilter(o, 'RemoveColor', { color: rc.color, distance: v / 100 }), 1, 80, 1));
    }
    if (!pro) return;
    panel.appendChild(el('button', { type: 'button', class: 'btn sm', style: 'margin-top:10px', text: 'Réinitialiser les réglages', onclick: () => { o.filters = []; o.applyFilters(); DS.render(); DS.pushHistory(); build(); } }));
  }
  // Background colour guess: the image's top-left pixel.
  function pickCorner(o) {
    try {
      const src = o.getOriginalElement ? o.getOriginalElement() : o._element;
      const c = document.createElement('canvas'); c.width = c.height = 1;
      const g = c.getContext('2d'); g.drawImage(src, 0, 0, 1, 1, 0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      return DS.color.rgbToHex(d[0], d[1], d[2]);
    } catch (_e) { return '#ffffff'; }
  }

  // Recolour every distinct fill inside a group / SVG / selection.
  function groupColors(objs) {
    const wrap = el('div', { class: 'pro' });
    const colors = new Map();
    const collect = (list) => list.forEach((x) => {
      if (x.type === 'group') return collect(x.getObjects());
      ['fill', 'stroke'].forEach((k) => {
        const v = x[k];
        if (typeof v === 'string' && v && v !== 'none' && v !== 'transparent') {
          const hex = toHex(v);
          if (!colors.has(hex)) colors.set(hex, []);
          colors.get(hex).push([x, k]);
        }
      });
    });
    collect(objs);
    if (!colors.size) return wrap;
    wrap.appendChild(section('Couleurs du vecteur'));
    [...colors.entries()].slice(0, 16).forEach(([hex, targets], i) => {
      let cur = hex;
      wrap.appendChild(color('Couleur ' + (i + 1), () => cur, (v) => { cur = v; targets.forEach(([x, k]) => { x.set(k, v); x.dirty = true; }); objs.forEach((x) => { if (x.group) x.group.dirty = true; }); const a = DS.active(); if (a) a.dirty = true; }));
    });
    return wrap;
  }

  /* ---------- layers ---------- */
  let layersRaf = 0;
  function buildLayers() {
    cancelAnimationFrame(layersRaf);
    layersRaf = requestAnimationFrame(() => {
      const list = $('#layerList');
      list.innerHTML = '';
      const objs = DS.objects();
      const sel = DS.activeList();
      $('#layersEmpty').hidden = objs.length > 0;
      objs.slice().reverse().forEach((o, ri) => {
        const idx = objs.length - 1 - ri;
        const li = el('li', { class: (sel.includes(o) ? 'sel ' : '') + (o.visible ? '' : 'hidden-layer'), draggable: DS.isMobile ? false : 'true' });
        const thumb = el('span', { class: 'thumb' });
        try {
          const m = 34 / Math.max(o.getScaledWidth() || 1, o.getScaledHeight() || 1);
          const vis = o.visible; o.visible = true;
          thumb.appendChild(el('img', { alt: '', src: o.toDataURL({ multiplier: Math.min(2, m * 2) }) }));
          o.visible = vis;
        } catch (_e) { /* tainted or empty */ }
        const name = el('span', { class: 'name', text: layerName(o) });
        name.addEventListener('dblclick', () => rename(o, name));
        li.append(thumb, name,
          el('button', { class: 'icon-btn', type: 'button', title: o.visible ? 'Masquer' : 'Afficher', onclick: (e) => { e.stopPropagation(); DS.setVisible(o, !o.visible); } }, [icon(o.visible ? 'eye' : 'eyeoff')]),
          el('button', { class: 'icon-btn', type: 'button', title: o.dsLocked ? 'Déverrouiller' : 'Verrouiller', onclick: (e) => { e.stopPropagation(); DS.setLocked(o, !o.dsLocked); } }, [icon(o.dsLocked ? 'lock' : 'unlock')]),
          DS.isMobile ? el('button', { class: 'icon-btn', type: 'button', title: 'Monter', text: '↑', onclick: (e) => { e.stopPropagation(); DS.moveLayer(o, Math.min(objs.length - 1, idx + 1)); } }) : null,
        );
        li.addEventListener('click', (e) => {
          if (!o.visible) return;
          if ((e.shiftKey || e.metaKey || e.ctrlKey) && sel.length) {
            const set = new Set(DS.activeList()); set.has(o) ? set.delete(o) : set.add(o);
            DS.canvas.discardActiveObject();
            const arr = [...set];
            if (arr.length) DS.select(arr.length === 1 ? arr[0] : new fabric.ActiveSelection(arr, { canvas: DS.canvas }));
          } else { DS.canvas.discardActiveObject(); DS.select(o); }
        });
        li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; });
        li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
        li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
        li.addEventListener('drop', (e) => {
          e.preventDefault(); li.classList.remove('drag-over');
          const from = +e.dataTransfer.getData('text/plain');
          const obj = objs[from];
          if (obj) DS.moveLayer(obj, idx);
        });
        list.appendChild(li);
      });
    });
  }
  function layerName(o) {
    if (o.dsName && !(o.type === 'i-text' && !o.dsRenamed && !o.dsName.startsWith('Emoji'))) return o.dsName;
    if (o.type === 'i-text') return '« ' + (o.text || '').replace(/\s+/g, ' ').slice(0, 28) + ' »';
    return typeLabel(o);
  }
  function rename(o, span) {
    const input = el('input', { class: 'name', value: layerName(o), 'aria-label': 'Nom du calque' });
    span.replaceWith(input); input.focus(); input.select();
    const done = () => { o.dsName = input.value.trim() || layerName(o); o.dsRenamed = true; DS.pushHistory(); buildLayers(); };
    input.addEventListener('blur', done);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = layerName(o); input.blur(); } e.stopPropagation(); });
  }

  DS.initInspector = function () {
    DS.on('selection', () => { build(); buildLayers(); });
    DS.on('modified', () => { build(); });
    DS.on('live', refresh);
    DS.on('layers', buildLayers);
    DS.on('view', () => { build(); buildLayers(); });
    DS.on('area', () => { if (!DS.active()) build(); });
    DS.rebuildInspector = build;
    build();
  };
})();
