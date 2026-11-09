# Goals: Apple-Style Horizontal Scroll Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked full-width goal cards on the Plan page with an Apple-style horizontal, scroll-snapping card rail, and move the "+ Add your own goal ›" action into the section header, right-aligned (Apple's App Store / Wallet "See All" pattern).

**Architecture:** Layout-only change in two files: `frontend/src/components/PlanPage.tsx` (markup restructure) and `frontend/src/styles/index.css` (scroller + card CSS). No data-model, projection, masking, or form logic changes. The scroll rail is pure CSS (`overflow-x` + `scroll-snap`); no carousel library.

**Tech Stack:** React 18 + TypeScript (Vite), hand-rolled CSS custom-property design system in `frontend/src/styles/index.css` (Tailwind is loaded but this codebase styles via bespoke classes).

## Global Constraints

- Fonts, tokens, radii, and breakpoints come from `:root` / `.dark` in `frontend/src/styles/index.css` — reuse `--attention`, `--ink`, `--rule`, `--focus`, `--surface-raised`; do not invent new hex values.
- Conventional commits (`feat:`, `style:`, `docs:`), matching `git log` history.
- Masked mode (`masked` prop) must keep working: amounts show `••`, progress shows `••% there` / `•• to go`.
- Light and dark themes must both render correctly (`.dark` variants already exist for every goal rule).
- Design language from `docs/redesign-plan.md`: 4px spacing steps, 20px surface radius / 28px feature radius, prefer whitespace and rules. Card rails must not introduce horizontal page overflow — the only horizontal scroll allowed is inside the rail.
- Keyboard and screen-reader access is required, not optional: the rail is focusable and every card keeps its existing `progressbar` ARIA.
- Verification commands (from repo root unless noted): `cd frontend && npm test`, `cd frontend && npm run build`, `make test` (Go is untouched but re-run as a regression gate).

## Current state (what we're replacing)

- `frontend/src/components/PlanPage.tsx:142-195` — `.plan-goals-section` renders:
  - `.section-heading` (h2 "Goals" + subtitle, left only, no right-side action).
  - `.goal-list` — a **single-column grid** (`index.css:744`) of `.goal-plan-card` articles. Each card is a **two-column grid** (progress left, projection right, `index.css:745`), yellow `--attention` background, radius 24px.
  - Below the list: either the `.goal-create-form` or the `+ Add your own goal ›` `.text-action` button (`PlanPage.tsx:194`).
  - `.goal-empty-feature` when there are zero goals (`PlanPage.tsx:186`).
- Relevant CSS ranges: goal card rules at `index.css:744-768`, form rules at `769-784`, plan breakpoints at `950-959` (900px), `994-999` (760px), `1038-1039` (440px).
- `.section-heading` is already `display: flex; justify-content: space-between` (`index.css:340`) — the header action slots straight in.
- `.text-action` (`index.css:248`) is the existing link-style button — reuse it for the header action.

## Design decisions (review points)

1. **"Add your own goal" placement — top right.** Apple's card rails (App Store, Wallet, Fitness, TV) put the section action in the header row, right-aligned and vertically centered against the section title — never below the cards. We follow that: the button moves into `.section-heading`, hidden while the inline form is open (same condition as today).
2. **Card anatomy — single vertical column.** A rail card is ~300–380px wide, so the current left/right split no longer fits. New stack, top to bottom: eyebrow → goal name → target amount → progress bar + labels → hairline divider → projection headline → projection copy → Edit/Remove actions pinned to the card bottom (`margin-top: auto`) so buttons align across cards of unequal text length.
3. **Keep the yellow `--attention` card.** It's the app's goal identity and both themes already style it. (Alternative if you want it more strictly "Apple": swap `var(--attention)` for `var(--surface-raised)` — one line, decided at review.)
4. **Scroll feel — CSS snap, hidden scrollbar, contained overflow.** `scroll-snap-type: x mandatory`, `scroll-snap-align: start`, `overscroll-behavior-inline: contain` (same pattern as `.snapshot-table-scroll`), scrollbar hidden; the ~0.5 card peeking at the right edge is the affordance.
5. **Rail stays inside the content column** (does not bleed to viewport edge). Full-bleed rails fight the centered `max-width: 1280px` content grid and the fixed 72px sidebar; skip unless requested later.
6. **Edit focus behavior:** clicking "Edit target" scrolls the target card into view horizontally (instant, no animation → safe under `prefers-reduced-motion`) since it may be off-screen in the rail.
7. **Optional (Task 4, decide at review):** circular ‹ › arrows in the header row for desktop mouse users, appearing only when the rail overflows. Apple's web rails (apple.com) do this; App Store does not.

