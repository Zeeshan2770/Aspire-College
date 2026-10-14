# Aspire design system (frontend upgrade)

- Tokens: `src/index.css` (`:root`): radius `--r-*`, elevation `--sh-*`, glass `--glass-*`, motion `--dur-*`/`--ease`. Tailwind maps them in `tailwind.config.js` (`rounded-*`, `shadow-soft|card|float|pop|hero`, `text-display|h1|h2|h3|lead`).
- Brand colours stay admin-controlled (`--c-primary/secondary/accent`, set in SiteProvider from Website & Branding). Defaults: navy `#172747`, blue `#246BFD`.
- Fonts: Manrope (headings, `font-display`) + Inter (body), loaded non-blocking from Google Fonts in `index.html`.
- Component classes: `.btn .btn-primary|accent|secondary|light|ghost-light`, `.field`, `.field-label`, `.field-error`, `.surface`, `.glass`, `.glass-dark`, `.eyebrow`, `.prose-body`, `.chip`, `.skeleton`, `.reveal` (scroll reveal via `src/public/useReveal.ts`).
- Glass is used only on the nav, hero overlays, quick links, dialogs/lightbox and student bottom nav; long-form content and data use solid surfaces.
- Reduced motion is respected globally.
