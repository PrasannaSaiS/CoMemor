# Agent Memory MCP — Dashboard Design System & Token Specification
**Specification Version:** 1.0.0  
**Target Surface:** Memory Console (Observability & Safety Dashboard for `CoMemor`)  
**Design Philosophy:** Rigorous Engineering, Precision Telemetry, Defensible Safety, Zero Generic Clutter.

---

## 1. Executive Summary & Design Rationale

The Agent Memory Console is a mission-critical safety and observability tool for an AI agent error-fix memory system. When operators and researchers view this dashboard, the visual language must communicate:
1. **Absolute Integrity:** Data, cryptographic hashes, and statistical bounds (e.g. Wilson score 95% CI) are unambiguous, unclipped, and legible.
2. **Defensible Safety:** Security and drift states (poisoning quarantine, lockfile staleness, high-risk execution dry-runs) demand immediate, intuitive recognition without alarming or cartoonish tropes.
3. **Information Density with Breathing Room:** Observability tools must convey dense telemetry without feeling cramped or noisy. Spacing rhythm, typography, and contrast do the heavy lifting rather than decorative containers.

---

## 2. Typography System & Typeface Pairing

We deliberately pair **Plus Jakarta Sans** (a geometric, highly legible modern grotesque with generous x-height and clean geometric forms for interface structure, headings, and labels) with **JetBrains Mono** (an engineered monospace font featuring optimized tabular figures, distinguished glyphs for `0`/`O` and `1`/`l`, and crisp code rendering).

### Type Scale Hierarchy

| Token Name | Font Family | Size | Weight | Line Height | Letter Spacing | Purpose / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `--font-display` | Plus Jakarta Sans | `1.5rem` (24px) | 700 (Bold) | 1.25 | `-0.025em` | Main Screen Titles |
| `--font-title-lg` | Plus Jakarta Sans | `1.125rem` (18px) | 600 (SemiBold) | 1.35 | `-0.015em` | Panel Headers, Modal Titles |
| `--font-title-sm` | Plus Jakarta Sans | `0.9375rem` (15px) | 600 (SemiBold) | 1.4 | `-0.01em` | Card Subheadings, Section Leads |
| `--font-body` | Plus Jakarta Sans | `0.875rem` (14px) | 400 (Regular) | 1.5 | `0` | Standard Body Copy, Rationale Text |
| `--font-body-medium`| Plus Jakarta Sans | `0.875rem` (14px) | 500 (Medium) | 1.5 | `0` | Interactive Labels, Table Body |
| `--font-label` | Plus Jakarta Sans | `0.75rem` (12px) | 600 (SemiBold) | 1.35 | `+0.04em` | All-Caps KPI Labels, Badges, Table Headers |
| `--font-caption` | Plus Jakarta Sans | `0.6875rem` (11px) | 500 (Medium) | 1.4 | `+0.01em` | Metadata Subtext, Timestamps, Footers |
| `--font-mono-lg` | JetBrains Mono | `1.125rem` (18px) | 600 (SemiBold) | 1.35 | `-0.01em` | Active Diagnostic Queries, Hero Values |
| `--font-mono-base` | JetBrains Mono | `0.8125rem` (13px) | 500 (Medium) | 1.45 | `0` | Command Snippets, Code Blocks |
| `--font-mono-sm` | JetBrains Mono | `0.75rem` (12px) | 400 (Regular) | 1.4 | `0` | SHA-256 Fingerprints, UUIDs, Latency Chips |

---

## 3. Color System & Semantic Severity Architecture

The color system is engineered specifically around safety, integrity, and trust. Every color token is calibrated in both Dark Mode (Obsidian / Slate) and Light Mode (Architectural Zinc / Pearl Slate) to meet or exceed **WCAG AA (minimum 4.5:1 contrast ratio for body text, 3:1 for large text/graphical elements)**.

### 3.1 Structural & Neutral Tokens

