# CreAte by Costa · Handmade candle shop

A bilingual (Greek / English) online catalogue for CreAte by Costa. Customers browse candles, fill a basket and send their order through **Instagram** or **email**. There are no online payments: every order is confirmed personally.

The site is built with [Astro](https://astro.build) and is completely static. It needs no database, no server and no paid services.

---

## Quick start

```bash
npm install
npm run dev      # local preview at http://localhost:4321
npm run build    # production files in dist/
```

Greek is the main language (`/`, `/shop/`, …). English lives under `/en/` (`/en/`, `/en/shop/`, …).

---

## Everyday changes (no coding knowledge needed)

All the files you will normally touch are in `src/config`, `src/data` and `src/i18n`. Open them in any text editor, or edit them straight on GitHub (open the file, click the ✏️ pencil, change it, then **Commit changes**). The site rebuilds itself after each change if GitHub Pages is set up (see below).

### Instagram link, email address and other settings → `src/config/site.ts`

| Setting | What it does |
|---|---|
| `instagramUrl` | Link used everywhere for Instagram (header, footer, order button). |
| `instagramHandle` | The `@name` shown next to the Instagram icon. |
| `email` | **Change `YOUR_EMAIL@example.com` to your real address.** Email orders and contact messages go here. |
| `formspreeId` | Optional. Leave empty and the contact form opens the visitor's email app. To receive messages straight from the website, create a free form at [formspree.io](https://formspree.io), then paste its ID (the part after `/f/`). |
| `gallery` | Photos for the "Follow us on Instagram" section on the home page. |
| `testimonials` | Real customer reviews (only with their permission). The section stays hidden while this list is empty. |

### Products → `src/data/products.ts`

⚠ **The 8 products in the file are examples.** Replace them with your real candles, prices and descriptions before sharing the site.

Each product looks like this:

```ts
{
  id: 'vanilla-cloud',                    // unique, lowercase, dashes only; also the web address
  name: { el: 'Σύννεφο Βανίλιας', en: 'Vanilla Cloud' },
  short: { el: '…', en: '…' },            // one line for the shop card
  description: { el: '…', en: '…' },      // full text for the product page
  price: 14,                              // euros
  categories: ['scented', 'gifts'],       // ids from categories.ts
  availability: 'in_stock',               // 'in_stock' | 'made_to_order' | 'sold_out'
  featured: true,                         // show on the home page
  added: '2026-09-01',                    // used for "Newest" sorting
  images: ['/images/products/vanilla-1.jpg', '/images/products/vanilla-2.jpg'],
  art: { shape: 'jar', wax: '#FBEBC9', accent: '#DFB154', bg: 'butter' }, // illustration used when there are no photos
  options: [ /* sizes, scents, colours: see below */ ],
  notes: { el: '…', en: '…' },            // optional fragrance notes
  wax: { el: '…', en: '…' },              // optional; only shown when filled in
  dimensions: { el: '…', en: '…' },       // optional
  burnTime: { el: '…', en: '…' },         // optional
  weight: { el: '…', en: '…' },           // optional
  maxQty: 10,                             // optional; most a customer can order at once
}
```

- **Add a product:** copy an existing block (from `{` to `},`), paste it below, and change the values. Give it a new `id`.
- **Remove a product:** delete its block.
- **Mark as sold out:** set `availability: 'sold_out'`. It stays visible but cannot be ordered.
- **Change a price:** edit `price`. Basket totals update automatically.

**Options (sizes, scents, colours).** Customers must pick each `required` option before adding to the basket. `priceDelta` adds to the base price:

```ts
options: [
  {
    id: 'size',
    label: { el: 'Μέγεθος', en: 'Size' },
    required: true,
    values: [
      { id: 'small', label: { el: 'Μικρό', en: 'Small' } },
      { id: 'large', label: { el: 'Μεγάλο', en: 'Large' }, priceDelta: 6 }, // +€6
    ],
  },
],
```

### Photos

1. Put photos in `public/images/products/` (for products), `public/images/gallery/` (home page gallery) or `public/images/about/` (Our Story page).
2. Use square-ish JPG or WebP photos about **1200 px** wide and under **300 KB** each, so the site stays fast. Free tools like [Squoosh](https://squoosh.app) shrink them.
3. Reference them with a path that starts at `/images/…`, e.g. `images: ['/images/products/rose-1.jpg']`.

Until a product has photos, a soft pastel illustration is shown instead.

### Categories → `src/data/categories.ts`

Rename, add or remove categories here. Each has an `id` (used in products), a Greek and English name, a short description and a pastel `color` (`pink`, `lavender`, `butter`, `blue`, `peach`, `mint` or `beige`).

### Any text on the site → `src/i18n/ui.ts`

Every sentence, button and message exists twice: once in the `el` block (Greek) and once in the `en` block (English). Find the text you want to change and edit it in both blocks. Keep the key on the left (e.g. `'home.hero.title'`) unchanged.

Things worth filling in with your own words:
- `story.*` → the Our Story page (currently placeholder text in [brackets]).
- `faq.3.a` → how delivery or collection works, with costs and timings.

---

## How ordering works

1. Customers add candles to the basket. It's saved in their browser, so it survives page changes, language switches and later visits.
2. In the basket they choose **Order via Instagram** or **Order via Email**.
3. **Instagram:** a clear order summary appears with a *Copy* button. *Copy & open Instagram* copies it and opens your profile; the customer pastes it into a DM. Instagram does not allow pre-filled messages, so the customer always sends it themselves.
4. **Email:** the customer's email app opens with the subject *Νέα παραγγελία — CreAte by Costa* / *New Order — CreAte by Costa* and the full order. If it doesn't open, the summary is shown with a copy button.
5. Nothing is marked as "confirmed" and the basket is not emptied automatically. You confirm availability, payment and delivery personally.

Totals are labelled as an *estimated product total*, excluding any delivery costs.

---

## Publishing (free) with GitHub Pages

This repository includes `.github/workflows/deploy.yml`, which publishes the site automatically.

1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the *Deploy to GitHub Pages* workflow from the **Actions** tab).

The site appears at `https://<your-account>.github.io/CreAte-by-Costa/`. For a custom domain (e.g. `createbycosta.gr`), add it under **Settings → Pages → Custom domain**.

Other free hosts (Netlify, Cloudflare Pages, Vercel) also work: build command `npm run build`, output folder `dist`. Set the `SITE_URL` environment variable to your address for correct share links.

---

## Project structure

```
src/
  config/site.ts         Shop settings (Instagram, email, gallery, reviews)
  data/products.ts       Products
  data/categories.ts     Categories
  i18n/ui.ts             All Greek and English text
  views/                 Page layouts (Home, Shop, Product, Story, Contact, Basket)
  pages/                 Web addresses (Greek at /, English under /en/)
  components/            Header, footer, product card, logo, illustrations…
  scripts/               Basket, order summary and page interactions
  styles/global.css      Colours, fonts and shared styles
public/images/           Logo and photos
```
