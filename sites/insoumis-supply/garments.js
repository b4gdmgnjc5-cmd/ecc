// Procedural 3D products. Each builder returns a pivot group whose origin is
// the hook point on the rail, so rotations read as a garment swinging.
import * as THREE from 'three';
import { printTexture, fabricTexture } from './art.js';

const fabricMap = fabricTexture();
const metal = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.7, roughness: 0.35 });
const EXTRUDE = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 18 };
const FRONT_Z = EXTRUDE.depth / 2 + EXTRUDE.bevelThickness + 0.003;

function fabricMat(hex, shade = 1) {
  const color = new THREE.Color(hex).multiplyScalar(shade);
  return new THREE.MeshStandardMaterial({ color, map: fabricMap, roughness: 0.92, metalness: 0 });
}

function extrude(shape, mat, opts = EXTRUDE) {
  const g = new THREE.ExtrudeGeometry(shape, opts);
  g.translate(0, 0, -opts.depth / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function printPlane(p, w, h, { bg = null, brand = true, texW = 1024 } = {}) {
  const tex = printTexture(p.print, p.ink, { w: texW, h: Math.round(texW * (h / w)), bg, brand });
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: !bg, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function tube(points, radius, mat = metal, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)), closed);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, closed), mat);
  m.castShadow = true;
  return m;
}

function hanger() {
  const g = new THREE.Group();
  g.add(tube([[0, -0.12], [0, 0.0], [0.015, 0.06], [0.055, 0.085], [0.09, 0.06], [0.085, 0.03]], 0.012));
  g.add(tube([[-0.44, -0.27], [-0.22, -0.19], [0, -0.12], [0.22, -0.19], [0.44, -0.27]], 0.014));
  g.add(tube([[-0.44, -0.27], [0, -0.28], [0.44, -0.27]], 0.01));
  return g;
}

function sHook(len = 0.3) {
  return tube([[0.07, 0.04], [0.03, 0.08], [0, 0.03], [0, -len * 0.5], [0, -len], [0.04, -len - 0.05], [0.07, -len - 0.01]], 0.011);
}

/* ---------------- Builders ---------------- */

function tee(p) {
  const s = new THREE.Shape();
  s.moveTo(-0.17, 0);
  s.quadraticCurveTo(0, -0.17, 0.17, 0);
  s.lineTo(0.42, -0.05);
  s.lineTo(0.69, -0.33);
  s.lineTo(0.54, -0.51);
  s.lineTo(0.39, -0.4);
  s.quadraticCurveTo(0.37, -0.8, 0.4, -1.18);
  s.quadraticCurveTo(0, -1.21, -0.4, -1.18);
  s.quadraticCurveTo(-0.37, -0.8, -0.39, -0.4);
  s.lineTo(-0.54, -0.51);
  s.lineTo(-0.69, -0.33);
  s.lineTo(-0.42, -0.05);
  s.closePath();
  const body = new THREE.Group();
  body.add(extrude(s, fabricMat(p.fabric)));
  const collar = tube([[-0.17, 0, FRONT_Z - 0.01], [0, -0.17, FRONT_Z - 0.01], [0.17, 0, FRONT_Z - 0.01]], 0.02, fabricMat(p.fabric, 0.8));
  body.add(collar);
  const print = printPlane(p, 0.56, 0.6);
  print.position.set(0, -0.6, FRONT_Z);
  body.add(print);
  body.position.y = -0.13;
  return [body, hanger()];
}

function hoodie(p) {
  const s = new THREE.Shape();
  s.moveTo(-0.15, -0.02);
  s.quadraticCurveTo(0, -0.22, 0.15, -0.02);
  s.quadraticCurveTo(0.3, -0.04, 0.47, -0.1);
  s.quadraticCurveTo(0.61, -0.3, 0.65, -0.98);
  s.lineTo(0.63, -1.1);
  s.lineTo(0.5, -1.1);
  s.lineTo(0.5, -0.98);
  s.quadraticCurveTo(0.47, -0.6, 0.41, -0.42);
  s.lineTo(0.42, -1.13);
  s.lineTo(0.42, -1.24);
  s.lineTo(-0.42, -1.24);
  s.lineTo(-0.42, -1.13);
  s.lineTo(-0.41, -0.42);
  s.quadraticCurveTo(-0.47, -0.6, -0.5, -0.98);
  s.lineTo(-0.5, -1.1);
  s.lineTo(-0.63, -1.1);
  s.lineTo(-0.65, -0.98);
  s.quadraticCurveTo(-0.61, -0.3, -0.47, -0.1);
  s.quadraticCurveTo(-0.3, -0.04, -0.15, -0.02);
  const body = new THREE.Group();
  const mat = fabricMat(p.fabric);
  body.add(extrude(s, mat, { ...EXTRUDE, depth: 0.08 }));

  const hood = new THREE.Shape();
  hood.moveTo(-0.27, -0.08);
  hood.quadraticCurveTo(-0.33, 0.36, 0, 0.37);
  hood.quadraticCurveTo(0.33, 0.36, 0.27, -0.08);
  hood.closePath();
  const hoodMesh = extrude(hood, fabricMat(p.fabric, 0.82));
  hoodMesh.position.z = -0.075;
  body.add(hoodMesh);

  const pocket = new THREE.Shape();
  pocket.moveTo(-0.26, -0.82);
  pocket.lineTo(0.26, -0.82);
  pocket.lineTo(0.32, -1.08);
  pocket.lineTo(-0.32, -1.08);
  pocket.closePath();
  const pocketMesh = extrude(pocket, fabricMat(p.fabric, 0.9), { ...EXTRUDE, depth: 0.01, bevelThickness: 0.01 });
  pocketMesh.position.z = FRONT_Z + 0.01;
  body.add(pocketMesh);

  const cord = new THREE.MeshStandardMaterial({ color: p.ink, roughness: 0.8 });
  [-0.07, 0.07].forEach((x) => body.add(tube([[x, -0.1, FRONT_Z + 0.03], [x * 1.1, -0.25, FRONT_Z + 0.04], [x * 0.9, -0.38, FRONT_Z + 0.04]], 0.01, cord)));

  const print = printPlane(p, 0.52, 0.42, { brand: false });
  print.position.set(0, -0.56, FRONT_Z + 0.015);
  body.add(print);
  body.position.y = -0.13;
  return [body, hanger()];
}

