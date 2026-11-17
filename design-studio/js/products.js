/* Motif Studio — product catalogue and 2D product rendering.
 * Every product is drawn from SVG path strings on a 600 x 700 logical canvas,
 * so the same geometry feeds the editor, PNG/PDF exports and SVG exports. */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  const W = 600, H = 700, CX = 300;
  DS.W = W; DS.H = H;

  /* ---------- colour helpers ---------- */
  function hexToRgb(hex) {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function shade(hex, amt) { // amt < 0 darkens, > 0 lightens
    const [r, g, b] = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  DS.color = { hexToRgb, rgbToHex, shade, luminance };

  /* ---------- path helpers ---------- */
  const f = (n) => +n.toFixed(2);
  const pt = (p) => f(p[0]) + ' ' + f(p[1]);
  // Builds a left/right symmetric outline from its left half (top centre -> bottom centre).
  function symmetric(start, segs) {
    const mx = (x) => 2 * CX - x;
    let d = 'M' + pt(start);
    segs.forEach((s) => { d += s.c ? ' Q' + pt(s.c) + ' ' + pt(s.p) : ' L' + pt(s.p); });
    const pts = [start].concat(segs.map((s) => s.p));
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i], to = pts[i];
      d += s.c ? ' Q' + pt([mx(s.c[0]), s.c[1]]) + ' ' + pt([mx(to[0]), to[1]]) : ' L' + pt([mx(to[0]), to[1]]);
    }
    return d + ' Z';
  }
  function rect(x, y, w, h) { return `M${f(x)} ${f(y)} h${f(w)} v${f(h)} h${f(-w)} Z`; }
  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return `M${f(x + r)} ${f(y)} H${f(x + w - r)} Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} V${f(y + h - r)} Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} H${f(x + r)} Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} V${f(y + r)} Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`;
  }
  function ellipse(cx, cy, rx, ry) {
    return `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;
  }
  function mirrorD(d) { // mirror absolute path data around CX (only M/L/Q/H/V/Z/A with absolute coords)
    return d.replace(/([MLQHA])([^MLQHVAZ]*)/g, (m, cmd, args) => {
      const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (cmd === 'H') return 'H' + f(2 * CX - n[0]) + ' ';
      if (cmd === 'A') return `A${n[0]} ${n[1]} ${n[2]} ${n[3]} ${n[4] ? 0 : 1} ${f(2 * CX - n[5])} ${n[6]} `;
      const out = [];
      for (let i = 0; i < n.length; i += 2) out.push(f(2 * CX - n[i]) + ' ' + n[i + 1]);
      return cmd + out.join(' ') + ' ';
    });
  }
  DS.path = { symmetric, rect, rrect, ellipse };

  /* ---------- garments (T-shirt, sweat, hoodie, tank) ---------- */
  function garment(view, o, flags) {
    const fit = { slim: 0.9, regular: 1, oversize: 1.14 }[o.fit] || 1;
    const bw = 150 * fit;
    const sleeves = flags.sleeves || o.sleeves || 'short';
    const tank = sleeves === 'none';
    const neckW = tank ? 74 : flags.hood ? 64 : 58;
    const back = view === 'back';
    let depth = 52;
    if (!back) depth = { round: 52, v: 112, scoop: 84, crew: 40 }[o.neck || 'round'] || 52;
    else depth = 16;
    if (tank && !back) depth = Math.max(depth, 90);
    if (flags.hood && !back) depth = 70;
    const ny = 88 + depth;
    const start = [CX, ny];
    const segs = [];
    if ((o.neck === 'v') && !back && !flags.hood) segs.push({ p: [CX - neckW, 88] });
    else segs.push({ c: [CX - neckW * 0.96, ny], p: [CX - neckW, 88] });
    if (tank) {
      segs.push({ p: [CX - neckW - 30, 90] });
      segs.push({ c: [CX - neckW - 36, 222], p: [CX - bw + 2, 252] });
    } else {
      const sx = CX - 112 * ((fit + 1) / 2);
      segs.push({ p: [sx, 104] });
      if (sleeves === 'long') {
        segs.push({ p: [CX - bw - 62, 300] });
        segs.push({ p: [CX - bw - 72, 566] });
        segs.push({ p: [CX - bw - 28, 572] });
        segs.push({ p: [CX - bw + 2, 262] });
      } else {
        segs.push({ p: [CX - bw - 78, 178] });
        segs.push({ p: [CX - bw - 44, 254] });
        segs.push({ c: [CX - bw - 18, 246], p: [CX - bw + 4, 228] });
      }
    }
    segs.push({ c: [CX - bw - 6, 440], p: [CX - bw + 2, 640] });
    segs.push({ c: [CX - bw / 2, 647], p: [CX, 645] });
    const outline = symmetric(start, segs);

    const layers = [];
    // hood (behind the body)
    if (flags.hood) {
      if (!back) layers.push({ d: `M${CX - 76} 104 Q${CX - 104} 18 ${CX} 10 Q${CX + 104} 18 ${CX + 76} 104 Z`, fill: 'shadeA' });
    }
    layers.push({ d: outline, fill: 'main', main: true });
    // collar rib
    if (!flags.hood) {
      const nd = (o.neck === 'v' && !back)
        ? `M${CX - neckW} 88 L${CX} ${ny} L${CX + neckW} 88`
        : `M${CX - neckW} 88 Q${f(CX - neckW * 0.96)} ${ny} ${CX} ${ny} Q${f(CX + neckW * 0.96)} ${ny} ${CX + neckW} 88`;
      layers.push({ d: nd, stroke: 'trim', lw: tank ? 8 : 11 });
      layers.push({ d: `M${CX - neckW + 4} 86 Q${CX} ${back ? 80 : 74} ${CX + neckW - 4} 86`, stroke: 'inner', lw: 6, alpha: back ? 0 : 0.9 });
    }
    if (tank) {
      // binding on armholes
      layers.push({ d: `M${CX - neckW - 30} 90 Q${CX - neckW - 36} 222 ${CX - bw + 2} 252`, stroke: 'trim', lw: 6 });
      layers.push({ d: `M${CX + neckW + 30} 90 Q${CX + neckW + 36} 222 ${CX + bw - 2} 252`, stroke: 'trim', lw: 6 });
    }
    // sleeve seams + hems
    if (!tank) {
      const sx = CX - 112 * ((fit + 1) / 2);
      layers.push({ d: `M${f(sx)} 104 Q${f(CX - bw + 6)} 160 ${f(CX - bw + 4)} ${sleeves === 'long' ? 262 : 228}`, stroke: 'seam', lw: 1.4 });
      layers.push({ d: mirrorD(`M${f(sx)} 104 Q${f(CX - bw + 6)} 160 ${f(CX - bw + 4)} ${sleeves === 'long' ? 262 : 228}`), stroke: 'seam', lw: 1.4 });
      if (sleeves === 'long') {
        const cuff = `M${f(CX - bw - 72)} 566 L${f(CX - bw - 28)} 572 L${f(CX - bw - 26)} 540 L${f(CX - bw - 71)} 536 Z`;
        layers.push({ d: cuff, fill: flags.ribs ? 'trim' : 'shadeA', alpha: flags.ribs ? 1 : 0.35 });
        layers.push({ d: mirrorD(cuff), fill: flags.ribs ? 'trim' : 'shadeA', alpha: flags.ribs ? 1 : 0.35 });
      } else {
        layers.push({ d: `M${f(CX - bw - 72)} 190 L${f(CX - bw - 40)} 244`, stroke: 'seam', lw: 1.2, dash: [4, 3] });
        layers.push({ d: mirrorD(`M${f(CX - bw - 72)} 190 L${f(CX - bw - 40)} 244`), stroke: 'seam', lw: 1.2, dash: [4, 3] });
      }
    }
    // waistband / hem
    if (flags.ribs) layers.push({ d: rect(0, 604, W, 50), fill: 'trim', clipMain: true });
    else layers.push({ d: `M${f(CX - bw + 4)} 628 Q${f(CX - bw / 2)} 635 ${CX} 633 Q${f(CX + bw / 2)} 635 ${f(CX + bw - 4)} 628`, stroke: 'seam', lw: 1.2, dash: [4, 3] });
    if (flags.hood && !back) {
      layers.push({ d: `M${CX - 64} 92 Q${CX - 70} 42 ${CX} 36 Q${CX + 70} 42 ${CX + 64} 92 Q${CX + 30} 166 ${CX} 168 Q${CX - 30} 166 ${CX - 64} 92 Z`, fill: 'inner' });
      layers.push({ d: `M${CX - 64} 92 Q${CX - 70} 42 ${CX} 36 Q${CX + 70} 42 ${CX + 64} 92`, stroke: 'trim', lw: 7 });
      if (o.strings !== 'no') {
        layers.push({ d: `M${CX - 20} 150 Q${CX - 24} 200 ${CX - 18} 246`, stroke: 'trim', lw: 4 });
        layers.push({ d: `M${CX + 20} 150 Q${CX + 24} 200 ${CX + 18} 246`, stroke: 'trim', lw: 4 });
      }
    }
    if (flags.hood && back) {
      layers.push({ d: `M${CX - 70} 90 Q${CX - 90} 210 ${CX} 236 Q${CX + 90} 210 ${CX + 70} 90 Z`, fill: 'shadeA', alpha: 0.9 });
      layers.push({ d: `M${CX} 96 L${CX} 232`, stroke: 'seam', lw: 1.4 });
    }
    if (flags.pocket && !back && o.pocket !== 'no') {
      layers.push({ d: `M${CX - 104} 470 L${CX + 104} 470 Q${CX + 124} 540 ${CX + 136} 600 L${CX - 136} 600 Q${CX - 124} 540 ${CX - 104} 470 Z`, stroke: 'seam', lw: 1.6, dash: [5, 3] });
      layers.push({ d: `M${CX - 104} 470 Q${CX - 140} 500 ${CX - 136} 560`, stroke: 'inner', lw: 2.5 });
      layers.push({ d: `M${CX + 104} 470 Q${CX + 140} 500 ${CX + 136} 560`, stroke: 'inner', lw: 2.5 });
    }

    let pa;
    if (back) pa = flags.hood ? { x: CX - 120, y: 250, w: 240, h: 300, cmW: 32, cmH: 40 } : { x: CX - 112.5, y: 135, w: 225, h: 315, cmW: 30, cmH: 42 };
    else if (flags.pocket && o.pocket !== 'no') pa = { x: CX - 112.5, y: 190, w: 225, h: 262, cmW: 30, cmH: 35 };
    else if (tank) pa = { x: CX - 100, y: ny + 24, w: 200, h: 270, cmW: 26, cmH: 35 };
    else pa = { x: CX - 112.5, y: Math.max(165, ny + 22), w: 225, h: 300, cmW: 30, cmH: 40 };
    return { outline, layers, pa, shade: 'garment' };
  }

  /* ---------- other objects ---------- */
  function mug(view, o) {
    const handleRight = (o.handle || 'right') === 'right';
    const showHandleRight = view === 'back' ? !handleRight : handleRight;
    const body = `M170 226 L410 226 L410 512 Q410 546 376 546 L204 546 Q170 546 170 512 Z`;
    // handle given as x/y pairs so it can be mirrored around the mug axis (x = 290)
    const hp = [[410, 270], [502, 262], [502, 380], [502, 498], [410, 494], [410, 458], [464, 460], [464, 380], [464, 300], [410, 306]]
      .map(([x, y]) => [showHandleRight ? x : 580 - x, y]);
    const handle = `M${pt(hp[0])} Q${pt(hp[1])} ${pt(hp[2])} Q${pt(hp[3])} ${pt(hp[4])} L${pt(hp[5])} Q${pt(hp[6])} ${pt(hp[7])} Q${pt(hp[8])} ${pt(hp[9])} Z`;
    const layers = [
      { d: handle, fill: 'main' },
      { d: body, fill: 'main', main: true },
      { d: ellipse(290, 226, 120, 18), fill: 'trim' },
      { d: ellipse(290, 229, 110, 13), fill: 'innerTrim' },
    ];
    return { outline: body, shadeOutline: body + ' ' + handle, handle, layers, pa: { x: 190, y: 280, w: 200, h: 190, cmW: 9, cmH: 8.6 }, shade: 'cyl', cyl: { x: 170, w: 240 }, handleRight: showHandleRight };
  }

  function cap(view, o) {
    const back = view === 'back';
    const crown = `M150 392 Q150 136 300 124 Q450 136 450 392 Z`;
    const layers = [{ d: crown, fill: 'main', main: true }];
    layers.push({ d: 'M300 126 L300 392', stroke: 'seam', lw: 1.4 });
    layers.push({ d: 'M300 126 Q212 176 200 392', stroke: 'seam', lw: 1.4 });
    layers.push({ d: 'M300 126 Q388 176 400 392', stroke: 'seam', lw: 1.4 });
    layers.push({ d: ellipse(300, 126, 13, 7), fill: 'trim' });
    if (!back) {
      const visor = o.visor === 'flat'
        ? 'M118 392 L482 392 L470 438 L130 438 Z'
        : 'M118 392 Q300 346 482 392 Q472 462 300 478 Q128 462 118 392 Z';
      layers.push({ d: visor, fill: 'trim' });
      layers.push({ d: o.visor === 'flat' ? 'M126 420 L474 420' : 'M134 410 Q300 372 466 410', stroke: 'seam', lw: 1.2, dash: [4, 3] });
      [[240, 170], [360, 170]].forEach(([x, y]) => layers.push({ d: ellipse(x, y, 4, 4), fill: 'innerTrim' }));
    } else {
      layers.push({ d: 'M244 392 Q244 318 300 312 Q356 318 356 392 Z', fill: 'inner' });
      layers.push({ d: rect(236, 366, 128, 16), fill: 'trim' });
    }
    const pa = back ? { x: 240, y: 252, w: 120, h: 45, cmW: 8, cmH: 3 } : { x: 210, y: 228, w: 180, h: 110, cmW: 11.5, cmH: 7 };
    return { outline: crown, layers, pa, shade: 'soft' };
  }

  function tote() {
    const body = 'M140 232 L460 232 L460 640 Q460 652 448 652 L152 652 Q140 652 140 640 Z';
    return {
      outline: body,
      layers: [
        { d: 'M214 238 Q206 64 300 62 Q394 64 386 238', stroke: 'trim', lw: 22 },
        { d: body, fill: 'main', main: true },
        { d: 'M140 252 L460 252', stroke: 'seam', lw: 1.2, dash: [4, 3] },
        { d: rect(206, 232, 16, 40), fill: 'trim' }, { d: rect(378, 232, 16, 40), fill: 'trim' },
      ],
      pa: { x: 180, y: 300, w: 240, h: 300, cmW: 28, cmH: 35 }, shade: 'soft',
    };
  }

  function phone(view, o) {
    const big = o.size === 'max';
    const x = big ? 190 : 205, y = big ? 98 : 120, w = big ? 220 : 190, h = big ? 470 : 412;
    const body = rrect(x, y, w, h, 36);
    const cam = rrect(x + 16, y + 16, 86, 92, 22);
    return {
      outline: body,
      layers: [
        { d: body, fill: 'main', main: true },
        { d: cam, fill: 'trim', top: true },
        { d: ellipse(x + 40, y + 41, 15, 15), fill: 'lens', top: true },
        { d: ellipse(x + 40, y + 83, 15, 15), fill: 'lens', top: true },
        { d: ellipse(x + 78, y + 62, 15, 15), fill: 'lens', top: true },
      ],
      pa: { x, y, w, h, cmW: big ? 7.8 : 7.2, cmH: big ? 16.6 : 15.6 }, shade: 'flat', topAfterDesign: true,
    };
  }

  const POSTER_FORMATS = { a4: [21, 29.7], a3: [29.7, 42], a2: [42, 59.4], p5070: [50, 70], square: [30, 30], land: [42, 29.7], story: [27, 48] };
  function poster(view, o) {
    const [cw, ch] = POSTER_FORMATS[o.format || 'a3'];
    const s = Math.min(460 / cw, 590 / ch);
    const w = cw * s, h = ch * s, x = CX - w / 2, y = 350 - h / 2;
    const layers = [];
    const frame = o.frame || 'none';
    if (frame !== 'none') {
      const fc = { black: '#1b1b1f', white: '#f4f4f2', wood: '#b07a4a' }[frame];
      layers.push({ d: rect(x - 18, y - 18, w + 36, h + 36), fill: fc, frame: true });
      layers.push({ d: rect(x - 4, y - 4, w + 8, h + 8), fill: '#ffffff', alpha: 0.9 });
    }
    layers.push({ d: rect(x, y, w, h), fill: 'main', main: true });
    return { outline: rect(x, y, w, h), layers, pa: { x, y, w, h, cmW: cw, cmH: ch }, shade: frame === 'none' ? 'flat' : 'none' };
  }

  function cushion(view, o) {
    const round = o.shape === 'round';
    const body = round ? ellipse(CX, 350, 230, 230)
      : `M90 140 Q300 120 510 140 Q530 350 510 560 Q300 580 90 560 Q70 350 90 140 Z`;
    const layers = [{ d: body, fill: 'main', main: true }];
    layers.push({ d: round ? ellipse(CX, 350, 222, 222) : `M98 148 Q300 128 502 148 Q522 350 502 552 Q300 572 98 552 Q78 350 98 148 Z`, stroke: 'trim', lw: 5 });
    return { outline: body, layers, pa: round ? { x: 140, y: 190, w: 320, h: 320, cmW: 30, cmH: 30 } : { x: 120, y: 170, w: 360, h: 360, cmW: 36, cmH: 36 }, shade: 'soft' };
  }

  function sticker(view, o) {
    const sh = o.shape || 'circle';
    const size = +(o.cm || 8);
    let body, pa;
    if (sh === 'circle') { body = ellipse(CX, 350, 200, 200); pa = { x: 100, y: 150, w: 400, h: 400 }; }
    else if (sh === 'rounded') { body = rrect(110, 160, 380, 380, 60); pa = { x: 110, y: 160, w: 380, h: 380 }; }
    else { body = rrect(70, 230, 460, 240, 26); pa = { x: 70, y: 230, w: 460, h: 240 }; }
    pa.cmW = size; pa.cmH = +(size * pa.h / pa.w).toFixed(2);
    return {
      outline: body,
      layers: [{ d: body, fill: '#ffffff', stroke: 'cut', lw: 14, under: true }, { d: body, fill: 'main', main: true }],
      pa, shade: 'flat',
    };
  }

  function custom(view, o, state) {
    const pa = {
      x: W * (o.pax ?? 30) / 100, y: H * (o.pay ?? 30) / 100,
      w: W * (o.paw ?? 40) / 100, h: H * (o.pah ?? 36) / 100,
    };
    pa.cmW = +(o.cm || 20); pa.cmH = +(pa.cmW * pa.h / pa.w).toFixed(2);
    return { outline: rect(0, 0, W, H), layers: [], pa, shade: 'none', image: state && state.customImage, tint: o.tint === 'yes' };
  }

  const sel = (key, label, choices, def) => ({ key, label, type: 'select', choices, def });
  const range = (key, label, min, max, def, unit) => ({ key, label, type: 'range', min, max, def, unit });

  DS.PRODUCTS = [
    {
      id: 'tee', name: 'T-shirt', views: [['front', 'Devant'], ['back', 'Dos']], kind: 'garment', trimHint: 'Col et bords',
      options: [
        sel('neck', 'Encolure', [['round', 'Ronde'], ['crew', 'Ras du cou'], ['v', 'En V'], ['scoop', 'Échancrée']], 'round'),
        sel('sleeves', 'Manches', [['short', 'Courtes'], ['long', 'Longues'], ['none', 'Sans (débardeur)']], 'short'),
        sel('fit', 'Coupe', [['slim', 'Ajustée'], ['regular', 'Classique'], ['oversize', 'Oversize']], 'regular'),
      ],
      build: (v, o) => garment(v, o, {}), main: '#ffffff', trim: '#ffffff',
    },
    {
      id: 'hoodie', name: 'Sweat à capuche', views: [['front', 'Devant'], ['back', 'Dos']], kind: 'garment', trimHint: 'Capuche, cordons, bords-côtes',
      options: [
        sel('fit', 'Coupe', [['slim', 'Ajustée'], ['regular', 'Classique'], ['oversize', 'Oversize']], 'regular'),
        sel('pocket', 'Poche kangourou', [['yes', 'Oui'], ['no', 'Non']], 'yes'),
        sel('strings', 'Cordons', [['yes', 'Oui'], ['no', 'Non']], 'yes'),
      ],
      build: (v, o) => garment(v, o, { sleeves: 'long', hood: true, ribs: true, pocket: true }), main: '#2b2f3a', trim: '#2b2f3a',
    },
    {
      id: 'sweat', name: 'Sweat col rond', views: [['front', 'Devant'], ['back', 'Dos']], kind: 'garment', trimHint: 'Col, poignets, bas',
      options: [sel('fit', 'Coupe', [['slim', 'Ajustée'], ['regular', 'Classique'], ['oversize', 'Oversize']], 'regular')],
      build: (v, o) => garment(v, Object.assign({}, o, { neck: 'crew' }), { sleeves: 'long', ribs: true }), main: '#9aa3b2', trim: '#9aa3b2',
    },
    {
      id: 'cap', name: 'Casquette', views: [['front', 'Face'], ['back', 'Arrière']], kind: 'cap', trimHint: 'Visière et bouton',
      options: [sel('visor', 'Visière', [['curved', 'Incurvée'], ['flat', 'Plate (snapback)']], 'curved')],
      build: cap, main: '#1d2130', trim: '#1d2130',
    },
    {
      id: 'mug', name: 'Mug', views: [['front', 'Face A'], ['back', 'Face B']], kind: 'mug', trimHint: 'Intérieur et bord',
      options: [sel('handle', 'Anse (face A)', [['right', 'À droite'], ['left', 'À gauche']], 'right')],
      build: mug, main: '#ffffff', trim: '#e83f6f',
    },
    {
      id: 'tote', name: 'Tote bag', views: [['front', 'Recto'], ['back', 'Verso']], kind: 'flat', trimHint: 'Anses',
      options: [], build: tote, main: '#efe6d2', trim: '#efe6d2',
    },
    {
      id: 'phone', name: 'Coque', views: [['front', 'Dos de coque']], kind: 'flat', trimHint: 'Bloc photo',
      options: [sel('size', 'Taille', [['std', 'Standard'], ['max', 'Grand modèle']], 'std')],
      build: phone, main: '#f2f3f7', trim: '#1d2130',
    },
    {
      id: 'poster', name: 'Affiche', views: [['front', 'Affiche']], kind: 'flat', trimHint: 'Sans effet',
      options: [
        sel('format', 'Format', [['a4', 'A4 21 × 29,7'], ['a3', 'A3 29,7 × 42'], ['a2', 'A2 42 × 59,4'], ['p5070', '50 × 70'], ['square', 'Carré 30 × 30'], ['land', 'Paysage A3'], ['story', 'Story 27 × 48']], 'a3'),
        sel('frame', 'Cadre', [['none', 'Aucun'], ['black', 'Noir'], ['white', 'Blanc'], ['wood', 'Bois']], 'none'),
      ],
      build: poster, main: '#ffffff', trim: '#ffffff',
    },
    {
      id: 'cushion', name: 'Coussin', views: [['front', 'Recto'], ['back', 'Verso']], kind: 'flat', trimHint: 'Passepoil',
      options: [sel('shape', 'Forme', [['square', 'Carré 40 cm'], ['round', 'Rond 40 cm']], 'square')],
      build: cushion, main: '#f4efe6', trim: '#c9b89a',
    },
    {
      id: 'sticker', name: 'Sticker', views: [['front', 'Sticker']], kind: 'flat', trimHint: 'Sans effet',
      options: [
        sel('shape', 'Découpe', [['circle', 'Rond'], ['rounded', 'Carré arrondi'], ['rect', 'Rectangle']], 'circle'),
        range('cm', 'Largeur', 3, 30, 8, 'cm'),
      ],
      build: sticker, main: '#ffffff', trim: '#ffffff',
    },
    {
      id: 'custom', name: 'Mon objet', views: [['front', 'Vue 1'], ['back', 'Vue 2']], kind: 'custom', trimHint: 'Sans effet',
      options: [
        sel('tint', 'Teinter la photo', [['no', 'Non'], ['yes', 'Oui']], 'no'),
        range('pax', 'Zone : gauche', 0, 90, 30, '%'), range('pay', 'Zone : haut', 0, 90, 30, '%'),
        range('paw', 'Zone : largeur', 5, 100, 40, '%'), range('pah', 'Zone : hauteur', 5, 100, 36, '%'),
        range('cm', 'Largeur réelle', 2, 200, 20, 'cm'),
      ],
      build: custom, main: '#ffffff', trim: '#ffffff',
    },
  ];
  DS.productById = (id) => DS.PRODUCTS.find((p) => p.id === id) || DS.PRODUCTS[0];
  DS.defaultOptions = (p) => { const o = {}; p.options.forEach((op) => { o[op.key] = op.def; }); return o; };

  DS.GARMENT_COLORS = [
    ['Blanc', '#ffffff'], ['Noir', '#16171b'], ['Gris chiné', '#a7abb3'], ['Anthracite', '#3b3f48'], ['Marine', '#1f2a4d'],
    ['Bleu roi', '#2f56c6'], ['Ciel', '#9cc7ec'], ['Vert forêt', '#21452f'], ['Kaki', '#6f6a45'], ['Menthe', '#a9dcc6'],
    ['Rouge', '#c8262e'], ['Bordeaux', '#5e1b27'], ['Rose', '#f2b6c8'], ['Orange', '#f06a1d'], ['Moutarde', '#d9a21f'],
    ['Sable', '#e6d6b8'],
  ];

  /* ---------- rendering ---------- */
  function resolve(token, colors) {
    const main = colors.main, trim = colors.trim;
    switch (token) {
      case 'main': return main;
      case 'trim': return trim;
      case 'shadeA': return shade(main, -0.14);
      case 'inner': return shade(main, luminance(main) > 0.5 ? -0.28 : -0.45);
      case 'innerTrim': return shade(trim, -0.18);
      case 'seam': return luminance(main) > 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
      case 'lens': return '#0c0d12';
      case 'cut': return '#ffffff';
      default: return token;
    }
  }
  DS.resolveColor = resolve;

  // Noise tiles for fabric materials (cached per colour).
  const noiseCache = {};
  function noisePattern(ctx, kind) {
    const key = kind;
    if (!noiseCache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); const img = g.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = Math.random();
        const v = kind === 'heather' ? (n > 0.5 ? 255 : 0) : (n * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = kind === 'heather' ? (n > 0.82 || n < 0.18 ? 46 : 0) : 14;
      }
      g.putImageData(img, 0, 0);
      noiseCache[key] = c;
    }
    return ctx.createPattern(noiseCache[key], 'repeat');
  }

  /**
   * Draws the product base (everything below the design).
   * opts: { colors, material, top:boolean (draw only layers flagged top), scale }
   */
  DS.drawProduct = function (ctx, built, opts) {
    const colors = opts.colors;
    ctx.save();
    if (built.image) {
      const img = built.image;
      const s = Math.min(W / img.width, H / img.height);
      const w = img.width * s, h = img.height * s;
      if (!opts.top) {
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        if (built.tint) {
          ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = colors.main; ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        }
      }
      ctx.restore();
      return;
    }
    const mainPath = new Path2D(built.outline);
    if (!opts.top && opts.dropShadow !== false) {
      ctx.save();
      ctx.shadowColor = 'rgba(20,22,32,0.28)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
      ctx.fillStyle = resolve('main', colors);
      ctx.fill(mainPath);
      ctx.restore();
    }
    built.layers.forEach((L) => {
      if (!!L.top !== !!opts.top) return;
      const p = new Path2D(L.d);
      ctx.save();
      if (L.alpha != null) ctx.globalAlpha = L.alpha;
      if (L.clipMain) ctx.clip(mainPath);
      if (L.fill) {
        ctx.fillStyle = resolve(L.fill, colors);
        if (L.under && L.stroke) { ctx.lineWidth = L.lw * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = resolve(L.stroke, colors); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.stroke(p); ctx.shadowColor = 'transparent'; }
        ctx.fill(p);
      }
      if (L.stroke && !L.under) {
        ctx.strokeStyle = resolve(L.stroke, colors); ctx.lineWidth = L.lw || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (L.dash) ctx.setLineDash(L.dash);
        ctx.stroke(p);
      }
      ctx.restore();
      if (L.main && opts.material && opts.material !== 'smooth' && opts.material !== 'gloss') {
        ctx.save(); ctx.clip(mainPath); ctx.fillStyle = noisePattern(ctx, opts.material); ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    });
    ctx.restore();
  };

  /** Draws the multiply shading layer (white = no change). */
  DS.drawShading = function (ctx, built, _opts) {
    if (built.shade === 'none' || built.image) return;
    const clip = new Path2D(built.shadeOutline || built.outline);
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.clip(clip);
    if (built.shade === 'garment') {
      let g = ctx.createLinearGradient(80, 0, 520, 0);
      g.addColorStop(0, '#b9bcc4'); g.addColorStop(0.18, '#ebecef'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.82, '#e9eaee'); g.addColorStop(1, '#b4b7c0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      g = ctx.createLinearGradient(0, 80, 0, 660);
      g.addColorStop(0, 'rgba(160,163,172,0.55)'); g.addColorStop(0.12, 'rgba(255,255,255,0)'); g.addColorStop(0.9, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(150,153,162,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#c9ccd3'; ctx.lineCap = 'round';
      [[196, 250, 214, 470, 16], [404, 260, 388, 480, 14], [250, 520, 240, 630, 10], [352, 530, 362, 632, 10], [170, 120, 210, 210, 9], [430, 120, 390, 210, 9]].forEach(([x1, y1, x2, y2, w]) => {
        ctx.lineWidth = w; ctx.filter = 'blur(7px)';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2 + 10, (y1 + y2) / 2, x2, y2); ctx.stroke();
      });
      ctx.filter = 'none';
    } else if (built.shade === 'cyl') {
      const { x, w } = built.cyl;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#9a9ea8'); g.addColorStop(0.16, '#dcdee3'); g.addColorStop(0.32, '#ffffff'); g.addColorStop(0.42, '#f4f5f7');
      g.addColorStop(0.75, '#d6d8de'); g.addColorStop(1, '#8e929d');
      ctx.fillStyle = g; ctx.fillRect(x, 0, w, H);
      if (built.handle) {
        const r = built.handleRight;
        const hg = ctx.createLinearGradient(r ? x + w : x, 0, r ? x + w + 92 : x - 92, 0);
        hg.addColorStop(0, '#9da1ab'); hg.addColorStop(0.55, '#f2f3f5'); hg.addColorStop(1, '#b4b8c1');
        ctx.fillStyle = hg; ctx.fill(new Path2D(built.handle));
      }
    } else if (built.shade === 'soft') {
      const g = ctx.createRadialGradient(300, 330, 60, 300, 360, 320);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.65, '#eef0f3'); g.addColorStop(1, '#b3b7c0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (built.shade === 'flat') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4e6ea');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };
  // Highlight pass (drawn with "screen"/source-over on top of the design).
  DS.drawHighlight = function (ctx, built, opts) {
    if (built.image || built.shade === 'none') return;
    ctx.save();
    ctx.clip(new Path2D(built.outline));
    const a = opts.material === 'gloss' ? 0.55 : 0.18;
    let g;
    if (built.shade === 'cyl') {
      const { x, w } = built.cyl;
      g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0.2, 'rgba(255,255,255,0)'); g.addColorStop(0.3, `rgba(255,255,255,${a})`); g.addColorStop(0.38, 'rgba(255,255,255,0)');
    } else {
      g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0.15, 'rgba(255,255,255,0)'); g.addColorStop(0.32, `rgba(255,255,255,${a * 0.6})`); g.addColorStop(0.45, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  /** SVG markup of the product (for mockup SVG export). */
  DS.productSVG = function (built, colors, top) {
    if (built.image) return '';
    return built.layers.filter((L) => !!L.top === !!top).map((L) => {
      const a = [];
      a.push(`d="${L.d}"`);
      a.push(`fill="${L.fill ? resolve(L.fill, colors) : 'none'}"`);
      if (L.stroke) a.push(`stroke="${resolve(L.stroke, colors)}" stroke-width="${L.under ? L.lw * 2 : (L.lw || 2)}" stroke-linecap="round" stroke-linejoin="round"`);
      if (L.dash) a.push(`stroke-dasharray="${L.dash.join(' ')}"`);
      if (L.alpha != null) a.push(`opacity="${L.alpha}"`);
      if (L.clipMain) a.push('clip-path="url(#mainClip)"');
      return `<path ${a.join(' ')}/>`;
    }).join('\n');
  };
})();
