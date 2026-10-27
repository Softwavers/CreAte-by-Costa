/**
 * The admin page (/admin/): the shop owner logs in with a GitHub access key,
 * edits the product list, and presses "Publish". Changes stay in this browser
 * until then; publishing saves products.json and any new photos to GitHub in
 * one commit, and the deploy workflow rebuilds the shop.
 */
import { GitHub, GitHubError, type FileChange } from './github';
import { preparePhoto } from './photos';
import { artSvg, shapes } from './art';
import { strings, type AdminLang, type StringKey } from './strings';
import { categories, pastelHex, type PastelColor } from '../../data/categories';
import type { Availability, Product, ProductOption, ProductOptionValue } from '../../data/products';
import { site } from '../../config/site';
import { asset, path, formatPrice } from '../../i18n/utils';

type T = { el: string; en: string };
type View =
  | { name: 'loading' }
  | { name: 'login'; error?: string }
  | { name: 'list' }
  | EditView;
/** index -1 = a new product, inserted at insertAt when saved. */
type EditView = { name: 'edit'; draft: Product; index: number; insertAt: number; idTouched: boolean; snapshot: string };
type Errors = [path: string, key: StringKey][];

const PRODUCTS_FILE = 'src/data/products.json';
const PHOTO_DIR = '/images/products/';
const TOKEN_KEY = 'cbc-admin-token';
const LANG_KEY = 'cbc-admin-lang';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Same key order as products.json, so saved changes make tidy diffs. */
const KEY_ORDER = ['id', 'name', 'short', 'description', 'price', 'categories', 'availability', 'featured', 'added', 'images', 'art', 'options', 'notes', 'wax', 'dimensions', 'burnTime', 'weight', 'maxQty'];
const DETAILS = [['notes', 'edit.notes'], ['wax', 'edit.waxType'], ['dimensions', 'edit.dimensions'], ['burnTime', 'edit.burnTime'], ['weight', 'edit.weight']] as const;
const AVAILABILITY: Availability[] = ['in_stock', 'made_to_order', 'sold_out'];
const PASTELS = Object.keys(pastelHex) as PastelColor[];

const root = document.querySelector<HTMLElement>('[data-admin]')!;
const bar = document.querySelector<HTMLElement>('[data-bar]')!;
const toastEl = document.querySelector<HTMLElement>('[data-toast]')!;

let lang: AdminLang = 'el';
let view: View = { name: 'loading' };
let gh: GitHub | null = null;
/** The products as they are on GitHub, and the working copy being edited. */
let original: Product[] = [];
let products: Product[] = [];
let fileSha = '';
/** Photos added in this session but not published yet (site path → file). */
const newPhotos = new Map<string, Blob>();
/** Local copies of new photos, shown until the rebuilt site serves them. */
const previews = new Map<string, string>();
let publishing = false;
let deploy: { sha: string; state: 'building' | 'live' | 'saved' | 'failed' } | null = null;
/** Ids of the products ticked in the list, for deleting several at once. */
const selected = new Set<string>();

/* ── Small helpers ─────────────────────────────────────────── */
const s = (key: StringKey, vars: Record<string, string | number> = {}) =>
  strings[lang][key].replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const blank = (): T => ({ el: '', en: '' });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const photoUrl = (src: string) => previews.get(src) ?? asset(src);
const productUrl = (id: string) => `${location.origin}${path('el', `/shop/${id}/`)}`;
const serialize = (list: Product[]) => `${JSON.stringify(list, null, 2)}\n`;

/** Reads "12,50" or "12.50" as 12.5. Empty → undefined, nonsense → NaN. */
function parseNumber(value: unknown): number | undefined {
  const text = String(value ?? '').trim().replace(',', '.');
  return text === '' ? undefined : Number(text);
}

const greek: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x',
  ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
/** "Σύννεφο Βανίλιας" → "synnefo-vanilias", "Rose Blush" → "rose-blush". */
function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[α-ω]|ς/g, (c) => greek[c] ?? '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

function uniqueSlug(stem: string, taken: Set<string>): string {
  let id = stem;
  for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;
  taken.add(id);
  return id;
}
const newProductId = (stem: string) => uniqueSlug(stem || 'candle', new Set(products.map((p) => p.id)));

/** Puts a product's fields in the standard order (keeping any extra fields added by hand). */
function canonical(p: Product): Product {
  const src = p as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of [...KEY_ORDER, ...Object.keys(src)]) if (src[k] !== undefined && !(k in out)) out[k] = src[k];
  return out as unknown as Product;
}

function pendingChanges() {
  const before = new Map(original.map((p) => [p.id, JSON.stringify(p)]));
  const after = new Map(products.map((p) => [p.id, JSON.stringify(p)]));
  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const edited = [...after.keys()].filter((id) => before.has(id) && before.get(id) !== after.get(id));
  const shared = (list: Product[]) => list.map((p) => p.id).filter((id) => before.has(id) && after.has(id)).join();
  const reordered = shared(original) !== shared(products);
  return { added, removed, edited, reordered, count: added.length + removed.length + edited.length + (reordered ? 1 : 0) };
}

/* ── Login & token storage ─────────────────────────────────── */
function readToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
function storeToken(token: string, remember: boolean) {
  clearToken();
  try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}

