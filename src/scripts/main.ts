import * as basket from './basket';
import { findProduct, maxQty, selectionLabels, unitPrice } from './catalog';
import { orderSummary, orderMailto } from './order';
import { site } from '../config/site';
import { t, formatPrice, path } from '../i18n/utils';
import type { Lang, UIKey } from '../i18n/ui';

const lang = (document.body.dataset.lang === 'en' ? 'en' : 'el') as Lang;
const tr = (key: UIKey, vars?: Record<string, string | number>) => t(lang, key, vars);
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/* ── Toast ─────────────────────────────────────────────────── */
let toastTimer: number | undefined;
function toast(message: string, opts: { error?: boolean; link?: boolean } = {}) {
  const el = $('[data-toast]');
  if (!el) return;
  el.innerHTML = escapeHtml(message) + (opts.link ? ` <a href="${path(lang, '/basket/')}">${escapeHtml(tr('msg.viewBasket'))}</a>` : '');
  el.classList.toggle('is-error', !!opts.error);
  el.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), opts.link ? 4500 : 3200);
}

/* ── Header ────────────────────────────────────────────────── */
function initHeader() {
  const header = $('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = $<HTMLButtonElement>('[data-menu-toggle]');
  const nav = $('[data-nav]');
  const setOpen = (open: boolean) => {
    toggle?.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('is-open', open);
  };
  toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  nav?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false);
  });

  // Remember the language the visitor picks.
  $$<HTMLAnchorElement>('[data-lang-link]').forEach((a) =>
    a.addEventListener('click', () => {
      try { localStorage.setItem('cbc-lang', a.dataset.langLink!); } catch { /* ignore */ }
    }),
  );
  try { localStorage.setItem('cbc-lang', lang); } catch { /* ignore */ }
}

function renderCount() {
  const n = basket.count();
  $$('[data-basket-count]').forEach((el) => {
    const changed = el.textContent !== String(n);
    el.textContent = String(n);
    el.hidden = n === 0;
    if (changed && n > 0) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  });
}

/* ── Scroll reveal ─────────────────────────────────────────── */
function initReveal() {
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('is-in'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

/* ── Quantity steppers ─────────────────────────────────────── */
function initSteppers(root: ParentNode = document) {
  $$('[data-qty]', root).forEach((wrap) => {
    if (wrap.dataset.ready) return;
    wrap.dataset.ready = '1';
    const input = $<HTMLInputElement>('input', wrap)!;
    $$<HTMLButtonElement>('[data-step]', wrap).forEach((btn) =>
      btn.addEventListener('click', () => {
        const max = Number(input.max) || 10;
        const next = Math.min(max, Math.max(1, (parseInt(input.value, 10) || 1) + Number(btn.dataset.step)));
        input.value = String(next);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }),
    );
  });
}

/* ── Add to order forms (product cards + product page) ─────── */
function initAddForms() {
  $$<HTMLFormElement>('form[data-add-form]').forEach((form) => {
    const product = findProduct(form.dataset.product!);
    if (!product) return;
    const error = $('[data-form-error]', form);
    const priceEl = $(`[data-price-for="${product.id}"]`, form.closest('[data-product-scope]') ?? form);

    const readSelection = () => {
      const sel: Record<string, string> = {};
      $$<HTMLSelectElement>('select[data-option]', form).forEach((s) => { if (s.value) sel[s.dataset.option!] = s.value; });
      return sel;
    };
    const updatePrice = () => {
      if (priceEl && product.options?.some((o) => o.values.some((v) => v.priceDelta))) {
        priceEl.textContent = formatPrice(lang, unitPrice(product, readSelection()));
        const from = priceEl.parentElement?.querySelector<HTMLElement>('.from');
        if (from) from.hidden = true;
      }
    };

    form.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('select')) {
        target.removeAttribute('aria-invalid');
        if (error) error.textContent = '';
        updatePrice();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (error) error.textContent = '';
      const selection = readSelection();
      const missing = (product.options ?? []).find((o) => o.required && !selection[o.id]);
      if (missing) {
        const select = $<HTMLSelectElement>(`select[data-option="${missing.id}"]`, form);
        select?.setAttribute('aria-invalid', 'true');
        select?.focus();
        if (error) error.textContent = tr('msg.chooseOption', { option: missing.label[lang].toLowerCase() });
        return;
      }
      const qtyInput = $<HTMLInputElement>('input[name="qty"]', form);
      const qty = qtyInput ? Number(qtyInput.value) : 1;
      const result = basket.add(product.id, selection, qty);
      if (result.ok) {
        toast(tr('msg.added'), { link: true });
        if (qtyInput) qtyInput.value = '1';
        return;
      }
      const msg =
        result.reason === 'sold_out' ? tr('msg.soldOut')
        : result.reason === 'qty' ? tr('msg.invalidQty', { max: result.max ?? maxQty(product) })
        : result.reason === 'max' ? tr('msg.maxQty', { max: result.max ?? maxQty(product) })
        : tr('msg.soldOut');
      if (error) error.textContent = msg;
      toast(msg, { error: true });
    });
  });
}

