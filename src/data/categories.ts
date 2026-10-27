/**
 * ─────────────────────────────────────────────────────────────
 *  PRODUCT CATEGORIES
 *  Add, rename or remove categories here. The "id" is used in
 *  products.ts, so if you change an id, update the products too.
 *  color: one of pink | lavender | butter | blue | peach | mint | beige
 * ─────────────────────────────────────────────────────────────
 */

export type PastelColor = 'pink' | 'lavender' | 'butter' | 'blue' | 'peach' | 'mint' | 'beige';

/** The actual colour behind each pastel name (same as in global.css). */
export const pastelHex: Record<PastelColor, string> = {
  pink: '#f8dde1', lavender: '#e8e0f4', butter: '#fcefc4', blue: '#dceaf5', peach: '#fbe3d3', mint: '#ddf0e3', beige: '#efe5d6',
};

export interface Category {
  id: string;
  name: { el: string; en: string };
  description: { el: string; en: string };
  color: PastelColor;
}

export const categories: Category[] = [
  {
    id: 'scented',
    name: { el: 'Αρωματικά κεριά', en: 'Scented Candles' },
    description: { el: 'Ζεστά αρώματα για κάθε γωνιά του σπιτιού.', en: 'Cozy scents for every corner of your home.' },
    color: 'pink',
  },
  {
    id: 'new',
    name: { el: 'Νέες δημιουργίες', en: 'New Arrivals' },
    description: { el: 'Τα πιο φρέσκα κεριά από το εργαστήρι μας.', en: 'The latest candles fresh from our workshop.' },
    color: 'mint',
  },
  {
    id: 'gifts',
    name: { el: 'Συλλογή δώρων', en: 'Gift Collection' },
    description: { el: 'Μικρά δώρα που λένε πολλά.', en: 'Little gifts that say a lot.' },
    color: 'lavender',
  },
  {
    id: 'seasonal',
    name: { el: 'Εποχιακή συλλογή', en: 'Seasonal Collection' },
    description: { el: 'Κεριά εμπνευσμένα από κάθε εποχή.', en: 'Candles inspired by every season.' },
    color: 'butter',
  },
];

/** The label for "show everything" in the shop filter. */
export const allCategoriesLabel = { el: 'Όλα τα κεριά', en: 'All Candles' };
