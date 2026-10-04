# Santos frontend redesign

Implemented October 4, 2026.

## Direction

A product-led, charcoal-and-brass interface with Geist typography. The homepage explains the product through an interactive report, then leads visitors to public evidence, audit options, developer integrations, and canonical pricing.

The report preview is explicitly labeled as sanitized sample data. Index claims still come from `lib/index-stats.js`; displayed report/API prices come from `lib/products.js`. The existing structured data, analytics consent, audit endpoints, payment enforcement, and report delivery paths are retained.

## Library research and selection

- [Motion for React](https://motion.dev/docs/react): used for the report entrance transition, with reduced-motion support and visible server-rendered content.
- [Radix Primitives](https://www.radix-ui.com/primitives/docs/components/tabs): used for the report and developer tabs, including arrow-key navigation and focus semantics.
- [shadcn/ui](https://ui.shadcn.com/docs): reviewed for component composition and accessibility. This app already has a substantial CSS system, so it was not migrated to Tailwind or given a second global reset.
- [Aceternity UI](https://ui.aceternity.com/components) and [React Bits](https://reactbits.dev): reviewed for visual treatments. The implemented artwork uses original CSS and SVG rather than copying premium components or introducing a WebGL runtime.
- Geist fonts are bundled locally through the `geist` package. Lucide provides the icon system.

## Implementation

- New responsive homepage with an interactive Overview/Evidence/JSON preview, JSON copy, four intelligence dimensions, index snapshot, audit feature cards, developer code tabs, pricing, native FAQ accordions, and a founder/contact section.
- Shared header/footer, mobile menu with Escape/focus handling, skip link, and design tokens across public routes.
- Pricing links point to the existing `/pricing` route. Deep Report links preserve `?tier=deep` at checkout. The checkout UI receives prices from the same catalog as server-side enforcement and uses native form validation.
- `CspImage` omits Next Image's optional inline color style. The Radix tab surfaces omit optional inline presentation styles. The original nonce-based CSP and `style-src 'self'` remain unchanged.
- CSS clips only decorative orbit artwork to prevent overflow. Content remains visible without JavaScript; animations honor reduced-motion preferences.
- Cookie settings retain their existing behavior and now clean up their delegated event listener.
- Compatible dependency updates resolve the advisories found by the repository's existing audit gate. Next resolves to 16.3.8 in the lockfile; no major framework migration was made.

## Verified locally

- `npm run build`: passed.
- `npm run test:unit`: 131 passed, 2 existing skipped, 0 failed (133 total).
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm run test:frontend`: 7 passed, covering:
  - Browser errors/CSP warnings and horizontal overflow at 320, 390, 768, 1024, and 1440 pixels.
  - Keyboard report tabs, evidence, and JSON clipboard output.
  - Developer tabs and the corresponding copied code.
  - Mobile menu, Escape, focus restoration, and pricing navigation.
  - FAQ interaction and persisted/reopenable cookie choices.
  - Deep checkout selection, request payload, error presentation, and recovery.
  - Automated axe WCAG A/AA checks on desktop and mobile (no detected violations; not an accessibility certification).

The checkout browser check uses a visibly fake test key and intercepts `/api/checkout`; it does not contact Stripe or purchase anything. Live payment processing, database-backed reports, audit execution, email delivery, and production deployment are outside this frontend verification.

## Reproduce

```sh
npm ci
npm run test:unit
npm audit --audit-level=high
npm run build
npx playwright install chromium
npm run test:frontend
```

If a browser is already installed, set `SANTOS_BROWSER_PATH` to its executable. The test runner starts and stops a local production server on port 3100. The provided screenshots were captured with headless Chromium 134 in the execution environment. The agent-browser helper could not bind its local socket here, so equivalent checks ran directly through Playwright.

## Screenshots

- [Desktop](screenshots/frontend-desktop.png)
- [Mobile](screenshots/frontend-mobile.png)