/** GitHub's "new token" page with the name and permissions already filled in. */
function tokenUrl(): string {
  const params = new URLSearchParams({
    name: `${site.brandName} admin`,
    description: 'Lets the shop admin page save product changes.',
    target_name: site.admin.repo.split('/')[0]!,
    expires_in: '366',
    contents: 'write',
    actions: 'read',
  });
  return `https://github.com/settings/personal-access-tokens/new?${params}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof GitHubError) {
    if (err.status === 0) return s('err.network');
    if (err.status === 401) return s('err.badToken');
    if (err.status === 404) return s('err.noRepo', { repo: site.admin.repo });
    if (err.status === 403 && !/rate limit/i.test(err.message)) return s('err.readOnly');
    if (err.status === 409) return s('err.conflict');
  }
  if (err instanceof Error && err.message === 'badData') return s('err.badData');
  return s('err.generic', { message: err instanceof Error ? err.message : String(err) });
}

async function login(token: string, remember: boolean) {
  const client = new GitHub(token, site.admin.repo, site.admin.branch);
  try {
    const file = await client.readFile(PRODUCTS_FILE);
    let list: Product[];
    try {
      list = JSON.parse(file.text);
      if (!Array.isArray(list)) throw new Error();
    } catch {
      throw new Error('badData');
    }
    storeToken(token, remember);
    gh = client;
    original = list.map(canonical);
    products = structuredClone(original);
    fileSha = file.sha;
    view = { name: 'list' };
  } catch (err) {
    if (err instanceof GitHubError && err.status === 401) clearToken();
    const missingFile = err instanceof GitHubError && err.status === 404 && (await client.canSeeRepo());
    view = { name: 'login', error: missingFile ? s('err.noFile', { file: PRODUCTS_FILE, branch: site.admin.branch }) : errorMessage(err) };
  }
  render();
}

function logout() {
  if (pendingChanges().count && !confirm(s('bar.confirmDiscard'))) return;
  clearToken();
  gh = null;
  original = products = [];
  newPhotos.clear();
  deploy = null;
  view = { name: 'login' };
  render();
}

/* ── Views ─────────────────────────────────────────────────── */
function topBar(): string {
  return `
  <header class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="${asset('/')}" target="_blank" rel="noopener">
        <img src="${asset('/images/logo-original.png')}" alt="" width="40" height="40">
        <span><span class="brand-name">${esc(site.brandName)}</span><span class="brand-sub">${s('title')}</span></span>
      </a>
      <nav class="topbar-actions" aria-label="${s('title')}">
        <button type="button" class="btn btn-soft btn-small" data-action="lang" lang="${lang === 'el' ? 'en' : 'el'}">${s('nav.lang')}</button>
        ${gh ? `
          <a class="btn btn-soft btn-small" href="${path(lang, '/')}" target="_blank" rel="noopener">${s('nav.viewShop')}</a>
          <button type="button" class="btn btn-ghost btn-small" data-action="logout">${s('nav.logout')}</button>` : ''}
      </nav>
    </div>
  </header>`;
}

function loginView(error = ''): string {
  const saved = readToken();
  return `
  <section class="wrap login">
    <div class="card login-card">
      <img class="login-logo" src="${asset('/images/logo-original.png')}" alt="" width="88" height="88">
      <h1>${s('login.title')}</h1>
      <p class="muted">${s('login.intro')}</p>
      <form class="stack" data-form="login">
        <input type="text" name="username" value="${esc(`${site.brandName} admin`)}" autocomplete="username" hidden>
        <div class="field">
          <label for="token">${s('login.token')}</label>
          <input id="token" name="token" class="input" type="password" value="${esc(saved)}" autocomplete="current-password" spellcheck="false" required ${error ? 'aria-invalid="true" aria-describedby="login-error"' : ''}>
        </div>
        <label class="check"><input type="checkbox" name="remember" checked> ${s('login.remember')}</label>
        <p class="error-text" id="login-error" role="alert">${esc(error)}</p>
        <button class="btn btn-primary btn-block" type="submit">${s('login.submit')}</button>
      </form>
      <details class="help">
        <summary>${s('login.help.title')}</summary>
        <ol>
          <li>${s('login.help.1')}</li>
          <li>${s('login.help.2', { url: esc(tokenUrl()) })}</li>
          <li>${s('login.help.3', { repo: esc(site.admin.repo.split('/')[1]) })}</li>
          <li>${s('login.help.4')}</li>
        </ol>
        <p class="hint">${s('login.help.note')}</p>
      </details>
    </div>
  </section>`;
}

function thumb(p: Product): string {
  return p.images[0] ? `<img src="${esc(photoUrl(p.images[0]))}" alt="" loading="lazy">` : artSvg(p.art);
}

function listView(): string {
  const { added, edited } = pendingChanges();
  const published = new Set(original.map((p) => p.id));
  for (const id of selected) if (!products.some((p) => p.id === id)) selected.delete(id);
  const all = products.length > 0 && selected.size === products.length;
  const rows = products.map((p, i) => {
    const chip = added.includes(p.id) ? 'new' : edited.includes(p.id) ? 'edited' : '';
    const name = p.name[lang] || p.name.el;
    return `
    <li class="row card${selected.has(p.id) ? ' is-selected' : ''}">
      <input type="checkbox" class="row-select" data-select="${esc(p.id)}" aria-label="${s('list.select')}: ${esc(name)}" ${selected.has(p.id) ? 'checked' : ''}>
      <div class="row-thumb">${thumb(p)}</div>
      <div class="row-main">
        <p class="row-name"><strong>${esc(name)}</strong>${chip ? ` <span class="chip chip-${chip}">${s(`list.${chip}.chip`)}</span>` : ''}</p>
        <p class="row-meta">
          <span>${formatPrice(lang, p.price)}</span>
          <span class="badge badge-${esc(p.availability)}">${AVAILABILITY.includes(p.availability) ? s(`stock.${p.availability}`) : esc(p.availability)}</span>
          ${p.featured ? `<span class="muted">★ ${s('list.featured')}</span>` : ''}
        </p>
      </div>
      <div class="row-actions">
        <button type="button" class="icon-btn" data-action="up" data-index="${i}" aria-label="${s('list.up')}: ${esc(name)}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn" data-action="down" data-index="${i}" aria-label="${s('list.down')}: ${esc(name)}" ${i === products.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="btn btn-dark btn-small" data-action="edit" data-index="${i}">${s('list.edit')}</button>
        <button type="button" class="btn btn-soft btn-small" data-action="duplicate" data-index="${i}">${s('list.duplicate')}</button>
        ${published.has(p.id) ? `<a class="btn btn-soft btn-small" href="${path(lang, `/shop/${p.id}/`)}" target="_blank" rel="noopener">${s('list.view')}</a>` : ''}
        <button type="button" class="btn btn-danger btn-small" data-action="delete" data-index="${i}">${s('list.delete')}</button>
      </div>
    </li>`;
  });
  return `
  <section class="wrap list">
    <div class="list-head">
      <div>
        <h1>${s('list.title')} <span class="count">${products.length}</span></h1>
        <p class="muted">${s('list.hint')}</p>
      </div>
      <button type="button" class="btn btn-primary" data-action="new">+ ${s('list.new')}</button>
    </div>
    ${rows.length ? `
      <div class="bulk">
        <label class="check"><input type="checkbox" data-select-all ${all ? 'checked' : ''}> ${s('list.selectAll')}</label>
        ${selected.size ? `
          <span class="muted">${selected.size === 1 ? s('list.selected.one') : s('list.selected.many', { n: selected.size })}</span>
          <button type="button" class="btn btn-danger btn-small" data-action="delete-selected">${s('list.deleteSelected')}</button>
          <button type="button" class="btn btn-ghost btn-small" data-action="clear-selection">${s('list.clearSelection')}</button>` : ''}
      </div>
      <ul class="rows">${rows.join('')}</ul>` : `<p class="card empty">${s('list.empty')}</p>`}
  </section>`;
}

/** A field in both languages, side by side. */
function pair(key: string, value: T, label: string, opts: { textarea?: boolean; hint?: string } = {}): string {
  const control = (l: AdminLang) => {
    const attrs = `id="f-${key}-${l}" class="${opts.textarea ? 'textarea' : 'input'}" data-bind="${key}.${l}" lang="${l}" aria-label="${esc(`${label} (${s(`edit.${l}`)})`)}"`;
    return `
      <label class="lang-field">
        <span class="lang-tag">${s(`edit.${l}`)}</span>
        ${opts.textarea ? `<textarea ${attrs} rows="5">${esc(value[l])}</textarea>` : `<input ${attrs} value="${esc(value[l])}">`}
      </label>`;
  };
  return `
    <div class="pair">
      <span class="label">${esc(label)}</span>
      <div class="pair-grid">${control('el')}${control('en')}</div>
      ${opts.hint ? `<p class="hint">${esc(opts.hint)}</p>` : ''}
    </div>`;
}

function photosSection(d: Product): string {
  return `
    <ul class="photos">
      ${d.images.map((src, i) => `
        <li class="photo">
          <img src="${esc(photoUrl(src))}" alt="">
          ${i === 0 ? `<span class="photo-main">★ ${s('edit.mainPhoto')}</span>` : `<button type="button" class="photo-main photo-make-main" data-action="photo-main" data-index="${i}">${s('edit.makeMain')}</button>`}
          <div class="photo-actions">
            <button type="button" class="icon-btn" data-action="photo-left" data-index="${i}" aria-label="${s('edit.photoLeft')}" ${i === 0 ? 'disabled' : ''}>←</button>
            <button type="button" class="icon-btn" data-action="photo-right" data-index="${i}" aria-label="${s('edit.photoRight')}" ${i === d.images.length - 1 ? 'disabled' : ''}>→</button>
            <button type="button" class="icon-btn icon-btn-danger" data-action="photo-remove" data-index="${i}" aria-label="${s('edit.photoRemove')}">✕</button>
          </div>
        </li>`).join('')}
    </ul>
    <label class="btn btn-soft upload">
      <input type="file" accept="image/*" multiple data-upload class="visually-hidden">
      + ${s('edit.addPhotos')}
    </label>
    <p class="hint" data-photo-status role="status"></p>`;
}

function optionsSection(d: Product): string {
  const options = d.options ?? [];
  return `
    ${options.map((o, i) => `
      <div class="option" data-error="options.${i}" aria-label="${s('edit.option')} ${i + 1}">
        <div class="option-head">
          <strong>${s('edit.option')} ${i + 1}</strong>
          <button type="button" class="btn btn-danger btn-small" data-action="remove-option" data-index="${i}">${s('edit.removeOption')}</button>
        </div>
        ${pair(`options.${i}.label`, o.label, s('edit.optionName'), { hint: s('edit.optionNameHint') })}
        <label class="check"><input type="checkbox" data-bind="options.${i}.required" ${o.required ? 'checked' : ''}> ${s('edit.required')}</label>
        <div class="values">
          <div class="value-row value-head" aria-hidden="true">
            <span>${s('edit.choice')} · ${s('edit.el')}</span><span>${s('edit.choice')} · ${s('edit.en')}</span><span>${s('edit.extra')}</span><span></span>
          </div>
          ${o.values.map((v, j) => {
            const label = `${s('edit.choice')} ${j + 1}`;
            return `
            <div class="value-row">
              <input class="input" data-bind="options.${i}.values.${j}.label.el" lang="el" value="${esc(v.label.el)}" aria-label="${esc(`${label} (${s('edit.el')})`)}" placeholder="${s('edit.el')}">
              <input class="input" data-bind="options.${i}.values.${j}.label.en" lang="en" value="${esc(v.label.en)}" aria-label="${esc(`${label} (${s('edit.en')})`)}" placeholder="${s('edit.en')}">
              <input class="input" data-bind="options.${i}.values.${j}.priceDelta" inputmode="decimal" autocomplete="off" value="${esc(v.priceDelta ?? '')}" aria-label="${esc(`${label}: ${s('edit.extra')}`)}" placeholder="+0">
              <button type="button" class="icon-btn icon-btn-danger" data-action="remove-value" data-index="${i}" data-value="${j}" aria-label="${esc(`${s('edit.removeValue')}: ${label}`)}">✕</button>
            </div>`;
          }).join('')}
          <button type="button" class="btn btn-soft btn-small" data-action="add-value" data-index="${i}">+ ${s('edit.addValue')}</button>
        </div>
      </div>`).join('')}
    <button type="button" class="btn btn-soft" data-action="add-option">+ ${s('edit.addOption')}</button>`;
}

function editView(v: EditView): string {
  const d = v.draft;
  const isNew = v.index === -1;
  const select = (bind: string, label: string, items: string[], current: string, text: (x: string) => string) => `
    <div class="field">
      <label for="f-${bind}">${label}</label>
      <select id="f-${bind}" class="select" data-bind="${bind}" aria-label="${esc(label)}">
        ${items.map((x) => `<option value="${x}" ${x === current ? 'selected' : ''}>${text(x)}</option>`).join('')}
      </select>
    </div>`;
  const color = (bind: 'wax' | 'accent', label: string) => `
    <div class="field">
      <label for="f-art-${bind}">${label}</label>
      <input id="f-art-${bind}" class="input color" type="color" data-bind="art.${bind}" value="${esc(d.art[bind].toLowerCase())}" aria-label="${esc(label)}">
    </div>`;

  return `
  <section class="wrap editor">
    <button type="button" class="back-link" data-action="cancel">← ${s('edit.back')}</button>
    <h1>${isNew ? s('edit.newTitle') : esc(d.name[lang] || d.name.el)}</h1>
    <div class="error-summary" data-errors tabindex="-1" hidden></div>
    <form class="stack" data-form="product" novalidate>
      <fieldset class="card">
        <legend>${s('edit.basics')}</legend>
        ${pair('name', d.name, s('edit.name'))}
        ${pair('short', d.short, s('edit.short'), { hint: s('edit.shortHint') })}
        ${pair('description', d.description, s('edit.description'), { textarea: true })}
      </fieldset>

      <fieldset class="card">
        <legend>${s('edit.selling')}</legend>
        <div class="grid">
          <div class="field">
            <label for="f-price">${s('edit.price')}</label>
            <input id="f-price" class="input" data-bind="price" inputmode="decimal" autocomplete="off" value="${esc(d.price)}" aria-label="${s('edit.price')}">
          </div>
          ${select('availability', s('edit.availability'), AVAILABILITY, d.availability, (a) => s(`stock.${a as Availability}`))}
          <div class="field">
            <label for="f-maxQty">${s('edit.maxQty')}</label>
            <input id="f-maxQty" class="input" type="number" min="1" step="1" inputmode="numeric" data-bind="maxQty" value="${esc(d.maxQty)}" placeholder="10" aria-label="${s('edit.maxQty')}">
            <p class="hint">${s('edit.maxQtyHint')}</p>
          </div>
          <div class="field">
            <label for="f-added">${s('edit.added')}</label>
            <input id="f-added" class="input" type="date" data-bind="added" value="${esc(d.added)}" aria-label="${s('edit.added')}">
            <p class="hint">${s('edit.addedHint')}</p>
          </div>
        </div>
        <fieldset class="field">
          <legend class="label">${s('edit.categories')}</legend>
          <div class="checks">
            ${categories.map((c) => `<label class="check"><input type="checkbox" data-category="${c.id}" ${d.categories.includes(c.id) ? 'checked' : ''}> ${esc(c.name[lang])}</label>`).join('')}
          </div>
        </fieldset>
        <label class="check"><input type="checkbox" data-bind="featured" ${d.featured ? 'checked' : ''}> ${s('edit.featured')}</label>
      </fieldset>

      <fieldset class="card">
        <legend>${s('edit.photos')}</legend>
        <p class="hint">${s('edit.photosHint')}</p>
        <div data-photos>${photosSection(d)}</div>
      </fieldset>

      <fieldset class="card">
        <legend>${s('edit.art')}</legend>
        <p class="hint">${s('edit.artHint')}</p>
        <div class="art-editor">
          <div class="art-preview" data-art-preview>${artSvg(d.art)}</div>
          <div class="grid">
            ${select('art.shape', s('edit.shape'), shapes, d.art.shape, (x) => s(`shape.${x as Product['art']['shape']}`))}
            ${select('art.bg', s('edit.bg'), PASTELS, d.art.bg, (x) => s(`bg.${x as PastelColor}`))}
            ${color('wax', s('edit.wax'))}
            ${color('accent', s('edit.accent'))}
          </div>
        </div>
      </fieldset>

      <fieldset class="card">
        <legend>${s('edit.options')}</legend>
        <p class="hint">${s('edit.optionsHint')}</p>
        <div class="stack" data-options>${optionsSection(d)}</div>
      </fieldset>

      <fieldset class="card">
        <legend>${s('edit.details')}</legend>
        <p class="hint">${s('edit.detailsHint')}</p>
        ${DETAILS.map(([key, label]) => pair(key, d[key] ?? blank(), s(label))).join('')}
      </fieldset>

      <fieldset class="card">
        <legend>${s('edit.address')}</legend>
        ${isNew ? `
          <div class="field">
            <label for="f-id">${s('edit.id')}</label>
            <input id="f-id" class="input" data-bind="id" value="${esc(d.id)}" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="${s('edit.id')}">
            <p class="hint">${s('edit.idHint', { url: `<span class="url" data-id-url>${esc(productUrl(d.id))}</span>` })}</p>
          </div>` : `
          <p class="url">${esc(productUrl(d.id))}</p>
          <p class="hint">${s('edit.idLocked')}</p>`}
      </fieldset>

      <div class="editor-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel">${s('edit.cancel')}</button>
        <button type="submit" class="btn btn-primary">${s('edit.save')}</button>
      </div>
    </form>
  </section>`;
}

function render() {
  document.documentElement.lang = lang;
  document.title = `${s('title')} · ${site.brandName}`;
  const main = view.name === 'loading' ? `<p class="wrap loading">${s('loading')}</p>`
    : view.name === 'login' ? loginView(view.error)
    : view.name === 'list' ? listView()
    : editView(view);
  root.innerHTML = topBar() + `<main id="main">${main}</main>`;
  renderBar();
}

function renderBar() {
  let html = '';
  const { count } = pendingChanges();
  if (view.name === 'list') {
    if (publishing) html = `<p>${s('bar.publishing')}</p>`;
    else if (count) html = `
      <p><strong>${count === 1 ? s('bar.pending.one') : s('bar.pending.many', { n: count })}</strong></p>
      <div class="bar-actions">
        <button type="button" class="btn btn-ghost btn-small" data-action="discard">${s('bar.discard')}</button>
        <button type="button" class="btn btn-primary btn-small" data-action="publish">${s('bar.publish')}</button>
      </div>`;
    else if (deploy) html = `<p>${s(`bar.${deploy.state}`)}</p>`;
  }
  bar.innerHTML = html;
  bar.hidden = !html;
  bar.dataset.state = publishing ? 'publishing' : count ? 'pending' : deploy?.state ?? '';
  document.body.classList.toggle('has-bar', !!html);
}

let toastTimer = 0;
function toast(message: string, error = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('is-error', error);
  toastEl.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), error ? 12000 : 4500);
}
toastEl.addEventListener('click', () => toastEl.classList.remove('is-visible'));

/** Re-renders the list and puts keyboard focus back on the matching button. */
function renderListAndFocus(selector: string) {
  render();
  root.querySelector<HTMLElement>(`${selector}:not([disabled])`)?.focus();
}

/* ── Editing ───────────────────────────────────────────────── */
function toDraft(p: Product): Product {
  const d = structuredClone(p);
  d.options ??= [];
  for (const [key] of DETAILS) d[key] ??= blank();
  return d;
}

function blankProduct(): Product {
  return {
    id: '', name: blank(), short: blank(), description: blank(), price: '' as unknown as number,
    categories: [], availability: 'in_stock', added: today(), images: [],
    art: { shape: 'jar', wax: '#fbebc9', accent: '#dfb154', bg: 'butter' },
  };
}

function openEditor(product: Product, index: number, insertAt: number) {
  const draft = toDraft(product);
  view = { name: 'edit', draft, index, insertAt, idTouched: false, snapshot: JSON.stringify(draft) };
  render();
  window.scrollTo(0, 0);
  root.querySelector<HTMLElement>('#f-name-el')?.focus({ preventScroll: true });
}

function closeEditor(): boolean {
  if (view.name !== 'edit') return true;
  if (JSON.stringify(view.draft) !== view.snapshot && !confirm(s('edit.confirmLeave'))) return false;
  view = { name: 'list' };
  render();
  return true;
}

function setPath(target: unknown, bind: string, value: unknown) {
  const keys = bind.split('.');
  let obj = target as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) obj = obj[k] as Record<string, unknown>;
  obj[keys[keys.length - 1]!] = value;
}

/** Checks the draft and turns it into a clean product, or lists what needs fixing. */
function finalize(d: Product, index: number): { product?: Product; errors: Errors } {
  const errors: Errors = [];
  const clean = (v: T | undefined): T => ({ el: (v?.el ?? '').trim(), en: (v?.en ?? '').trim() });
  const required = (key: string, v: T | undefined): T => {
    const t = clean(v);
    if (!t.el) errors.push([`${key}.el`, 'val.required']);
    if (!t.en) errors.push([`${key}.en`, 'val.required']);
    return t;
  };
  const optional = (key: string, v: T | undefined): T | undefined => {
    const t = clean(v);
    if (!t.el !== !t.en) errors.push([`${key}.${t.el ? 'en' : 'el'}`, 'val.both']);
    return t.el || t.en ? t : undefined;
  };
  const money = (v: number) => Math.round(v * 100) / 100;

  const out = structuredClone(d) as unknown as Record<string, unknown>;
  if (index === -1) {
    const id = d.id.trim();
    if (!id) errors.push(['id', 'val.required']);
    else if (!ID_PATTERN.test(id)) errors.push(['id', 'val.id']);
    else if (products.some((p) => p.id === id)) errors.push(['id', 'val.idTaken']);
    out.id = id;
  }
  out.name = required('name', d.name);
  out.short = required('short', d.short);
  out.description = required('description', d.description);

  const price = parseNumber(d.price);
  if (price === undefined || !(price >= 0)) errors.push(['price', 'val.price']);
  else out.price = money(price);

  const maxQty = parseNumber(d.maxQty);
  if (maxQty === undefined) delete out.maxQty;
  else if (!Number.isInteger(maxQty) || maxQty < 1) errors.push(['maxQty', 'val.maxQty']);
  else out.maxQty = maxQty;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.added)) errors.push(['added', 'val.date']);
  out.categories = categories.map((c) => c.id).filter((id) => d.categories.includes(id));
  if (d.featured) out.featured = true;
  else delete out.featured;
  out.art = { shape: d.art.shape, wax: d.art.wax, accent: d.art.accent, bg: d.art.bg };

  const optionIds = new Set((d.options ?? []).map((o) => o.id).filter(Boolean));
  const options = (d.options ?? []).map((o, i): ProductOption => {
    const label = required(`options.${i}.label`, o.label);
    const valueIds = new Set(o.values.map((v) => v.id).filter(Boolean));
    const values = o.values.map((v, j): ProductOptionValue => {
      const valueLabel = required(`options.${i}.values.${j}.label`, v.label);
      const value: ProductOptionValue = { id: v.id || uniqueSlug(slugify(valueLabel.en || valueLabel.el) || 'choice', valueIds), label: valueLabel };
      const delta = parseNumber(v.priceDelta);
      if (delta !== undefined && Number.isNaN(delta)) errors.push([`options.${i}.values.${j}.priceDelta`, 'val.price']);
      else if (delta) value.priceDelta = money(delta);
      return value;
    });
    if (!values.length) errors.push([`options.${i}`, 'val.values']);
    return { id: o.id || uniqueSlug(slugify(label.en || label.el) || 'option', optionIds), label, required: !!o.required, values };
  });
  if (options.length) out.options = options;
  else delete out.options;

  for (const [key] of DETAILS) {
    const value = optional(key, d[key]);
    if (value) out[key] = value;
    else delete out[key];
  }

  return errors.length ? { errors } : { product: canonical(out as unknown as Product), errors };
}

function showErrors(errors: Errors) {
  root.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  const summary = root.querySelector<HTMLElement>('[data-errors]')!;
  summary.hidden = !errors.length;
  if (!errors.length) return;
  const find = (bind: string) => root.querySelector<HTMLElement>(`[data-bind="${bind}"], [data-error="${bind}"]`);
  summary.innerHTML = `
    <p><strong>${s('edit.errors')}</strong></p>
    <ul>${errors.map(([bind, key]) => {
      find(bind)?.setAttribute('aria-invalid', 'true');
      return `<li><a href="#" data-focus="${esc(bind)}">${esc(find(bind)?.getAttribute('aria-label') ?? bind)}</a>: ${esc(s(key))}</li>`;
    }).join('')}</ul>`;
  summary.focus();
}

function saveDraft() {
  if (view.name !== 'edit') return;
  const { draft, index, insertAt } = view;
  const { product, errors } = finalize(draft, index);
  showErrors(errors);
  if (!product) return;
  if (index === -1) products.splice(insertAt, 0, product);
  else products[index] = product;
  view = { name: 'list' };
  renderListAndFocus(`[data-action="edit"][data-index="${index === -1 ? insertAt : index}"]`);
  toast(s('edit.saved'));
}

async function addPhotos(input: HTMLInputElement) {
  if (view.name !== 'edit') return;
  const editing = view;
  const files = [...(input.files ?? [])];
  input.value = '';
  const status = root.querySelector('[data-photo-status]');
  for (const [n, file] of files.entries()) {
    if (status) status.textContent = s('edit.photoPreparing', { i: n + 1, n: files.length });
    try {
      const { blob, ext } = await preparePhoto(file);
      const stem = editing.draft.id || slugify(editing.draft.name.en || editing.draft.name.el) || 'photo';
      const src = `${PHOTO_DIR}${stem}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
      newPhotos.set(src, blob);
      previews.set(src, URL.createObjectURL(blob));
      editing.draft.images.push(src);
    } catch {
      toast(s('edit.photoError', { name: file.name }), true);
    }
  }
  if (view === editing) renderSection('photos');
}

