/** Builds the plain-text order summary sent via Instagram or email. */
import { site } from '../config/site';
import { t, formatPrice, locales } from '../i18n/utils';
import type { Lang } from '../i18n/ui';
import { lines, subtotal } from './basket';
import { selectionLabels } from './catalog';

export function orderSummary(lang: Lang, opts: { forEmail?: boolean } = {}): string {
  const date = new Intl.DateTimeFormat(locales[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const rows = lines().filter((l) => l.orderable);
  const out: string[] = [];

  out.push(`${site.brandName} · ${t(lang, 'order.heading')}`);
  out.push(`${t(lang, 'order.date')}: ${date}`);
  out.push('');
  out.push(t(lang, 'order.greeting'));
  out.push('');
  rows.forEach((line, i) => {
    out.push(`${i + 1}. ${line.product.name[lang]}`);
    for (const [label, value] of selectionLabels(line.product, line.options, lang)) {
      out.push(`   ${label}: ${value}`);
    }
    out.push(`   ${t(lang, 'order.qty')}: ${line.qty} × ${formatPrice(lang, line.unit)} = ${formatPrice(lang, line.total)}`);
  });
  out.push('');
  out.push(`${t(lang, 'order.total')}: ${formatPrice(lang, subtotal())}`);
  out.push(t(lang, 'order.excl'));
  out.push('');
  out.push(t(lang, 'order.confirmNote'));
  if (opts.forEmail) {
    out.push('');
    out.push(t(lang, 'order.contactPrompt'));
    out.push('');
    out.push('');
    out.push(t(lang, 'order.thanks'));
  }
  return out.join('\n');
}

export function orderMailto(lang: Lang): string {
  const subject = encodeURIComponent(t(lang, 'order.emailSubject'));
  const body = encodeURIComponent(orderSummary(lang, { forEmail: true }));
  return `mailto:${site.email}?subject=${subject}&body=${body}`;
}
