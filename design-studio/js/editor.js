/* Motif Studio — editing engine (Fabric.js canvas, product layers, history, objects). */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  const W = DS.W, H = DS.H;

  /* ---------- tiny event bus ---------- */
  const handlers = {};
  DS.on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); };
  DS.emit = (evt, data) => { (handlers[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error('[MotifStudio]', e); } }); };

  /* ---------- state ---------- */
  const state = (DS.state = {
    productId: 'tee',
    options: {},
    colors: { main: '#ffffff', trim: '#ffffff' },
    material: 'cotton',
    realism: true,
    clip: true,
    grid: false,
    view: 'front',
    designs: {}, // "productId:viewId" -> { json: string, pa: {x,y,w,h} }
    perProduct: {}, // productId -> { options, colors } remembered when switching
    customImage: null, // dataURL
  });
  let customImageEl = null;

  DS.PROPS = ['dsName', 'dsRenamed', 'dsCurve', 'dsShape', 'dsLocked', 'dsGrad', 'selectable', 'lockMovementX', 'lockMovementY',
    'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'globalCompositeOperation', 'editable'];

  /* ---------- image registry (keeps base64 out of the undo stack) ---------- */
  const images = (DS.images = {});
  const imageIds = new Map();
  let imgSeq = 0;
  DS.registerImage = (dataURL) => {
    if (imageIds.has(dataURL)) return imageIds.get(dataURL);
    const id = 'img' + Date.now().toString(36) + (imgSeq++);
    images[id] = dataURL; imageIds.set(dataURL, id);
    return id;
  };
  function walk(objs, fn) {
    (objs || []).forEach((o) => {
      fn(o);
      if (o.objects) walk(o.objects, fn);
      if (o.clipPath) walk([o.clipPath], fn);
    });
  }
  function toRefs(json) {
    walk(json.objects, (o) => { if (o.type === 'image' && o.src && o.src.startsWith('data:')) o.src = 'ds:' + DS.registerImage(o.src); });
    return json;
  }
  function fromRefs(json) {
    const j = typeof json === 'string' ? JSON.parse(json) : JSON.parse(JSON.stringify(json));
    walk(j.objects, (o) => { if (o.type === 'image' && o.src && o.src.startsWith('ds:')) o.src = images[o.src.slice(3)] || ''; });
    return j;
  }
  DS.fromRefs = fromRefs;

  /* ---------- product helpers ---------- */
  DS.product = () => DS.productById(state.productId);
  DS.built = (view) => {
    const b = DS.product().build(view || state.view, state.options, { customImage: customImageEl });
    return b;
  };
  DS.pa = (view) => DS.built(view).pa;
  DS.pxPerCm = (view) => { const pa = DS.pa(view); return pa.w / pa.cmW; };
  DS.defaultInk = () => (DS.color.luminance(state.colors.main) > 0.5 ? '#16171b' : '#ffffff');

  /* ---------- canvas setup ---------- */
  let canvas, aux = {}, scale = 1, suspend = false;
  const hist = {};
  let guides = { v: [], h: [] };
  let clipboard = null;

  DS.initEditor = function () {
    fabric.filterBackend = new fabric.Canvas2dFilterBackend();
    const touch = DS.isMobile;
    Object.assign(fabric.Object.prototype, {
      originX: 'center', originY: 'center', transparentCorners: false, cornerStyle: 'circle',
      cornerColor: '#ffffff', cornerStrokeColor: '#2b45e0', borderColor: '#2b45e0', borderScaleFactor: 1.5,
      cornerSize: touch ? 18 : 11, touchCornerSize: 30, padding: 4, borderDashArray: null,
    });
    fabric.Object.prototype.controls.mtr.offsetY = touch ? -34 : -28;

    canvas = DS.canvas = new fabric.Canvas('designCanvas', {
      width: W, height: H, preserveObjectStacking: true, stopContextMenu: true, controlsAboveOverlay: true,
      selectionColor: 'rgba(43,69,224,0.08)', selectionBorderColor: '#2b45e0', selectionLineWidth: 1,
      allowTouchScrolling: false, enableRetinaScaling: true,
    });
    const wrap = canvas.wrapperEl;
    ['base', 'shade', 'hi', 'top'].forEach((k) => {
      const c = document.createElement('canvas');
      c.className = 'layer ' + k + '-layer';
      aux[k] = c;
    });
    wrap.insertBefore(aux.base, canvas.lowerCanvasEl);
    wrap.insertBefore(aux.top, canvas.upperCanvasEl);
    wrap.insertBefore(aux.hi, aux.top);
    wrap.insertBefore(aux.shade, aux.hi);
    // fabric positions its own canvases absolutely; lower canvas must sit above base
    canvas.lowerCanvasEl.style.position = 'absolute';

    canvas.on('object:added', (e) => { if (!suspend && !e.target.excludeFromExport) { pushHistory(); DS.emit('layers'); } });
    canvas.on('object:removed', () => { if (!suspend) { pushHistory(); DS.emit('layers'); } });
    canvas.on('object:modified', () => { pushHistory(); DS.emit('modified'); DS.emit('layers'); });
    canvas.on('selection:created', () => DS.emit('selection'));
    canvas.on('selection:updated', () => DS.emit('selection'));
    canvas.on('selection:cleared', () => DS.emit('selection'));
    canvas.on('path:created', (e) => { e.path.dsName = 'Trait'; e.path.set({ fill: null }); pushHistory(); DS.emit('layers'); });
    canvas.on('text:changed', (e) => { if (e.target.dsCurve) applyCurve(e.target, e.target.dsCurve); debouncedPush(); DS.emit('layers'); });
    canvas.on('object:moving', onMoving);
    canvas.on('object:scaling', () => DS.emit('live'));
    canvas.on('object:rotating', () => DS.emit('live'));
    canvas.on('mouse:up', () => { if (guides.v.length || guides.h.length) { guides = { v: [], h: [] }; drawTop(); } });
    canvas.on('mouse:dblclick', (e) => { if (e.target && e.target.type === 'group') DS.emit('dblgroup', e.target); });
    applyClip();
  };

  /* ---------- sizing / zoom ---------- */
  DS.getScale = () => scale;
  DS.setScale = function (s) {
    scale = Math.max(0.15, Math.min(4, s));
    const w = Math.round(W * scale), h = Math.round(H * scale);
    canvas.setDimensions({ width: w, height: h });
    canvas.setZoom(scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    Object.values(aux).forEach((c) => {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = w + 'px'; c.style.height = h + 'px';
    });
    drawAux();
    DS.emit('zoom', scale);
  };
  DS.fit = function () {
    const host = document.getElementById('stageScroll');
    const pad = DS.isMobile ? 20 : 56;
    const s = Math.min((host.clientWidth - pad) / W, (host.clientHeight - pad) / H);
    DS.setScale(s > 0 ? s : 1);
  };

  function ctxFor(c) {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const k = c.width / W;
    g.setTransform(k, 0, 0, k, 0, 0);
    return g;
  }
  function drawAux() {
    if (!canvas) return;
    const b = DS.built();
    const opts = { colors: state.colors, material: state.material };
    DS.drawProduct(ctxFor(aux.base), b, opts);
    const sc = ctxFor(aux.shade);
    if (state.realism) DS.drawShading(sc, b, opts);
    const hc = ctxFor(aux.hi);
    if (state.realism) DS.drawHighlight(hc, b, opts);
    drawTop(b);
    const pa = b.pa;
    DS.emit('area', pa);
  }
  DS.redraw = drawAux;

  function drawTop(b) {
    b = b || DS.built();
    const g = ctxFor(aux.top);
    DS.drawProduct(g, b, { colors: state.colors, material: state.material, top: true, dropShadow: false });
    const pa = b.pa;
    const lw = 1 / scale;
    // grid in centimetres
    if (state.grid) {
      const ppc = pa.w / pa.cmW;
      g.save();
      g.strokeStyle = 'rgba(43,69,224,0.18)'; g.lineWidth = lw;
      for (let x = pa.x; x <= pa.x + pa.w + 0.01; x += ppc) { g.beginPath(); g.moveTo(x, pa.y); g.lineTo(x, pa.y + pa.h); g.stroke(); }
      for (let y = pa.y; y <= pa.y + pa.h + 0.01; y += ppc) { g.beginPath(); g.moveTo(pa.x, y); g.lineTo(pa.x + pa.w, y); g.stroke(); }
      g.strokeStyle = 'rgba(43,69,224,0.35)';
      g.beginPath(); g.moveTo(pa.x + pa.w / 2, pa.y); g.lineTo(pa.x + pa.w / 2, pa.y + pa.h); g.moveTo(pa.x, pa.y + pa.h / 2); g.lineTo(pa.x + pa.w, pa.y + pa.h / 2); g.stroke();
      g.restore();
    }
    // print area
    g.save();
    g.strokeStyle = '#e8930c'; g.lineWidth = 1.4 * lw; g.setLineDash([6 * lw, 4 * lw]);
    g.strokeRect(pa.x, pa.y, pa.w, pa.h);
    g.setLineDash([]);
    g.fillStyle = '#e8930c'; g.font = `600 ${11 * lw}px Inter, sans-serif`;
    const label = `${fmt(pa.cmW)} × ${fmt(pa.cmH)} cm`;
    g.fillText(label, pa.x + 4 * lw, pa.y - 5 * lw);
    // snapping guides
    g.strokeStyle = '#e83f6f'; g.lineWidth = lw;
    guides.v.forEach((x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); });
    guides.h.forEach((y) => { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); });
    g.restore();
  }
  const fmt = (n) => String(+(+n).toFixed(1)).replace('.', ',');
  DS.fmt = fmt;

  function applyClip() {
    const pa = DS.pa();
    canvas.clipPath = state.clip ? new fabric.Rect({ left: pa.x, top: pa.y, width: pa.w, height: pa.h, originX: 'left', originY: 'top', absolutePositioned: true }) : null;
    canvas.requestRenderAll();
  }
  DS.applyClip = applyClip;

  /* ---------- snapping ---------- */
  function onMoving(e) {
    const o = e.target, pa = DS.pa(), th = 7 / scale;
    guides = { v: [], h: [] };
    const c = o.getCenterPoint();
    const cx = pa.x + pa.w / 2, cy = pa.y + pa.h / 2;
    let dx = 0, dy = 0;
    if (Math.abs(c.x - cx) < th) { dx = cx - c.x; guides.v.push(cx); }
    if (Math.abs(c.y - cy) < th) { dy = cy - c.y; guides.h.push(cy); }
    const br = o.getBoundingRect(true, true);
    if (!dx) {
      if (Math.abs(br.left - pa.x) < th) { dx = pa.x - br.left; guides.v.push(pa.x); }
      else if (Math.abs(br.left + br.width - (pa.x + pa.w)) < th) { dx = pa.x + pa.w - br.left - br.width; guides.v.push(pa.x + pa.w); }
    }
    if (!dy) {
      if (Math.abs(br.top - pa.y) < th) { dy = pa.y - br.top; guides.h.push(pa.y); }
      else if (Math.abs(br.top + br.height - (pa.y + pa.h)) < th) { dy = pa.y + pa.h - br.top - br.height; guides.h.push(pa.y + pa.h); }
    }
    if (dx || dy) o.set({ left: o.left + dx, top: o.top + dy });
    drawTop();
    DS.emit('live');
  }

  /* ---------- history ---------- */
  const dkey = (v) => state.productId + ':' + (v || state.view);
  DS.dkey = dkey;
  function hs() { const k = dkey(); return (hist[k] = hist[k] || { stack: [], idx: -1 }); }
  function snapshot() {
    const j = canvas.toJSON(DS.PROPS);
    delete j.clipPath; delete j.background;
    return JSON.stringify(toRefs(j));
  }
  DS.snapshot = snapshot;
  function pushHistory() {
    if (suspend) return;
    const s = snapshot(), h = hs();
    if (h.stack[h.idx] === s) return;
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push(s);
    if (h.stack.length > 80) h.stack.shift();
    h.idx = h.stack.length - 1;
    state.designs[dkey()] = { json: s, pa: pick(DS.pa()) };
    DS.emit('history');
    DS.emit('changed');
  }
  DS.pushHistory = pushHistory;
  let pushTimer = 0;
  function debouncedPush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushHistory, 350); }
  DS.debouncedPush = debouncedPush;
  const pick = (pa) => ({ x: pa.x, y: pa.y, w: pa.w, h: pa.h });
  DS.canUndo = () => hs().idx > 0;
  DS.canRedo = () => hs().idx < hs().stack.length - 1;
  DS.undo = () => { const h = hs(); if (h.idx > 0) { h.idx--; restore(h.stack[h.idx]); } };
  DS.redo = () => { const h = hs(); if (h.idx < h.stack.length - 1) { h.idx++; restore(h.stack[h.idx]); } };
  function restore(json) {
    loadJSON(json, () => {
      state.designs[dkey()] = { json, pa: pick(DS.pa()) };
      DS.emit('history'); DS.emit('changed');
    });
  }

  function loadJSON(json, cb) {
    suspend = true;
    canvas.discardActiveObject();
    const data = fromRefs(json || '{"objects":[]}');
    canvas.loadFromJSON(data, () => {
      canvas.getObjects().forEach((o) => {
        if (o.dsCurve && (o.type === 'i-text' || o.type === 'text')) applyCurve(o, o.dsCurve);
        if (o.dsGrad) applyGradient(o, o.dsGrad);
      });
      applyClip();
      canvas.requestRenderAll();
      suspend = false;
      DS.emit('layers'); DS.emit('selection');
      if (cb) cb();
    });
  }

  // Re-map a stored design when the print area changed (other product / option).
  function remapJSON(jsonStr, from, to) {
    if (!from || (from.x === to.x && from.y === to.y && from.w === to.w && from.h === to.h)) return jsonStr;
    const j = JSON.parse(jsonStr);
    const r = Math.min(to.w / from.w, to.h / from.h);
    const ox = to.x + (to.w - from.w * r) / 2, oy = to.y + (to.h - from.h * r) / 2;
    (j.objects || []).forEach((o) => {
      o.left = ox + (o.left - from.x) * r; o.top = oy + (o.top - from.y) * r;
      o.scaleX = (o.scaleX || 1) * r; o.scaleY = (o.scaleY || 1) * r;
    });
    return JSON.stringify(j);
  }
  DS.designJSON = function (view, fromStore) {
    if (!fromStore && view === state.view && canvas) return snapshot();
    const d = state.designs[dkey(view)];
    if (!d) return '{"objects":[]}';
    return remapJSON(d.json, d.pa, pick(DS.pa(view)));
  };

  /* ---------- product / view switching ---------- */
  function saveCurrent() { if (canvas) state.designs[dkey()] = { json: snapshot(), pa: pick(DS.pa()) }; }
  DS.saveCurrent = saveCurrent;
  DS.setView = function (view, force, skipSave) {
    if (view === state.view && !force) return;
    if (!skipSave) saveCurrent();
    state.view = view;
    const json = DS.designJSON(view, true);
    loadJSON(json, () => {
      const h = hs();
      if (!h.stack.length) { h.stack = [snapshot()]; h.idx = 0; }
      DS.emit('history');
    });
    drawAux();
    DS.emit('view', view);
  };
  DS.setProduct = function (id, keepColors) {
    saveCurrent();
    const oldId = state.productId;
    state.perProduct[oldId] = { options: state.options, colors: Object.assign({}, state.colors) };
    const p = DS.productById(id);
    state.productId = p.id;
    const saved = state.perProduct[p.id];
    state.options = Object.assign(DS.defaultOptions(p), saved ? saved.options : {});
    if (!keepColors) state.colors = saved ? Object.assign({}, saved.colors) : { main: p.main, trim: p.trim };
    const views = p.views.map((v) => v[0]);
    // a product seen for the first time inherits the current design, face by face
    views.forEach((v) => {
      const from = state.designs[oldId + ':' + v];
      if (!state.designs[p.id + ':' + v] && from && oldId !== p.id) state.designs[p.id + ':' + v] = Object.assign({}, from);
    });
    if (!views.includes(state.view)) state.view = views[0];
    DS.setView(state.view, true, true);
    DS.emit('product', p);
    DS.emit('changed');
  };
  DS.setOption = function (key, value) {
    saveCurrent();
    state.options[key] = value;
    // re-map the live design to the new print area
    loadJSON(DS.designJSON(state.view, true), () => { pushHistory(); });
    drawAux();
    DS.emit('changed');
  };
  DS.setColors = function (c) { Object.assign(state.colors, c); drawAux(); DS.emit('changed'); };
  DS.setRender = function (patch) {
    Object.assign(state, patch);
    if ('clip' in patch) applyClip();
    drawAux(); DS.emit('changed');
  };
  DS.setCustomImage = function (dataURL, cb) {
    state.customImage = dataURL;
    if (!dataURL) { customImageEl = null; drawAux(); return; }
    const img = new Image();
    img.onload = () => { customImageEl = img; drawAux(); DS.emit('changed'); if (cb) cb(); };
    img.src = dataURL;
  };
  DS.customImageEl = () => customImageEl;

  /* ---------- object factories ---------- */
  const SHAPE_COLORS = ['#2b45e0', '#e83f6f', '#ffbf00', '#22b07d', '#f06a1d', '#16171b'];
  let colorIdx = 0;
  const nextColor = () => SHAPE_COLORS[(colorIdx++) % SHAPE_COLORS.length];
  function center() { const pa = DS.pa(); return { x: pa.x + pa.w / 2, y: pa.y + pa.h / 2 }; }
  function place(obj, opts) {
    const c = center();
    obj.set({ left: c.x + ((opts && opts.dx) || 0), top: c.y + ((opts && opts.dy) || 0) });
    if (DS.state.clip === false) obj.setCoords();
    canvas.add(obj);
    if (!opts || !opts.noSelect) { canvas.setActiveObject(obj); }
    canvas.requestRenderAll();
    return obj;
  }

  function makeGradient(g) {
    const a = ((g.angle || 0) * Math.PI) / 180;
    const coords = g.type === 'radial'
      ? { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.6 }
      : { x1: 0.5 - Math.cos(a) / 2, y1: 0.5 - Math.sin(a) / 2, x2: 0.5 + Math.cos(a) / 2, y2: 0.5 + Math.sin(a) / 2 };
    return new fabric.Gradient({ type: g.type || 'linear', gradientUnits: 'percentage', coords, colorStops: [{ offset: 0, color: g.c1 }, { offset: 1, color: g.c2 }] });
  }
  function applyGradient(o, g) {
    o.dsGrad = g;
    if (!g) return;
    o.set('fill', makeGradient(g));
  }
  DS.applyGradient = (o, g) => { applyGradient(o, g); if (!g) o.set('fill', DS.defaultInk()); canvas.requestRenderAll(); };

  function applyCurve(t, c) {
    t.dsCurve = c || 0;
    t.set({ path: null });
    t.initDimensions();
    if (!c) { t.setCoords(); return; }
    const w = t.calcTextWidth();
    const theta = Math.max(0.2, (Math.abs(c) / 100) * 2 * Math.PI * 0.97);
    const r = (w / theta) * 1.03;
    const up = c > 0;
    const a0 = up ? -Math.PI / 2 - theta / 2 : Math.PI / 2 + theta / 2;
    const a1 = up ? -Math.PI / 2 + theta / 2 : Math.PI / 2 - theta / 2;
    const d = `M ${r * Math.cos(a0)} ${r * Math.sin(a0)} A ${r} ${r} 0 ${theta > Math.PI ? 1 : 0} ${up ? 1 : 0} ${r * Math.cos(a1)} ${r * Math.sin(a1)}`;
    const p = new fabric.Path(d, { fill: '', stroke: '', visible: false, objectCaching: false });
    t.set({ path: p, pathAlign: 'baseline', pathSide: 'left', pathStartOffset: 0, textAlign: 'left' });
    t.initDimensions();
    t.setCoords();
  }
  DS.applyCurve = (t, c) => { applyCurve(t, c); canvas.requestRenderAll(); };

  function textFrom(spec) {
    const t = new fabric.IText(spec.text || 'Ton texte', {
      fontFamily: spec.fontFamily || 'Montserrat', fontSize: spec.fontSize || 48, fontWeight: spec.fontWeight || 'normal',
      fill: typeof spec.fill === 'string' ? spec.fill : DS.defaultInk(), textAlign: 'center', charSpacing: spec.charSpacing || 0,
      stroke: spec.stroke || null, strokeWidth: spec.strokeWidth || 0, paintFirst: spec.paintFirst || 'fill', lineHeight: 1.1,
      shadow: spec.shadow ? new fabric.Shadow(spec.shadow) : null,
    });
    if (spec.fill && spec.fill.gradient) applyGradient(t, { type: 'linear', c1: spec.fill.gradient[0], c2: spec.fill.gradient[1], angle: spec.fill.angle || 90 });
    return t;
  }
  function ensureFont(family) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return document.fonts.load(`48px "${family}"`).catch(() => {}).then(() => { try { fabric.util.clearFabricFontCache(family); } catch (_e) { /* older fabric */ } });
  }
  DS.ensureFont = ensureFont;

  DS.addText = function (spec) {
    spec = spec || {};
    ensureFont(spec.fontFamily || 'Montserrat').then(() => {
      const t = textFrom(spec);
      if (!spec.fill && DS.color.luminance(state.colors.main) < 0.5) t.set('fill', '#ffffff');
      place(t, { dy: spec.dy || 0 });
      if (spec.dsCurve) applyCurve(t, spec.dsCurve);
      canvas.requestRenderAll();
    });
  };
  DS.addPreset = function (preset) {
    const fams = [...new Set(preset.items.filter((i) => i.fontFamily).map((i) => i.fontFamily))];
    Promise.all(fams.map(ensureFont)).then(() => {
      suspend = true;
      const objs = preset.items.map((it) => {
        let o;
        if (it.type === 'circle') o = new fabric.Circle({ radius: it.radius, fill: it.fill, stroke: it.stroke, strokeWidth: it.strokeWidth });
        else { o = textFrom(it); if (it.dsCurve) applyCurve(o, it.dsCurve); }
        const ink = DS.defaultInk();
        if (ink === '#ffffff') { if (o.fill === '#16171b') o.set('fill', '#ffffff'); if (o.stroke === '#16171b') o.set('stroke', '#ffffff'); }
        const c = center();
        o.set({ left: c.x, top: c.y + (it.dy || 0) });
        canvas.add(o);
        return o;
      });
      suspend = false;
      if (objs.length > 1) {
        const sel = new fabric.ActiveSelection(objs, { canvas });
        canvas.setActiveObject(sel);
      } else canvas.setActiveObject(objs[0]);
      canvas.requestRenderAll();
      pushHistory(); DS.emit('layers'); DS.emit('selection');
    });
  };

  DS.addShape = function (id) {
    const fill = nextColor();
    let o;
    switch (id) {
      case 'rect': o = new fabric.Rect({ width: 170, height: 120, fill }); break;
      case 'rrect': o = new fabric.Rect({ width: 170, height: 120, rx: 24, ry: 24, fill }); break;
      case 'circle': o = new fabric.Circle({ radius: 72, fill }); break;
      case 'ellipse': o = new fabric.Ellipse({ rx: 96, ry: 60, fill }); break;
      case 'triangle': o = new fabric.Triangle({ width: 150, height: 130, fill }); break;
      case 'star': o = new fabric.Polygon(DS.geom.star(5, 80, 36), { fill, dsShape: { kind: 'star', n: 5, inner: 45 } }); break;
      case 'poly': o = new fabric.Polygon(DS.geom.poly(6, 80), { fill, dsShape: { kind: 'poly', n: 6 } }); break;
      case 'heart': o = new fabric.Path(DS.HEART, { fill, scaleX: 7, scaleY: 7 }); break;
      case 'line': o = new fabric.Line([0, 0, 220, 0], { stroke: DS.defaultInk(), strokeWidth: 6, strokeLineCap: 'round' }); break;
      case 'arrow': o = new fabric.Path('M0 25 L190 25 M160 0 L190 25 L160 50', { fill: '', stroke: DS.defaultInk(), strokeWidth: 8, strokeLineCap: 'round', strokeLineJoin: 'round' }); break;
      default: return;
    }
    o.dsName = (DS.SHAPES.find((s) => s.id === id) || {}).label || 'Forme';
    place(o);
  };
  DS.regenShape = function (o, patch) {
    Object.assign(o.dsShape, patch);
    const s = o.dsShape;
    const pts = s.kind === 'star' ? DS.geom.star(s.n, 80, 80 * s.inner / 100) : DS.geom.poly(s.n, 80);
    const c = o.getCenterPoint();
    o.set({ points: pts });
    o._setPositionDimensions({});
    o.setPositionByOrigin(c, 'center', 'center');
    o.setCoords();
    canvas.requestRenderAll();
  };
  DS.addClipart = function (item) {
    const ink = DS.defaultInk();
    const o = new fabric.Path(item.d, item.stroke
      ? { fill: '', stroke: ink, strokeWidth: 1.8, strokeLineCap: 'round', strokeLineJoin: 'round', scaleX: 6, scaleY: 6 }
      : { fill: ink, fillRule: item.evenodd ? 'evenodd' : 'nonzero', scaleX: 6, scaleY: 6 });
    o.dsName = item.label;
    place(o);
  };
  DS.addEmoji = function (e) {
    const t = new fabric.IText(e, { fontSize: 110, fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' });
    t.dsName = 'Emoji ' + e;
    place(t);
  };

  function downscale(dataURL, max) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        if (s >= 1) return res(dataURL);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL(dataURL.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', 0.92));
      };
      img.onerror = () => res(null);
      img.src = dataURL;
    });
  }
  DS.readFile = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = rej;
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) r.readAsText(file); else r.readAsDataURL(file);
  });
  DS.addImageFile = async function (file) {
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
    const data = await DS.readFile(file);
    if (isSvg) return DS.addSVG(data, file.name);
    const url = await downscale(data, DS.isMobile ? 2000 : 3200);
    if (!url) { DS.toast('Image illisible. Essaie un PNG ou un JPG.'); return; }
    fabric.Image.fromURL(url, (img) => {
      const pa = DS.pa();
      const s = Math.min((pa.w * 0.8) / img.width, (pa.h * 0.8) / img.height);
      img.set({ scaleX: s, scaleY: s });
      img.dsName = (file.name || 'Image').replace(/\.[a-z0-9]+$/i, '').slice(0, 40);
      place(img);
    });
  };
  DS.addSVG = function (str, name) {
    fabric.loadSVGFromString(str, (objects, options) => {
      if (!objects || !objects.length) { DS.toast('Ce SVG ne contient aucune forme utilisable.'); return; }
      const g = fabric.util.groupSVGElements(objects, options);
      const pa = DS.pa();
      const s = Math.min((pa.w * 0.8) / (g.width || 1), (pa.h * 0.8) / (g.height || 1));
      g.set({ scaleX: s, scaleY: s });
      g.dsName = (name || 'Vecteur').replace(/\.svg$/i, '').slice(0, 40);
      place(g);
    });
  };

  /* ---------- selection operations ---------- */
  DS.active = () => canvas.getActiveObject();
  DS.activeList = () => canvas.getActiveObjects();
  DS.objects = () => canvas.getObjects();
  DS.render = () => canvas.requestRenderAll();
  DS.select = (o) => { canvas.setActiveObject(o); canvas.requestRenderAll(); };

  DS.remove = function () {
    const objs = canvas.getActiveObjects();
    if (!objs.length) return;
    const a = canvas.getActiveObject();
    if (a && a.isEditing) return;
    suspend = true; canvas.discardActiveObject(); objs.forEach((o) => canvas.remove(o)); suspend = false;
    pushHistory(); DS.emit('layers'); canvas.requestRenderAll();
  };
  DS.copy = function () {
    const a = canvas.getActiveObject();
    if (!a) return;
    a.clone((c) => { clipboard = c; }, DS.PROPS);
  };
  DS.paste = function () {
    if (!clipboard) return;
    clipboard.clone((c) => {
      canvas.discardActiveObject();
      c.set({ left: c.left + 20, top: c.top + 20, evented: true });
      suspend = true;
      if (c.type === 'activeSelection') {
        c.canvas = canvas;
        c.forEachObject((o) => canvas.add(o));
        c.setCoords();
      } else canvas.add(c);
      suspend = false;
      clipboard.top += 20; clipboard.left += 20;
      canvas.setActiveObject(c);
      canvas.requestRenderAll();
      pushHistory(); DS.emit('layers');
    }, DS.PROPS);
  };
  DS.duplicate = function () { DS.copy(); setTimeout(DS.paste, 0); };
  DS.selectAll = function () {
    canvas.discardActiveObject();
    const objs = canvas.getObjects().filter((o) => o.visible && o.selectable !== false);
    if (!objs.length) return;
    canvas.setActiveObject(objs.length === 1 ? objs[0] : new fabric.ActiveSelection(objs, { canvas }));
    canvas.requestRenderAll();
  };
  DS.group = function () {
    const a = canvas.getActiveObject();
    if (!a || a.type !== 'activeSelection') return;
    suspend = true; const g = a.toGroup(); g.dsName = 'Groupe'; suspend = false;
    canvas.requestRenderAll(); pushHistory(); DS.emit('layers'); DS.emit('selection');
  };
  DS.ungroup = function () {
    const a = canvas.getActiveObject();
    if (!a || a.type !== 'group') return;
    suspend = true; a.toActiveSelection(); suspend = false;
    canvas.requestRenderAll(); pushHistory(); DS.emit('layers'); DS.emit('selection');
  };
  DS.order = function (dir) {
    const a = canvas.getActiveObject();
    if (!a) return;
    if (dir === 'up') canvas.bringForward(a);
    else if (dir === 'down') canvas.sendBackwards(a);
    else if (dir === 'top') canvas.bringToFront(a);
    else if (dir === 'bottom') canvas.sendToBack(a);
    canvas.requestRenderAll(); pushHistory(); DS.emit('layers');
  };
  DS.moveLayer = function (obj, toIndex) {
    canvas.moveTo(obj, toIndex);
    canvas.requestRenderAll(); pushHistory(); DS.emit('layers');
  };
  DS.setLocked = function (o, locked) {
    o.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked, dsLocked: locked });
    if (o.type === 'i-text') o.editable = !locked;
    canvas.requestRenderAll(); pushHistory(); DS.emit('layers'); DS.emit('selection');
  };
  DS.setVisible = function (o, v) {
    o.visible = v;
    if (!v && canvas.getActiveObjects().includes(o)) canvas.discardActiveObject();
    canvas.requestRenderAll(); pushHistory(); DS.emit('layers');
  };
  DS.nudge = function (dx, dy) {
    const a = canvas.getActiveObject();
    if (!a || a.lockMovementX) return;
    a.set({ left: a.left + dx, top: a.top + dy }); a.setCoords();
    canvas.requestRenderAll(); debouncedPush(); DS.emit('live');
  };

  function withDetached(fn) {
    const objs = canvas.getActiveObjects();
    if (!objs.length) return;
    canvas.discardActiveObject();
    fn(objs);
    objs.forEach((o) => o.setCoords());
    canvas.setActiveObject(objs.length > 1 ? new fabric.ActiveSelection(objs, { canvas }) : objs[0]);
    canvas.requestRenderAll(); pushHistory(); DS.emit('selection');
  }
  DS.align = function (where) {
    withDetached((objs) => {
      let ref;
      if (objs.length === 1) { const pa = DS.pa(); ref = { left: pa.x, top: pa.y, width: pa.w, height: pa.h }; }
      else {
        const rs = objs.map((o) => o.getBoundingRect(true, true));
        const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
        ref = { left: l, top: t, width: Math.max(...rs.map((r) => r.left + r.width)) - l, height: Math.max(...rs.map((r) => r.top + r.height)) - t };
      }
      objs.forEach((o) => {
        const r = o.getBoundingRect(true, true);
        let dx = 0, dy = 0;
        if (where === 'left') dx = ref.left - r.left;
        if (where === 'hcenter') dx = ref.left + ref.width / 2 - (r.left + r.width / 2);
        if (where === 'right') dx = ref.left + ref.width - (r.left + r.width);
        if (where === 'top') dy = ref.top - r.top;
        if (where === 'vcenter') dy = ref.top + ref.height / 2 - (r.top + r.height / 2);
        if (where === 'bottom') dy = ref.top + ref.height - (r.top + r.height);
        o.set({ left: o.left + dx, top: o.top + dy });
      });
    });
  };
  DS.distribute = function (axis) {
    withDetached((objs) => {
      if (objs.length < 3) return;
      const key = axis === 'h' ? 'x' : 'y';
      const sorted = objs.slice().sort((a, b) => a.getCenterPoint()[key] - b.getCenterPoint()[key]);
      const first = sorted[0].getCenterPoint()[key], last = sorted[sorted.length - 1].getCenterPoint()[key];
      const step = (last - first) / (sorted.length - 1);
      sorted.forEach((o, i) => {
        const c = o.getCenterPoint();
        const target = first + step * i;
        if (key === 'x') o.set({ left: o.left + (target - c.x) }); else o.set({ top: o.top + (target - c.y) });
      });
    });
  };
  DS.fitToArea = function (mode) {
    const a = canvas.getActiveObject();
    if (!a) { DS.toast('Sélectionne d’abord un élément.'); return; }
    const pa = DS.pa();
    a.set({ angle: 0 }); a.setCoords();
    const w = a.getScaledWidth(), h = a.getScaledHeight();
    const f = mode === 'fill' ? Math.max(pa.w / w, pa.h / h) : Math.min(pa.w / w, pa.h / h);
    a.set({ scaleX: a.scaleX * f, scaleY: a.scaleY * f });
    a.setPositionByOrigin(new fabric.Point(pa.x + pa.w / 2, pa.y + pa.h / 2), 'center', 'center');
    a.setCoords(); canvas.requestRenderAll(); pushHistory(); DS.emit('selection');
  };
  // Mask: the upper of two selected objects becomes the clip shape of the lower one.
  DS.mask = function () {
    const objs = canvas.getActiveObjects();
    if (objs.length !== 2) { DS.toast('Sélectionne 2 calques : le contenu et la forme du masque (au-dessus).'); return; }
    const all = canvas.getObjects();
    const [low, up] = objs.slice().sort((a, b) => all.indexOf(a) - all.indexOf(b));
    canvas.discardActiveObject();
    const m = fabric.util.multiplyTransformMatrices(fabric.util.invertTransform(low.calcTransformMatrix()), up.calcTransformMatrix());
    const d = fabric.util.qrDecompose(m);
    up.clone((c) => {
      c.set({ angle: d.angle, scaleX: d.scaleX, scaleY: d.scaleY, skewX: d.skewX, skewY: d.skewY, left: d.translateX, top: d.translateY, originX: 'center', originY: 'center', flipX: false, flipY: false, opacity: 1, shadow: null });
      suspend = true; canvas.remove(up); suspend = false;
      low.clipPath = c; low.dirty = true;
      canvas.setActiveObject(low); canvas.requestRenderAll();
      pushHistory(); DS.emit('layers'); DS.emit('selection');
      DS.toast('Masque appliqué. « Retirer le masque » dans Style pour l’annuler.');
    }, DS.PROPS);
  };
  DS.unmask = function (o) { o.clipPath = null; o.dirty = true; canvas.requestRenderAll(); pushHistory(); DS.emit('selection'); };

  /* ---------- drawing ---------- */
  DS.setDrawing = function (on, cfg) {
    canvas.isDrawingMode = !!on;
    if (!on) return;
    let b;
    if (cfg.type === 'spray') { b = new fabric.SprayBrush(canvas); b.density = 30; b.dotWidth = 2; }
    else if (cfg.type === 'circle') b = new fabric.CircleBrush(canvas);
    else { b = new fabric.PencilBrush(canvas); b.decimate = 2; }
    b.color = cfg.color; b.width = +cfg.width;
    b.shadow = cfg.shadow > 0 ? new fabric.Shadow({ color: cfg.color, blur: +cfg.shadow, offsetX: 0, offsetY: 0 }) : null;
    canvas.freeDrawingBrush = b;
  };

  /* ---------- offscreen rendering (exports, 3D, thumbnails) ---------- */
  // Renders the design of a view. crop: 'full' (600x700 frame) or 'pa' (print area only).
  DS.renderDesign = function (view, k, crop, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const pa = DS.pa(view);
      const ox = crop === 'pa' ? pa.x : 0, oy = crop === 'pa' ? pa.y : 0;
      const w = Math.max(1, Math.round((crop === 'pa' ? pa.w : W) * k)), h = Math.max(1, Math.round((crop === 'pa' ? pa.h : H) * k));
      const sc = new fabric.StaticCanvas(null, { width: w, height: h, enableRetinaScaling: false, renderOnAddRemove: false });
      sc.setViewportTransform([k, 0, 0, k, -ox * k, -oy * k]);
      const clip = opts.clip != null ? opts.clip : state.clip;
      sc.loadFromJSON(fromRefs(DS.designJSON(view)), () => {
        sc.getObjects().forEach((o) => {
          if (o.dsCurve && (o.type === 'i-text' || o.type === 'text')) applyCurve(o, o.dsCurve);
          if (o.dsGrad) applyGradient(o, o.dsGrad);
        });
        sc.clipPath = clip ? new fabric.Rect({ left: pa.x, top: pa.y, width: pa.w, height: pa.h, originX: 'left', originY: 'top', absolutePositioned: true }) : null;
        sc.renderAll();
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        out.getContext('2d').drawImage(sc.lowerCanvasEl, 0, 0);
        sc.dispose();
        resolve(out);
      });
    });
  };

  // Full mockup of a view: product + design + realistic shading.
  DS.composeView = async function (view, width, opts) {
    opts = opts || {};
    const k = width / W;
    const out = document.createElement('canvas');
    out.width = Math.round(W * k); out.height = Math.round(H * k);
    const g = out.getContext('2d');
    if (opts.background && opts.background !== 'transparent') { g.fillStyle = opts.background; g.fillRect(0, 0, out.width, out.height); }
    const b = DS.built(view);
    const ro = { colors: state.colors, material: state.material, dropShadow: opts.dropShadow };
    g.save(); g.scale(k, k); DS.drawProduct(g, b, ro); g.restore();
    const design = await DS.renderDesign(view, k, 'full');
    g.drawImage(design, 0, 0);
    const realism = opts.realism != null ? opts.realism : state.realism;
    if (realism && b.shade !== 'none' && !b.image) {
      const s = document.createElement('canvas'); s.width = out.width; s.height = out.height;
      const sg = s.getContext('2d'); sg.scale(k, k); DS.drawShading(sg, b, ro);
      g.save(); g.scale(k, k); g.clip(new Path2D(b.shadeOutline || b.outline)); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.drawImage(s, 0, 0); g.restore();
      g.save(); g.scale(k, k); DS.drawHighlight(g, b, ro); g.restore();
    }
    g.save(); g.scale(k, k); DS.drawProduct(g, b, Object.assign({}, ro, { top: true, dropShadow: false })); g.restore();
    return out;
  };

  /* ---------- project (de)serialisation ---------- */
  DS.projectData = function () {
    saveCurrent();
    const used = {};
    Object.values(state.designs).forEach((d) => {
      (d.json.match(/"ds:(img[a-z0-9]+)"/g) || []).forEach((m) => { const id = m.slice(4, -1); used[id] = images[id]; });
    });
    return {
      app: 'motif-studio', version: 1, productId: state.productId, options: state.options, colors: state.colors,
      material: state.material, realism: state.realism, clip: state.clip, view: state.view,
      designs: state.designs, perProduct: state.perProduct, images: used, customImage: state.customImage,
    };
  };
  DS.loadProject = function (p, cb) {
    if (!p || p.app !== 'motif-studio') { DS.toast('Ce fichier n’est pas un projet Motif Studio.'); return; }
    Object.entries(p.images || {}).forEach(([id, url]) => { images[id] = url; imageIds.set(url, id); });
    state.productId = DS.productById(p.productId).id;
    state.options = Object.assign(DS.defaultOptions(DS.product()), p.options || {});
    state.colors = Object.assign({}, p.colors || {});
    state.material = p.material || 'cotton';
    state.realism = p.realism !== false; state.clip = p.clip !== false;
    state.designs = p.designs || {};
    state.perProduct = p.perProduct || {};
    Object.keys(hist).forEach((k) => delete hist[k]);
    const views = DS.product().views.map((v) => v[0]);
    state.view = views.includes(p.view) ? p.view : views[0];
    const finish = () => {
      loadJSON(DS.designJSON(state.view, true), () => {
        hs().stack = [snapshot()]; hs().idx = 0;
        DS.emit('history'); if (cb) cb();
      });
      drawAux();
      DS.emit('product', DS.product()); DS.emit('view', state.view);
    };
    if (p.customImage) DS.setCustomImage(p.customImage, finish); else { DS.setCustomImage(null); finish(); }
  };
  DS.newProject = function () {
    state.designs = {}; state.perProduct = {};
    Object.keys(hist).forEach((k) => delete hist[k]);
    suspend = true; canvas.clear(); suspend = false;
    state.productId = 'tee';
    state.options = DS.defaultOptions(DS.product());
    state.colors = { main: DS.product().main, trim: DS.product().trim };
    state.view = 'front';
    DS.setView('front', true, true);
    state.designs = {}; state.perProduct = {};
    DS.emit('product', DS.product());
    DS.emit('changed');
  };
})();
