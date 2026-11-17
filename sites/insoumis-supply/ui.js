// DOM layer: product HUD, cart drawer, list view, section nav, progress rail.
import { PRODUCTS, SECTIONS } from './products.js';

const $ = (id) => document.getElementById(id);
const euro = (n) => `${n.toLocaleString('fr-FR')} €`;
const STORE_KEY = 'insoumis-supply-cart';

function sectionOf(index) {
  let s = SECTIONS[0];
  for (const sec of SECTIONS) if (index >= sec.from) s = sec;
  return s;
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function saveCart(cart) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch { /* private mode */ }
}

export function createUI({ onJump, onAdded, onListToggle }) {
  const cart = loadCart();
  const chosenSize = Object.fromEntries(PRODUCTS.map((p) => [p.id, p.sizes.includes('M') ? 'M' : p.sizes[0]]));
  let current = -1;
  let currentSection = null;
  let lastFocus = null;

  /* ---------- Nav + progress ---------- */
  const nav = $('sectionNav');
  SECTIONS.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = s.label;
    b.dataset.section = s.id;
    b.addEventListener('click', () => onJump(s.from));
    nav.appendChild(b);
  });
  const ticks = $('progressTicks');
  const tickEls = PRODUCTS.map(() => ticks.appendChild(document.createElement('i')));

  function setTicks(positions) {
    positions.forEach((pct, i) => { tickEls[i].style.top = `${pct * 100}%`; });
  }

  function setProgress(pct) {
    $('progressFill').style.height = `${Math.max(0, Math.min(1, pct)) * 100}%`;
  }

  /* ---------- HUD ---------- */
  const hud = $('hud');
  const sizesEl = $('hudSizes');

  function renderSizes(p) {
    sizesEl.innerHTML = '';
    p.sizes.forEach((size) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = size;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(chosenSize[p.id] === size));
      b.addEventListener('click', () => { chosenSize[p.id] = size; renderSizes(p); });
      sizesEl.appendChild(b);
    });
  }

  function setFocus(index, visible) {
    hud.classList.toggle('is-on', visible);
    if (!visible || index === current) return;
    current = index;
    const p = PRODUCTS[index];
    $('hudIndex').textContent = `${String(index + 1).padStart(2, '0')} / ${String(PRODUCTS.length).padStart(2, '0')}`;
    const sec = sectionOf(index);
    $('hudSection').textContent = sec.label;
    const name = $('hudName');
    name.textContent = p.name;
    name.classList.remove('swap');
    void name.offsetWidth;
    name.classList.add('swap');
    $('hudTag').textContent = p.tag;
    $('hudPrice').textContent = euro(p.price);
    renderSizes(p);
    tickEls.forEach((t, i) => t.classList.toggle('is-active', i === index));
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.section === sec.id));
    if (currentSection && currentSection !== sec.id) flash(sec.label);
    currentSection = sec.id;
  }

  function flash(label) {
    const el = $('sectionFlash');
    el.textContent = label;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
  }

  /* ---------- Cart ---------- */
  function add(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    const size = chosenSize[id];
    const line = cart.find((l) => l.id === id && l.size === size);
    if (line) line.qty += 1; else cart.push({ id, size, qty: 1 });
    saveCart(cart);
    renderCart();
    const btn = $('cartBtn');
    btn.classList.remove('bump');
    void btn.offsetWidth;
    btn.classList.add('bump');
    onAdded(PRODUCTS.indexOf(p));
  }

  function total() {
    return cart.reduce((sum, l) => sum + PRODUCTS.find((p) => p.id === l.id).price * l.qty, 0);
  }

  function renderCart() {
    const count = cart.reduce((n, l) => n + l.qty, 0);
    $('cartCount').textContent = count;
    $('cartTotal').textContent = euro(total());
    $('finaleTotal').textContent = euro(total());
    const list = $('cartItems');
    list.innerHTML = '';
    if (!cart.length) {
      list.innerHTML = '<li class="cart__empty">Ton panier est vide. Le dressing t\'attend.</li>';
      return;
    }
    cart.forEach((l, idx) => {
      const p = PRODUCTS.find((x) => x.id === l.id);
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="cart__swatch" style="background:${p.fabric}"></span>
        <div><strong>${p.name}</strong><small>Taille ${l.size} · ${euro(p.price)}</small></div>
        <div class="cart__qty">
          <button type="button" aria-label="Retirer un exemplaire">−</button>
          <span>${l.qty}</span>
          <button type="button" aria-label="Ajouter un exemplaire">+</button>
        </div>`;
      const [minus, plus] = li.querySelectorAll('button');
      minus.addEventListener('click', () => { l.qty -= 1; if (l.qty <= 0) cart.splice(idx, 1); saveCart(cart); renderCart(); });
      plus.addEventListener('click', () => { l.qty += 1; saveCart(cart); renderCart(); });
      list.appendChild(li);
    });
  }

  const cartEl = $('cart');
  function openCart() {
    lastFocus = document.activeElement;
    cartEl.hidden = false;
    cartEl.querySelector('[data-close].btn').focus();
  }
  function closeCart() {
    cartEl.hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  cartEl.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeCart));
  $('cartBtn').addEventListener('click', openCart);
  $('finaleCart').addEventListener('click', openCart);
  $('hudAdd').addEventListener('click', () => { if (current >= 0) add(PRODUCTS[current].id); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!cartEl.hidden) closeCart(); else if (!listEl.hidden) toggleList(false); } });

  /* ---------- List view ---------- */
  const listEl = $('listView');
  const grid = $('listGrid');
  PRODUCTS.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__visual" style="background:${p.fabric};color:${p.ink}">${p.print.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="card__body">
        <h3 class="card__name">${p.name}</h3>
        <span class="card__price">${euro(p.price)}</span>
        <button class="btn btn--add" type="button">Ajouter +</button>
        <button class="btn btn--ghost" type="button">Voir dans le dressing →</button>
      </div>`;
    const [addBtn, seeBtn] = card.querySelectorAll('button');
    addBtn.addEventListener('click', () => add(p.id));
    seeBtn.addEventListener('click', () => { toggleList(false); onJump(i); });
    grid.appendChild(card);
  });

  const listToggle = $('listToggle');
  function toggleList(force) {
    const open = typeof force === 'boolean' ? force : listEl.hidden;
    listEl.hidden = !open;
    listToggle.setAttribute('aria-pressed', String(open));
    listToggle.textContent = open ? 'Vue 3D' : 'Vue liste';
    onListToggle(open);
  }
  listToggle.addEventListener('click', () => toggleList());

  renderCart();

  return {
    setFocus,
    setProgress,
    setTicks,
    toggleList,
    isBusy: () => !cartEl.hidden || !listEl.hidden,
    hideListToggle: () => { listToggle.hidden = true; },
  };
}