function renderSection(section: 'photos' | 'options', focus?: string) {
  if (view.name !== 'edit') return;
  const el = root.querySelector(`[data-${section}]`);
  if (el) el.innerHTML = section === 'photos' ? photosSection(view.draft) : optionsSection(view.draft);
  if (focus) root.querySelector<HTMLElement>(`${focus}:not([disabled])`)?.focus();
}

/* ── Publishing ────────────────────────────────────────────── */
async function publish() {
  if (!gh || publishing) return;
  const { added, removed, edited, reordered } = pendingChanges();
  const used = new Set(products.flatMap((p) => p.images));
  const files: FileChange[] = [{ path: PRODUCTS_FILE, content: serialize(products) }];
  for (const [src, blob] of newPhotos) if (used.has(src)) files.push({ path: `public${src}`, content: blob });
  // Photos of deleted products (or removed from a product) are deleted too.
  for (const src of new Set(original.flatMap((p) => p.images))) {
    if (!used.has(src) && src.startsWith(PHOTO_DIR)) files.push({ path: `public${src}`, delete: true });
  }
  const message = [
    'Update products from the admin page',
    '',
    added.length ? `Added: ${added.join(', ')}` : '',
    edited.length ? `Changed: ${edited.join(', ')}` : '',
    removed.length ? `Removed: ${removed.join(', ')}` : '',
    reordered ? 'Changed the order' : '',
  ].filter((line, i) => i < 2 || line).join('\n').trim();

  publishing = true;
  renderBar();
  try {
    const result = await gh.commit(message, files, { path: PRODUCTS_FILE, sha: fileSha });
    fileSha = result.blobs[PRODUCTS_FILE]!;
    original = structuredClone(products);
    newPhotos.clear();
    void watchDeploy(result.commit);
  } catch (err) {
    toast(errorMessage(err), true);
  } finally {
    publishing = false;
    if (view.name === 'list') render();
  }
}

