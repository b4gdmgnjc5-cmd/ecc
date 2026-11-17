// Procedural 3D products. Each builder returns a pivot group whose origin is the
// hook point on the rail, so rotations read as a garment swinging.
import * as THREE from 'three';
import { logoTexture, memeTexture, tagTexture, fabricTexture } from './art.js';
import { TRICOLORE } from './products.js';

const fabricMap = fabricTexture();
const tagMap = tagTexture();
export const brass = new THREE.MeshStandardMaterial({ color: 0xb8996a, metalness: 1, roughness: 0.28 });
const EXTRUDE = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4, curveSegments: 24 };
const FRONT_Z = EXTRUDE.depth / 2 + EXTRUDE.bevelThickness + 0.003;

function fabricMat(hex, shade = 1) {
  const color = new THREE.Color(hex).multiplyScalar(shade);
  return new THREE.MeshPhysicalMaterial({
    color, map: fabricMap, roughness: 0.88, sheen: 0.7, sheenRoughness: 0.6,
    sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.35),
  });
}

function extrude(shape, mat, opts = EXTRUDE) {
  const g = new THREE.ExtrudeGeometry(shape, opts);
  g.translate(0, 0, -opts.depth / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function decal(tex, w, h) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function printFor(p, { logoSize, memeW, memeH }) {
  return p.print.kind === 'logo'
    ? decal(logoTexture(p.ink), logoSize, logoSize)
    : decal(memeTexture(p.print.lines, p.ink, { italic: p.print.italic }), memeW, memeH);
}

function tag() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.045), new THREE.MeshStandardMaterial({ map: tagMap, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 }));
  return m;
}

function tube(points, radius, mat = brass) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 10), mat);
  m.castShadow = true;
  return m;
}

function hanger() {
  const g = new THREE.Group();
  g.add(tube([[0, -0.12], [0, 0.0], [0.015, 0.06], [0.055, 0.085], [0.09, 0.06], [0.085, 0.03]], 0.011));
  g.add(tube([[-0.44, -0.27], [-0.22, -0.19], [0, -0.12], [0.22, -0.19], [0.44, -0.27]], 0.014));
  return g;
}

function sHook(len) {
  return tube([[0.07, 0.04], [0.03, 0.08], [0, 0.03], [0, -len * 0.5], [0, -len], [0.04, -len - 0.05], [0.07, -len - 0.01]], 0.01);
}

/* ---------------- Builders ---------------- */

function tee(p) {
  const s = new THREE.Shape();
  s.moveTo(-0.17, 0);
  s.quadraticCurveTo(0, -0.17, 0.17, 0);
  s.lineTo(0.42, -0.05);
  s.lineTo(0.68, -0.33);
  s.lineTo(0.53, -0.5);
  s.lineTo(0.39, -0.4);
  s.quadraticCurveTo(0.37, -0.8, 0.4, -1.18);
  s.quadraticCurveTo(0, -1.2, -0.4, -1.18);
  s.quadraticCurveTo(-0.37, -0.8, -0.39, -0.4);
  s.lineTo(-0.53, -0.5);
  s.lineTo(-0.68, -0.33);
  s.lineTo(-0.42, -0.05);
  s.closePath();
  const body = new THREE.Group();
  body.add(extrude(s, fabricMat(p.fabric)));
  body.add(tube([[-0.17, 0, FRONT_Z - 0.012], [0, -0.17, FRONT_Z - 0.012], [0.17, 0, FRONT_Z - 0.012]], 0.017, fabricMat(p.fabric, 0.85)));
  const print = printFor(p, { logoSize: 0.13, memeW: 0.56, memeH: 0.56 });
  if (p.print.kind === 'logo') print.position.set(0.17, -0.36, FRONT_Z);
  else print.position.set(0, -0.56, FRONT_Z);
  body.add(print);
  const t = tag();
  t.position.set(-0.3, -1.1, FRONT_Z);
  body.add(t);
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
  s.lineTo(0.42, -1.24);
  s.lineTo(-0.42, -1.24);
  s.lineTo(-0.41, -0.42);
  s.quadraticCurveTo(-0.47, -0.6, -0.5, -0.98);
  s.lineTo(-0.5, -1.1);
  s.lineTo(-0.63, -1.1);
  s.lineTo(-0.65, -0.98);
  s.quadraticCurveTo(-0.61, -0.3, -0.47, -0.1);
  s.quadraticCurveTo(-0.3, -0.04, -0.15, -0.02);
  const body = new THREE.Group();
  body.add(extrude(s, fabricMat(p.fabric), { ...EXTRUDE, depth: 0.08 }));

  const hood = new THREE.Shape();
  hood.moveTo(-0.27, -0.08);
  hood.quadraticCurveTo(-0.33, 0.36, 0, 0.37);
  hood.quadraticCurveTo(0.33, 0.36, 0.27, -0.08);
  hood.closePath();
  const hoodMesh = extrude(hood, fabricMat(p.fabric, 0.8));
  hoodMesh.position.z = -0.075;
  body.add(hoodMesh);

  const pocket = new THREE.Shape();
  pocket.moveTo(-0.26, -0.84);
  pocket.lineTo(0.26, -0.84);
  pocket.lineTo(0.31, -1.08);
  pocket.lineTo(-0.31, -1.08);
  pocket.closePath();
  const pocketMesh = extrude(pocket, fabricMat(p.fabric, 0.92), { ...EXTRUDE, depth: 0.008, bevelThickness: 0.008 });
  pocketMesh.position.z = FRONT_Z + 0.01;
  body.add(pocketMesh);

  // Tricolour cords: blue left, red right, white aglets.
  const z = FRONT_Z + 0.035;
  [[-0.07, TRICOLORE.bleu], [0.07, TRICOLORE.rouge]].forEach(([x, col]) => {
    body.add(tube([[x, -0.1, z], [x * 1.1, -0.25, z + 0.01], [x * 0.9, -0.4, z + 0.01]], 0.009, new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })));
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 10), new THREE.MeshStandardMaterial({ color: TRICOLORE.blanc, roughness: 0.4 }));
    tip.position.set(x * 0.9, -0.42, z + 0.01);
    body.add(tip);
  });

  const print = printFor(p, { logoSize: 0.24, memeW: 0.5, memeH: 0.38 });
  print.position.set(0, p.print.kind === 'logo' ? -0.58 : -0.6, FRONT_Z + 0.015);
  body.add(print);
  const t = tag();
  t.position.set(0.33, -1.17, FRONT_Z + 0.015);
  body.add(t);
  body.position.y = -0.13;
  return [body, hanger()];
}

