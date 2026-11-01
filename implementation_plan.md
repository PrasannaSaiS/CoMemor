# Dashboard Redesign Implementation Plan

This document outlines the step-by-step implementation plan for the comprehensive UI redesign of the Agent Memory Console dashboard based on the provided specifications.

## User Review Required

> [!IMPORTANT]
> - **Routing library:** I will install `react-router-dom` to support deep-linking (`/records?id=abc123`). Is this acceptable?
> - **Virtualization:** The spec requires virtualizing the Live Activity feed and Records table. I plan to use `@tanstack/react-virtual` to achieve this. Please confirm.
> - **Component Documentation:** I will create a living component documentation file (e.g., `src/docs/COMPONENTS.md`) containing the required anatomy and states. Setting up a full Storybook environment may add unnecessary bloat to the project right now. Please confirm if a markdown-based component guide is sufficient.

## Open Questions

> [!WARNING]
> - Should the "dark-first palette" colors specified in the spec override the existing colors in `index.css`, or do we just formalize the existing colors into the strict `--color-bg-0` through `--color-bg-3` format?
> - In the mobile view, where the sidebar becomes a full-screen overlay nav, is there a preference for animation style (slide-in from left, or fade-in)?

---

## Proposed Changes

### Configuration & Dependencies
#### [MODIFY] [package.json](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/package.json)
- Add `react-router-dom` for deep-linkable states.
- Add `@tanstack/react-virtual` for list virtualization (Records table, Live Feed).

---

### Core Styling & Design Tokens
#### [MODIFY] [index.css](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/index.css)
- Restructure all CSS variables to adhere to the requested semantic naming (`--color-status-success`, `--color-bg-0`, etc.).
- Define the `4px` base spacing scale (`--space-1`, `--space-2`, ..., `--space-12`).
- Define the two-tier typography system (UI sans-serif and monospace) with the 1.2x modular scale.
- Implement responsive breakpoints (`@media (min-width: 640px)`, `@media (min-width: 1024px)`).
- Add global focus styles (`:focus-visible`) and `prefers-reduced-motion` media queries.

---

### App Shell & Routing
#### [MODIFY] [App.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/App.tsx)
- Refactor the state-based `activeScreen` router to use `react-router-dom` `<BrowserRouter>` and `<Routes>`.
- Redesign the persistent left sidebar to group items (Operate, Investigate, Reference).
- Make the Approval Queue (amber) and Security Audit (red) badges highly prominent.
- Move the global SSE connection status to the sidebar footer.
- Add a non-blocking toast/banner system for connection drops and success messages.

---

### Shared UI Components
#### [NEW] [Skeleton.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/shared/Skeleton.tsx)
- Reusable shimmer placeholder for all loading states. Respects `prefers-reduced-motion`.
#### [NEW] [EmptyState.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/shared/EmptyState.tsx)
- Standardized empty state component (icon, title, description, optional action button) to replace the 4+ duplicated versions.
#### [NEW] [ConfirmButton.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/shared/ConfirmButton.tsx)
- Two-stage button for destructive actions (e.g., "Deny & Terminate" -> "Confirm Deny?").
#### [NEW] [Badge.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/shared/Badge.tsx)
- Refactored semantic badge component pairing color with text/icon.

---

### Screen Enhancements & Decluttering
#### [MODIFY] [OverviewScreen.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/OverviewScreen.tsx)
- Remove the hardcoded Subsystem Status panel.
- Update Hero KPI cards to use new typography and spacing tokens.
- Add `<Skeleton>` usage for initial load.

#### [MODIFY] [LiveFeedScreen.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/LiveFeedScreen.tsx)
- Implement `@tanstack/react-virtual` for rendering up to 200 events without lag.
- Make the header (Auto-scroll/Clear) sticky on mobile view.

#### [MODIFY] [RecordBrowserScreen.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/RecordBrowserScreen.tsx)
- Implement list virtualization for the data table.
- Wrap filter toolbar to 2 rows on tablet and stack fully on mobile.
- Support deep linking via URL query parameters (e.g., `?id=xyz`) to open the `RecordDetailDrawer`.

#### [MODIFY] [RecordDetailDrawer.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/RecordDetailDrawer.tsx)
- Make it slide in from the right on desktop (40% width) and full-screen sheet on mobile.
- Trap focus while open and manage ARIA attributes.
- Lazy-load heavy content (environment, provenance).

#### [MODIFY] [ExplainabilityScreen.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/ExplainabilityScreen.tsx)
- Make it interactive: Add a query input field to manually fetch/evaluate explainability data instead of a static view.

#### [MODIFY] [ApprovalQueueScreen.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/ApprovalQueueScreen.tsx)
- Replace basic Deny/Approve buttons with the new `<ConfirmButton>` to require two-stage confirmation.
- Stack action buttons full-width on mobile.

#### [MODIFY] [SecurityAuditScreen.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/SecurityAuditScreen.tsx)
- Collapse the static redaction-layer constants into an expandable `<details>`/`<summary>` "Defense Config" accordion.

#### [MODIFY] [BenchmarkScreen.tsx](file:///c:/Projects/agent-memory-mcp/dashboard/frontend/src/components/BenchmarkScreen.tsx)
- Shorten the verbose banner.
- Implement the "No evaluation data available" empty state.

---

## Verification Plan

### Automated Tests
- Type checking (`npm run typecheck`) and linting (`npm run lint`) to ensure no regressions.
- If applicable, run existing tests in the repository.

### Manual Verification
- Resize the browser viewport across Desktop (>1024px), Tablet (640px-1023px), and Mobile (<640px) to verify responsive behaviors (sidebar collapsing, tables stacking into cards, etc.).
- Use keyboard navigation (Tab, Shift+Tab, Enter) to navigate the app, focusing heavily on table rows and the Record Detail drawer focus trapping.
- Trigger the Approve/Deny flow in the Approval Queue to verify the two-stage confirmation micro-interaction and toast notification.
- Connect to the bridge server and view the Live Feed under activity to ensure virtualization handles the load smoothly.
