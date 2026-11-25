# Anta — Current design extract (as implemented, 2026-11-16)

Source of truth = code in `inertia/` + `resources/views/`. The old `ux-design-specification.md` / `ux-design-directions.html` are OBSOLETE.
Paths below are relative to the repo root `/home/atlas/projects/anta`.

## 1. Stack & config
- Tailwind v4 (`tailwindcss` ^4.3, `@tailwindcss/vite`), **no tailwind.config**; tokens declared in `@theme` in `inertia/css/app.css`.
- shadcn `components.json`: style `new-york`, baseColor `stone`, cssVariables true, iconLibrary `lucide`, aliases `~/components`, `~/components/ui`, `~/lib/utils`.
- Primitives: `radix-ui` meta-package, `class-variance-authority`, `sonner` (toasts), `lucide-react` (icons, only icon library).
- No `:root` / `.dark` variable blocks. **No dark mode** (only inherited `dark:` classes inside shadcn `button`/`badge`/`select`, never activated).

## 2. Tokens (`inertia/css/app.css`, `@theme`) — exact values
| Token | Value | Note |
|---|---|---|
| `--color-primary` | `oklch(0.5278 0.1413 150.0)` | green-700 `#15803d` (brand) |
| `--color-primary-foreground` | `#ffffff` | |
| `--color-background` | `oklch(0.9851 0.0014 95.0)` | stone-50 `#fafaf9` |
| `--color-foreground` | `oklch(0.2755 0.0066 79.0)` | stone-900 ~`#1c1917` |
| `--color-text-secondary` | `oklch(0.4452 0.0107 79.0)` | stone-600 `#57534e` |
| `--color-card` / `--color-popover` | `#ffffff` | fg `#1c1917` |
| `--color-secondary` / `--color-muted` / `--color-accent` | `#f5f5f4` | stone-100 (accent is neutral on purpose: an amber accent made hovers brown) |
| `--color-muted-foreground` | `#78716c` | stone-500 |
| `--color-destructive` | `#dc2626` | red-600 |
| `--color-border` | `#e7e5e4` | stone-200 (also global default border colour in `@layer base`) |
| `--color-input` | `#d6d3d1` | stone-300 |
| `--color-ring` | `oklch(0.5278 0.1413 150.0)` | green-700 |

- **Radius**: no `--radius` token; Tailwind defaults used directly. Conventions: `rounded-md` (buttons, inputs, pagination, toggles), `rounded-lg` (cards, panels, tables, fieldsets, dropzone), `rounded-full` (search bar, search button, filter chips, badges), `rounded-2xl` only on the home hero.
- **Shadows**: almost none. `shadow-xs` on inputs/outline buttons, `shadow-sm` only on the admin login card. Depth comes from borders (stone-200) on white surfaces over a stone-50 background.
- **Focus**: global `:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px }` (WCAG); shadcn components add `ring-[3px] ring-ring/50`.
- **Status colours (raw Tailwind, no tokens)**: success/brand = green-700/800, green-50/100/300; warning = amber-50/200/300/700/800/900; error = red-600/700, red-50.

## 3. Typography
- Fonts (Google Fonts, both edge layouts `resources/views/inertia_layout.edge`, `admin_layout.edge`): **Inter** 400/500/600/700 (body, `system-ui` fallback) + **Playfair Display** 600/700 (headings, Georgia fallback).
- `@layer base`: `h1, h2` → Playfair Display, weight 600, automatically. Utility `.font-display` = Playfair for other elements (card titles h3, filter sidebar title).
- Consequence: admin `h1`/`h2` are also serif (Playfair) even with `font-semibold`.
- Scale actually used:
  - Home hero h1: `font-display text-3xl sm:text-4xl leading-tight text-stone-900`; eyebrow `text-sm font-medium uppercase tracking-widest text-green-700`; subtitle `text-stone-600 max-w-xl`.
  - Home section h2: `text-2xl text-stone-900`.
  - Production detail h1: `font-display text-3xl leading-tight`; section h2: `text-xl text-stone-900`.
  - Privacy h1: `text-3xl font-bold mb-8`; h2: `text-xl font-semibold text-stone-800`; body `text-stone-700 leading-relaxed` (in `max-w-3xl`).
  - Card title h3: `font-display text-lg leading-snug`.
  - Admin page h1: `text-2xl font-semibold text-stone-900`; KPI numbers `text-2xl/3xl font-semibold`, `tabular-nums` in tables.
  - Body: `text-sm`/`text-base` stone-700; secondary stone-600; meta/labels **`text-xs uppercase tracking-wide text-stone-500/600`** (recurring pattern: card meta, detail `dt`, filter dimension labels, stat labels).