function tote(p) {
  const s = new THREE.Shape();
  s.moveTo(-0.38, -0.32);
  s.lineTo(0.38, -0.32);
  s.lineTo(0.39, -1.2);
  s.lineTo(-0.39, -1.2);
  s.closePath();
  const body = new THREE.Group();
  body.add(extrude(s, fabricMat(p.fabric), { ...EXTRUDE, depth: 0.03, bevelThickness: 0.012 }));
  [[0.025, TRICOLORE.bleu], [-0.025, TRICOLORE.rouge]].forEach(([z, col]) => body.add(
    tube([[-0.2, -0.33, z], [-0.16, -0.08, z], [0, 0.0, z], [0.16, -0.08, z], [0.2, -0.33, z]], 0.016, fabricMat(col)),
  ));
  const print = printFor(p, { logoSize: 0.3, memeW: 0.66, memeH: 0.66 });
  print.position.set(0, -0.78, 0.03);
  body.add(print);
  const t = tag();
  t.position.set(0.29, -1.13, 0.031);
  body.add(t);
  body.position.y = -0.33;
  return [body, sHook(0.26)];
}

function cap(p) {
  const body = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), fabricMat(p.fabric));
  dome.scale.set(1, 0.82, 1.04);
  dome.castShadow = true;
  body.add(dome);
  const brimShape = new THREE.Shape();
  brimShape.moveTo(-0.2, 0);
  brimShape.quadraticCurveTo(-0.2, 0.26, 0, 0.27);
  brimShape.quadraticCurveTo(0.2, 0.26, 0.2, 0);
  brimShape.quadraticCurveTo(0, 0.07, -0.2, 0);
  const brim = extrude(brimShape, fabricMat(p.fabric, 0.9), { ...EXTRUDE, depth: 0.012, bevelThickness: 0.008, bevelSize: 0.008 });
  brim.rotation.x = Math.PI / 2;
  brim.position.set(0, 0.005, 0.16);
  body.add(brim);
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), fabricMat(p.fabric, 0.8));
  btn.position.y = 0.18;
  body.add(btn);
  const logo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2305, 0.2305, 0.11, 32, 1, true, -0.3, 0.6),
    new THREE.MeshStandardMaterial({ map: logoTexture(p.ink, 256), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  logo.position.y = 0.075;
  logo.scale.set(1, 1, 1.04);
  body.add(logo);
  // Tricolour patch on the side panel.
  const patch = tag();
  patch.scale.setScalar(0.7);
  const th = 0.95, el = 0.28, r = 0.224;
  patch.position.set(r * Math.sin(th) * Math.cos(el), r * Math.sin(el) * 0.82, r * Math.cos(th) * Math.cos(el) * 1.04);
  patch.lookAt(patch.position.clone().multiplyScalar(2));
  body.add(patch);
  body.rotation.x = 0.42;
  body.scale.setScalar(1.75);
  body.position.y = -0.6;
  return [body, sHook(0.2)];
}

const BUILDERS = { tee, hoodie, tote, cap };

export function buildProduct(p) {
  const pivot = new THREE.Group();
  const inner = new THREE.Group();
  const [body, hook] = BUILDERS[p.type](p);
  inner.add(body, hook);
  inner.position.y = -0.09;
  pivot.add(inner);
  const hit = [];
  body.traverse((o) => { if (o.isMesh) { o.userData.product = p.id; hit.push(o); } });
  return { pivot, body, hit };
}
