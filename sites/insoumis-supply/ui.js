// DOM layer: product bar, cart drawer, no-WebGL list fallback, progress line.
import { PRODUCTS } from './products.js';

const $ = (id) => document.getElementById(id);
const euro = (n) => `${n.toLocaleString('fr-FR')} €`;
const STORE_KEY = 'maison-insoumise-cart';

function loadCart() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function saveCart(cart) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch { /* private mode */ }
}

export function createUI({ onJump, onAdded }) {
  const cart = loadCart().filter((l) => PRODUCTS.some((p) => p.id === l.id));
  const chosenSize = Object.fromEntries(PRODUCTS.map((p) => [p.id, p.sizes.includes('M') ? 'M' : p.sizes[0]]));
  let current = -1;
  let lastFocus = null;

  /* ---------- Product bar ---------- */
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
    const name = $('hudName');
    name.textContent = p.name;
    name.classList.remove('swap');
    void name.offsetWidth;
    name.classList.add('swap');
    $('hudPrice').textContent = euro(p.price);
    $('hudDetail').textContent = p.detail;
    renderSizes(p);
  }

  const setProgress = (pct) => { $('progressFill').style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`; };

  /* ---------- Cart ---------- */
  const total = () => cart.reduce((sum, l) => sum + PRODUCTS.find((p) => p.id === l.id).price * l.qty, 0);

  function add(id, button) {
    const size = chosenSize[id];
    const line = cart.find((l) => l.id === id && l.size === size);
    if (line) line.qty += 1; else cart.push({ id, size, qty: 1 });
    saveCart(cart);
    renderCart();
    if (button) {
      const label = button.textContent;
      button.classList.remove('added');
      void button.offsetWidth;
      button.classList.add('added');
      button.textContent = 'Ajouté';
      setTimeout(() => { button.textContent = label; }, 1200);
    }
    onAdded(PRODUCTS.findIndex((p) => p.id === id));
  }

  function renderCart() {
    $('cartCount').textContent = cart.reduce((n, l) => n + l.qty, 0);
    $('cartTotal').textContent = euro(total());
    $('finaleTotal').textContent = euro(total());
    const list = $('cartItems');
    list.innerHTML = '';
    if (!cart.length) {
      list.innerHTML = '<li class="cart__empty">Votre panier est vide.</li>';
      return;
    }
    cart.forEach((l, idx) => {
      const p = PRODUCTS.find((x) => x.id === l.id);
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="cart__swatch" style="background:${p.fabric}"></span>
        <div><strong></strong><small>Taille ${l.size} · ${euro(p.price)}</small></div>
        <div class="cart__qty">
          <button type="button" aria-label="Retirer un exemplaire">−</button>
          <span>${l.qty}</span>
          <button type="button" aria-label="Ajouter un exemplaire">+</button>
        </div>`;
      li.querySelector('strong').textContent = p.name;
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
    $('cartClose').focus();
  }
  function closeCart() {
    cartEl.hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  cartEl.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeCart));
  $('cartBtn').addEventListener('click', openCart);
  $('finaleCart').addEventListener('click', openCart);
  $('hudAdd').addEventListener('click', (e) => { if (current >= 0) add(PRODUCTS[current].id, e.currentTarget); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cartEl.hidden) closeCart(); });

  /* ---------- List fallback ---------- */
  const listEl = $('listView');
  function showList() {
    const grid = $('listGrid');
    PRODUCTS.forEach((p) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="card__visual" style="background:${p.fabric};color:${p.ink}"></div>
        <h3 class="card__name"></h3>
        <span class="card__price">${euro(p.price)}</span>
        <button class="cta" type="button">Ajouter au panier</button>`;
      card.querySelector('.card__visual').textContent = p.print.kind === 'meme' ? p.print.lines.join(' ') : '';
      card.querySelector('.card__name').textContent = p.name;
      card.querySelector('button').addEventListener('click', (e) => add(p.id, e.currentTarget));
      grid.appendChild(card);
    });
    listEl.hidden = false;
  }

  renderCart();

  return {
    setFocus,
    setProgress,
    showList,
    isBusy: () => !cartEl.hidden || !listEl.hidden,
    jump: onJump,
  };
}
