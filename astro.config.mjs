// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL: the address where the shop is published (used for SEO links).
// BASE_PATH: set to "/repo-name" when hosting on GitHub Pages without a custom domain.
export default defineConfig({
  site: process.env.SITE_URL || 'https://create-by-costa.example.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'el',
    locales: ['el', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
