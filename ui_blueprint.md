# Agent Memory Dashboard — UI Blueprint & Feature Catalog

> **Purpose:** A practical, actionable reference for redesigning the dashboard UI.  
> All backend/API details excluded. Focus is strictly on what appears in the interface.

---

## App Shell & Navigation

### Left Sidebar (Persistent)
| Element | Detail |
|---|---|
| **Brand mark** | ⚡ icon + "Memory Console" title + `agent-memory-mcp • v0.1.0` subtitle |
| **Nav items** | 7 tabs stacked vertically (see below) |
| **Status indicator** | Pulse dot + `127.0.0.1:4321` or `Reconnecting…` label |
| **Theme toggle** | Single button, cycles Dark ↔ Light |

### Nav Items & Their Badges
| Tab Label | Badge | Badge Color |
|---|---|---|
| Overview | — | — |
| Live Activity | event count | cyan |
| Records | record count | gray |
| Explainability | — | — |
| Approval Queue | pending count | **amber** (attention-critical) |
| Security Audit | quarantine count | **red** (danger-critical) |
| Evaluation | — | — |

### Global Connection Status
- **SSE connected:** green pulse dot + IP address
- **Disconnected:** orange/red pulse dot + "Reconnecting…"
- **Error banner** (inline, dismissable via Retry button): appears above screen content when bridge is unreachable

---

## Screen 1 — Overview

**Purpose:** High-level health snapshot at a glance.

### Hero KPI Cards (3-column grid, clickable → navigate to relevant screen)
| Card | Value | Color Signal | Destination |
|---|---|---|---|
| Poisoning / Quarantine Flags | count | green (0) / red (>0) | → Security Audit |
| Stale Drift Warnings | count | cyan (0) / amber (>0) | → Records |
| Confidence (Wilson Lower Bound) | `XX.X%` | always green | — |

Each card has: label, large number, subtext description, colored top accent bar.

### Secondary Stat Cards (auto-fit grid, clickable)
| Card | Value |
|---|---|
| Total Memories | integer |
| Verified Fixes | integer (violet) |
| Unique Fingerprints (SHA-256) | integer (blue) |

### Age Distribution Histogram Panel
- 4 horizontal bar segments, each with label, count, progress bar, and decay weight label
- Buckets: `< 1h`, `< 24h`, `< 7d`, `> 7d`
- Bars are proportional to max bucket count

### Subsystem Status Panel
- 3 info tiles (Transport, Storage Engine, Security)
- Each tile: name, description, 2–3 small badges showing active features
- Always shows "All Checks Passed" badge — currently **static / hardcoded**

---

## Screen 2 — Live Activity Feed

**Purpose:** Real-time stream of every agent tool call.

