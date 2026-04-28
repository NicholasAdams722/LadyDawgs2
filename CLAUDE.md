# CLAUDE.md: Frontend Website Rules

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions. Read it fully before touching markup, styles, or components.
- Name the aesthetic direction in one sentence before coding (e.g. "editorial magazine with a transitional serif display and restrained motion"). No coding starts until the direction is named.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or the user says so.

## Local Server
- **Always serve on localhost.** Never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`).
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.

## Screenshot Workflow
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`.
- Screenshots save automatically to `./temporary-screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 hero` saves as `screenshot-N-hero.png`.
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `./temporary-screenshots/` with the Read tool. Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px".
- Check on every comparison pass: spacing and padding, font size and weight and line-height, colors (exact hex), alignment, border-radius, shadows, image sizing.

## Output Defaults
- Default to a single `index.html` file with all styles inline, unless the user has named a framework (Next.js, Astro, Remix, etc.).
- For single-file output: Tailwind via CDN: `<script src="https://cdn.tailwindcss.com"></script>`.
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`.
- For framework projects: follow the existing project structure. Do not introduce new dependencies without asking first.

## Brand Assets
- Check `./brand/`, `./public/brand/`, and `./assets/` first. If real assets exist, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined (in `BRAND.md`, a tokens file, or Tailwind config), use those exact values. Do not invent brand colors.
- If a `BRAND.md` exists at the root, read it before designing.

## Anti-Generic Guardrails
The site must not look AI-generated or template-derived. Apply these tactically.
- **Colors:** Never use the default Tailwind palette as primary (no indigo-500, blue-600, slate-900 hero accents). Pick a custom brand color and derive the palette from it. Define tokens as CSS custom properties on `:root`.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity. Stack two: one tight and dark for contact, one wide and brand-tinted for atmosphere.
- **Typography:** Never use the same font for headings and body. Pair a distinctive display or serif with a clean sans. Apply tight tracking (`-0.02em` to `-0.04em`) on large headings, generous line-height (`1.6` to `1.75`) on body. Banned as primary face: Inter, Roboto, Arial, system-ui.
- **Gradients:** Layer multiple radial gradients. Add grain or texture via an SVG noise filter for depth. Avoid the purple-to-blue cliche entirely.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style or custom cubic-bezier easing, never the default `ease`.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (e.g. `bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply` to unify disparate photography.
- **Z-plane:** Some elements should float above the baseline (cards, callouts, drop caps, badges). Not all elements should sit at the same z-plane.
- **Components:** Default shadcn/ui or unstyled primitives are a starting point, not a finished look. Restyle every component before shipping.

## Writing and Copy Rules
- **No em dashes anywhere on the site.** Not in copy, headings, alt text, meta descriptions, image captions, or code comments that ship to production. This applies to `—` (U+2014) and to double hyphens `--` used as an em dash substitute in prose.
- Acceptable substitutes: a comma, a period, a colon, parentheses, or a restructured sentence. Pick the one that reads cleanly.
- En dashes (`–`) are allowed only in numeric ranges like "2020 to 2024" style ranges, never as sentence punctuation.
- Run `grep -rn "—" .` and `grep -rn " -- " .` before declaring a section done. Both must return nothing in shipped content.
- Sentence case for headings unless the brand system explicitly calls for title case. No ALL CAPS unless tied deliberately to the aesthetic direction.
- No lorem ipsum or placeholder copy in committed output. Write realistic content.

## SEO and Discoverability
- Semantic HTML by default: `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<main>` used correctly.
- Schema.org JSON-LD for the org, site, and any article or product pages.
- `llms.txt` at the root describing site purpose and primary content surfaces.
- Meta titles and descriptions written by hand per page, not templated. Open Graph and Twitter card images sized correctly (1200x630 default).

## Verification Loop (Before Saying "Done")
1. Screenshot every page at desktop (1440), tablet (768), and mobile (375) widths.
2. Walk through the page top to bottom and name three things that feel distinctive. If you cannot name three, the design is not done.
3. Run the em dash grep. Run a Lighthouse pass. For TypeScript projects, run `tsc --noEmit`.
4. Read every line of copy out loud once. Fix anything that sounds like an LLM wrote it.
5. Only then ask the user to review.

## Hard Rules
- Do not add sections, features, or content not in the reference.
- Do not "improve" a reference design. Match it.
- Do not stop after one screenshot pass.
- Do not use `transition-all`.
- Do not use default Tailwind blue or indigo as the primary color.
- Do not use Inter, Roboto, Arial, or system-ui as the primary typeface.
- Do not commit lorem ipsum or placeholder copy.
- Do not use em dashes anywhere in shipped content.
- Do not introduce new dependencies in framework projects without asking.