| Token | Dark Mode Value | Light Mode Value | Functional Usage | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#080b11` | `#f8fafc` | Global application viewport background | N/A (base) |
| `--bg-surface` | `#0e131f` | `#ffffff` | Primary panel & container background | > 15:1 vs text |
| `--bg-subtle` | `#141b2d` | `#f1f5f9` | Secondary nested sections, code blocks, controls | > 12:1 vs text |
| `--bg-card-hover` | `#1c253d` | `#e2e8f0` | Hovered interactive table row / card | Non-disruptive feedback |
| `--border-subtle` | `#1e293b` | `#cbd5e1` | Standard container and divider borders | Structure demarcation |
| `--border-strong` | `#334155` | `#94a3b8` | Active borders, input borders, hover outlines | High-confidence bounds |
| `--border-focus` | `#0ea5e9` | `#0284c7` | Focused input / keyboard accessibility ring | 3:1 graphical boundary |
| `--text-primary` | `#f8fafc` | `#0f172a` | Primary headings, values, key information | ≥ 14:1 (WCAG AAA) |
| `--text-secondary`| `#94a3b8` | `#475569` | Explanations, descriptive copy, active labels | ≥ 5.2:1 (WCAG AA) |
| `--text-muted` | `#64748b` | `#64748b` | Captions, metadata, inactive labels, placeholders | ≥ 4.6:1 (WCAG AA) |

### 3.2 Semantic Severity & Domain Tokens

| Semantic Role | Token | Dark Mode | Light Mode | System Meaning & Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Verified / Safe** | `--status-success` | `#10b981` | `#059669` | Verified fixes (human or sandboxed), passing Wilson confidence bounds, healthy SSE pipeline. |
| **Verified BG** | `--status-success-bg`| `rgba(16, 185, 129, 0.12)` | `rgba(5, 150, 105, 0.10)` | Soft tinted container for verified elements. |
| **Verified Border** | `--status-success-bd`| `rgba(16, 185, 129, 0.35)` | `rgba(5, 150, 105, 0.30)` | Subtle perimeter delimiter. |
| **Stale / Warning** | `--status-warning` | `#f59e0b` | `#d97706` | Lockfile hash mismatches, age TTL drift, medium risk approvals. |
| **Stale BG** | `--status-warning-bg`| `rgba(245, 158, 11, 0.12)` | `rgba(217, 119, 6, 0.10)` | Warning notification background. |
| **Stale Border** | `--status-warning-bd`| `rgba(245, 158, 11, 0.35)` | `rgba(217, 119, 6, 0.30)` | Warning border perimeter. |
| **Quarantine / Hazard**| `--status-danger` | `#f43f5e` | `#dc2626` | Persisted-retrieval poisoning alerts, high-risk commands, failed filters. |
| **Quarantine BG** | `--status-danger-bg` | `rgba(244, 63, 94, 0.12)` | `rgba(220, 38, 38, 0.10)` | High-visibility isolation background. |
| **Quarantine Border**| `--status-danger-bd` | `rgba(244, 63, 94, 0.35)` | `rgba(220, 38, 38, 0.30)` | High-risk callout perimeter. |
| **Diagnostic / Cyan** | `--accent-cyan` | `#06b6d4` | `#0891b2` | Exact match badges, fingerprints, diagnostic queries, active tabs. |
| **Provenance / Violet**| `--accent-violet` | `#8b5cf6` | `#7c3aed` | Provenance chains, command family chips, Git history, baseline comparison. |
| **Latency / Azure** | `--accent-blue` | `#38bdf8` | `#0284c7` | FTS5 benchmark times, retrieval latency, protocol channel chips. |

---

## 4. Spacing Scale & Layout Grid

All margins, paddings, and gaps adhere strictly to an **8px base grid** with a `4px` sub-grid for compact metadata. Ad hoc or arbitrary pixel values are prohibited.

| Token | Pixels | Rem Equivalent | Primary Applications |
| :--- | :--- | :--- | :--- |
| `--space-1` | `4px` | `0.25rem` | Badge padding, micro gaps between icon and text |
| `--space-2` | `8px` | `0.5rem` | Button vertical padding, small gaps, metadata chip spacing |
| `--space-3` | `12px` | `0.75rem` | Input padding, compact card internal padding, table cell padding |
| `--space-4` | `16px` | `1rem` | Standard card and container internal padding, grid gap (small) |
| `--space-5` | `20px` | `1.25rem` | Panel header spacing, metric card padding |
| `--space-6` | `24px` | `1.5rem` | Section vertical margins, standard grid gap |
| `--space-8` | `32px` | `2rem` | Screen header margin, major section separation |
| `--space-12` | `48px` | `3rem` | Large empty-state padding, page footer spacing |

### Responsive Layout Breakpoints
- **Mobile (`<= 480px` / `390px target`):** Single column layouts, horizontal scrolling navigation with subtle indicators, stacked table cards.
- **Tablet (`481px - 1024px` / `768px target`):** 2-column KPI grids, responsive side-drawers taking 85vw width.
- **Desktop (`>= 1025px` / `1440px target`):** Max container width `1440px` centered, multi-column metric grids, full side-drawers (640px).

---

## 5. Elevation, Borders & Motion Rules