- Locales FR/EN (`inertia/locales/`), all strings via i18n.

## 4. Brand / logo
- `public/images/logo_anta.png` (512×512 PNG, square): green circular swoosh + dark-brown stylised "A" (book/building) held by a green hand, "ANTA" green wordmark below. `public/favicon.png`.
- Logo sizes: header `h-10`, footer / admin sidebar `h-8`, admin login `h-10`.
- Brand colour = green-700 everywhere (primary buttons, active states, links hover, icons in detail aside, chart bars). Neutrals = stone. No secondary brand colour.

## 5. Public layout — `inertia/layouts/PublicLayout.tsx`
- Shell: `min-h-screen flex flex-col bg-background text-stone-900`; skip link (green pill on focus).
- **Header**: `sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-stone-200`; inner `max-w-7xl mx-auto px-6 py-4 flex justify-between`. Contents: logo (link `/`) left, `LanguageSwitcher` (FR | EN text buttons, active `font-semibold text-green-700`, min-h-11) right. **No nav menu, no search in header, no auth links.**
- **Main**: `max-w-7xl mx-auto px-6 py-8`.
- **Footer**: `border-t bg-stone-50 mt-12`, `py-10 grid gap-8 sm:grid-cols-3`: (1) logo h-8 + about text `text-sm text-stone-600 max-w-xs`; (2) "Explorer" nav: Home, Search (`/productions`), Privacy policy; (3) Contact `contact@anta.community`. Bottom bar: copyright `text-sm text-stone-600`. Column titles `text-sm font-semibold` (h2 → serif). Links `hover:text-green-700`.
- Toasts: sonner `top-center richColors`.

