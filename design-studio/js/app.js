/* Motif Studio — UI wiring, panels, shortcuts, autosave, PWA. */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const STORE_KEY = 'motif-studio:project';
  const MODE_KEY = 'motif-studio:mode';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (_e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (_e) { /* ignore */ } },
  };

  /* ---------- mode (PC / mobile) ---------- */
  function detectMobile() {
    const pref = store.get(MODE_KEY);
    if (pref === 'mobile') return true;
    if (pref === 'desktop') return false;
    return window.matchMedia('(max-width: 820px)').matches || (window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 700);
  }
  DS.isMobile = detectMobile();
  document.body.classList.toggle('is-mobile', DS.isMobile);

  /* ---------- toast ---------- */
  let toastTimer = 0;
  DS.toast = function (msg, ms) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  };

  /* ---------- panels ---------- */
  const TITLES = { product: 'Produit', text: 'Texte', image: 'Image', shapes: 'Formes et pictos', draw: 'Dessin', props: 'Style', layers: 'Calques' };
  function openTool(tool) {
    $$('#rail button').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
    if (tool === 'props' || tool === 'layers') {
      showInspectorTab(tool);
      if (DS.isMobile) { $('#toolPanel').classList.remove('open'); $('#inspector').classList.add('open'); $('#inspTitle').textContent = TITLES[tool]; }
      return;
    }
    $$('#toolPanel .tool').forEach((s) => { s.hidden = s.dataset.panel !== tool; });
    $('#toolTitle').textContent = TITLES[tool];
    if (DS.isMobile) { $('#inspector').classList.remove('open'); $('#toolPanel').classList.add('open'); }
    if (tool !== 'draw' && $('#drawMode').checked) { $('#drawMode').checked = false; DS.setDrawing(false); }
  }
  function closeSheets() { $$('.sheet').forEach((s) => s.classList.remove('open')); $$('#rail button').forEach((b) => b.classList.remove('active')); }
  function showInspectorTab(tab) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.itab === tab));
    $$('.itab').forEach((p) => { p.hidden = p.dataset.ipanel !== tab; });
  }

  /* ---------- product panel ---------- */
  function productThumbs() {
    const grid = $('#productGrid');
    grid.innerHTML = '';
    DS.PRODUCTS.forEach((p) => {
      const c = document.createElement('canvas');
      c.width = 120; c.height = 140;
      const g = c.getContext('2d'); g.scale(0.2, 0.2);
      if (p.kind === 'custom') {
        g.fillStyle = 'rgba(128,128,140,0.25)'; g.fillRect(120, 140, 360, 420);
        g.strokeStyle = '#7f8698'; g.lineWidth = 10; g.setLineDash([24, 18]); g.strokeRect(120, 140, 360, 420);
        g.setLineDash([]); g.fillStyle = '#7f8698'; g.font = '700 150px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('+', 300, 410);
      } else {
        const b = p.build(p.views[0][0], DS.defaultOptions(p), {});
        DS.drawProduct(g, b, { colors: { main: p.main === '#ffffff' ? '#f1f2f5' : p.main, trim: p.trim === '#ffffff' ? '#e3e5ea' : p.trim }, material: 'smooth', dropShadow: false });
        DS.drawProduct(g, b, { colors: { main: p.main, trim: p.trim }, material: 'smooth', top: true, dropShadow: false });
      }
      const btn = DS.el('button', { type: 'button', class: 'product-card', 'data-id': p.id, title: p.name }, [c, DS.el('span', { text: p.name })]);
      btn.addEventListener('click', () => { DS.setProduct(p.id); if (DS.isMobile) DS.fit(); });
      grid.appendChild(btn);
    });
  }
  function swatches(host, list, key) {
    host.innerHTML = '';
    list.forEach((item) => {
      const [name, hex] = Array.isArray(item) ? item : [item, item];
      const b = DS.el('button', { type: 'button', class: 'swatch', title: name, 'aria-label': name, style: `background:${hex}`, 'data-hex': hex });
      b.addEventListener('click', () => {
        const patch = {}; patch[key] = hex;
        if (key === 'main' && DS.state.colors.trim === DS.state.colors.main) patch.trim = hex;
        DS.setColors(patch); syncProductPanel();
      });
      host.appendChild(b);
    });
  }
  function renderOptions() {
    const host = $('#productOptions');
    host.innerHTML = '';
    const p = DS.product();
    if (!p.options.length) host.appendChild(DS.el('p', { class: 'hint', text: 'Pas d’option de forme pour cet objet.' }));
    p.options.forEach((op) => {
      const id = 'opt-' + op.key;
      if (op.type === 'select') {
        const s = DS.el('select', { id }, op.choices.map(([v, t]) => DS.el('option', { value: v, text: t })));
        s.value = DS.state.options[op.key];
        s.addEventListener('change', () => { DS.setOption(op.key, s.value); });
        host.appendChild(DS.el('div', { class: 'row' }, [DS.el('label', { for: id, text: op.label }), s]));
      } else {
        const out = DS.el('output', { text: DS.state.options[op.key] + ' ' + (op.unit || '') });
        const r = DS.el('input', { type: 'range', id, min: op.min, max: op.max, value: DS.state.options[op.key] });
        r.addEventListener('input', () => { out.textContent = r.value + ' ' + (op.unit || ''); DS.state.options[op.key] = +r.value; DS.redraw(); DS.applyClip(); });
        r.addEventListener('change', () => DS.setOption(op.key, +r.value));
        host.appendChild(DS.el('div', { class: 'row' }, [DS.el('label', { for: id }, [document.createTextNode(op.label), out]), r]));
      }
    });
    $('#customUpload').hidden = p.kind !== 'custom';
    $('#trimHint').textContent = p.trimHint || '';
  }
  function syncProductPanel() {
    const p = DS.product();
    $$('.product-card').forEach((c) => c.classList.toggle('active', c.dataset.id === p.id));
    $('#mainColor').value = DS.state.colors.main;
    $('#trimColor').value = DS.state.colors.trim;
    $$('#mainSwatches .swatch').forEach((s) => s.classList.toggle('active', s.dataset.hex.toLowerCase() === DS.state.colors.main.toLowerCase()));
    $$('#trimSwatches .swatch').forEach((s) => s.classList.toggle('active', s.dataset.hex.toLowerCase() === DS.state.colors.trim.toLowerCase()));
    $('#material').value = DS.state.material;
    $('#realism').checked = DS.state.realism;
    $('#clipToArea').checked = DS.state.clip;
  }
  function viewTabs() {
    const host = $('#viewTabs');
    host.innerHTML = '';
    const views = DS.product().views;
    host.hidden = views.length < 2;
    views.forEach(([id, label]) => {
      const b = DS.el('button', { type: 'button', role: 'tab', text: label, class: id === DS.state.view ? 'active' : '' });
      b.addEventListener('click', () => DS.setView(id));
      host.appendChild(b);
    });
  }
  function hud() {
    const pa = DS.pa(), p = DS.product();
    $('#hudProduct').textContent = p.name;
    $('#hudArea').textContent = `Zone ${DS.fmt(pa.cmW)} × ${DS.fmt(pa.cmH)} cm`;
  }

  /* ---------- text / shapes panels ---------- */
  function textPanel() {
    const host = $('#textPresets');
    DS.TEXT_PRESETS.forEach((pr) => {
      const b = DS.el('button', { type: 'button', class: 'preset' + (pr.pro ? ' pro' : ''), style: `font-family:'${pr.font}'` }, [document.createTextNode(pr.label), DS.el('small', { text: pr.note })]);
      b.addEventListener('click', () => { DS.addPreset(pr); afterAdd(); });
      host.appendChild(b);
    });
    const fl = $('#fontList');
    DS.FONTS.forEach(([f, mob]) => {
      const b = DS.el('button', { type: 'button', text: f, style: `font-family:'${f}'`, class: mob ? '' : 'pro', title: f });
      b.addEventListener('click', () => {
        const o = DS.active();
        if (o && o.type === 'i-text') DS.ensureFont(f).then(() => { o.set('fontFamily', f); if (o.dsCurve) DS.applyCurve(o, o.dsCurve); DS.render(); DS.pushHistory(); DS.rebuildInspector(); });
        else { DS.addText({ fontFamily: f, text: f }); afterAdd(); }
      });
      fl.appendChild(b);
    });
  }
  function shapesPanel() {
    const sg = $('#shapeGrid');
    DS.SHAPES.forEach((s) => {
      const b = DS.el('button', { type: 'button', title: s.label, 'aria-label': s.label });
      b.innerHTML = `<svg viewBox="0 0 24 24">${s.svg}</svg>`;
      b.addEventListener('click', () => { DS.addShape(s.id); afterAdd(); });
      sg.appendChild(b);
    });
    const cg = $('#clipartGrid');
    DS.CLIPART.forEach((c) => {
      const b = DS.el('button', { type: 'button', title: c.label, 'aria-label': c.label });
      b.innerHTML = c.stroke ? `<svg viewBox="0 0 24 24"><path d="${c.d}"/></svg>` : `<svg viewBox="0 0 24 24" class="filled"><path d="${c.d}" fill-rule="${c.evenodd ? 'evenodd' : 'nonzero'}"/></svg>`;
      b.addEventListener('click', () => { DS.addClipart(c); afterAdd(); });
      cg.appendChild(b);
    });
    const eg = $('#emojiGrid');
    DS.EMOJIS.forEach((e) => {
      const b = DS.el('button', { type: 'button', text: e, 'aria-label': 'Emoji ' + e });
      b.addEventListener('click', () => { DS.addEmoji(e); afterAdd(); });
      eg.appendChild(b);
    });
  }
  function afterAdd() { if (DS.isMobile) closeSheets(); }

  /* ---------- images: picker, drop, paste ---------- */
  function bindImages() {
    $('#imageFile').addEventListener('change', (e) => { [...e.target.files].forEach((f) => DS.addImageFile(f)); e.target.value = ''; afterAdd(); });
    const stage = $('#stage');
    stage.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); stage.classList.add('dragover'); } });
    stage.addEventListener('dragleave', (e) => { if (e.target === stage || !stage.contains(e.relatedTarget)) stage.classList.remove('dragover'); });
    stage.addEventListener('drop', (e) => {
      e.preventDefault(); stage.classList.remove('dragover');
      [...e.dataTransfer.files].filter((f) => /^image\//.test(f.type) || /\.svg$/i.test(f.name)).forEach((f) => DS.addImageFile(f));
    });
    document.addEventListener('paste', (e) => {
      if (isTyping(e.target)) return;
      const items = [...(e.clipboardData ? e.clipboardData.items : [])];
      const img = items.find((i) => i.type.startsWith('image/'));
      if (img) { e.preventDefault(); DS.addImageFile(img.getAsFile()); return; }
      const txt = e.clipboardData && e.clipboardData.getData('text/plain');
      if (txt && txt.trim().startsWith('<svg')) { e.preventDefault(); DS.addSVG(txt, 'Vecteur collé'); }
    });
    $('#imgFit').addEventListener('click', () => DS.fitToArea('fit'));
    $('#imgFill').addEventListener('click', () => DS.fitToArea('fill'));
    $('#customFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const url = await DS.readFile(f);
      DS.setCustomImage(url);
      e.target.value = '';
    });
  }

  /* ---------- drawing ---------- */
  function drawCfg() { return { type: $('#brushType').value, color: $('#brushColor').value, width: $('#brushWidth').value, shadow: $('#brushShadow').value }; }
  function bindDraw() {
    const upd = () => { $('#brushWidthOut').textContent = $('#brushWidth').value; DS.setDrawing($('#drawMode').checked, drawCfg()); };
    ['drawMode', 'brushType', 'brushColor', 'brushWidth', 'brushShadow'].forEach((id) => $('#' + id).addEventListener('input', upd));
    $('#drawMode').addEventListener('change', () => { upd(); if ($('#drawMode').checked && DS.isMobile) { closeSheets(); DS.toast('Dessine avec le doigt. Rouvre Dessin pour arrêter.'); } });
  }

  /* ---------- export dialog ---------- */
  function exportCfg() {
    return {
      type: ($('input[name="etype"]:checked') || {}).value || 'mockup',
      size: $('#exSize').value, dpi: $('#exDpi').value, bg: $('#exBg').value, svgMode: $('#exSvgMode').value, views: $('#exViews').value,
    };
  }
  function syncExport() {
    const cfg = exportCfg();
    $$('#exportOpts [data-for]').forEach((r) => { r.hidden = !r.dataset.for.split(' ').includes(cfg.type); });
    $('#exportInfo').textContent = DS.exportInfo(cfg);
  }
  function openExport() {
    if (DS.isMobile) { const m = $('input[name="etype"][value="mockup"]'); if (!$('input[name="etype"]:checked') || $('input[name="etype"]:checked').closest('.pro')) m.checked = true; }
    syncExport();
    $('#exportDlg').showModal();
  }

  /* ---------- keyboard ---------- */
  const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      const a = DS.active();
      if (a && a.isEditing) return;
      if (document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      const go = (fn) => { e.preventDefault(); fn(); };
      if (mod && k === 'z' && !e.shiftKey) return go(DS.undo);
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) return go(DS.redo);
      if (mod && k === 'c') return go(DS.copy);
      if (mod && k === 'v') return; // handled by paste event + internal clipboard below
      if (mod && k === 'd') return go(DS.duplicate);
      if (mod && k === 'a') return go(DS.selectAll);
      if (mod && k === 'g' && e.shiftKey) return go(DS.ungroup);
      if (mod && k === 'g') return go(DS.group);
      if (mod && k === 's') return go(() => DS.saveProjectFile());
      if (mod && k === 'e') return go(openExport);
      if (mod && e.key === ']') return go(() => DS.order(e.shiftKey ? 'top' : 'up'));
      if (mod && e.key === '[') return go(() => DS.order(e.shiftKey ? 'bottom' : 'down'));
      if (k === 'delete' || k === 'backspace') return go(DS.remove);
      if (k.startsWith('arrow')) {
        const s = e.shiftKey ? 10 : 1;
        return go(() => DS.nudge(k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0));
      }
      if (mod) return;
      if (k === 'escape') { DS.canvas.discardActiveObject(); DS.render(); return; }
      if (DS.isMobile) return;
      if (k === 't') return go(() => DS.addText({}));
      if (k === 'r') return go(() => DS.addShape('rect'));
      if (k === 'e') return go(() => DS.addShape('ellipse'));
      if (k === 'b') return go(() => { openTool('draw'); $('#drawMode').checked = !$('#drawMode').checked; DS.setDrawing($('#drawMode').checked, drawCfg()); });
      if (k === 'v') return go(() => { $('#drawMode').checked = false; DS.setDrawing(false); });
      if (k === 'g') return go(toggleGrid);
      if (e.key === '+' || e.key === '=') return go(() => DS.setScale(DS.getScale() * 1.2));
      if (e.key === '-') return go(() => DS.setScale(DS.getScale() / 1.2));
      if (e.key === '0') return go(DS.fit);
      if (e.key === '?') return go(() => $('#keysDlg').showModal());
    });
    // internal clipboard paste when the system clipboard holds no image
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isTyping(e.target)) setTimeout(() => { if (!pastedImage) DS.paste(); pastedImage = false; }, 60);
    });
    document.addEventListener('paste', (e) => {
      const cd = e.clipboardData;
      if (cd && ([...cd.items].some((i) => i.type.startsWith('image/')) || (cd.getData('text/plain') || '').trim().startsWith('<svg'))) pastedImage = true;
    }, true);
  }
  let pastedImage = false;
  function toggleGrid() { DS.state.grid = !DS.state.grid; $('#btnGrid').classList.toggle('on', DS.state.grid); DS.redraw(); }

  /* ---------- autosave ---------- */
  let saveTimer = 0, warnedQuota = false;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = store.set(STORE_KEY, JSON.stringify(DS.projectData()));
      if (!ok && !warnedQuota) { warnedQuota = true; DS.toast('Sauvegarde automatique impossible (images trop lourdes). Pense à « Enregistrer le projet ».', 5000); }
    }, 800);
  }

  /* ---------- wiring ---------- */
  function bindUI() {
    $$('#rail button').forEach((b) => b.addEventListener('click', () => {
      if (DS.isMobile && b.classList.contains('active') && document.querySelector('.sheet.open')) { closeSheets(); return; }
      openTool(b.dataset.tool);
    }));
    $$('.sheet-close').forEach((b) => b.addEventListener('click', closeSheets));
    $$('.tab').forEach((t) => t.addEventListener('click', () => showInspectorTab(t.dataset.itab)));

    $('#mainColor').addEventListener('input', (e) => DS.setColors({ main: e.target.value }));
    $('#mainColor').addEventListener('change', syncProductPanel);
    $('#trimColor').addEventListener('input', (e) => DS.setColors({ trim: e.target.value }));
    $('#trimColor').addEventListener('change', syncProductPanel);
    $('#material').addEventListener('change', (e) => DS.setRender({ material: e.target.value }));
    $('#realism').addEventListener('change', (e) => DS.setRender({ realism: e.target.checked }));
    $('#clipToArea').addEventListener('change', (e) => DS.setRender({ clip: e.target.checked }));

    $('#addText').addEventListener('click', () => { DS.addText({}); afterAdd(); });

    $('#btnUndo').addEventListener('click', DS.undo);
    $('#btnRedo').addEventListener('click', DS.redo);
    $('#btnZoomIn').addEventListener('click', () => DS.setScale(DS.getScale() * 1.2));
    $('#btnZoomOut').addEventListener('click', () => DS.setScale(DS.getScale() / 1.2));
    $('#zoomVal').addEventListener('click', DS.fit);
    $('#btnGrid').addEventListener('click', toggleGrid);
    $('#btnKeys').addEventListener('click', () => $('#keysDlg').showModal());
    $('#btn3d').addEventListener('click', () => { DS.saveCurrent(); DS.open3D(); });
    $('#close3d').addEventListener('click', () => $('#dlg3d').close());
    $('#dlg3d').addEventListener('close', DS.close3D);
    $('#shot3d').addEventListener('click', DS.shot3D);
    $('#bg3d').addEventListener('change', (e) => DS.bg3D(e.target.value));

    const menu = $('#projectMenu');
    $('#btnProject').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.hidden = true; });
    menu.addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (!act) return;
      menu.hidden = true;
      if (act === 'new') confirmNew();
      if (act === 'open') $('#projectFile').click();
      if (act === 'save') DS.saveProjectFile();
      if (act === 'mode') { store.set(MODE_KEY, DS.isMobile ? 'desktop' : 'mobile'); autosaveNow(); location.reload(); }
    });
    $('#projectFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { DS.loadProject(JSON.parse(await f.text()), () => { syncAll(); DS.toast('Projet ouvert.'); }); } catch (_e) { DS.toast('Fichier de projet illisible.'); }
      e.target.value = '';
    });

    $('#btnExport').addEventListener('click', openExport);
    $('#exportForm').addEventListener('change', syncExport);
    $('#exportForm').addEventListener('submit', (e) => {
      const btn = e.submitter;
      if (btn && btn.value === 'cancel') return;
      e.preventDefault();
      $('#exportDlg').close();
      DS.runExport(exportCfg());
    });

    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const m = detectMobile();
        if (m !== DS.isMobile && !store.get(MODE_KEY)) { autosaveNow(); location.reload(); return; }
        DS.fit();
      }, 150);
    });
  }
  let pendingNew = 0;
  function confirmNew() {
    if (Date.now() - pendingNew < 4000) { pendingNew = 0; DS.newProject(); store.del(STORE_KEY); syncAll(); DS.toast('Nouveau projet.'); return; }
    pendingNew = Date.now();
    DS.toast('Choisis encore « Nouveau projet » pour effacer le design actuel.', 4000);
  }
  function autosaveNow() { store.set(STORE_KEY, JSON.stringify(DS.projectData())); }

  function syncAll() { renderOptions(); syncProductPanel(); viewTabs(); hud(); }

  function sampleDesign() {
    // First visit: a small example so the tool opens in a working state.
    DS.setColors({ main: '#ffffff', trim: '#ffffff' });
    DS.ensureFont('Anton').then(() => DS.ensureFont('Pacifico')).then(() => {
      DS.addShape('circle');
      const c = DS.active();
      c.set({ radius: 88, fill: '#ffbf00', top: c.top - 20 }); c.setCoords();
      DS.addPreset({ items: [
        { type: 'text', text: 'SUNSET', fontFamily: 'Anton', fontSize: 72, fill: '#16171b', charSpacing: 60, dy: 70 },
        { type: 'text', text: 'Club', fontFamily: 'Pacifico', fontSize: 46, fill: '#e83f6f', dy: 128 },
      ] });
      setTimeout(() => { DS.canvas.discardActiveObject(); DS.render(); DS.toast('Exemple chargé : touche un élément pour le modifier.'); }, 250);
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    if (!window.fabric) {
      document.body.innerHTML = '<p style="padding:24px;font:16px system-ui">Le moteur d’édition n’a pas pu se charger. Vérifie ta connexion internet puis recharge la page.</p>';
      return;
    }
    DS.initEditor();
    DS.initInspector();
    productThumbs();
    swatches($('#mainSwatches'), DS.GARMENT_COLORS, 'main');
    swatches($('#trimSwatches'), DS.TRIM_COLORS, 'trim');
    textPanel(); shapesPanel(); bindImages(); bindDraw(); bindUI(); bindKeys();

    DS.on('product', () => { syncAll(); });
    DS.on('view', () => { viewTabs(); hud(); });
    DS.on('area', hud);
    DS.on('history', () => { $('#btnUndo').disabled = !DS.canUndo(); $('#btnRedo').disabled = !DS.canRedo(); });
    DS.on('zoom', (s) => { $('#zoomVal').textContent = Math.round(s * 100) + ' %'; });
    DS.on('changed', autosave);
    DS.on('dblgroup', () => DS.toast('Groupe : « Dégrouper » dans Style pour modifier chaque élément.'));

    let restored = false;
    const saved = store.get(STORE_KEY);
    if (saved) {
      try { DS.loadProject(JSON.parse(saved), () => { syncAll(); DS.fit(); }); restored = true; } catch (_e) { store.del(STORE_KEY); }
    }
    if (!restored) { DS.setProduct('tee'); syncAll(); requestAnimationFrame(() => { DS.fit(); sampleDesign(); }); }
    requestAnimationFrame(DS.fit);
    if (!DS.isMobile) openTool('product');

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.claude && window.self === window.top) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
