// Night boutique: the mouse wheel (or a swipe / pinch) dives the camera into
// the room and glides from one spot-lit piece to the next.
import * as THREE from 'three';
import { Reflector } from './vendor/Reflector.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { PRODUCTS, TRICOLORE } from './products.js';
import { buildProduct, brass } from './garments.js';
import { setMaxAnisotropy, beamTexture, finaleTexture } from './art.js';
import { createUI } from './ui.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const NIGHT = 0x0a0a0b;
const RAIL_Y = 2.62;
const RAIL_X = 1.15;
const SPACING = 4.4;
const START_Z = 15;

const setLoad = (p) => { $('loaderBar').style.width = `${p}%`; };

/* ---------------- Layout ---------------- */
const layout = PRODUCTS.map((p, i) => ({ x: i % 2 === 0 ? -RAIL_X : RAIL_X, z: -i * SPACING }));
const lastZ = layout[layout.length - 1].z;
const END_Z = lastZ - 6.5;

let view = 3.5;
let stops = [];
let dMax = 0;
function computeStops() {
  view = innerWidth / innerHeight < 0.9 ? 4.2 : 3.5;
  stops = layout.map((l) => START_Z - (l.z + view));
  dMax = START_Z - (lastZ - 2);
}
computeStops();

function fractionAt(d) {
  const n = stops.length - 1;
  if (d <= stops[0]) return (d - stops[0]) / SPACING;
  if (d >= stops[n]) return n + (d - stops[n]) / SPACING;
  const i = Math.floor((d - stops[0]) / SPACING);
  return i + (d - stops[i]) / SPACING;
}

function aisleX(f) {
  const n = layout.length - 1;
  const i = clamp(Math.floor(f), 0, n);
  const j = clamp(i + 1, 0, n);
  const x = lerp(layout[i].x, layout[j].x, smooth(0, 1, f - i));
  return x * smooth(-1.4, -0.1, f) * (1 - smooth(n + 0.2, n + 1, f));
}