function tote(p) {
  const s = new THREE.Shape();
  s.moveTo(-0.39, -0.32);
  s.lineTo(0.39, -0.32);
  s.lineTo(0.4, -1.22);
  s.lineTo(-0.4, -1.22);
  s.closePath();
  const body = new THREE.Group();
  const mat = fabricMat(p.fabric);
  body.add(extrude(s, mat, { ...EXTRUDE, depth: 0.03, bevelThickness: 0.012 }));
  const strap = fabricMat(p.fabric, 0.78);
  [-0.02, 0.02].forEach((z) => body.add(tube([[-0.22, -0.33, z], [-0.17, -0.08, z], [0, 0.0, z], [0.17, -0.08, z], [0.22, -0.33, z]], 0.018, strap)));
  const print = printPlane(p, 0.66, 0.72);
  print.position.set(0, -0.78, 0.03);
  body.add(print);
  body.position.y = -0.33;
  return [body, sHook(0.28)];
}

function cap(p) {
  const body = new THREE.Group();
  const mat = fabricMat(p.fabric);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.scale.set(1, 0.82, 1.04);
  dome.castShadow = true;
  body.add(dome);
  const brimShape = new THREE.Shape();
  brimShape.moveTo(-0.2, 0);
  brimShape.quadraticCurveTo(-0.2, 0.26, 0, 0.27);
  brimShape.quadraticCurveTo(0.2, 0.26, 0.2, 0);
  brimShape.quadraticCurveTo(0, 0.07, -0.2, 0);
  const brim = extrude(brimShape, fabricMat(p.fabric, 0.85), { ...EXTRUDE, depth: 0.012, bevelThickness: 0.008, bevelSize: 0.008 });
  brim.rotation.x = Math.PI / 2;
  brim.position.set(0, 0.005, 0.16);
  body.add(brim);
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), fabricMat(p.fabric, 0.7));
  btn.position.y = 0.18;
  body.add(btn);
  const tex = printTexture(p.print, p.ink, { w: 1024, h: 220, brand: false });
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2305, 0.2305, 0.08, 32, 1, true, -0.62, 1.24),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  label.position.y = 0.065;
  label.scale.set(1, 1, 1.04);
  body.add(label);
  body.rotation.x = 0.5;
  body.scale.setScalar(1.7);
  body.position.y = -0.62;
  const hook = sHook(0.22);
  return [body, hook];
}

function flag(p) {
  const body = new THREE.Group();
  const W = 1.1, H = 0.74;
  const geo = new THREE.PlaneGeometry(W, H, 28, 18);
  geo.translate(0, -H / 2, 0);
  const tex = printTexture(p.print, p.ink, { w: 1024, h: 690, bg: p.fabric });
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
  const cloth = new THREE.Mesh(geo, mat);
  cloth.castShadow = true;
  cloth.position.y = -0.24;
  body.add(cloth);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, W + 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.7 }));
  stick.rotation.z = Math.PI / 2;
  stick.position.y = -0.24;
  body.add(stick);
  body.add(tube([[-W / 2, -0.24], [0, 0.0], [W / 2, -0.24]], 0.004));
  const base = geo.attributes.position.array.slice();
  const update = (t) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      const fall = -y / H;
      pos.array[i * 3 + 2] = Math.sin(x * 4.2 + t * 2.4 + y * 3) * 0.05 * fall + Math.sin(t * 1.3 + x) * 0.02 * fall;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return [body, sHook(0.02), update];
}

function poster(p) {
  const body = new THREE.Group();
  const W = 0.8, H = 1.12;
  const tex = printTexture(p.print, p.ink, { w: 800, h: 1120, bg: p.fabric });
  const paper = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.006), [
    new THREE.MeshStandardMaterial({ color: 0xeeeeee }), new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee }), new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }), new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 1 }),
  ]);
  paper.castShadow = true;
  paper.position.y = -0.26 - H / 2;
  body.add(paper);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  [-0.24, -0.26 - H - 0.02].forEach((y) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.035, 0.03), barMat);
    bar.position.y = y;
    bar.castShadow = true;
    body.add(bar);
  });
  body.add(tube([[-W / 2, -0.23], [0, 0.0], [W / 2, -0.23]], 0.004));
  return [body, sHook(0.02)];
}

const BUILDERS = { tee, hoodie, tote, cap, flag, poster };

export function buildProduct(p) {
  const pivot = new THREE.Group();
  const inner = new THREE.Group();
  const [body, hook, update] = BUILDERS[p.type](p);
  inner.add(body);
  if (hook) inner.add(hook);
  inner.position.y = -0.09;
  pivot.add(inner);
  const hit = [];
  body.traverse((o) => { if (o.isMesh) { o.userData.product = p.id; hit.push(o); } });
  return { pivot, body, hit, update };
}