/* ── Shop filters & sorting ────────────────────────────────── */
function initShop() {
  const shop = $('[data-shop]');
  if (!shop) return;
  const grid = $('[data-shop-grid]', shop)!;
  const cards = $$('[data-card]', grid);
  const buttons = $$<HTMLButtonElement>('[data-filter]', shop);
  const sortSelect = $<HTMLSelectElement>('[data-sort]', shop)!;
  const countEl = $('[data-shop-count]', shop);
  const empty = $('[data-shop-empty]', shop);
  const params = new URLSearchParams(location.search);
  let category = params.get('category') || 'all';
  if (!buttons.some((b) => b.dataset.filter === category)) category = 'all';
  sortSelect.value = params.get('sort') || 'featured';
  if (!sortSelect.value) sortSelect.value = 'featured';

  const apply = () => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === category)));
    let visible = 0;
    cards.forEach((card) => {
      const show = category === 'all' || card.dataset.categories!.split(' ').includes(category);
      card.hidden = !show;
      if (show) visible++;
    });
    const sort = sortSelect.value;
    const sorted = [...cards].sort((a, b) => {
      const da = a.dataset, db = b.dataset;
      if (sort === 'priceAsc') return Number(da.price) - Number(db.price);
      if (sort === 'priceDesc') return Number(db.price) - Number(da.price);
      if (sort === 'newest') return db.added!.localeCompare(da.added!);
      return Number(da.order) - Number(db.order);
    });
    sorted.forEach((c) => grid.appendChild(c));
    if (countEl) countEl.textContent = `${visible} ${visible === 1 ? tr('shop.count.one') : tr('shop.count.many')}`;
    if (empty) empty.hidden = visible > 0;

    const url = new URL(location.href);
    category === 'all' ? url.searchParams.delete('category') : url.searchParams.set('category', category);
    sortSelect.value === 'featured' ? url.searchParams.delete('sort') : url.searchParams.set('sort', sortSelect.value);
    history.replaceState(null, '', url);
    // Keep the language switch on the same filter.
    $$<HTMLAnchorElement>('[data-lang-link]').forEach((a) => {
      const u = new URL(a.href);
      u.search = url.search;
      a.href = u.toString();
    });
  };

  buttons.forEach((b) => b.addEventListener('click', () => { category = b.dataset.filter!; apply(); }));
  sortSelect.addEventListener('change', apply);
  apply();
}

/* ── Product page: gallery & share ─────────────────────────── */
function initProductPage() {
  $$('[data-gallery]').forEach((gallery) => {
    const slides = $$('[data-slide]', gallery);
    const thumbs = $$<HTMLButtonElement>('[data-thumb]', gallery);
    thumbs.forEach((thumb, i) =>
      thumb.addEventListener('click', () => {
        slides.forEach((s, j) => (s.hidden = j !== i));
        thumbs.forEach((t2, j) => t2.setAttribute('aria-current', String(j === i)));
      }),
    );
  });

  $$<HTMLButtonElement>('[data-share]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const data = { title: document.title, url: location.href };
      try {
        if (navigator.share) return await navigator.share(data);
        await navigator.clipboard.writeText(location.href);
        toast(tr('product.shareCopied'));
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') toast(location.href);
      }
    }),
  );
}

