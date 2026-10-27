/**
 * ─────────────────────────────────────────────────────────────
 *  PRODUCTS
 *  The candles themselves live in products.json. The easiest way
 *  to add, edit or remove them is the admin page (/admin/).
 *  This file describes what a product looks like and checks the
 *  list when the site is built. See README.md for details.
 *
 *  ⚠ The products in products.json are EXAMPLES so the shop has
 *  something to show. Replace them with your real candles before
 *  publishing.
 * ─────────────────────────────────────────────────────────────
 */
import { categories, type PastelColor } from './categories';
import data from './products.json';

type T = { el: string; en: string };

export type Availability = 'in_stock' | 'made_to_order' | 'sold_out';

export interface ProductOptionValue {
  id: string;
  label: T;
  /** Extra cost added to the base price for this choice (e.g. a bigger size). */
  priceDelta?: number;
}

export interface ProductOption {
  id: string;
  label: T;
  /** Customers must pick a value before adding to the basket. */
  required: boolean;
  values: ProductOptionValue[];
}

export interface Product {
  /** Unique, never changes. Lowercase letters, numbers and dashes. Also used in the web address. */
  id: string;
  name: T;
  short: T;
  description: T;
  /** Base price in euros. */
  price: number;
  /** Category ids from categories.ts. A candle can be in several. */
  categories: string[];
  availability: Availability;
  featured?: boolean;
  /** Date added (YYYY-MM-DD), used for "Newest" sorting. */
  added: string;
  /** Photos in public/images/products/. The first one is the main photo. */
  images: string[];
  /** Used to draw an illustration when there are no photos yet. */
  art: { shape: 'jar' | 'pillar' | 'tin' | 'bubble' | 'heart'; wax: string; accent: string; bg: PastelColor };
  options?: ProductOption[];
  /** Optional details: shown only when filled in. */
  notes?: T;
  wax?: T;
  dimensions?: T;
  burnTime?: T;
  weight?: T;
  /** Most a customer can order in one go. Defaults to 10. */
  maxQty?: number;
}

const productIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Stops the build with a clear message instead of publishing a broken shop. */
function checkProducts(list: Product[]): Product[] {
  const seen = new Set<string>();
  const categoryIds = new Set(categories.map((c) => c.id));
  for (const p of list) {
    const where = `products.json → "${p.id}"`;
    if (!productIdPattern.test(p.id)) throw new Error(`${where}: id must use lowercase letters, numbers and dashes.`);
    if (seen.has(p.id)) throw new Error(`${where}: this id is used by more than one product.`);
    seen.add(p.id);
    if (!p.name?.el || !p.name?.en) throw new Error(`${where}: name needs Greek and English.`);
    if (typeof p.price !== 'number' || !(p.price >= 0)) throw new Error(`${where}: price must be a number.`);
    const unknown = p.categories.filter((c) => !categoryIds.has(c));
    if (unknown.length) throw new Error(`${where}: unknown categories ${unknown.join(', ')} (see categories.ts).`);
  }
  return list;
}

export const products: Product[] = checkProducts(data as Product[]);

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
