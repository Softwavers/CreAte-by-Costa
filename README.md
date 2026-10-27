# CreAte by Costa · Handmade candle shop

A bilingual (Greek / English) online catalogue for CreAte by Costa. Customers browse candles, fill a basket and send their order through **Instagram** or **email**. There are no online payments: every order is confirmed personally.

The site is built with [Astro](https://astro.build) and is completely static. It needs no database, no server and no paid services. The shop owner manages products on a private [admin page](#the-admin-page) that saves straight to GitHub.

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

Products are managed on the [admin page](#the-admin-page). Everything else you will normally touch is in `src/config`, `src/data` and `src/i18n`. Open them in any text editor, or edit them straight on GitHub (open the file, click the ✏️ pencil, change it, then **Commit changes**). The site rebuilds itself after each change if GitHub Pages is set up (see below).

### Instagram link, email address and other settings → `src/config/site.ts`

| Setting | What it does |
|---|---|
| `instagramUrl` | Link used everywhere for Instagram (header, footer, order button). |
| `instagramHandle` | The `@name` shown next to the Instagram icon. |
| `email` | **Change `Createbycosta@hotmail.com` to your real address.** Email orders and contact messages go here. |
| `formspreeId` | Optional. Leave empty and the contact form opens the visitor's email app. To receive messages straight from the website, create a free form at [formspree.io](https://formspree.io), then paste its ID (the part after `/f/`). |
| `gallery` | Photos for the "Follow us on Instagram" section on the home page. |
| `testimonials` | Real customer reviews (only with their permission). The section stays hidden while this list is empty. |

### Products → the admin page (`/admin/`)

⚠ **The 8 products in the shop are examples.** Replace them with your real candles, prices and descriptions before sharing the site.

The easiest way to manage products is the admin page at `/admin/` (for example `https://createbycosta.gr/admin/`). There you can add, edit, duplicate, reorder and delete products, upload photos, set options (sizes, scents, colours) and mark candles as sold out, in Greek or English. See [The admin page](#the-admin-page) below for the one-time setup.

Changes stay in your browser until you press **Publish**. Publishing saves everything to GitHub at once, and the site updates itself about 1–2 minutes later. Products you've added or changed are marked *New* / *Changed* until then.

<details>
<summary>Editing products by hand instead</summary>

Products are stored in `src/data/products.json` (the admin page edits this same file). Each product looks like this:

```json
{
  "id": "vanilla-cloud",
  "name": { "el": "Σύννεφο Βανίλιας", "en": "Vanilla Cloud" },
  "short": { "el": "…", "en": "…" },
  "description": { "el": "…", "en": "…" },
  "price": 14,
  "categories": ["scented", "gifts"],
  "availability": "in_stock",
  "featured": true,
  "added": "2026-09-01",
  "images": ["/images/products/vanilla-1.webp"],
  "art": { "shape": "jar", "wax": "#FBEBC9", "accent": "#DFB154", "bg": "butter" },
  "options": [
    {
      "id": "size",
      "label": { "el": "Μέγεθος", "en": "Size" },
      "required": true,
      "values": [
        { "id": "small", "label": { "el": "Μικρό", "en": "Small" } },
        { "id": "large", "label": { "el": "Μεγάλο", "en": "Large" }, "priceDelta": 6 }
      ]
    }
  ],
  "notes": { "el": "…", "en": "…" },
  "maxQty": 10
}
```

- `id`: unique, lowercase, dashes only; also the web address. Don't change it once the product is live.
- `availability`: `in_stock`, `made_to_order` or `sold_out` (sold-out products stay visible but can't be ordered).
- `featured`: show on the home page. `added`: used for "Newest" sorting.
- `art`: the illustration shown while there are no photos (`shape`: `jar`, `pillar`, `tin`, `bubble` or `heart`).
- Optional, shown only when filled in: `notes`, `wax`, `dimensions`, `burnTime`, `weight`, `maxQty` (defaults to 10).
- `priceDelta` adds to the base price for that choice. Customers must pick each `required` option before adding to the basket.

The types are described in `src/data/products.ts`, which also stops the build with a clear message if a product is broken (for example two products with the same `id`).
</details>

### Photos

**Product photos:** upload them in the admin page. They're shrunk automatically and saved in `public/images/products/`; photos of deleted products are removed too.

**Other photos:**

1. Put photos in `public/images/gallery/` (home page gallery) or `public/images/about/` (Our Story page).
2. Use square-ish JPG or WebP photos about **1200 px** wide and under **300 KB** each, so the site stays fast. Free tools like [Squoosh](https://squoosh.app) shrink them.
3. Reference them with a path that starts at `/images/…`, e.g. `'/images/gallery/candles-1.jpg'`.

Until a product has photos, a soft pastel illustration is shown instead.

### Categories → `src/data/categories.ts`

Rename, add or remove categories here (the admin page shows whatever is in this file). Each has an `id` (used in products), a Greek and English name, a short description and a pastel `color` (`pink`, `lavender`, `butter`, `blue`, `peach`, `mint` or `beige`).

### Any text on the site → `src/i18n/ui.ts`

Every sentence, button and message exists twice: once in the `el` block (Greek) and once in the `en` block (English). Find the text you want to change and edit it in both blocks. Keep the key on the left (e.g. `'home.hero.title'`) unchanged.

Things worth filling in with your own words:
- `story.*` → the Our Story page (currently placeholder text in [brackets]).
- `faq.3.a` → how delivery or collection works, with costs and timings.

---

## The admin page

`/admin/` is a private page where the shop owner manages products. It isn't linked anywhere on the shop and search engines are asked not to list it.

The site has no server, so the admin page saves straight to this GitHub repository. Logging in uses a **GitHub access key** (a "fine-grained personal access token"), not a password. Anyone with the key can change the shop, so treat it like a password.

### One-time setup

1. **A GitHub account with write access.** The owner needs a GitHub account that can push to this repository. In the `Softwavers` organisation, add them as a member with *Write* access to `CreAte-by-Costa`. Fine-grained keys only work for organisation members. If the owner is added as an *outside collaborator* instead, use a classic token with the `public_repo` scope (*Settings → Developer settings → Personal access tokens → Tokens (classic)*); the admin page accepts either.
2. **Allow fine-grained keys in the organisation** (organisation owner, once): *Organization settings → Personal access tokens → Settings*. Allow fine-grained tokens. If "Require administrator approval" is on, approve each new key under *Pending requests*.
3. **Create the key.** On `/admin/`, open *Where do I get my key?*. The link there opens GitHub's "new token" page with the name, expiry and permissions already filled in. Check that:
   - **Resource owner** is `Softwavers`
   - **Repository access** is *Only select repositories* → `CreAte-by-Costa`
   - **Permissions → Repository:** *Contents: Read and write* (required) and *Actions: Read-only* (optional: lets the admin page show when the site has finished updating)

   Press *Generate token* and copy it.
4. **Log in** on `/admin/` by pasting the key. Tick *Remember me on this device* to stay logged in on that phone or computer. *Log out* forgets it.

Keys expire (at most after a year). When that happens the admin page says the key isn't right; create a new one the same way. If a key is lost or leaked, delete it on GitHub (*Settings → Developer settings → Personal access tokens*) and make a new one.

### How saving works

- Edits, new products, reordering and deletions are kept in the browser and marked *New* / *Changed*. Nothing is public yet; *Undo all* throws them away. Leaving the page with unpublished changes asks for confirmation.
- **Publish** makes one commit to `main` with `src/data/products.json` and any new photos. The *Deploy to GitHub Pages* workflow then rebuilds the site. The bar at the bottom shows when it's done.
- If `products.json` was changed somewhere else since the page loaded (on GitHub, or the admin page open on another device), publishing stops instead of overwriting it. Reload the page to continue from the latest version.
- The repository and branch are set in `src/config/site.ts` → `admin`.
- Running `npm run dev` and opening `http://localhost:4321/admin/` also saves to the real repository on GitHub.

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
  data/products.json     Products (edited by the admin page)
  data/products.ts       Product types and build-time checks
  data/categories.ts     Categories
  i18n/ui.ts             All Greek and English text
  views/                 Page layouts (Home, Shop, Product, Story, Contact, Basket)
  pages/                 Web addresses (Greek at /, English under /en/, admin at /admin/)
  components/            Header, footer, product card, logo, illustrations…
  scripts/               Basket, order summary and page interactions
  scripts/admin/         The admin page (GitHub saving, photo shrinking, editor)
  styles/global.css      Colours, fonts and shared styles
public/images/           Logo and photos
```