/* ── Basket page ───────────────────────────────────────────── */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers: fall back to a temporary textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function initBasketPage() {
  const page = $('[data-basket-page]');
  if (!page) return;
  const list = $('[data-basket-lines]', page)!;
  const filled = $('[data-basket-filled]', page)!;
  const emptyState = $('[data-basket-empty]', page)!;
  const subtotalEls = $$('[data-basket-subtotal]', page);
  const orderButtons = $$<HTMLButtonElement>('[data-order]', page);
  const blockedMsg = $('[data-order-blocked]', page);

  const thumb = (id: string) => $<HTMLTemplateElement>(`template[data-thumb-for="${id}"]`)?.innerHTML ?? '';

  const render = () => {
    const rows = basket.lines();
    filled.hidden = rows.length === 0;
    emptyState.hidden = rows.length > 0;
    list.innerHTML = rows.map((line) => {
      const name = escapeHtml(line.product.name[lang]);
      const opts = selectionLabels(line.product, line.options, lang)
        .map(([k, v]) => `<span>${escapeHtml(k)}: <strong>${escapeHtml(v)}</strong></span>`).join('');
      const href = path(lang, `/shop/${line.product.id}/`);
      const max = maxQty(line.product);
      return `
        <li class="line${line.orderable ? '' : ' is-unavailable'}" data-key="${escapeHtml(line.key)}">
          <a class="line-thumb" href="${href}" tabindex="-1" aria-hidden="true">${thumb(line.product.id)}</a>
          <div class="line-info">
            <a class="line-name" href="${href}">${name}</a>
            ${opts ? `<div class="line-opts">${opts}</div>` : ''}
            <div class="line-unit">${escapeHtml(tr('basket.unitPrice'))}: ${formatPrice(lang, line.unit)}</div>
            ${line.orderable ? '' : `<p class="line-warn">${escapeHtml(tr('basket.unavailable'))}</p>`}
          </div>
          <div class="line-controls">
            ${line.orderable ? `
            <div class="qty qty-small" data-qty>
              <button type="button" data-step="-1" aria-label="${escapeHtml(tr('product.decrease'))}">−</button>
              <input type="number" inputmode="numeric" min="1" max="${max}" value="${line.qty}" aria-label="${escapeHtml(tr('product.quantity'))}: ${name}" data-line-qty />
              <button type="button" data-step="1" aria-label="${escapeHtml(tr('product.increase'))}">+</button>
            </div>` : ''}
            <button type="button" class="line-remove" data-remove aria-label="${escapeHtml(tr('basket.removeItem', { name: line.product.name[lang] }))}">${escapeHtml(tr('basket.remove'))}</button>
          </div>
          <div class="line-total">${formatPrice(lang, line.total)}</div>
        </li>`;
    }).join('');
    initSteppers(list);
    const total = formatPrice(lang, basket.subtotal());
    subtotalEls.forEach((el) => (el.textContent = total));
    const blocked = rows.some((r) => !r.orderable);
    orderButtons.forEach((b) => (b.disabled = blocked || rows.length === 0));
    if (blockedMsg) blockedMsg.hidden = !blocked;
  };

  list.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches('[data-line-qty]')) return;
    const key = input.closest<HTMLElement>('[data-key]')!.dataset.key!;
    const max = Number(input.max);
    let n = parseInt(input.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > max) { n = max; toast(tr('msg.maxQty', { max }), { error: true }); }
    basket.setQty(key, n);
  });
  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-remove]');
    if (!btn) return;
    const key = btn.closest<HTMLElement>('[data-key]')!.dataset.key!;
    basket.remove(key);
    $<HTMLElement>('h1', page)?.focus();
  });
  $('[data-clear]', page)?.addEventListener('click', () => {
    if (window.confirm(tr('basket.clearConfirm'))) {
      basket.clear();
      toast(tr('basket.cleared'));
    }
  });

  initOrderModal();
  basket.subscribe(render);
  render();
}