### Header Controls
- SSE status indicator (streaming / disconnected)
- **Auto-scroll toggle** button (ON / PAUSED)
- **Clear** button (wipes current session's event list, not persistent)

### Event Type Filter Tabs (inline, not sidebar)
- All Events (count)
- Record Failure
- Find Fix
- Verify Fix
- Quarantine Alerts

### Event Stream Container
- Scrollable, dark-coded background, 620px fixed height
- Up to 200 events buffered (oldest trimmed)
- Each event card shows:
  - **Type badge** (RECORD_FAILURE / FIND_FIX / VERIFY_FIX / QUARANTINE_ALERT / INFO)
  - Event message/name
  - Timestamp (right-aligned)
  - Metadata row: `cmd:`, `fp:` (truncated fingerprint), `matches:`, `repo:`, BLOCKED badge
- Left border color-codes event type (green / cyan / violet / red)

---

## Screen 3 — Records

**Purpose:** Browse, search, and inspect the full memory catalog.

### Filter Toolbar (panel row)
- **Search input** — searches command, ID, fingerprint, fix explanation
- **Command Family** dropdown — dynamically populated from data
- **Verification Status** dropdown — All / Clean / Quarantined / Verified Only
- **Reset Filters** button (appears only when any filter is active)
- Live count badge: `N Records (M matching)`

### Records Table (8 columns)
| Column | Content |
|---|---|
| Record ID | monospace cyan ID |
| Target Command | truncated code (40 chars) |
| Family | violet badge |
| Fingerprint (SHA-256) | truncated monospace (16 chars) |
| Wilson Lower Bound | percentage + mini progress bar |
| Integrity Status | QUARANTINED (red) / VERIFIED (green) / RECORDED (gray) |
| Created | locale date |
| Actions | "Inspect →" button |

- Rows are clickable (click row or Inspect button)
- Keyboard accessible (Enter key)
- Skeleton loading state (5 placeholder rows)

### Record Detail Drawer (slide-in from right)
Triggered by clicking any row. Contains:
- **Header:** Record ID, status badges (QUARANTINED / VERIFIED), command family badge, captured date, normalizer version, Close button
- **Security Alert Banner** (if quarantined): reason + flagged timestamp
- **Supersedes Chain Timeline:** visual predecessor → current chain with IDs
- **Command & Fix Info:** original command, fix explanation, fix commands (code block)
- **Error Output Tabs:** "Normalized" / "Raw Redacted" toggle — shows error output text
- **Provenance Metadata:** git commit, branch, author, captured at
- **Environment Snapshot:** runtime version, lockfile hashes
- **Verification Record:** status, method, verified at, Wilson score

---

## Screen 4 — Explainability

**Purpose:** Understand why a specific fix was (or wasn't) retrieved.

### Diagnostic Query Banner
- Displays the last retrieval query
- Acceptance threshold value (e.g., `0.70`)
- Static "Deterministic Scoring Engine" badge

### Candidate Scoring Table / Cards
Each candidate shows:
- Record ID, command, command family
- Match type badge: `EXACT` / `FUZZY`
- Similarity score (percentage + mini bar)
- Trust/composite score
- **Passes Threshold** indicator (green ✓ / red ✗)
- Filter pass/fail flags: repository, command family, exit code
- Stale reasons (if any)
- Quarantined flag

> **Note:** No user interaction on this screen — data-loads once on mount. No search or re-query input exists yet.

---

## Screen 5 — Approval Queue

**Purpose:** Human-in-the-loop gate for AI-proposed shell commands.

### Empty State
- Shield icon + "Approval Queue Clean" + "Dry-Run Protection Active" badge

### Pending Approval Cards (one card per pending item)
Each card contains:
- **Header row:** Approval ID (cyan), Risk badge (HIGH/MEDIUM/LOW), Referenced Record ID, timestamp, status
- **Intercepted command** display (code block with `$` prefix)
- **Security Policy Findings** — list of risk reason badges
- **Operator Notes input** — free text field, logged immutably on submission
- **Action buttons:**
  - `Deny & Terminate` (red, destructive)
  - `Authorize Execution` (green, permissive)
  - Disabled state + loading label while submitting
- Card left-border color: red (HIGH) or amber (MEDIUM/LOW)

---

## Screen 6 — Security Audit

**Purpose:** Inspect all active defenses and quarantined records.

### Redaction Pipeline Panel
- 2 tiles side-by-side:
  - **Layer 1 — Deterministic Patterns:** list of pattern type badges (GitHub PAT, AWS Key, OpenAI, etc.)
  - **Layer 2 — Shannon Entropy:** entropy threshold value, min token length

### Poisoning Detectors Panel
- 7 detector tiles in auto-fit grid
- Each: name, description of what it catches, ACTIVE badge
- Currently **static / always all active**

### Quarantined Records Table (5 columns)
| Column | Content |
|---|---|
| Record ID | cyan monospace |
| Command | code text |
| Detection Reason | red-colored description text |
| Quarantined At | locale datetime |
| Status | red badge |

- Empty state: "Quarantine Log Clean" with shield icon

---

## Screen 7 — Evaluation (Benchmarks)

**Purpose:** Show empirical performance data across memory configurations.

### Evaluation Phase Banner
- Protocol description, `B3 Benchmark Target Achieved` badge

### Baseline Comparison Cards (B0–B3)
Each baseline card shows:
- Name (e.g., "B0: No Memory", "B3: Full Verified Memory")
- 4 metrics with labeled values + mini horizontal bars:
  - Time-to-Repair (seconds)
  - Tool Calls (count)
  - Success Rate (%)
  - False Reuse Rate (%)

### Retrieval Latency SLA Table
| Scale | p50 | p95 |
|---|---|---|
| 100 records | Xms | Xms |
| 1,000 records | Xms | Xms |
| 10,000 records | Xms | Xms |

### Ablation Study Cards
- Each ablation: name, risk score or stale/poisoned retrieval %, latency delta

> **Note:** No refresh button — data loads once on mount.

---

## UI Patterns & Elements Catalog

| Pattern | Used In |
|---|---|
| **Skeleton loading** (animated shimmer) | All screens while fetching |
| **Empty state** (icon + title + description) | All screens when no data |
| **Status badges** (color-coded pills) | Throughout — VERIFIED, QUARANTINED, RECORDED, ACTIVE |
| **Inline progress bars** (mini) | Wilson score, similarity score, age distribution, benchmarks |
| **Data table** with clickable rows | Records, Security Audit |
| **Slide-in drawer / panel** (right edge) | Record Detail |
| **Filter toolbar** (search + dropdowns + reset) | Records screen |
| **Event filter tabs** (inline segmented) | Live Feed |
| **Hero KPI cards** (large number, colored accent) | Overview |
| **Code blocks** (dark bg, monospace) | Approval commands, record outputs |
| **Pulse dot** (animated) | Connection status |
| **Confirmation-less actions** | Approve/Deny buttons (submit immediately) |
| **Toast/error banner** | Connection failure recovery |

---

## Prioritized Feature List

### 🔴 Core (Essential)
1. **Live status indicator** — always visible, shows if data pipeline is live
2. **Overview KPIs** — quarantine count, stale count, confidence score (most important health signals)
3. **Record browser with search + filters** — the main data-exploration tool
4. **Record detail drawer** — inspect any memory record fully
5. **Approval queue** — the only interactive write operation; requires human attention
6. **Live activity feed** — real-time visibility into agent operations

### 🟡 Secondary (Supporting)
7. **Age distribution histogram** — useful context for data freshness
8. **Security audit / redaction layers view** — read-only posture verification
9. **Quarantined records table** — linked from security screen and overview
10. **Explainability screen** — debugging aid for retrieval decisions
11. **Benchmark/Evaluation screen** — project-level performance summary

### 🟢 UX & Utility
12. **Dark/light theme toggle** — user preference
13. **Auto-scroll toggle** on live feed
14. **Clear event stream** button on live feed
15. **Reset filters** button on record browser
16. **Retry connection** on error banner

---

## Opportunities for Declutter (Current Redundancies)

| Issue | Recommendation |
|---|---|
| Overview "Subsystem Status" panel is entirely hardcoded/static | Remove or collapse to a single always-green badge |
| Security screen redaction details are static constants | Collapse into an expandable "Defense Config" accordion |
| Evaluation banner text is very academic/verbose | Shorten; surface only the key metrics |
| Empty states on 4+ screens use very similar patterns | Unify into a single `<EmptyState>` component |
| Explainability has no interactivity (no re-query) | Either add a query input or merge into Record Detail drawer as a tab |
