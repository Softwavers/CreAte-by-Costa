import { products, type Product } from '../data/products';
import type { Lang } from '../i18n/ui';

export type Selection = Record<string, string>;

const byId = new Map(products.map((p) => [p.id, p]));

export function findProduct(id: string): Product | undefined {
  return byId.get(id);
}

export function maxQty(product: Product): number {
  return product.maxQty ?? 10;
}

export function isOrderable(product: Product): boolean {
  return product.availability !== 'sold_out';
}

/** Base price plus any extra cost from the chosen options. */
export function unitPrice(product: Product, selection: Selection): number {
  let price = product.price;
  for (const opt of product.options ?? []) {
    const value = opt.values.find((v) => v.id === selection[opt.id]);
    price += value?.priceDelta ?? 0;
  }
  return Math.round(price * 100) / 100;
}

/** Keeps only valid choices; returns null if a required option is missing. */
export function cleanSelection(product: Product, selection: Selection): Selection | null {
  const clean: Selection = {};
  for (const opt of product.options ?? []) {
    const chosen = selection[opt.id];
    if (chosen && opt.values.some((v) => v.id === chosen)) clean[opt.id] = chosen;
    else if (opt.required) return null;
  }
  return clean;
}

/** e.g. [["Size", "Large"], ["Scent", "Vanilla"]] in the chosen language. */
export function selectionLabels(product: Product, selection: Selection, lang: Lang): [string, string][] {
  const out: [string, string][] = [];
  for (const opt of product.options ?? []) {
    const value = opt.values.find((v) => v.id === selection[opt.id]);
    if (value) out.push([opt.label[lang], value.label[lang]]);
  }
  return out;
}
