import { ui, defaultLang, type Lang, type UIKey } from './ui';

export type Localized = { el: string; en: string };

/** Translate a key, filling {placeholders} from vars. */
export function t(lang: Lang, key: UIKey, vars: Record<string, string | number> = {}): string {
  const text = ui[lang][key] ?? ui[defaultLang][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

/** Pick the right language from a { el, en } object. */
export function l(lang: Lang, value: Localized): string {
  return value[lang] || value[defaultLang];
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Build a link for the given language, e.g. path('en', '/shop/') → '/en/shop/'. */
export function path(lang: Lang, p = '/'): string {
  const clean = p.startsWith('/') ? p : `/${p}`;
  return `${base}${lang === defaultLang ? '' : `/${lang}`}${clean}`;
}

/** Link to a file in public/, respecting the base path. */
export function asset(p: string): string {
  if (/^https?:/.test(p)) return p;
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

/** The same page in the other language. */
export function switchLangPath(pathname: string, to: Lang): string {
  let rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  rest = rest.replace(/^\/en(?=\/|$)/, '') || '/';
  return path(to, rest);
}

export const locales: Record<Lang, string> = { el: 'el-GR', en: 'en-GB' };

export function formatPrice(lang: Lang, amount: number): string {
  return new Intl.NumberFormat(locales[lang], { style: 'currency', currency: 'EUR' }).format(amount);
}