## What does NOT change

- `Goal` type, `addGoal` / `deleteGoal` / `saveGoalEdit` logic, the `goal-create-form` fields and validation.
- Projection math (`projectedMonths`, `estimateDate`, scenario copy) — only its container shrinks.
- Masked-mode copy, empty state (`goal-empty-feature`), modals, "Your pace", "Assumptions".
- Go backend, `data.json`, routing.

---

### Task 1: Move "+ Add your own goal" into the section header (top right)

**Files:**
- Modify: `frontend/src/components/PlanPage.tsx` (goals section, ~lines 142-144 and 187-194)
- Modify: `frontend/src/styles/index.css` (goal rules block, ~line 744 area)

**Interfaces:**
- Consumes: existing `goalFormOpen` state, `setGoalFormOpen`, `goals` memo (`PlanPage.tsx:19,69`), `.text-action` and `.section-heading` classes.
- Produces: `.goals-add-action` CSS class and a section-header row layout that Task 4's arrows will sit next to.

- [ ] **Step 1: Move the button into the header**

In `frontend/src/components/PlanPage.tsx`, replace the current section heading and the trailing ternary. Current heading (line 143):

```tsx
<div className="section-heading"><div><h2 id="goals-heading">Goals</h2><p>What are you building towards, with a projected date?</p></div></div>
```

New heading:

```tsx
<div className="section-heading">
  <div><h2 id="goals-heading">Goals</h2><p>What are you building towards, with a projected date?</p></div>
  {goals.length && !goalFormOpen ? <button className="text-action goals-add-action" type="button" onClick={() => setGoalFormOpen(true)}>+ Add your own goal <span aria-hidden="true">›</span></button> : null}
</div>
```

Then change the trailing ternary (line 194) from:

```tsx
</form> : goals.length ? <button className="text-action" type="button" onClick={() => setGoalFormOpen(true)}>+ Add your own goal <span aria-hidden="true">›</span></button> : null}
```

to (form stays; the button no longer appears at the bottom):

```tsx
</form> : null}
```

- [ ] **Step 2: Add the header-action CSS**

In `frontend/src/styles/index.css`, directly above the `.goal-plan-card` rule (line ~745), add:

```css
.goals-add-action { flex-shrink: 0; align-self: center; }
```

`.section-heading` already applies `justify-content: space-between` (`index.css:340`), so no other header CSS is needed.

- [ ] **Step 3: Build and eyeball**

Run: `cd frontend && npm run build`
Expected: clean tsc + vite build, no type errors.

- [ ] **Step 4: Visual check**