/* ── Order modal (Instagram / email) ───────────────────────── */
function initOrderModal() {
  const dialog = $<HTMLDialogElement>('[data-order-dialog]');
  if (!dialog) return;
  const summaryBox = $<HTMLTextAreaElement>('[data-order-text]', dialog)!;
  const copyBtn = $<HTMLButtonElement>('[data-copy]', dialog)!;
  const copyStatus = $('[data-copy-status]', dialog)!;
  const blocked = $('[data-popup-blocked]', dialog)!;
  const panels = $$('[data-panel]', dialog);
  let mode: 'instagram' | 'email' = 'instagram';

  const open = (m: typeof mode) => {
    mode = m;
    summaryBox.value = orderSummary(lang, { forEmail: m === 'email' });
    $<HTMLAnchorElement>('[data-email-link]', dialog)?.setAttribute('href', orderMailto(lang));
    copyStatus.textContent = '';
    blocked.hidden = true;
    panels.forEach((p) => (p.hidden = p.dataset.panel !== m));
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  const close = () => (typeof dialog.close === 'function' ? dialog.close() : dialog.removeAttribute('open'));

  const doCopy = async () => {
    const ok = await copyText(summaryBox.value);
    copyStatus.textContent = ok ? tr('modal.copied') : tr('modal.copyFailed');
    copyStatus.classList.toggle('is-error', !ok);
    if (!ok) { summaryBox.focus(); summaryBox.select(); }
    return ok;
  };

  $$<HTMLButtonElement>('[data-order]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const m = btn.dataset.order as typeof mode;
      if (basket.lines().some((l) => !l.orderable) || basket.count() === 0) return;
      open(m);
      if (m === 'email') window.location.href = orderMailto(lang);
    }),
  );

  copyBtn.addEventListener('click', doCopy);
  $('[data-copy-open]', dialog)?.addEventListener('click', async () => {
    // Start copying while this page still has focus, then open Instagram straight
    // away (browsers only allow new tabs right after a click).
    // ("noopener" would make window.open return null, hiding whether it was blocked.)
    const copying = doCopy();
    const win = window.open(site.instagramUrl, '_blank');
    if (win) win.opener = null;
    await copying;
    blocked.hidden = !!win;
  });
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', close));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
}

/* ── Contact form ──────────────────────────────────────────── */
function initContactForm() {
  const form = $<HTMLFormElement>('form[data-contact-form]');
  if (!form) return;
  const status = $('[data-form-status]', form)!;
  const submit = $<HTMLButtonElement>('button[type="submit"]', form)!;
  const fields = {
    name: $<HTMLInputElement>('[name="name"]', form)!,
    email: $<HTMLInputElement>('[name="email"]', form)!,
    message: $<HTMLTextAreaElement>('[name="message"]', form)!,
  };
  const setError = (el: HTMLInputElement | HTMLTextAreaElement, msg: string) => {
    const out = $(`#${el.id}-error`, form);
    if (out) out.textContent = msg;
    if (msg) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  };
  const validate = () => {
    let first: HTMLElement | null = null;
    const name = fields.name.value.trim();
    const email = fields.email.value.trim();
    const message = fields.message.value.trim();
    setError(fields.name, name ? '' : tr('contact.form.required'));
    if (!name) first ??= fields.name;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    setError(fields.email, !email ? tr('contact.form.required') : emailOk ? '' : tr('contact.form.invalidEmail'));
    if (!emailOk) first ??= fields.email;
    setError(fields.message, !message ? tr('contact.form.required') : message.length < 5 ? tr('contact.form.short') : '');
    if (message.length < 5) first ??= fields.message;
    first?.focus();
    return !first;
  };
  Object.values(fields).forEach((el) => el.addEventListener('input', () => setError(el, '')));

  const emailLink = `<a class="link" href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>`;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status';
    status.innerHTML = '';
    if (!validate()) return;
    const name = fields.name.value.trim();
    const email = fields.email.value.trim();
    const message = fields.message.value.trim();

    if (site.formspreeId) {
      submit.disabled = true;
      submit.textContent = tr('contact.form.sending');
      try {
        const res = await fetch(`https://formspree.io/f/${encodeURIComponent(site.formspreeId)}`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message, _subject: tr('contact.form.subject') }),
        });
        if (!res.ok) throw new Error(String(res.status));
        status.classList.add('is-success');
        status.textContent = tr('contact.form.sent');
        form.reset();
      } catch {
        status.classList.add('is-error');
        status.innerHTML = `${escapeHtml(tr('contact.form.error'))} ${emailLink}.`;
      } finally {
        submit.disabled = false;
        submit.textContent = tr('contact.form.submit');
      }
      return;
    }

    // No form service configured: open the visitor's email app. We can't know
    // whether they actually press "send", so we never claim it was delivered.
    const body = `${message}\n\n— ${name}\n${email}`;
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(tr('contact.form.subject'))}&body=${encodeURIComponent(body)}`;
    status.classList.add('is-info');
    status.innerHTML = `${escapeHtml(tr('contact.form.mailtoOpened'))} ${emailLink}.`;
  });
}

initHeader();
renderCount();
basket.subscribe(renderCount);
initReveal();
initSteppers();
initAddForms();
initShop();
initProductPage();
initBasketPage();
initContactForm();
