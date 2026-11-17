// Scene, camera rig and input: the mouse wheel (or a pinch / swipe) dives the
// camera into the wardrobe and travels from one product to the next.
import * as THREE from 'three';
import { PRODUCTS, SECTIONS } from './products.js';
import { buildProduct } from './garments.js';
import { setMaxAnisotropy, floorTexture, wallTexture, signTexture, finaleTexture } from './art.js';
import { createUI } from './ui.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const PAPER = 0xe9e3d7;
const RAIL_Y = 2.62;
const RAIL_X = 1.3;
const SPACING = 4.2;
const SECTION_GAP = 2.2;
const START_Z = 17;

const loaderBar = $('loaderBar');
const setLoad = (p) => { loaderBar.style.width = `${p}%`; };

/* ---------------- Layout ---------------- */
const sectionStarts = new Set(SECTIONS.map((s) => s.from));
const layout = [];
{
  let z = 0;
  PRODUCTS.forEach((p, i) => {
    if (i > 0) z -= SPACING + (sectionStarts.has(i) ? SECTION_GAP : 0);
    layout.push({ x: i % 2 === 0 ? -RAIL_X : RAIL_X, z });
  });
}
const lastZ = layout[layout.length - 1].z;
const END_Z = lastZ - 7;

let view = 3.3;
let stops = [];
let dMax = 0;
function computeStops() {
  const portrait = innerWidth / innerHeight < 0.9;
  view = portrait ? 4.1 : 3.7;
  stops = layout.map((l) => START_Z - (l.z + view));
  dMax = START_Z - (lastZ - 2.2);
}
computeStops();

function fractionAt(d) {
  if (d <= stops[0]) return (d - stops[0]) / SPACING;
  const n = stops.length - 1;
  if (d >= stops[n]) return n + (d - stops[n]) / SPACING;
  for (let i = 0; i < n; i++) {
    if (d < stops[i + 1]) return i + (d - stops[i]) / (stops[i + 1] - stops[i]);
  }
  return n;
}

function aisleX(f) {
  const n = layout.length - 1;
  const i = clamp(Math.floor(f), 0, n);
  const j = clamp(i + 1, 0, n);
  const x = lerp(layout[i].x, layout[j].x, smooth(0, 1, f - i));
  const k = smooth(-1.4, -0.1, f) * (1 - smooth(n + 0.2, n + 1, f));
  return x * k;
}