## 6. Pages (public)
### Home — `inertia/pages/home.tsx` (order)
1. **Hero** card: `rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-100 to-background px-6 py-12 sm:py-16 text-center` → eyebrow (green uppercase) → h1 tagline → subtitle → `SearchBar` (`max-w-2xl`) → category chips (`FilterBar` home mode, horizontal scroll-snap).
2. **Section "Most viewed"** (`mt-12`, h2 + grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5` of grid cards).
3. **Section "Recent"** (same). Empty state: `text-sm text-stone-500`.
No stats band, no illustrations/images, no CTA blocks.

### Search / listing — `inertia/pages/productions.tsx`
- Container `max-w-6xl`; h1 sr-only; full-width `SearchBar` on top.
- `lg:flex-row gap-8`: left `FilterSidebar` (`lg:w-64`, mobile = collapsible button "Filters" with `SlidersHorizontal`; desktop = `<details>` per dimension, `border-b`, ChevronDown, check-list items `hover:text-green-700`, in-facet search input, `max-h-60` scroll), right results.
- Results toolbar: count `text-sm text-stone-600` left; right `Select` sort (`w-44`: relevance/date/views/downloads) + `ListingToggle` (two `size-11 rounded-md` icon buttons List / LayoutGrid; active `bg-green-700 text-white border-green-700`).
- View persisted in localStorage `anta:productions-view`, **default = list**. Grid: `sm:grid-cols-2 xl:grid-cols-3 gap-5`; list: `flex flex-col gap-4`.
- Approximate results notice: `rounded-md border-amber-200 bg-amber-50 text-amber-900`. No-results: centred stone-500 + green "reset filters" link.
- `Pagination` (`inertia/components/shared/Pagination.tsx`): centred `h-9 min-w-9 rounded-md border` squares, active green-700 filled, chevrons.

### Production detail — `inertia/pages/production.tsx`
- Breadcrumb `text-sm text-stone-500` with `/` separators (stone-300), current item truncated.
- Header: serif h1 + "By authors" (stone-600) left, `ShareButton` right.
- Grid `lg:grid-cols-3 gap-8`: main `lg:col-span-2` = Summary (`whitespace-pre-line text-stone-700`), Files (`MediaViewer` per file: `rounded-lg border bg-white p-4`, file name + size, primary green download button + outline secondary button, inline PDF/video/audio viewer), External links (embed iframe `aspect-video rounded-lg border`, or green button with `ExternalLink`).
- Aside `lg:col-span-1`: single white card `rounded-lg border p-5`: counters (Eye/Download `size-5 text-green-700` + `text-lg font-semibold`), `<dl>` MetaRows (dt `text-xs uppercase tracking-wide text-stone-500`, dd `text-sm text-stone-900`, separated `border-t border-stone-100`, empty rows hidden), subdomains & tags as `Badge variant="outline"`, full-width ShareButton at bottom.

### Privacy — `inertia/pages/privacy-policy.tsx`: plain article `max-w-3xl`, 6 sections h2 + paragraph.

## 7. Production card — `inertia/components/public/ProductionCard.tsx`
Single component, `variant: 'grid' | 'list'`. **Text-only card: no cover image, no thumbnail, no badges, no file-type icon.**
- Container: `rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-green-700` (grid adds `flex flex-col`).
- Order: title h3 (`font-display text-lg leading-snug`, link, `hover:text-green-700`) → byline `mt-1 text-sm text-stone-600` "By A, B" → meta `mt-1 text-xs uppercase tracking-wide text-stone-600` "Category · Domain" → summary `mt-3 text-sm text-stone-700` (`line-clamp-3` grid / `line-clamp-2` list) → counters `mt-4 flex gap-4 text-sm text-stone-500` with lucide `Eye`, `Download`, `Calendar` (`size-4`) + date `d MMM yyyy` localised.
- Grid vs list differ only in line clamp and layout container; same vertical stack.

## 8. Component inventory
- shadcn `inertia/components/ui/`: `button.tsx` (variants default/destructive/outline/secondary/ghost/link; sizes default h-9, xs h-6, sm h-8, lg h-10, icon 9/6/8/10; stone overrides replace token names), `badge.tsx` (rounded-full `text-xs`; default/secondary/destructive/outline/ghost/link), `dialog.tsx` (confirm modals, `role="alertdialog"`), `input.tsx`, `select.tsx`. **No card, table, tabs, dropdown, sheet, tooltip, checkbox, textarea, label components** — those are hand-rolled with Tailwind.
- Public `inertia/components/public/`: `SearchBar` (pill `h-12 rounded-full border-stone-300 bg-white pl-11`, Search icon, clear X, green pill submit `h-12 px-6 hover:bg-green-800`), `FilterBar` (home chips / listing multi-dimension chips), `FilterChip` (`min-h-11 rounded-full px-4 text-sm`; active `bg-green-700 text-white`, idle `border-stone-300 hover:border-green-700 hover:text-green-700`, `aria-pressed`), `FilterSidebar`, `ListingToggle`, `ProductionCard`, `MediaViewer`, `PdfViewer`, `ShareButton`, `ViewTracker`.
- Shared `inertia/components/shared/`: `LanguageSwitcher`, `Pagination`.
- Admin `inertia/components/admin/`: `ProductionForm`, `ProductionFormActions`, `CompletionIndicator`, `FileUploader`, `LinkManager`, `ChipInput`, `StatusBadge`, `ProductionStats`.

## 9. Admin — `inertia/layouts/AdminLayout.tsx`, `AdminAuthLayout.tsx`
- **Desktop only** (`hidden lg:flex`); below `lg` a centred "use a desktop" message.
- **Left sidebar** `w-64 bg-white border-r border-stone-200`: logo h-8 header (`px-6 py-5 border-b`); nav items (lucide `FolderOpen` Productions, `BarChart3` Statistics, `Users` Users*, `ScrollText` Activity*; *super admin only) `px-6 py-2.5 text-sm border-l-[3px]`; active `bg-green-100 text-green-700 border-green-700 font-medium`, idle `text-stone-700 hover:bg-stone-50`. Footer block: role badge (super admin = green filled, admin = secondary), email, Logout (`LogOut` icon).
- Main `flex-1 px-8 py-8` on stone-50; sonner `bottom-right`, closeButton, max 3.
- Auth layout: centred `max-w-md`, logo h-10, white card `rounded-lg border shadow-sm p-8`.
- **Productions list** (`inertia/pages/admin/Productions/Index.tsx`): header row h1 + green "Create" button; filter row (search Input with icon `min-w-[16rem]`, Selects `w-44` for status/category/domain/language, ghost "clear"); **plain HTML table** in `rounded-lg border overflow-x-auto`, thead `bg-stone-50 text-stone-600 font-medium px-4 py-3`, rows `border-b border-stone-100`; columns Title / Authors / Category / Status / Updated / Actions (outline sm Edit, outline sm Unpublish, ghost red Delete); empty state with `Library` icon size-12 stone-300; confirm Dialogs.
- `StatusBadge`: draft = secondary (stone-100), published = outline `border-green-600 text-green-700`, unpublished = outline `border-amber-700 text-amber-800`.
- **Production form** (`Create.tsx`/`Edit.tsx` in `max-w-3xl`, `components/admin/ProductionForm.tsx`): `space-y-8`; sticky `CompletionIndicator` on top (green-50/300 complete vs amber-50/300 incomplete, CheckCircle2/AlertCircle, anchor links to missing fields); `<fieldset class="rounded-lg border border-stone-200 p-6">` + `legend px-2 text-sm font-semibold` sections: General, Content, Rights, Optional, Files. Labels `text-sm font-medium text-stone-700`, required `*` red-600, errors `mt-1 text-sm text-red-600`. `ChipInput` chips `rounded-full bg-green-100 text-green-800`. `FileUploader` dashed dropzone `border-2 border-dashed rounded-lg` (stone-300/stone-50, drag-over green-700/green-50), progress bar green-700 on stone-200, file list `divide-y rounded-lg border`. Actions bar `mt-8 flex gap-3`: green save/publish, amber outline unpublish, green outline variant; `Loader2` spinner.
- Stats (`pages/admin/Stats/Index.tsx`, `ProductionStats.tsx`): KPI cards `rounded-lg border bg-white p-5` in `sm:grid-cols-3`, label xs uppercase stone-500 with icon, value `text-3xl font-semibold`; simple CSS bar chart (`bg-green-700 rounded-t`, `h-32`); tables `text-sm tabular-nums`.

## 10. Responsive
- Breakpoints used: mostly `sm:` (21) and `lg:` (14), rare `md:` (1) and `xl:` (1). Mobile-first; touch targets `min-h-11`/`size-11` (44 px) on public interactive elements. Containers `max-w-7xl` (layout), `max-w-6xl` (listing), `max-w-3xl` (form, privacy), `max-w-5xl` (stats).

## 11. Conventions — Do / Don't
- DO use stone neutrals + green-700 as the only accent; hover darker `green-800` for filled green; text links `text-green-700 hover:underline` or `hover:text-green-700`.
- DO separate surfaces by `border-stone-200` + white bg on stone-50 page; avoid shadows.
- DO use serif Playfair only for headings/titles (h1/h2 auto, `.font-display` elsewhere), Inter elsewhere.
- DO use xs uppercase tracking-wide stone-500/600 for metadata labels.
- DO keep icons lucide `size-4` inline (`size-5` emphasis), `aria-hidden` + aria-label on parent.
- DO use pills (`rounded-full`) for search, chips, badges; `rounded-md` for buttons; `rounded-lg` for cards.
- DO use amber for warnings/"approximate"/incomplete, red-600 for destructive.
- NOTE: many components hard-code Tailwind palette classes (`bg-green-700`, `text-stone-600`) instead of semantic tokens (`bg-primary`, `text-muted-foreground`); shadcn ui files were edited to stone classes. Both coexist.
- DON'T introduce dark mode, imagery/cover thumbnails or a second brand colour without a decision (none exist today).
- DON'T rely on `--radius` or `.dark` vars (absent).
