/**
 * The shopping basket. It stores only product ids, chosen options and
 * quantities in the browser (localStorage); names and prices always come
 * from products.ts, so they stay correct in both languages.
 */
import { findProduct, cleanSelection, maxQty, unitPrice, type Selection } from './catalog';

export interface BasketItem { id: string; options: Selection; qty: number }
export interface BasketLine extends BasketItem {
  key: string;
  product: NonNullable<ReturnType<typeof findProduct>>;
  unit: number;
  total: number;
  orderable: boolean;
}

const STORAGE_KEY = 'cbc-basket-v1';
type Listener = (items: BasketItem[]) => void;
const listeners = new Set<Listener>();
let items: BasketItem[] = load();

export function keyOf(id: string, options: Selection): string {
  const opts = Object.keys(options).sort().map((k) => `${k}=${options[k]}`).join(';');
  return `${id}|${opts}`;
}

function sanitize(raw: unknown): BasketItem[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, BasketItem>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, options, qty } = entry as Partial<BasketItem>;
    const product = typeof id === 'string' ? findProduct(id) : undefined;
    if (!product) continue;
    const clean = cleanSelection(product, (options && typeof options === 'object' ? options : {}) as Selection);
    if (!clean) continue;
    const n = Math.floor(Number(qty));
    if (!Number.isFinite(n) || n < 1) continue;
    const key = keyOf(product.id, clean);
    const prev = merged.get(key);
    merged.set(key, { id: product.id, options: clean, qty: Math.min(maxQty(product), (prev?.qty ?? 0) + n) });
  }
  return [...merged.values()];
}

function load(): BasketItem[] {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Private mode or storage full: the basket still works for this visit. */
  }
  listeners.forEach((fn) => fn(items));
}

export function getItems(): BasketItem[] {
  return items;
}

export function count(): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

export function lines(): BasketLine[] {
  return items.map((item) => {
    const product = findProduct(item.id)!;
    const unit = unitPrice(product, item.options);
    return {
      ...item,
      key: keyOf(item.id, item.options),
      product,
      unit,
      total: Math.round(unit * item.qty * 100) / 100,
      orderable: product.availability !== 'sold_out',
    };
  });
}

export function subtotal(): number {
  return Math.round(lines().reduce((sum, l) => sum + l.total, 0) * 100) / 100;
}

export type AddResult = { ok: true; qty: number } | { ok: false; reason: 'unknown' | 'sold_out' | 'options' | 'qty' | 'max'; max?: number };

export function add(id: string, options: Selection, qty = 1): AddResult {
  const product = findProduct(id);
  if (!product) return { ok: false, reason: 'unknown' };
  if (product.availability === 'sold_out') return { ok: false, reason: 'sold_out' };
  const clean = cleanSelection(product, options);
  if (!clean) return { ok: false, reason: 'options' };
  const max = maxQty(product);
  if (!Number.isInteger(qty) || qty < 1 || qty > max) return { ok: false, reason: 'qty', max };
  const key = keyOf(id, clean);
  const existing = items.find((i) => keyOf(i.id, i.options) === key);
  if (existing) {
    if (existing.qty >= max) return { ok: false, reason: 'max', max };
    existing.qty = Math.min(max, existing.qty + qty);
  } else {
    items.push({ id, options: clean, qty });
  }
  save();
  return { ok: true, qty: existing?.qty ?? qty };
}

export function setQty(key: string, qty: number) {
  const item = items.find((i) => keyOf(i.id, i.options) === key);
  if (!item) return;
  const product = findProduct(item.id)!;
  const n = Math.floor(qty);
  if (!Number.isFinite(n)) return;
  if (n < 1) return remove(key);
  item.qty = Math.min(maxQty(product), n);
  save();
}

export function remove(key: string) {
  items = items.filter((i) => keyOf(i.id, i.options) !== key);
  save();
}

export function clear() {
  items = [];
  save();
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Keep several open tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  items = load();
  listeners.forEach((fn) => fn(items));
});