/* ---------------- Boot ---------------- */
async function boot() {
  setLoad(15);
  try {
    await Promise.race([
      Promise.all(['100px Anton', '700 20px "Space Mono"', '900 20px Archivo'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fallback fonts */ }
  setLoad(40);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
  } catch {
    const ui = createUI({ onJump() {}, onAdded() {}, onListToggle() {} });
    ui.toggleList(true);
    ui.hideListToggle();
    finishLoader();
    return;
  }
  start(renderer);
}

function finishLoader() {
  setLoad(100);
  const l = $('loader');
  setTimeout(() => l.classList.add('is-done'), 150);
  setTimeout(() => l.remove(), 1200);
}

function start(renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.6 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !coarse;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.fog = new THREE.Fog(PAPER, 7, 26);
  const camera = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.05, 80);
  camera.position.set(0, 1.62, START_Z);

  /* Lights */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ae9c, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const spot = new THREE.PointLight(0xff3b2f, 0, 7, 1.6);
  scene.add(spot);

  /* Architecture */
  const length = START_Z - END_Z + 10;
  const midZ = (START_Z + END_Z) / 2;
  const floorTex = floorTexture();
  floorTex.repeat.set(3, length / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, length), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = midZ;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallTex = wallTexture();
  wallTex.repeat.set(length / 16, 1);
  [-4.6, 4.6].forEach((x) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, 6), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
    wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(x, 3, midZ);
    wall.receiveShadow = true;
    scene.add(wall);
  });

  const black = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.5, metalness: 0.4 });
  const railStart = layout[0].z + 2.5;
  const railLen = railStart - (lastZ - 2);
  [-RAIL_X, RAIL_X].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, railLen, 12), black);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(x, RAIL_Y, railStart - railLen / 2);
    rail.castShadow = true;
    scene.add(rail);
    // Rails hang from the ceiling on thin cables: nothing blocks the aisle view.
    for (let z = railStart; z >= lastZ - 2.01; z -= railLen / 6) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 4, 6), black);
      cable.position.set(x, RAIL_Y + 2, z);
      scene.add(cable);
    }
  });

  function portal(z, label, opts) {
    const g = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    [-3.1, 3.1].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35), frame);
      pillar.position.set(x, 2.1, 0);
      pillar.castShadow = true;
      g.add(pillar);
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(6.55, 0.82, 0.3), [
      frame, frame, frame, frame, new THREE.MeshStandardMaterial({ map: signTexture(label, opts), roughness: 0.7 }), frame,
    ]);
    sign.position.y = 3.95;
    sign.castShadow = true;
    g.add(sign);
    g.position.z = z;
    scene.add(g);
    return g;
  }
  portal(layout[0].z + 6.5, 'INSOUMIS SUPPLY CO.', { bg: '#111111', ink: '#EFE7D6', sub: '★ DRESSING DE LUTTE ★' });
  SECTIONS.forEach((s, i) => portal(layout[s.from].z + SPACING * 0.62, s.label, {
    bg: ['#E3201B', '#4B2E83', '#111111'][i % 3], ink: '#EFE7D6', sub: `RAYON 0${i + 1}`,
  }));

  const finale = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: finaleTexture(), roughness: 0.9 }));
  finale.position.set(0, 3.2, END_Z);
  scene.add(finale);

  /* Products */
  const items = PRODUCTS.map((p, i) => {
    const built = buildProduct(p);
    const { x, z } = layout[i];
    built.pivot.position.set(x, RAIL_Y, z);
    const baseYaw = x < 0 ? 0.55 : -0.55;
    built.pivot.rotation.y = baseYaw;
    scene.add(built.pivot);
    return { ...built, i, x, z, baseYaw, yaw: baseYaw, swing: 0, swingV: 0, spin: 1, pop: 0 };
  });
  const hitMeshes = items.flatMap((it) => it.hit);
  const idToIndex = Object.fromEntries(PRODUCTS.map((p, i) => [p.id, i]));
  setLoad(80);

  /* ---------------- State + UI ---------------- */
  let d = 0;
  let target = 0;
  let prevD = 0;
  let vel = 0;
  let listOpen = false;
  let lastInput = 0;
  let lastDir = 0;
  let touching = false;
  let hovered = -1;
  const mouse = new THREE.Vector2(0, 0);
  const mouseSmooth = new THREE.Vector2(0, 0);
  let mouseInside = false;

  const goTo = (i) => { target = stops[clamp(i, 0, stops.length - 1)]; lastInput = 0; lastDir = 0; };
  const ui = createUI({
    onJump: goTo,
    onAdded: (i) => { items[i].spin = 0; },
    onListToggle: (open) => { listOpen = open; if (!open) loop(); },
  });
  const updateTicks = () => ui.setTicks(stops.map((s) => s / dMax));
  updateTicks();

  /* ---------------- Input ---------------- */
  const blocked = (e) => ui.isBusy() || (e && e.target && e.target.closest && e.target.closest('.list, .cart'));

  addEventListener('wheel', (e) => {
    if (blocked(e)) return;
    e.preventDefault();
    let delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (e.ctrlKey) delta *= 4; // trackpad pinch-zoom
    target = clamp(target + clamp(delta, -140, 140) * 0.0105, 0, dMax);
    lastDir = Math.sign(delta);
    lastInput = performance.now();
  }, { passive: false });

  const canvas = renderer.domElement;
  const pointers = new Map();
  let pinchDist = 0;
  let tap = null;
  let flingV = 0;
  let lastMoveT = 0;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touching = true;
    flingV = 0;
    tap = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      mouseInside = true;
    }
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) return;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      target = clamp(target + (dist - pinchDist) * 0.035, 0, dMax);
      if (dist !== pinchDist) lastDir = Math.sign(dist - pinchDist);
      pinchDist = dist;
    } else {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const step = Math.abs(dy) >= Math.abs(dx) ? -dy : -dx * 0.8;
      const k = e.pointerType === 'mouse' ? 0.012 : 0.02;
      target = clamp(target + step * k, 0, dMax);
      if (step) lastDir = Math.sign(step);
      const now = performance.now();
      const dt = Math.max(8, now - lastMoveT);
      flingV = lerp(flingV, (step * k) / dt, 0.4);
      lastMoveT = now;
    }
    lastInput = performance.now();
  });

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      touching = false;
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10 && performance.now() - tap.t < 350) {
        const i = pick(e.clientX, e.clientY);
        if (i >= 0) goTo(i);
      } else if (performance.now() - lastMoveT < 80) {
        target = clamp(target + flingV * 320, 0, dMax);
      }
      tap = null;
      lastInput = performance.now();
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { mouseInside = false; });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(cx, cy) {
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitMeshes, false)[0];
    return hit ? idToIndex[hit.object.userData.product] : -1;
  }

  addEventListener('keydown', (e) => {
    if (blocked(e)) return;
    // Let Space/Enter activate a focused button, but arrows always drive the dressing.
    if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('button, a, input')) return;
    const f = Math.round(fractionAt(target));
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
      e.preventDefault();
      if (f >= PRODUCTS.length - 1) target = dMax; else goTo(Math.max(0, f + 1));
    } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      if (f <= 0) target = 0; else goTo(Math.min(PRODUCTS.length - 1, f - 1));
    } else if (e.key === 'Home') { target = 0; } else if (e.key === 'End') { target = dMax; }
  });

  $('restart').addEventListener('click', () => { target = 0; });
  $('homeLink').addEventListener('click', (e) => { e.preventDefault(); target = 0; });

  addEventListener('resize', () => {
    const f = fractionAt(target);
    computeStops();
    updateTicks();
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (f >= -0.5 && f <= PRODUCTS.length - 0.5) target = d = stops[clamp(Math.round(f), 0, stops.length - 1)];
  });

  /* ---------------- Frame ---------------- */
  const hero = $('hero');
  const finaleEl = $('finale');
  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  let camRoll = 0;
  let prevCamX = 0;
  let running = false;

  function frame() {
    if (listOpen) { running = false; return; }
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const t = clock.elapsedTime;

    // Snap to the nearest product once input has settled.
    const now = performance.now();
    if (!touching && lastInput && now - lastInput > 220) {
      const f = fractionAt(target);
      // Bias toward the scroll direction so a single notch reaches the next piece.
      if (f > -0.6 && f < PRODUCTS.length - 0.4) target = stops[clamp(Math.round(f + lastDir * 0.35), 0, stops.length - 1)];
      lastInput = 0;
      lastDir = 0;
    }

    d = lerp(d, target, 1 - Math.exp(-dt * (reduceMotion ? 14 : 4.2)));
    vel = lerp(vel, (d - prevD) / Math.max(dt, 1e-4), 0.25);
    prevD = d;
    const f = fractionAt(d);
    const aspect = innerWidth / innerHeight;
    const portrait = aspect < 0.9;

    /* Camera rig */
    const ax = aisleX(f);
    const camZ = START_Z - d;
    mouseSmooth.lerp(mouseInside ? mouse : mouse.set(0, 0), 0.05);
    const camX = ax * (portrait ? 0.78 : 0.4) + mouseSmooth.x * 0.25;
    camera.position.set(camX, 1.62 + mouseSmooth.y * 0.1 + Math.sin(t * 0.7) * 0.015, camZ);
    look.set(ax * (portrait ? 0.98 : 0.9), portrait ? 1.42 : 1.6, camZ - view);
    camera.lookAt(look);
    const vx = (camX - prevCamX) / Math.max(dt, 1e-4);
    prevCamX = camX;
    camRoll = lerp(camRoll, reduceMotion ? 0 : clamp(-vx * 0.035, -0.08, 0.08), 0.08);
    camera.rotateZ(camRoll);

    // Dolly-zoom: start telephoto, widen as you dive in, kick with speed.
    let fov = lerp(22, 46, smooth(0, 10, d)) + (reduceMotion ? 0 : clamp(Math.abs(vel) * 0.35, 0, 9));
    if (portrait) fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov * 1.08) / 2) / aspect * 0.62));
    camera.fov = fov;
    camera.updateProjectionMatrix();

    sun.position.set(4, 9, camZ + 2);
    sun.target.position.set(0, 0, camZ - 5);

    /* Hover */
    if (!coarse && mouseInside && !touching) {
      ndc.copy(mouse);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(hitMeshes, false)[0];
      hovered = hit ? idToIndex[hit.object.userData.product] : -1;
      canvas.style.cursor = hovered >= 0 ? 'pointer' : 'grab';
    }

    /* Products */
    const focus = clamp(Math.round(f), 0, items.length - 1);
    items.forEach((it) => {
      const w = 1 - smooth(0, 1, Math.abs(f - it.i));
      const face = Math.atan2(camera.position.x - it.x, camera.position.z - it.z);
      const hoverBoost = it.i === hovered ? 1 : 0;
      let yawTarget = lerp(it.baseYaw, face, Math.max(w, hoverBoost * 0.8));
      yawTarget += reduceMotion ? 0 : Math.sin(t * 0.8 + it.i) * 0.14 * w;
      it.yaw = lerp(it.yaw, yawTarget, 1 - Math.exp(-dt * 5));
      it.spin = Math.min(1, it.spin + dt * 1.1);
      const spinEase = 1 - Math.pow(1 - it.spin, 3);
      it.pivot.rotation.y = it.yaw + (it.spin < 1 ? spinEase * Math.PI * 2 : 0);

      if (!reduceMotion) {
        const near = Math.exp(-((camZ - it.z - 1.5) ** 2) / 8);
        const swingTarget = clamp(-vel * 0.03 * near, -0.4, 0.4) + Math.sin(t * 1.2 + it.i * 1.7) * 0.012;
        it.swingV += (swingTarget - it.swing) * 38 * dt;
        it.swingV *= Math.exp(-dt * 3.2);
        it.swing += it.swingV * dt;
        it.pivot.rotation.x = it.swing;
        it.pivot.rotation.z = Math.sin(t * 0.9 + it.i * 2.1) * 0.02 + it.swingV * 0.03;
      }
      it.pop = lerp(it.pop, w + hoverBoost * 0.4, 1 - Math.exp(-dt * 6));
      it.pivot.scale.setScalar(1 + it.pop * 0.06);
      if (it.update && Math.abs(camZ - it.z) < 14) it.update(t);
    });

    // Red accent light follows the focused piece.
    const fw = 1 - smooth(0, 0.5, Math.abs(f - focus));
    const fit = items[focus];
    spot.position.set(fit.x * 0.4, 2.2, fit.z + 1.4);
    spot.intensity = lerp(spot.intensity, f > -0.5 && f < items.length - 0.5 ? 2.2 * fw : 0, 0.1);

    /* DOM sync */
    const heroK = d / 2.2;
    const heroOpacity = 1 - smooth(1.2, 4.5, d);
    hero.style.opacity = heroOpacity;
    hero.style.transform = `scale(${1 + heroK * heroK * 0.9}) translateZ(0)`;
    hero.style.visibility = heroOpacity <= 0.001 ? 'hidden' : 'visible';
    ui.setFocus(focus, f > -0.5 && f < items.length - 0.5);
    ui.setProgress(d / dMax);
    finaleEl.classList.toggle('is-on', f > items.length - 0.35);

    renderer.render(scene, camera);
  }

  function loop() {
    if (running) return;
    running = true;
    clock.getDelta();
    requestAnimationFrame(frame);
  }

  renderer.compile(scene, camera);
  loop();
  requestAnimationFrame(finishLoader);
}

boot();
