# CareerPilot Design System & UI Specification

## 1. Philosophy & Visual Direction

The CareerPilot AI design system is inspired by the clean, minimal aesthetic of modern high-end SaaS applications (such as [TryRote](https://tryrote.com/)), tailored specifically for career co-piloting. It balances executive-level polish with functional efficiency.

### Core Principles
- **Pristine White Canvas**: Predominantly white (`#FFFFFF`) and off-white (`#F8FAFC`, `#F1F5F9`) backgrounds that feel spacious, calm, and uncluttered.
- **Deep Charcoal Typography**: Text hierarchy anchored on slate-900 (`#0F172A`) for high contrast readability without the harshness of pure black.
- **Restrained Accents**: Purpose-driven, muted indicator colors (emerald for verified/completed, amber for human review, indigo for AI agents, rose for critical gaps).
- **Subtle Glassmorphism**: Translucent headers (`bg-white/80 backdrop-blur-md border-b border-slate-200/80`) that dissolve into the page on scroll.
- **Micro-Interactions**: Smooth 150ms–200ms cubic transitions on hover, focus, and state changes with full `prefers-reduced-motion` compliance.

---

## 2. Color Palette & Tokens

| Token | Hex | Tailwind Utility | Semantic Purpose |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#FFFFFF` | `bg-white` | Main surface, cards, modals |
| **Subtle Canvas** | `#F8FAFC` | `bg-slate-50` | App background, code blocks, secondary containers |
| **Muted Canvas** | `#F1F5F9` | `bg-slate-100` | Hover states, pill tracks, dividers |
| **Border Subtle** | `#F1F5F9` | `border-slate-100` | Internal row dividers, soft cards |
| **Border Default** | `#E2E8F0` | `border-slate-200` | Component borders, inputs, modals |
| **Text Primary** | `#0F172A` | `text-slate-900` | Headings, active values, button labels |
| **Text Secondary** | `#475569` | `text-slate-600` | Body copy, secondary actions, tooltips |
| **Text Muted** | `#94A3B8` | `text-slate-400` | Placeholders, timestamps, subtle icons |
| **Success (Verified)**| `#059669` | `emerald-600` | Matched skills, approved outreach, high scores |
| **Warning (Review)** | `#D97706` | `amber-600` | Pending human approvals, caution badges |
| **Info / AI Accent** | `#4F46E5` | `indigo-600` | LangGraph agent tags, interview modes |
| **Destructive / Gap** | `#E11D48` | `rose-600` | Missing required skills, rejected statuses |

---

## 3. Typography Hierarchy

CareerPilot utilizes a high-contrast, modern sans-serif font stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`).

- **Display Hero Headings**: `text-3xl` / `text-4xl` font-semibold tracking-tight text-slate-900.
- **Section Headers**: `text-lg` / `text-xl` font-semibold tracking-tight text-slate-900.
- **Subtitles & Descriptions**: `text-sm` text-slate-500 font-normal leading-relaxed.
- **Interactive Labels & Buttons**: `text-xs` / `text-sm` font-medium tracking-normal.
- **System & Metric Metadata**: `text-[11px]` / `text-xs` font-mono uppercase tracking-wider text-slate-500.

---

## 4. Reusable Component Inventory

All components are located under [`frontend/components/ui/`](file:///Users/zaidhaque/Desktop/CareerPilot/frontend/components/ui) and strictly adhere to unified tokens:

### 1. `Button`
- **Variants**: `primary` (slate-900 with white text), `secondary` (slate-100 with slate-800 text), `outline` (white background with slate-200 border), `ghost` (transparent background with slate-600 hover), `destructive` (rose-600 with white text).
- **Sizes**: `sm` (compact, 28px height), `md` (standard, 36px height), `lg` (prominent, 44px height).
- **Features**: Built-in loading spinner, icon slot (`icon`), full-width support, and disabled state prevention.

### 2. `Card` & `CardHeader`
- **Variants**: `default` (white with slate-200/90 border), `flat` (slate-50 background, subtle border), `elevated` (subtle shadow), `interactive`/`hover` (smooth translate-y on hover).
- **Subcomponents**: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

### 3. `Badge`
- **Variants**: `default` (slate-100), `brand` (indigo-50 / text-indigo-700), `success` (emerald-50 / text-emerald-700), `warning` (amber-50 / text-amber-700), `danger` (rose-50 / text-rose-700), `outline` (border-slate-200).
- **Sizes**: `sm` (10px font), `md` (12px font).

### 4. `Input`, `Textarea`, `Select`
- Minimalist borders (`border-slate-200`), slate-900 focus rings with subtle offset, clear labels, helper text, and inline validation states.

### 5. `Modal` & `Drawer`
- Clean white backdrop dialogs with `backdrop-blur-sm bg-slate-900/40` overlay.
- Accessible escape key handling, click-outside dismissal, and scroll lock.

### 6. `Tabs` & `Metric`
- Underline and pill variants for zero-latency view switching.
- Standardized numeric stat display with trend indicators and context badges.

### 7. `Progress` & `Timeline`
- Monochromatic or semantic completion bars for deterministic skill coverage and step-by-step career timelines.

### 8. `JobCard`
- Compact, dense card rendering role, company, location, experience requirements, match percentage badge, matched/missing skill chips, and quick actions.

### 9. State Handlers (`LoadingState`, `EmptyState`, `ErrorState`)
- Standardized placeholder illustrations, clean descriptions, and primary CTA retry or navigation buttons.

---

## 5. Responsive Behavior & Breakpoints

- **Mobile (< 640px)**: Single column layouts, collapsible mobile navigation drawer, vertical action strips, touch-friendly 44px hit targets.
- **Tablet (640px - 1023px)**: 2-column grids for jobs and metric dashboards, balanced horizontal padding.
- **Desktop (>= 1024px)**: 3-column job grids, side-by-side LaTeX diff viewer, horizontal 8-column Kanban board with smooth scroll.

---

## 6. Accessibility & Performance Guardrails

1. **Contrast Compliance**: All text elements meet WCAG 2.1 AA standards (minimum 4.5:1 for body copy).
2. **Motion Preference**: Animations honor `prefers-reduced-motion: reduce` by disabling transforms and transitions.
3. **Bundle Efficiency**: Lightweight Lucide icons, native CSS transitions, zero bulky UI framework overhead.