Run `make run` (or `cd frontend && npm run dev`); open `/plan` with ≥1 goal.
Expected: button sits top-right, vertically centered against the "Goals" heading; opening the Add form hides it; the form still renders below the list.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlanPage.tsx frontend/src/styles/index.css
git commit -m "feat(plan): move add-goal action into the goals header row"
```

---

### Task 2: Convert the goal list into a scroll-snapping card rail

**Files:**
- Modify: `frontend/src/components/PlanPage.tsx` (goals section, lines 142-195; `beginEdit` at line 81)
- Modify: `frontend/src/styles/index.css` (replace goal-card rules at lines 744-768; breakpoint rules at 957-958 and 997)

**Interfaces:**
- Consumes: card markup and classes from Task 1; `beginEdit`, card projection computation block (`PlanPage.tsx:144-171`).
- Produces: `.goal-scroller` (focusable scroll container), per-card `id="goal-card-<uuid>"` anchors, `.goal-plan-card` as a vertical flex card with bottom-pinned actions. Task 4's arrow code targets `.goal-scroller` and `.goal-plan-card`.

- [ ] **Step 1: Restructure the section markup**

In `frontend/src/components/PlanPage.tsx`, replace the `.goal-list` wrapper (line 144) and card article (lines 172-184). The wrapper becomes a focusable scroller rendered only when goals exist; each card gains an `id`. All inner content (progress block children, details children) is unchanged — only the wrappers and their classes change:

```tsx
{goals.length ? <div className="goal-scroller" tabIndex={0} aria-label="Goal cards">{goals.map((goal) => {
  // …existing per-goal computation block (lines 145-171) stays exactly as-is…
  return <article className="goal-plan-card" key={goal.id} id={`goal-card-${goal.id}`}>
    <div className="goal-feature-progress">
      {/* …unchanged children: eyebrow, h3, target value, progressbar, labels… */}
    </div>
    <div className="goal-feature-details">
      {/* …unchanged children: h4, projection copy, actions… */}
    </div>
  </article>;
})}</div> : null}
```

Delete the now-empty `.goal-list` div; keep the `.goal-empty-feature`, `.goal-create-form`, and header button blocks from Task 1 in place.

- [ ] **Step 2: Scroll the edited card into view**

Update `beginEdit` (line 81) so the card being edited is brought into the rail viewport:

```tsx
function beginEdit(goal: Goal) { setEditingId(goal.id); setGoalFormOpen(true); setName(goal.name); setAmount(String(goal.targetAmount)); setTargetDate(goal.targetDate ?? ""); setGoalType(goal.type); document.getElementById(`goal-card-${goal.id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" }); }
```

- [ ] **Step 3: Replace the goal card CSS**

In `frontend/src/styles/index.css`, replace the rules at lines 744-762 with:

```css
.goal-scroller { display: flex; gap: 14px; align-items: stretch; overflow-x: auto; margin: 20px 0 15px; padding: 4px 2px 18px; scroll-snap-type: x mandatory; scroll-padding-inline-start: 2px; overscroll-behavior-inline: contain; scrollbar-width: none; }
.goal-scroller::-webkit-scrollbar { display: none; }
.goal-scroller:focus-visible { outline: 2px solid var(--focus); outline-offset: 4px; border-radius: 12px; }
.goal-plan-card { display: flex; flex-direction: column; flex: 0 0 auto; width: clamp(300px, 30vw, 380px); scroll-snap-align: start; padding: 26px 26px 24px; border-radius: 24px; background: var(--attention); color: #15140f; }
.dark .goal-plan-card { color: var(--ink); }
.goal-feature-progress, .goal-feature-details { min-width: 0; }
.goal-feature-eyebrow { margin: 0 0 5px; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.goal-feature-progress h3 { overflow-wrap: anywhere; margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -.02em; }
.goal-feature-progress .goal-progress-track { height: 10px; overflow: hidden; border-radius: 99px; background: color-mix(in srgb, #111 16%, transparent); }
.goal-feature-progress .goal-progress-track span { display: block; height: 100%; border-radius: inherit; background: #15140f; transition: width .28s ease; }
.goal-feature-details { display: flex; flex-direction: column; flex: 1 1 auto; margin-top: 18px; padding-top: 16px; border-top: 1px solid color-mix(in srgb, #15140f 14%, transparent); }
.dark .goal-feature-details { border-top-color: color-mix(in srgb, var(--ink) 18%, transparent); }
.goal-feature-details h4 { margin: 0; font-size: clamp(20px, 1.8vw, 24px); font-weight: 720; letter-spacing: -.03em; line-height: 1.1; }
.goal-feature-details > p { margin: 8px 0 0; font-size: 12.5px; line-height: 1.45; }
.goal-feature-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; margin-top: auto; padding-top: 18px; }
.goal-feature-primary, .goal-feature-secondary { min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; font-size: 12px; font-weight: 680; cursor: pointer; }
.goal-feature-primary { background: #15140f; color: #fff; }
.dark .goal-feature-primary { background: var(--ink); color: var(--canvas); }
.goal-feature-secondary { background: color-mix(in srgb, #15140f 10%, transparent); color: inherit; }
.goal-feature-primary:hover, .goal-feature-secondary:hover { filter: brightness(.94); }
```

Keep `.goal-empty-feature` rules (763-768) and all form rules untouched. `.goal-target-value` (line 750) is untouched.

- [ ] **Step 4: Update the 900px and 760px breakpoints**

In the `@media (max-width: 900px)` block (lines 950-959), replace:

```css
.goal-plan-card { grid-template-columns: 1fr; gap: 19px; padding: 24px; }
.goal-feature-details h4 { font-size: 25px; }
```

with:

```css
.goal-plan-card { width: clamp(280px, 42vw, 340px); padding: 24px; }
```

In the `@media (max-width: 760px)` block (line 997), replace:

```css
.goal-plan-card { padding: 22px; border-radius: 20px; }
```

with:

```css
.goal-plan-card { width: min(78vw, 320px); padding: 22px; border-radius: 20px; }
```

- [ ] **Step 5: Build and verify**

Run: `cd frontend && npm run build && npm test`
Expected: clean build; existing util tests still pass (no logic was touched).

- [ ] **Step 6: Manual rail check at desktop width**

Run `make run`; open `/plan` with 2+ goals at 1440×900.
Expected: cards sit side by side, equal height, actions bottom-aligned, ~0.5–1 card peeking right; trackpad/shift-wheel scrolling snaps card-to-card; no page-level horizontal scrollbar; clicking "Edit target" on the last card scrolls it into view.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PlanPage.tsx frontend/src/styles/index.css
git commit -m "feat(plan): render goals as a scroll-snapping horizontal card rail"
```

---

### Task 3: Mobile, masking, and reduced-motion polish

**Files:**
- Modify: `frontend/src/styles/index.css` (440px block ~line 1021+; reduced-motion block at line 648)

**Interfaces:**
- Consumes: `.goal-scroller` / `.goal-plan-card` from Task 2.
- Produces: final responsive sizes; no new classes.

- [ ] **Step 1: Phone-width card size**

In the `@media (max-width: 440px)` block (after line 1021), add:

```css
.goal-scroller { gap: 12px; padding: 4px 0 16px; scroll-padding-inline-start: 0; }
.goal-plan-card { width: 85vw; }
```

- [ ] **Step 2: Reduced-motion guard**

The rail itself has no animated scrolling (Task 2 uses instant `scrollIntoView`), but guard the transition in case smooth scrolling is added later. In the existing `@media (prefers-reduced-motion: reduce)` block (line 648), add:

```css
.goal-scroller { scroll-behavior: auto; }
.goal-feature-progress .goal-progress-track span { transition: none; }
```

- [ ] **Step 3: Full manual matrix**

Run `make run` and verify at `/plan`:
- Widths 1440px, 1024px, 760px, 390px (browser dev tools): rail scrolls, first card flush with the content's left edge, no horizontal page overflow at any width.
- Dark mode toggle: card text `var(--ink)`, hairline divider visible, buttons readable.
- Masked mode (eye icon in toolbar): `••` amounts, `••% there`, `•• to go`, progress bar at 0 width.
- One goal only: single left-aligned card, rail does not scroll.
- Keyboard: Tab reaches the rail; arrow keys scroll it; focus ring visible.

- [ ] **Step 4: Regression gate**

Run: `cd frontend && npm test && npm run build && cd .. && make test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/index.css
git commit -m "feat(plan): tune goal rail for phone widths and reduced motion"
```

---

### Task 4 (OPTIONAL — decide at plan review): Desktop ‹ › rail arrows

Include only if you want mouse users to get explicit arrow affordances (apple.com-style). Skip → the rail still scrolls via trackpad, mouse wheel, and keyboard.

**Files:**
- Modify: `frontend/src/components/PlanPage.tsx` (PlanPage state + header row from Task 1)
- Modify: `frontend/src/styles/index.css` (near the goal card rules)

**Interfaces:**
- Consumes: `.goal-scroller` cards and 14px gap from Task 2; header row layout from Task 1.
- Produces: `.goals-header-actions`, `.goal-rail-arrows`, `.goal-rail-arrow` classes.

- [ ] **Step 1: Add scroll state and handlers to PlanPage**

Inside `PlanPage`, add state and helpers (near the existing refs, ~line 29):

```tsx
const scrollerRef = useRef<HTMLDivElement>(null);
const [railEdges, setRailEdges] = useState({ back: false, forward: false });
function updateRailEdges() {
  const el = scrollerRef.current;
  if (!el) return;
  setRailEdges({ back: el.scrollLeft > 1, forward: el.scrollLeft < el.scrollWidth - el.clientWidth - 1 });
}
useEffect(() => {
  updateRailEdges();
  const el = scrollerRef.current;
  if (!el) return;
  el.addEventListener("scroll", updateRailEdges, { passive: true });
  const observer = new ResizeObserver(updateRailEdges);
  observer.observe(el);
  return () => { el.removeEventListener("scroll", updateRailEdges); observer.disconnect(); };
}, [goals.length]);
function scrollGoalsByCard(direction: 1 | -1) {
  const el = scrollerRef.current;
  if (!el) return;
  const card = el.querySelector<HTMLElement>(".goal-plan-card");
  const step = (card ? card.offsetWidth + 14 : 394) * direction;
  el.scrollBy({ left: step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
```

- [ ] **Step 2: Wire arrows into the header row and scroller**

Attach `ref={scrollerRef}` to the `.goal-scroller` div. In the header from Task 1, wrap the right side so arrows sit left of the add action (conditionally rendered, so arrows only appear when the rail overflows):

```tsx
<div className="section-heading">
  <div><h2 id="goals-heading">Goals</h2><p>What are you building towards, with a projected date?</p></div>
  <div className="goals-header-actions">
    {railEdges.back || railEdges.forward ? <div className="goal-rail-arrows">
      <button type="button" className="goal-rail-arrow" aria-label="Scroll goals backward" disabled={!railEdges.back} onClick={() => scrollGoalsByCard(-1)}><span aria-hidden="true">‹</span></button>
      <button type="button" className="goal-rail-arrow" aria-label="Scroll goals forward" disabled={!railEdges.forward} onClick={() => scrollGoalsByCard(1)}><span aria-hidden="true">›</span></button>
    </div> : null}
    {goals.length && !goalFormOpen ? <button className="text-action goals-add-action" type="button" onClick={() => setGoalFormOpen(true)}>+ Add your own goal <span aria-hidden="true">›</span></button> : null}
  </div>
</div>
```

- [ ] **Step 3: Arrow CSS**

Add to the goal block in `frontend/src/styles/index.css`:

```css
.goals-header-actions { display: flex; flex-shrink: 0; align-items: center; align-self: center; gap: 14px; }
.goal-rail-arrows { display: flex; gap: 8px; }
.goal-rail-arrow { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--rule); border-radius: 999px; background: var(--surface-raised); color: var(--ink); font-size: 16px; line-height: 1; cursor: pointer; }
.goal-rail-arrow:disabled { opacity: .35; cursor: default; }
.goal-rail-arrow:not(:disabled):hover { border-color: var(--rule-strong); }
```

(Replace Task 1's standalone `.goals-add-action { align-self: center; }` with the wrapper-based rule above.)

- [ ] **Step 4: Verify and commit**

Verify: arrows appear only when the rail overflows, disable at each end, page one card per click, and respect reduced motion. Then:

```bash
git add frontend/src/components/PlanPage.tsx frontend/src/styles/index.css
git commit -m "feat(plan): add desktop arrow controls for the goals rail"
```

---

### Task 5: Final verification and docs

**Files:**
- Modify: `docs/redesign-plan.md` (only the "Plan and Settings" section, one line)

- [ ] **Step 1: Full test pass**

Run from repo root: `cd frontend && npm test && npm run build && cd .. && make test`
Expected: all green.

- [ ] **Step 2: Visual sign-off**

Run `make run`; walk the matrix from Task 3 Step 3 once more on the final build; confirm light + dark, masked + unmasked.

- [ ] **Step 3: Record the change in the project plan doc**

In `docs/redesign-plan.md`, section "5. Plan and Settings", add:

```markdown
- [x] Render goals as an Apple-style horizontal scroll-snap card rail with the add-goal action in the section header.
```

- [ ] **Step 4: Commit**

```bash
git add docs/redesign-plan.md
git commit -m "docs: note goals card-rail redesign in the project plan"
```

---

## Risk notes

- **`scroll-snap-type: x mandatory`** can feel grabby with exactly 2 short cards; if review dislikes it, `x proximity` is a one-word change on `.goal-scroller`.
- **Long projection copy** makes cards tall when returns aren't configured ("A projection needs at least two snapshots…"). Equal-height cards absorb this; if it still looks heavy we can clamp the copy to 3 lines (`-webkit-line-clamp`) in a follow-up.
- **`document.getElementById` in `beginEdit`** runs before the form opens; the card already exists so it is safe. If cards were conditionally unmounted (they aren't), this would no-op.
