import { pastelHex } from '../../data/categories';
import type { Product } from '../../data/products';

/**
 * The admin page renders one CandleArt per shape with these placeholder colours
 * (see src/pages/admin/index.astro); artSvg() swaps in a product's real colours,
 * so previews look exactly like the shop without redrawing the candles here.
 */
export const ART_WAX = '#010101';
export const ART_ACCENT = '#020202';
export const ART_BG = 'pink';

export const shapes: Product['art']['shape'][] = ['jar', 'pillar', 'tin', 'bubble', 'heart'];

const hex = /^#[0-9a-f]{3,8}$/i;

export function artSvg(art: Product['art']): string {
  if (!shapes.includes(art.shape)) return '';
  const tpl = document.querySelector<HTMLTemplateElement>(`template[data-art="${art.shape}"]`);
  if (!tpl) return '';
  return tpl.innerHTML
    .replaceAll(ART_WAX, hex.test(art.wax) ? art.wax : '#fbebc9')
    .replaceAll(ART_ACCENT, hex.test(art.accent) ? art.accent : '#dfb154')
    .replaceAll(pastelHex[ART_BG], pastelHex[art.bg] ?? pastelHex[ART_BG]);
}
