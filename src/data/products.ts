/**
 * ─────────────────────────────────────────────────────────────
 *  PRODUCTS
 *  Every candle in the shop lives in this list. See README.md
 *  ("Adding or changing products") for a step-by-step guide.
 *
 *  ⚠ The products below are EXAMPLES so the shop has something
 *  to show. Replace names, prices, descriptions and details with
 *  your real candles before publishing.
 * ─────────────────────────────────────────────────────────────
 */
import type { PastelColor } from './categories';

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

const sizes: ProductOption = {
  id: 'size',
  label: { el: 'Μέγεθος', en: 'Size' },
  required: true,
  values: [
    { id: 'small', label: { el: 'Μικρό', en: 'Small' } },
    { id: 'large', label: { el: 'Μεγάλο', en: 'Large' }, priceDelta: 6 },
  ],
};

export const products: Product[] = [
  {
    id: 'vanilla-cloud',
    name: { el: 'Σύννεφο Βανίλιας', en: 'Vanilla Cloud' },
    short: { el: 'Απαλό, γλυκό άρωμα βανίλιας σε κρεμ βαζάκι.', en: 'Soft, sweet vanilla in a creamy little jar.' },
    description: {
      el: 'Ένα τρυφερό κερί σε κρεμ βαζάκι, για ήσυχα βράδια με ένα βιβλίο και μια κούπα τσάι. Το άρωμα της βανίλιας γεμίζει απαλά τον χώρο χωρίς να είναι έντονο.',
      en: 'A gentle candle in a creamy jar, made for quiet evenings with a book and a cup of tea. The vanilla scent softly fills the room without being overpowering.',
    },
    price: 14,
    categories: ['scented'],
    availability: 'in_stock',
    featured: true,
    added: '2026-09-01',
    images: [],
    art: { shape: 'jar', wax: '#FBEBC9', accent: '#DFB154', bg: 'butter' },
    options: [sizes],
    notes: { el: 'Βανίλια, γάλα, ελαφριά καραμέλα', en: 'Vanilla, milk, a hint of caramel' },
  },
  {
    id: 'rose-blush',
    name: { el: 'Ροζ Τριαντάφυλλο', en: 'Rose Blush' },
    short: { el: 'Ρομαντικό τριαντάφυλλο σε ροζ απόχρωση.', en: 'Romantic rose in a blush-pink pour.' },
    description: {
      el: 'Ένα ρομαντικό ροζ κερί με λουλουδένιο άρωμα, ιδανικό για το κομοδίνο ή ως δώρο σε κάποιον που αγαπάς.',
      en: 'A romantic pink candle with a floral scent, lovely on a bedside table or as a gift for someone you love.',
    },
    price: 16,
    categories: ['scented', 'gifts'],
    availability: 'in_stock',
    featured: true,
    added: '2026-08-15',
    images: [],
    art: { shape: 'jar', wax: '#F6D3D8', accent: '#E8A9B4', bg: 'pink' },
    options: [sizes],
    notes: { el: 'Τριαντάφυλλο, παιώνια, λευκός μόσχος', en: 'Rose, peony, white musk' },
  },
  {
    id: 'lavender-dreams',
    name: { el: 'Όνειρα Λεβάντας', en: 'Lavender Dreams' },
    short: { el: 'Χαλαρωτική λεβάντα για ήρεμα βράδια.', en: 'Calming lavender for slow evenings.' },
    description: {
      el: 'Ένα κερί σε απαλό λιλά, με άρωμα λεβάντας που σε βοηθά να χαλαρώσεις στο τέλος της μέρας.',
      en: 'A soft lilac candle with a lavender scent to help you unwind at the end of the day.',
    },
    price: 15,
    categories: ['scented'],
    availability: 'in_stock',
    featured: true,
    added: '2026-07-20',
    images: [],
    art: { shape: 'tin', wax: '#E6DCF3', accent: '#B9A6DA', bg: 'lavender' },
  },
  {
    id: 'sweet-peach',
    name: { el: 'Γλυκό Ροδάκινο', en: 'Sweet Peach' },
    short: { el: 'Φρουτώδες, καλοκαιρινό και χαρούμενο.', en: 'Fruity, summery and cheerful.' },
    description: {
      el: 'Ένα χαρούμενο κερί σε απόχρωση ροδάκινου, με φρουτώδες άρωμα που θυμίζει καλοκαιρινά απογεύματα.',
      en: 'A cheerful peach-toned candle with a fruity scent that brings back summer afternoons.',
    },
    price: 13,
    categories: ['scented', 'new'],
    availability: 'made_to_order',
    added: '2026-10-05',
    images: [],
    art: { shape: 'jar', wax: '#FADBC8', accent: '#F0B08F', bg: 'peach' },
    options: [
      {
        id: 'scent',
        label: { el: 'Άρωμα', en: 'Scent' },
        required: true,
        values: [
          { id: 'peach', label: { el: 'Ροδάκινο', en: 'Peach' } },
          { id: 'apricot', label: { el: 'Βερίκοκο', en: 'Apricot' } },
          { id: 'mango', label: { el: 'Μάνγκο', en: 'Mango' } },
        ],
      },
    ],
  },
  {
    id: 'bubble-cube',
    name: { el: 'Κυβάκι Φυσαλίδα', en: 'Bubble Cube' },
    short: { el: 'Διακοσμητικό κερί-κύβος σε παστέλ χρώματα.', en: 'A decorative bubble cube in pastel shades.' },
    description: {
      el: 'Ένα παιχνιδιάρικο διακοσμητικό κερί σε σχήμα κύβου με φυσαλίδες. Ομορφαίνει ράφια και τραπεζάκια, αναμμένο ή όχι.',
      en: 'A playful decorative candle shaped like a bubble cube. It brightens up shelves and side tables, lit or not.',
    },
    price: 9,
    categories: ['new', 'gifts'],
    availability: 'in_stock',
    featured: true,
    added: '2026-10-12',
    images: [],
    art: { shape: 'bubble', wax: '#D6E6F2', accent: '#A9C6DE', bg: 'blue' },
    options: [
      {
        id: 'color',
        label: { el: 'Χρώμα', en: 'Colour' },
        required: true,
        values: [
          { id: 'blue', label: { el: 'Γαλάζιο', en: 'Powder blue' } },
          { id: 'pink', label: { el: 'Ροζ', en: 'Pink' } },
          { id: 'lilac', label: { el: 'Λιλά', en: 'Lilac' } },
          { id: 'mint', label: { el: 'Μέντα', en: 'Mint' } },
        ],
      },
    ],
  },
  {
    id: 'little-heart',
    name: { el: 'Μικρή Καρδούλα', en: 'Little Heart' },
    short: { el: 'Ένα τρυφερό κερί-καρδιά για δώρο.', en: 'A sweet heart-shaped candle for gifting.' },
    description: {
      el: 'Ένα μικρό κερί σε σχήμα καρδιάς, ιδανικό για μπομπονιέρα, κάρτα ευχών ή απλώς για να πεις «σε σκέφτομαι».',
      en: 'A little heart-shaped candle, perfect as a favour, alongside a card, or simply to say “thinking of you”.',
    },
    price: 6,
    categories: ['gifts'],
    availability: 'in_stock',
    added: '2026-06-10',
    images: [],
    art: { shape: 'heart', wax: '#F6D3D8', accent: '#E8A9B4', bg: 'pink' },
    maxQty: 30,
  },
  {
    id: 'autumn-cinnamon',
    name: { el: 'Φθινοπωρινή Κανέλα', en: 'Autumn Cinnamon' },
    short: { el: 'Ζεστή κανέλα για τις κρύες μέρες.', en: 'Warm cinnamon for chilly days.' },
    description: {
      el: 'Ένα ζεστό, φθινοπωρινό κερί με άρωμα κανέλας και μπαχαρικών, για να νιώθεις το σπίτι πιο φιλόξενο.',
      en: 'A warm autumn candle with cinnamon and spice, to make your home feel extra welcoming.',
    },
    price: 17,
    categories: ['seasonal', 'scented'],
    availability: 'in_stock',
    featured: true,
    added: '2026-09-25',
    images: [],
    art: { shape: 'pillar', wax: '#EADFCF', accent: '#C9A27E', bg: 'beige' },
    notes: { el: 'Κανέλα, γαρίφαλο, πορτοκάλι', en: 'Cinnamon, clove, orange' },
  },
  {
    id: 'mint-garden',
    name: { el: 'Κήπος Μέντας', en: 'Mint Garden' },
    short: { el: 'Δροσερό, πράσινο και ανάλαφρο.', en: 'Fresh, green and light.' },
    description: {
      el: 'Ένα δροσερό κερί σε απαλό πράσινο, εμπνευσμένο από ανοιξιάτικους κήπους.',
      en: 'A fresh candle in soft green, inspired by spring gardens.',
    },
    price: 14,
    categories: ['seasonal'],
    availability: 'sold_out',
    added: '2026-04-02',
    images: [],
    art: { shape: 'tin', wax: '#D7EEDF', accent: '#9FCDB0', bg: 'mint' },
  },
];

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
