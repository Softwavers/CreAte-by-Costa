/**
 * ─────────────────────────────────────────────────────────────
 *  SHOP SETTINGS: edit this file to change contact details.
 * ─────────────────────────────────────────────────────────────
 */

export const site = {
  brandName: 'CreAte by Costa',

  /** Full link to the Instagram profile (used in the header, footer and orders). */
  instagramUrl: 'https://www.instagram.com/create_bycosta?exln=MWE5bm9jYmx2djZjeA==',

  /** The handle shown as text next to the Instagram icon. */
  instagramHandle: '@create_bycosta',

  /** Business email address. Orders and contact messages go here. */
  email: 'Createbycosta@hotmail.com',

  /**
   * Optional: a free Formspree form ID (e.g. "xyzabcd") so the contact form
   * sends messages straight from the website. Leave empty ('') and the form
   * will open the visitor's own email app instead.
   */
  formspreeId: '',

  /**
   * Photos for the "Our creations" gallery on the home page.
   * Put image files in public/images/gallery/ and list them here,
   * e.g. '/images/gallery/candles-1.jpg'. Leave empty to show illustrations.
   */
  gallery: [] as string[],

  /**
   * Customer reviews. Only add real ones, quoted with the customer's permission.
   * Example: { quote: { el: '…', en: '…' }, name: 'Maria' }
   * The section is hidden while this list is empty.
   */
  testimonials: [] as { quote: { el: string; en: string }; name: string }[],

  /**
   * Admin page (/admin/). Product changes made there are saved to this
   * GitHub repository and branch, which then republishes the site.
   */
  admin: {
    repo: 'Softwavers/CreAte-by-Costa',
    branch: 'main',
  },
};