### 5.1 Elevation Philosophy
Rather than relying on heavy, fuzzy drop shadows that look muddy in dark mode, the design system utilizes **Border-First Architecture** combined with subtle ambient depth:
- **Base Surfaces (`--bg-canvas`):** Level 0.
- **Panels & Cards (`--bg-surface`):** Level 1. 1px border (`--border-subtle`) + subtle shadow `0 2px 8px rgba(0,0,0,0.2)`.
- **Hovered Elements:** Level 2. Border elevates to `--border-strong`, subtle translation `-1px`, shadow `0 6px 16px rgba(0,0,0,0.3)`.
- **Drawers & Modals:** Level 3. Border left `--border-subtle`, shadow `-12px 0 36px rgba(0,0,0,0.5)`, backdrop blur `12px`.

### 5.2 Motion & Transition Standards
Live SSE event feeds require purposeful, calm animations that preserve readability even at 50 events/minute:
- **Fast Interactive:** `120ms cubic-bezier(0.2, 0, 0, 1)` for buttons, links, tab switches.
- **Surface Elevation:** `200ms cubic-bezier(0.16, 1, 0.3, 1)` for card hovers and drawer slides.
- **Live Stream Entry (`@keyframes feedItemEnter`):**
  ```css
  @keyframes feedItemEnter {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.99);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  ```
  Items animate in over `250ms`, drawing the eye smoothly without causing layout jank or vibration.

---

## 6. Interactive Component States

Every interactive element specifies five distinct states:

### 6.1 Buttons (`.btn-primary`, `.btn-success`, `.btn-danger`, `.btn-outline`)
- **Default:** Solid high-contrast surface or border, crisp typography, `cursor: pointer`.
- **Hover:** Brightness `1.08`, subtle translateY(`-1px`), subtle ambient shadow increase.
- **Focus (`:focus-visible`):** Mandatory `2px solid var(--border-focus)` with `2px` offset (`outline-offset: 2px`). Accessible via keyboard `Tab`.
- **Active:** Scaled down `0.98`, brightness `0.95`.
- **Disabled:** Opacity `0.45`, `cursor: not-allowed`, pointer-events disabled, zero transform.

### 6.2 Form Inputs & Dropdowns (`.input`)
- **Default:** Solid background (`--bg-subtle`), `1px solid var(--border-subtle)`, text `--text-primary`.
- **Hover:** Border shifts to `--border-strong`.
- **Focus (`:focus-visible`):** Border shifts to `--accent-cyan`, subtle cyan ring `0 0 0 3px rgba(6, 182, 212, 0.15)`.
- **Disabled:** Opacity `0.5`, background `--bg-canvas`.

### 6.3 Table Rows (`tr`)
- **Default:** Transparent background with bottom border `--border-subtle`.
- **Hover:** Background smoothly transitions to `--bg-card-hover`, row cursor changes to `pointer`.
- **Focus (`:focus-within`):** Row border left highlighted with `--accent-cyan`.

---

## 7. Screen-Specific Archetypes & Visual Jobs

1. **Overview:** Status-at-a-glance. Prioritize high-consequence metrics (Stale Count, Poisoning Flags, Wilson Lower Bound) with prominent visual weight over secondary counts.
2. **Live Activity Feed:** High-throughput streaming. Color-coded tool event badges (`record_failure`, `find_fix`, `verify_fix`, `quarantine_alert`), clear event timestamps, pause auto-scroll control, and non-distracting arrival animations.
3. **Record Browser & Detail:** Data-dense table with scannable IDs, Wilson confidence bars, and status pills. The Detail view renders the `supersedes` chain as an **actual multi-node visual timeline** with directional connectors and lockfile diff context.
4. **Retrieval Explainability:** Primary safety demonstration screen. Legible mini-data visualizations: Score vs. Acceptance Threshold bars with vertical threshold indicator lines, exact/fuzzy badges, and multi-factor penalty chips.
5. **Approval Queue:** Safety control surface. Serious, unambiguous risk-level indicators (`HIGH`, `MEDIUM`, `LOW`), readable dry-run execution plan viewer, and operator audit notes input.
6. **Security & Redaction Audit:** "Nothing is hidden" transparency. Deterministic regex pattern cards (100% recall), Shannon entropy gauge ($H > 4.5$), and full 7-layer heuristic detection matrix.
7. **Benchmark & Evaluation Results:** Scientific dissertation quality. Restrained, harmonious comparison bars for baselines (B0 through B3), latency SLA performance tables (< 20ms target), and safety ablation cards.