async function watchDeploy(sha: string) {
  deploy = { sha, state: 'building' };
  renderBar();
  const started = Date.now();
  while (Date.now() - started < 10 * 60_000) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    if (deploy?.sha !== sha || !gh) return;
    const status = await gh.deployStatus(sha);
    // The rebuild can take a little while to appear on GitHub.
    if (status === 'pending' || (status === 'none' && Date.now() - started < 90_000)) continue;
    deploy.state = status === 'success' ? 'live' : status === 'failure' ? 'failed' : 'saved';
    renderBar();
    return;
  }
  if (deploy?.sha === sha) {
    deploy.state = 'saved';
    renderBar();
  }
}

/* ── Events ────────────────────────────────────────────────── */
function move<X>(list: X[], from: number, to: number) {
  if (to < 0 || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item!);
}

const actions: Record<string, (i: number, el: HTMLElement) => void> = {
  lang: () => {
    lang = lang === 'el' ? 'en' : 'el';
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    render();
    root.querySelector<HTMLElement>('[data-action="lang"]')?.focus();
  },
  logout,
  new: () => openEditor(blankProduct(), -1, 0),
  edit: (i) => openEditor(products[i]!, i, i),
  duplicate: (i) => {
    const copy = structuredClone(products[i]!);
    copy.id = newProductId(copy.id);
    openEditor(copy, -1, i + 1);
  },
  delete: (i) => {
    const p = products[i]!;
    if (!confirm(s('list.confirmDelete', { name: p.name[lang] || p.name.el }))) return;
    products.splice(i, 1);
    renderListAndFocus(`[data-action="delete"][data-index="${Math.min(i, products.length - 1)}"], [data-action="new"]`);
  },
  up: (i) => { move(products, i, i - 1); renderListAndFocus(`[data-action="up"][data-index="${i - 1}"]`); },
  down: (i) => { move(products, i, i + 1); renderListAndFocus(`[data-action="down"][data-index="${i + 1}"]`); },
  'delete-selected': () => {
    if (!selected.size || !confirm(s('list.confirmBulkDelete', { n: selected.size }))) return;
    products = products.filter((p) => !selected.has(p.id));
    selected.clear();
    renderListAndFocus('[data-select-all], [data-action="new"]');
  },
  'clear-selection': () => {
    selected.clear();
    renderListAndFocus('[data-select-all]');
  },
  discard: () => {
    if (!confirm(s('bar.confirmDiscard'))) return;
    products = structuredClone(original);
    render();
  },
  publish: () => void publish(),
  cancel: () => void closeEditor(),
  'add-option': () => {
    if (view.name !== 'edit') return;
    const options = (view.draft.options ??= []);
    options.push({ id: '', label: blank(), required: true, values: [{ id: '', label: blank() }] });
    renderSection('options', `[data-bind="options.${options.length - 1}.label.el"]`);
  },
  'remove-option': (i) => {
    if (view.name !== 'edit') return;
    view.draft.options!.splice(i, 1);
    renderSection('options', '[data-action="add-option"]');
  },
  'add-value': (i) => {
    if (view.name !== 'edit') return;
    const values = view.draft.options![i]!.values;
    values.push({ id: '', label: blank() });
    renderSection('options', `[data-bind="options.${i}.values.${values.length - 1}.label.el"]`);
  },
  'remove-value': (i, el) => {
    if (view.name !== 'edit') return;
    view.draft.options![i]!.values.splice(Number(el.dataset.value), 1);
    renderSection('options', `[data-action="add-value"][data-index="${i}"]`);
  },
  'photo-left': (i) => {
    if (view.name !== 'edit') return;
    move(view.draft.images, i, i - 1);
    renderSection('photos', `[data-action="photo-left"][data-index="${i - 1}"]`);
  },
  'photo-right': (i) => {
    if (view.name !== 'edit') return;
    move(view.draft.images, i, i + 1);
    renderSection('photos', `[data-action="photo-right"][data-index="${i + 1}"]`);
  },
  'photo-main': (i) => {
    if (view.name !== 'edit') return;
    move(view.draft.images, i, 0);
    renderSection('photos', '.photo-main');
  },
  'photo-remove': (i) => {
    if (view.name !== 'edit') return;
    view.draft.images.splice(i, 1);
    renderSection('photos', '[data-upload]');
  },
};

