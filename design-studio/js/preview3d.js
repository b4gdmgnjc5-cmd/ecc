/* Motif Studio — 3D preview (desktop). Garments and flat objects are "inflated" from their
 * 2D silhouette; mugs are wrapped on a cylinder; caps get a textured front panel. */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  let renderer, scene, camera, root, raf = 0, running = false;
  const view = { yaw: 0.5, pitch: 0.12, dist: 11, drag: null };

  const DEPTH = { tee: 0.42, hoodie: 0.5, sweat: 0.48, tote: 0.14, phone: 0.1, poster: 0.03, cushion: 0.75, sticker: 0.03, custom: 0.18 };

  function texture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    t.needsUpdate = true;
    return t;
  }
  const mat = (opts) => new THREE.MeshStandardMaterial(Object.assign({ roughness: DS.state.material === 'gloss' ? 0.25 : 0.88, metalness: 0 }, opts));
  const colorOf = (hex) => new THREE.Color(hex).convertSRGBToLinear();

  // Height field from the silhouette alpha: distance-to-edge, square-root profile.
  function inflated(canvas, depth) {
    const SX = 90, SY = 105;
    const geo = new THREE.PlaneGeometry(6, 7, SX, SY);
    const m = document.createElement('canvas'); m.width = SX + 1; m.height = SY + 1;
    const g = m.getContext('2d'); g.drawImage(canvas, 0, 0, SX + 1, SY + 1);
    const a = g.getImageData(0, 0, SX + 1, SY + 1).data;
    const n = (SX + 1) * (SY + 1), d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = a[i * 4 + 3] > 30 ? 1e9 : 0;
    const w = SX + 1;
    for (let y = 0; y <= SY; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!d[i]) continue;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) d[i] = Math.min(d[i], d[i - w] + 1);
      if (x > 0 && y > 0) d[i] = Math.min(d[i], d[i - w - 1] + 1.414);
      if (x < w - 1 && y > 0) d[i] = Math.min(d[i], d[i - w + 1] + 1.414);
      if (x === 0 || y === 0 || x === w - 1 || y === SY) d[i] = Math.min(d[i], 1);
    }
    for (let y = SY; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; if (!d[i]) continue;
      if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < SY) d[i] = Math.min(d[i], d[i + w] + 1);
      if (x < w - 1 && y < SY) d[i] = Math.min(d[i], d[i + w + 1] + 1.414);
      if (x > 0 && y < SY) d[i] = Math.min(d[i], d[i + w - 1] + 1.414);
    }
    const cap = 14;
    const pos = geo.attributes.position;
    for (let i = 0; i < n; i++) pos.setZ(i, d[i] ? depth * Math.sqrt(Math.min(d[i], cap) / cap) : 0);
    geo.computeVertexNormals();
    return geo;
  }

  async function baseOnly(v) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * DS.H / DS.W);
    const g = c.getContext('2d'); g.scale(1024 / DS.W, 1024 / DS.W);
    DS.drawProduct(g, DS.built(v), { colors: DS.state.colors, material: DS.state.material, dropShadow: false });
    return c;
  }

  async function buildFlat(p) {
    const views = p.views.map((v) => v[0]);
    const front = await DS.composeView(views[0], 1024, { realism: false, dropShadow: false });
    const back = views[1] ? await DS.composeView(views[1], 1024, { realism: false, dropShadow: false }) : await baseOnly(views[0]);
    const depth = DEPTH[p.id] != null ? DEPTH[p.id] : 0.3;
    const group = new THREE.Group();
    const fm = new THREE.Mesh(inflated(front, depth), mat({ map: texture(front), alphaTest: 0.5, side: THREE.DoubleSide }));
    const bm = new THREE.Mesh(inflated(back, depth), mat({ map: texture(back), alphaTest: 0.5, side: THREE.DoubleSide }));
    bm.rotation.y = Math.PI;
    group.add(fm, bm);
    return group;
  }

  async function buildMug() {
    const r = 1.25, h = 3.33;
    const Wc = 2048, Hc = 1024;
    const wrap = document.createElement('canvas'); wrap.width = Wc; wrap.height = Hc;
    const g = wrap.getContext('2d');
    g.fillStyle = DS.state.colors.main; g.fillRect(0, 0, Wc, Hc);
    const half = Wc / 2;
    for (const [i, v] of ['front', 'back'].entries()) {
      const pa = DS.pa(v);
      const art = await DS.renderDesign(v, 4, 'pa', { clip: true });
      const worldH = (pa.h / 320) * h;
      const worldW = worldH * (pa.w / pa.h);
      const frac = worldW / (Math.PI * r);
      const dw = half * frac, dh = Hc * (pa.h / 320);
      const dx = half * i + (half - dw) / 2, dy = Hc * ((pa.y - 226) / 320);
      g.drawImage(art, dx, dy, dw, dh);
    }
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 128, 1, true, -Math.PI / 2, Math.PI * 2), mat({ map: texture(wrap), roughness: 0.3 }));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, h * 0.98, 96, 1, true), mat({ color: colorOf(DS.state.colors.trim), side: THREE.BackSide, roughness: 0.3 }));
    inner.position.y = 0.02;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.97, r * 0.035, 12, 128), mat({ color: colorOf(DS.state.colors.main), roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = h / 2;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mat({ color: colorOf(DS.state.colors.main), roughness: 0.4 }));
    bottom.rotation.x = Math.PI / 2; bottom.position.y = -h / 2;
    const innerBottom = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 64), mat({ color: colorOf(DS.state.colors.trim) }));
    innerBottom.rotation.x = -Math.PI / 2; innerBottom.position.y = -h / 2 + 0.12;
    const right = (DS.state.options.handle || 'right') === 'right';
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.15, 20, 64, Math.PI), mat({ color: colorOf(DS.state.colors.main), roughness: 0.3 }));
    handle.rotation.z = right ? -Math.PI / 2 : Math.PI / 2;
    handle.position.set(right ? r - 0.05 : -r + 0.05, 0.05, 0);
    handle.scale.set(1, 1.05, 1);
    group.add(body, inner, rim, bottom, innerBottom, handle);
    return group;
  }

  async function buildCap() {
    const group = new THREE.Group();
    const R = 1.7;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: colorOf(DS.state.colors.main) }));
    crown.scale.y = 0.82;
    group.add(crown);
    const patch = async (v, phiCenter, span, t0, tl) => {
      const art = await DS.renderDesign(v, 5, 'pa', { clip: true });
      const m = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 64, 32, phiCenter - span / 2, span, t0, tl),
        mat({ map: texture(art), transparent: true, alphaTest: 0.05, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.scale.y = 0.82;
      group.add(m);
    };
    await patch('front', Math.PI / 2, 1.35, 0.42, 0.72);
    await patch('back', Math.PI * 1.5, 0.9, 0.95, 0.34);
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, R * 1.02, R * 1.28, 0, Math.PI, false);
    const visor = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 64 }), mat({ color: colorOf(DS.state.colors.trim) }));
    visor.rotation.x = Math.PI / 2 + (DS.state.options.visor === 'flat' ? 0.02 : 0.16);
    visor.position.y = 0.04;
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat({ color: colorOf(DS.state.colors.trim) }));
    button.position.y = R * 0.82;
    group.add(visor, button);
    group.position.y = -0.6;
    return group;
  }

  function groundShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  function frame() {
    if (!running) return;
    if (!view.drag && document.getElementById('auto3d').checked) view.yaw += 0.006;
    const cp = Math.cos(view.pitch);
    camera.position.set(Math.sin(view.yaw) * cp * view.dist, Math.sin(view.pitch) * view.dist, Math.cos(view.yaw) * cp * view.dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function resize() {
    if (!renderer) return;
    const host = document.getElementById('view3d');
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  DS.open3D = async function () {
    const dlg = document.getElementById('dlg3d');
    const host = document.getElementById('view3d');
    const msg = document.getElementById('msg3d');
    if (!window.THREE) { DS.toast('Le moteur 3D n’a pas pu se charger. Vérifie ta connexion.'); return; }
    dlg.showModal();
    msg.hidden = false; msg.textContent = 'Préparation du rendu…';
    try {
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        host.appendChild(renderer.domElement);
        camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
        bindControls(renderer.domElement);
        window.addEventListener('resize', resize);
      }
      scene = new THREE.Scene();
      scene.background = new THREE.Color(document.getElementById('bg3d').value);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a90a0, 0.85));
      const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(4, 6, 6); scene.add(key);
      const rim = new THREE.DirectionalLight(0xdfe6ff, 0.35); rim.position.set(-5, 2, -6); scene.add(rim);
      const p = DS.product();
      root = p.kind === 'mug' ? await buildMug() : p.kind === 'cap' ? await buildCap() : await buildFlat(p);
      scene.add(root);
      const sh = groundShadow();
      const box = new THREE.Box3().setFromObject(root);
      sh.position.y = box.min.y - 0.02;
      scene.add(sh);
      view.dist = p.kind === 'mug' ? 10.5 : p.kind === 'cap' ? 9.5 : 12.5;
      view.yaw = 0.45; view.pitch = 0.12;
      resize();
      msg.hidden = true;
      running = true; cancelAnimationFrame(raf); frame();
    } catch (e) {
      console.error('[MotifStudio] 3D', e);
      msg.textContent = 'Le rendu 3D n’est pas disponible sur cet appareil (WebGL désactivé).';
    }
  };
  DS.close3D = function () {
    running = false; cancelAnimationFrame(raf);
    if (scene) scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    scene = null;
  };
  DS.shot3D = function () {
    if (!renderer) return;
    renderer.render(scene, camera);
    renderer.domElement.toBlob((b) => DS.saveFile(`motif-studio-${DS.product().id}-3d.png`, b));
  };
  DS.bg3D = function (hex) { if (scene) scene.background = new THREE.Color(hex); };

  function bindControls(c) {
    c.addEventListener('pointerdown', (e) => { view.drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing'; });
    c.addEventListener('pointermove', (e) => {
      if (!view.drag) return;
      view.yaw -= (e.clientX - view.drag.x) * 0.01;
      view.pitch = Math.max(-0.6, Math.min(1.2, view.pitch + (e.clientY - view.drag.y) * 0.008));
      view.drag = { x: e.clientX, y: e.clientY };
    });
    const up = () => { view.drag = null; c.style.cursor = 'grab'; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); view.dist = Math.max(4, Math.min(24, view.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
    c.addEventListener('dblclick', () => { view.yaw = 0; view.pitch = 0.12; });
  }
})();