/* ---------------- Boot ---------------- */
async function boot() {
  setLoad(15);
  try {
    await Promise.race([
      Promise.all(['400 100px "Bodoni Moda"', '700 100px "Bodoni Moda"', 'italic 500 100px "Bodoni Moda"', '500 14px Manrope']
        .map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fallback fonts */ }
  setLoad(45);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
  } catch {
    createUI({ onJump() {}, onAdded() {} }).showList();
    finishLoader();
    return;
  }
  start(renderer);
}

function finishLoader() {
  setLoad(100);
  const l = $('loader');
  setTimeout(() => l.classList.add('is-done'), 250);
  setTimeout(() => l.remove(), 1500);
}

function start(renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.6 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !coarse;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.Fog(NIGHT, 6, 24);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(22, innerWidth / innerHeight, 0.05, 80);
  camera.position.set(0, 1.62, START_Z);
  scene.add(new THREE.HemisphereLight(0x2a2a33, 0x000000, 0.5));

  /* Room */
  const length = START_Z - END_Z + 10;
  const midZ = (START_Z + END_Z) / 2;
  if (!coarse) {
    const mirror = new Reflector(new THREE.PlaneGeometry(10, length), {
      textureWidth: Math.round(innerWidth * 0.6), textureHeight: Math.round(innerHeight * 0.6), color: 0x8a8a8a,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.z = midZ;
    scene.add(mirror);
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, length),
    new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.4, metalness: 0.2, transparent: !coarse, opacity: 0.86 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.002, midZ);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.9 });
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8 });
  [-4, 4].forEach((x) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, 5), wallMat);
    wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(x, 2.5, midZ);
    scene.add(wall);
    for (let z = START_Z - 6; z > END_Z; z -= 4.4) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 3.4, 0.02), stripMat);
      strip.position.set(x * 0.995, 1.9, z - 2.2);
      scene.add(strip);
    }
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8, length), wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 4.4, midZ);
  scene.add(ceiling);

  // Tricolour neon over the entrance: the one loud gesture in the room.
  [TRICOLORE.bleu, TRICOLORE.blanc, TRICOLORE.rouge].forEach((c, i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6) }));
    bar.position.set((i - 1) * 0.5, 3.75, layout[0].z + 4.4);
    scene.add(bar);
  });

  const railStart = layout[0].z + 2;
  const railLen = railStart - (lastZ - 2);
  [-RAIL_X, RAIL_X].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, railLen, 16), brass);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(x, RAIL_Y, railStart - railLen / 2);
    scene.add(rail);
    for (let z = railStart; z >= lastZ - 2.01; z -= railLen / 5) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 4.4 - RAIL_Y, 6), brass);
      cable.position.set(x, (4.4 + RAIL_Y) / 2, z);
      scene.add(cable);
    }
  });

  const finale = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ map: finaleTexture(), roughness: 0.8 }));
  finale.position.set(0, 2.9, END_Z);
  scene.add(finale);
  const finaleLight = new THREE.SpotLight(0xffe4c4, 0, 12, 0.6, 0.9, 1.5);
  finaleLight.position.set(0, 4.2, END_Z + 5);
  finaleLight.target.position.set(0, 2.4, END_Z);
  scene.add(finaleLight, finaleLight.target);

  /* Products, each under its own spot and soft light cone */
  const beamMap = beamTexture();
  const items = PRODUCTS.map((p, i) => {
    const built = buildProduct(p);
    const { x, z } = layout[i];
    built.pivot.position.set(x, RAIL_Y, z);
    const baseYaw = x < 0 ? 0.5 : -0.5;
    built.pivot.rotation.y = baseYaw;
    scene.add(built.pivot);

    const spot = new THREE.SpotLight(0xfff2e6, 0, 9, 0.36, 0.85, 1.4);
    spot.position.set(x * 0.6, 4.35, z + 1.2);
    spot.target.position.set(x, 1.5, z);
    spot.castShadow = !coarse;
    spot.shadow.mapSize.set(512, 512);
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);

    const beamH = 4.3;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 1.0, beamH, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2e6, alphaMap: beamMap, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      }),
    );
    beam.position.set(x * 0.85, 4.35 - beamH / 2, z + 0.5);
    scene.add(beam);
    return { ...built, i, x, z, baseYaw, yaw: baseYaw, swing: 0, swingV: 0, spin: 1, pop: 0, spot, beam };
  });
  const hitMeshes = items.flatMap((it) => it.hit);
  const idToIndex = Object.fromEntries(PRODUCTS.map((p, i) => [p.id, i]));
  setLoad(80);

  /* ---------------- State ---------------- */
  let d = 0;
  let target = 0;
  let prevD = 0;
  let vel = 0;
  let lastInput = 0;
  let lastDir = 0;
  let touching = false;
  let hovered = -1;
  const mouse = new THREE.Vector2();
  const mouseSmooth = new THREE.Vector2();
  let mouseInside = false;

  const goTo = (i) => { target = stops[clamp(i, 0, stops.length - 1)]; lastInput = 0; lastDir = 0; };
  const ui = createUI({ onJump: goTo, onAdded: (i) => { items[i].spin = 0; } });

  /* ---------------- Input ---------------- */
  addEventListener('wheel', (e) => {
    if (ui.isBusy()) return;
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
      flingV = lerp(flingV, (step * k) / Math.max(8, now - lastMoveT), 0.4);
      lastMoveT = now;
    }
    lastInput = performance.now();
  });

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size) return;
    touching = false;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10 && performance.now() - tap.t < 350) {
      const i = pick(e.clientX, e.clientY);
      if (i >= 0) goTo(i);
    } else if (performance.now() - lastMoveT < 80) {
      target = clamp(target + flingV * 320, 0, dMax);
    }
    tap = null;
    lastInput = performance.now();
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
    if (ui.isBusy()) return;
    if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('button, a, input')) return;
    const f = Math.round(fractionAt(target));
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
      e.preventDefault();
      if (f >= PRODUCTS.length - 1) target = dMax; else goTo(Math.max(0, f + 1));
    } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      if (f <= 0) target = 0; else goTo(f - 1);
    } else if (e.key === 'Home') { target = 0; } else if (e.key === 'End') { target = dMax; }
  });

  $('restart').addEventListener('click', () => { target = 0; });
  $('homeLink').addEventListener('click', (e) => { e.preventDefault(); target = 0; });

  addEventListener('resize', () => {
    const f = fractionAt(target);
    computeStops();
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

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const t = clock.elapsedTime;

    // Snap to the nearest piece once input settles, biased toward the scroll direction.
    if (!touching && lastInput && performance.now() - lastInput > 220) {
      const f = fractionAt(target);
      if (f > -0.6 && f < PRODUCTS.length - 0.4) target = stops[clamp(Math.round(f + lastDir * 0.35), 0, stops.length - 1)];
      lastInput = 0;
      lastDir = 0;
    }

    d = lerp(d, target, 1 - Math.exp(-dt * (reduceMotion ? 14 : 3.6)));
    vel = lerp(vel, (d - prevD) / Math.max(dt, 1e-4), 0.25);
    prevD = d;
    const f = fractionAt(d);
    const aspect = innerWidth / innerHeight;
    const portrait = aspect < 0.9;

    /* Camera rig */
    const ax = aisleX(f);
    const camZ = START_Z - d;
    mouseSmooth.lerp(mouseInside ? mouse : mouse.set(0, 0), 0.04);
    const camX = ax * (portrait ? 0.8 : 0.42) + mouseSmooth.x * 0.2;
    camera.position.set(camX, 1.62 + mouseSmooth.y * 0.08, camZ);
    look.set(ax * (portrait ? 0.98 : 0.9), portrait ? 1.35 : 1.55, camZ - view);
    camera.lookAt(look);
    const vx = (camX - prevCamX) / Math.max(dt, 1e-4);
    prevCamX = camX;
    camRoll = lerp(camRoll, reduceMotion ? 0 : clamp(-vx * 0.025, -0.05, 0.05), 0.06);
    camera.rotateZ(camRoll);

    // Dolly-zoom: telephoto at the door, wider once inside, a touch wider with speed.
    let fov = lerp(20, 42, smooth(0, 10, d)) + (reduceMotion ? 0 : clamp(Math.abs(vel) * 0.25, 0, 6));
    if (portrait) fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov * 1.08) / 2) / aspect * 0.62));
    camera.fov = fov;
    camera.updateProjectionMatrix();

    /* Hover */
    if (!coarse && mouseInside && !touching) {
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(hitMeshes, false)[0];
      hovered = hit ? idToIndex[hit.object.userData.product] : -1;
      canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
    }

    /* Products and their light */
    const inside = smooth(1, 6, d);
    items.forEach((it) => {
      const w = 1 - smooth(0, 1, Math.abs(f - it.i));
      const face = Math.atan2(camera.position.x - it.x, camera.position.z - it.z);
      const hoverBoost = it.i === hovered ? 1 : 0;
      let yawTarget = lerp(it.baseYaw, face, Math.max(w, hoverBoost * 0.8));
      yawTarget += reduceMotion ? 0 : Math.sin(t * 0.6 + it.i) * 0.1 * w;
      it.yaw = lerp(it.yaw, yawTarget, 1 - Math.exp(-dt * 4));
      it.spin = Math.min(1, it.spin + dt * 0.9);
      const spinEase = 1 - Math.pow(1 - it.spin, 3);
      it.pivot.rotation.y = it.yaw + (it.spin < 1 ? spinEase * Math.PI * 2 : 0);

      if (!reduceMotion) {
        const near = Math.exp(-((camZ - it.z - 1.5) ** 2) / 8);
        const swingTarget = clamp(-vel * 0.025 * near, -0.3, 0.3) + Math.sin(t * 1.1 + it.i * 1.7) * 0.01;
        it.swingV += (swingTarget - it.swing) * 34 * dt;
        it.swingV *= Math.exp(-dt * 3.4);
        it.swing += it.swingV * dt;
        it.pivot.rotation.x = it.swing;
        it.pivot.rotation.z = Math.sin(t * 0.8 + it.i * 2.1) * 0.015 + it.swingV * 0.03;
      }
      it.pop = lerp(it.pop, w + hoverBoost * 0.4, 1 - Math.exp(-dt * 5));
      it.pivot.scale.setScalar(1 + it.pop * 0.04);

      // Every piece keeps a low light; the one in front of you gets the full spot.
      const lit = inside * (0.35 + 0.65 * Math.max(w, hoverBoost * 0.6));
      it.spot.intensity = lerp(it.spot.intensity, lit * 26, 0.08);
      it.beam.material.opacity = lerp(it.beam.material.opacity, lit * 0.03, 0.08);
    });
    finaleLight.intensity = lerp(finaleLight.intensity, 18 * smooth(PRODUCTS.length - 0.8, PRODUCTS.length, f), 0.06);

    /* DOM sync */
    const k = d / 2.4;
    const heroOpacity = 1 - smooth(1, 4, d);
    hero.style.opacity = heroOpacity;
    hero.style.transform = `scale(${1 + k * k * 0.7})`;
    hero.style.visibility = heroOpacity <= 0.001 ? 'hidden' : 'visible';
    ui.setFocus(clamp(Math.round(f), 0, items.length - 1), f > -0.5 && f < items.length - 0.5);
    ui.setProgress(d / dMax);
    finaleEl.classList.toggle('is-on', f > items.length - 0.3);

    renderer.render(scene, camera);
  }

  renderer.compile(scene, camera);
  clock.getDelta();
  requestAnimationFrame(frame);
  requestAnimationFrame(finishLoader);
}

boot();