document.addEventListener('click', (e) => {
  const target = e.target as Element;
  const focusLink = target.closest<HTMLElement>('[data-focus]');
  if (focusLink) {
    e.preventDefault();
    const bind = focusLink.dataset.focus!;
    const field = root.querySelector<HTMLElement>(`[data-bind="${bind}"]`) ?? root.querySelector<HTMLElement>(`[data-error="${bind}"] input`);
    field?.focus();
    return;
  }
  const btn = target.closest<HTMLElement>('[data-action]');
  if (btn) actions[btn.dataset.action!]?.(Number(btn.dataset.index), btn);
});

root.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  e.preventDefault();
  if (form.dataset.form === 'product') return saveDraft();
  if (form.dataset.form === 'login') {
    const data = new FormData(form);
    const token = String(data.get('token') ?? '').trim();
    if (!token) return;
    const button = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    button.disabled = true;
    button.textContent = s('login.checking');
    void login(token, data.get('remember') === 'on');
  }
});

root.addEventListener('input', (e) => {
  if (view.name !== 'edit') return;
  const editing = view;
  const el = e.target as HTMLInputElement;
  const bind = el.dataset.bind;
  if (bind) {
    setPath(editing.draft, bind, el.type === 'checkbox' ? el.checked : el.value);
    el.removeAttribute('aria-invalid');
    // New products get a web address made from their name, until it's typed by hand.
    if (bind === 'id') editing.idTouched = true;
    else if (bind.startsWith('name.') && editing.index === -1 && !editing.idTouched) {
      editing.draft.id = newProductId(slugify(editing.draft.name.en || editing.draft.name.el));
      const idInput = root.querySelector<HTMLInputElement>('[data-bind="id"]');
      if (idInput) idInput.value = editing.draft.id;
    }
    if (bind === 'id' || bind.startsWith('name.')) {
      const url = root.querySelector('[data-id-url]');
      if (url) url.textContent = productUrl(editing.draft.id);
    }
    if (bind.startsWith('art.')) root.querySelector('[data-art-preview]')!.innerHTML = artSvg(editing.draft.art);
  } else if (el.dataset.category) {
    const id = el.dataset.category;
    editing.draft.categories = el.checked ? [...editing.draft.categories, id] : editing.draft.categories.filter((c) => c !== id);
  }
});

root.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.matches('[data-upload]')) void addPhotos(el);
  else if (el.dataset.select) {
    if (el.checked) selected.add(el.dataset.select);
    else selected.delete(el.dataset.select);
    renderListAndFocus(`[data-select="${CSS.escape(el.dataset.select)}"]`);
  } else if (el.matches('[data-select-all]')) {
    selected.clear();
    if (el.checked) products.forEach((p) => selected.add(p.id));
    renderListAndFocus('[data-select-all]');
  }
});

window.addEventListener('beforeunload', (e) => {
  const editing = view.name === 'edit' && JSON.stringify(view.draft) !== view.snapshot;
  if (editing || pendingChanges().count) e.preventDefault();
});

/* ── Start ─────────────────────────────────────────────────── */
try {
  const saved = localStorage.getItem(LANG_KEY) ?? localStorage.getItem('cbc-lang');
  lang = saved === 'en' ? 'en' : 'el';
} catch { /* ignore */ }

const savedToken = readToken();
if (savedToken) {
  render();
  let remembered = false;
  try { remembered = !!localStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
  void login(savedToken, remembered);
} else {
  view = { name: 'login' };
  render();
}
