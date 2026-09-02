# GEMINI.md — A11y Lab

Read this file before writing any code. Re-read it when starting a new session.
These are constraints, not suggestions. When a request in chat conflicts with a
rule here, say so before proceeding.

This describes the complete tool. There is no phase gating in this document —
every capability below is in scope.

---

## 1. What we are building

A client-side web app that audits interfaces for accessibility against
**WCAG 2.2 (A/AA)** and **WAI-ARIA 1.2 + the ARIA Authoring Practices Guide**,
and lets a designer *experience* their interface the way a disabled user would.

**Guiding question (locked — this is the submitted framing):**
> HMW run accessibility checks during the design phase, making barriers visible
> where design decisions are made, so failures are caught before code is written
> rather than only audited after launch?

Read "barriers visible" as *made apparent*, not *rendered on screen*. The
screen-reader transcript, the audio playback, and the keyboard overlay all serve
this — each one makes a barrier apparent that a designer could not otherwise
perceive.

Scope is deliberately tight. Ship beats scope — a working narrow tool is worth
more than a broad broken one.

---

## 2. Non-negotiable rules

### R1 — Deterministic code owns every number and every verdict

Contrast ratios, thresholds, tab order, target sizes, counts, pass/fail, WCAG criterion mapping: all computed in TypeScript. Never ask a model for a number or threshold.

The model owns **only**: plain-language impact text, remediation copy, accessible
colour suggestions, semantic interpretation of images and layer names, and the
executive summary. Pass it computed findings and ask it to explain them.

A hallucinated `4.7:1` is worse than no tool at all. This rule has no exceptions.

**Enforce it at the prompt boundary.** Every prompt that could invite a
measurement must forbid one explicitly: *"Return no colours, ratios, sizes or any
other number."* Then validate the response shape on the way back in and drop any
numeric field you did not ask for.

### R2 — Never present a prediction as a measurement

Every finding carries a `confidence` field: `measured` | `predicted`.
Predicted findings render with a visible badge and a one-line reason.

**R1 and R2 are independent axes and must not be collapsed.**

| | R1 | R2 |
|---|---|---|
| Question | Who authored this? | How direct is the evidence? |
| Values | code / model | measured / predicted |
| Applies to | numbers and verdicts → always code | every finding |

A `predicted` finding is still fully code-authored. Predicted means *code derived
this from a proxy signal rather than observing the real thing* — a deterministic
graph walk over prototype links is predicted, not because a model guessed, but
because a design file has no runtime to observe. If "predicted" ever starts to
mean "the model supplied it", R1 has already been breached.

**Predicted is not only a design-file problem.** On a fully live DOM, two
findings remain predicted:

- **Focus visible (2.4.7)** — computed from resting styles; a static snapshot
  never enters `:focus`.
- **Focus trap in a dialog (2.4.3)** — trap behaviour is runtime JS, and the
  render pipeline strips scripts.

Both must state that reason inline.

### R3 — The tool must pass its own audit

Full keyboard operation. Visible focus everywhere. Live regions announcing audit
progress. No status conveyed by colour alone — always colour **plus** icon or text.
Semantic HTML, real labels, correct heading order.

Two specific traps, both found in our own build:

- **Never put explanatory content in a `title` attribute.** Tooltips via `title`
  are unreachable by keyboard and inconsistently announced. The capability matrix
  reasons need a real popover or visible text.
- **Interactive elements must not nest.** An expandable issue row is one button;
  its detail content uses `span` with `display:block`, not `div` or nested
  controls.

An accessibility tool that fails accessibility is the one bug a judge will find.

### R4 — Never report "no issues found" on a thin parse

A false clean bill of health is the worst possible output. Each input has its own
floor, and below the floor the tool refuses to report rather than reporting zero:

| Input | Floor | On failure |
|---|---|---|
| HTML / URL | < 50 element nodes, or no text content | Warning state, offer paste fallback |
| Image | < 3 usable regions | Warning state, ask for a larger screenshot |
| Figma | Node fetch returned no children | Warning state, check node-id and token scope |

**A partial pass must announce itself as partial.** If the region list was
truncated, or a module threw, say which parts of the interface were not examined.
Silent partial coverage is the same lie as a false clean result.

### R5 — Declare the unit before measuring in it

Image pixels are not CSS pixels, and the ratio between them is not recoverable
from the file. Any check with a CSS-pixel threshold — target size (2.5.8), the
large-text allowance in 1.4.3, the 12px floor — is `predicted` until the user
declares the export scale, and `measured` after.

This is the cheapest demonstration in the tool of what "measured" actually costs:
one user-supplied fact moves a cell in the matrix.

### R6 — No secrets in the repo

Figma PAT lives in React state for the session only. Never `localStorage`, never
committed, never logged. Model API key via env var. Same for any headless-browser
API token.

### R7 — Exceptions must be documented and cleared before reporting

Many WCAG criteria contain specific exceptions (e.g., logotypes for contrast, spaced targets for 2.5.8). The audit engine must rigorously check these exceptions before marking a finding as a failure.
If an element passes due to an exception, it is **exempted**, not a full pass. The tool must surface the exempted count and detail the specific reasons (e.g., "Exempted: Spacing Exception") in the report. This prevents the tool from crying wolf on elements that technically violate the base rule but satisfy the exception criteria.

---

## 3. Architecture

```
Input adapter  →  regions / node tree  →  Audit engine  →  Findings[]  →  UI
```

The engine never knows where its input came from. Adding an input means writing
an adapter, nothing else. Every panel in the UI is a different rendering of one
`Finding[]` — the issue rail, the overlays, the transcript, and the report are
four views over the same array, not four features.

### Canonical finding shape

Every module emits this. Do not invent variants.

```ts
type Finding = {
  id: string;                    // stable, e.g. "contrast-btn-primary-01"
  module: 'contrast' | 'keyboard' | 'screenreader' | 'structure';
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  confidence: 'measured' | 'predicted';
  confidenceReason?: string;     // required when predicted
  wcag: { sc: string; name: string; level: 'A' | 'AA' | 'AAA' };
  aria?: string;                 // related ARIA or APG rule
  target: {
    selector?: string;           // HTML paths
    figmaNodePath?: string;      // Figma path
    boundingBox?: { x: number; y: number; w: number; h: number };
    snippet?: string;
  };
  evidence: string;              // MUST contain the real numbers
  swatch?: { fg: string; bg: string };  // sampled pair, rendered as chips
  note?: string;                 // caveat on the threshold used
  impact?: string;               // model-authored, added post-audit
  fix?: string;                  // model-authored, added post-audit
};
```

`evidence` is written by code, never by a model.
`"2.9:1, needs 4.5:1 — #8A8A8A on #FFFFFF"` — not `"fails contrast"`.

### Stack

React + TypeScript + Tailwind for the frontend via Vite. 
FastAPI + Python backend running locally to support Hugging Face computer vision models (e.g. YOLOv11, OmniParser) to eliminate cloud AI token costs and limits.
No database, no heavy build step beyond Vite.

---

## 4. The three inputs

### A. Figma link

Parse all three URL shapes; the file key sits in the same position:

```
figma.com/proto/<fileKey>/<name>?node-id=123-456
figma.com/design/<fileKey>/<name>?node-id=123-456
figma.com/file/<fileKey>/<name>?node-id=123-456
```

Normalise `node-id`: URL `123-456` → API `123:456`.

```
GET https://api.figma.com/v1/files/{fileKey}/nodes?ids={nodeId}
Header: X-Figma-Token: <PAT>
```

`api.figma.com` sends permissive CORS headers — call it directly from the browser.
**No MCP. No OAuth. No proxy.**

Also fetch `GET /v1/images/{fileKey}?ids={nodeId}` for a rendered PNG to use as
the canvas background.

**Prototype links are the better input.** A `/proto/` URL means prototype
connections exist. The response carries `prototypeStartNodeID` and per-node
`interactions[].transitionNodeID` — use these to derive focus order from the
designer's declared flow rather than from geometry. Fall back to geometric order
(top-to-bottom, then reading direction, respecting frame nesting) only when no
interactions are present.

Both paths are deterministic graph walks. Both are `predicted`, because the file
has no runtime — see R2.

A PAT only reads files its owner can access. Public Community files 403 unless
duplicated into the token owner's drafts first.

### B. Image upload

Canvas → `getImageData` → sample colour pairs in text regions for real contrast
numbers. Send the image to the model for regions, structure and reading order.

**Division of labour on this path:**

| Model returns | Code computes |
|---|---|
| Region bounding boxes | Every sampled colour |
| Element kind (heading, button, input…) | Every contrast ratio |
| Visual reading order | Every size check |
| Visible text and purpose | Every severity and verdict |

A bad box gives a bad sample. A bad box never gives an invented number.

**Sample decile cores, not cluster means.** Split the region's pixels by
luminance, then take the darkest tenth and the lightest tenth and average within
each band. Do **not** average a k-means cluster: antialiased glyph edges sit
between ink and ground, get pulled into the ink cluster, and lighten the reported
foreground.

Measured on a synthetic `#8A8A8A`-on-white region: cluster means reported
`#999999` at 2.87:1; decile cores reported `#8A8A8A` at 3.45:1, matching ground
truth exactly. The verdict was unchanged, but the number was wrong by 0.58, and
the number is the product.

If the luminance spread across a region is under 0.012, report it as unsampleable
rather than guessing a pair.

**The model pass must survive its own limits:**

- Cap the response at ~14 regions, prioritising interactive controls and form
  fields over decorative containers.
- Use short keys. Long schema names spend the token budget on punctuation.
- **Salvage truncated JSON.** If there is no closing bracket, trim back to the
  last complete object and close the array. Truncation is the single most likely
  failure and it is fully recoverable.
- If the response truncated, surface a partial-pass notice naming how many
  regions were covered — R4.
- Distinguish the failure causes in the UI: API error, tainted canvas, too few
  regions, unparseable response. Every one gets a retry. Never dead-end.

Keep this path working at all times — it is the fallback if Figma or URL fetch
fails during the demo.

### C. Live website link (single page, no crawl)

Cross-origin fetch is impossible from the browser. Get the HTML via a hosted
headless-browser API (JS-rendered), with a public CORS proxy as fallback and
"paste the HTML" as final fallback. Never dead-end the UI.

**Prefer JS-rendered HTML.** A raw fetch of a React/Next site returns an empty
`<div id="root">` and the audit finds nothing — see R4.

**The rendering pipeline (this is what makes it work):**

1. Inject `<base href="https://original-site.com/">` as the first child of `<head>`.
   Relative CSS, image, and font URLs now resolve against the real origin.
   Browsers do not CORS-block *rendering* of those assets, only reading them.
   The page looks correct with zero asset rewriting.
2. Strip every `<script>` tag — they break without their origin anyway, and this
   removes the security surface.
3. Remove CSP and `X-Frame-Options` `<meta>` tags.
4. Write into a **same-origin** iframe via `srcdoc`.

`iframe.contentDocument` is now fully readable: `getComputedStyle`, real
`tabindex` resolution, genuine measured tab order. Identical to the paste path
from here — same engine, no branching.

Use `sandbox="allow-same-origin"` without `allow-scripts`. Scripts are already
stripped; withholding the capability is belt and braces.

**SSRF guard:** block `localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`, `0.*`.
15s timeout with a clear failure state.

This is a static post-render snapshot. Say so in the capability matrix:
"single page, post-render snapshot; interactive states require manual review."

---

## 5. Capability matrix

Three inputs × four modules, each cell `Measured` | `Predicted` | `Unavailable`,
with a reason attached.

| | Contrast | Keyboard | Screen reader | Structure |
|---|---|---|---|---|
| **Figma** | Measured | Predicted | Predicted | Measured |
| **Image** | Measured | Predicted | Predicted | Predicted¹ |
| **HTML / URL** | Measured | Measured | Measured | Measured |

¹ Target size flips to Measured once the export scale is declared (R5).

Reasons, per cell:

- Figma contrast — fills and text colours are literal values in the file.
- Figma keyboard — no runtime; order derived from prototype links or geometry.
- Figma screen reader — no accessibility tree; inferred from layer and component names.
- Figma structure — sizes, text styles and nesting are exact in the document.
- Image contrast — colour pairs sampled directly from pixels.
- Image keyboard — order inferred from visual reading order, not from `tabindex`.
- Image screen reader — names read from visible text only; no alt or aria to inspect.
- Image structure — heading levels and labels inferred visually.
- HTML, all four — read from a same-origin document.

**The matrix is state, not documentation.** It reads the currently selected input
and highlights that row. It is not an FAQ and must not be built as one — an FAQ
is optional supplementary text, whereas someone who skips the matrix can look at
a Figma keyboard result and reasonably believe we pressed Tab. It is load-bearing
for a finding being interpreted correctly, which makes it part of the output.

Permanently visible. It is the one thing in the left panel that survives the
collapse after a run. Per R3, the reasons live in a real popover, never in a
`title` attribute.

---

## 6. Audit modules

### A — Contrast and colour

WCAG relative luminance formula. Checks 1.4.3 (4.5:1 body, 3:1 large), 1.4.11
non-text contrast for UI components and focus indicators, 1.4.1 colour as sole
carrier of meaning.

- **HTML**: `getComputedStyle` for `color`; walk ancestors compositing background
  layers until alpha reaches 1. Composite translucent foregrounds against the
  resolved background before measuring.
- **Figma**: resolve effective background by walking parent frame fills until opaque.
- **Image**: decile-core pixel sampling per §4B.

Always report the sampled hex pair, and render it as two colour chips beside the
ratio. Large text is ≥24px, or ≥18.66px at weight ≥700.

**Verify the maths against known anchors, not memory.** `#777777` on white is
4.48:1; black on white is 21.00:1. During this build a recalled expectation of
3.03:1 for `#8A8A8A` on white was wrong — the correct value is 3.45:1. That is R1
demonstrating itself on the developer.

### B — Keyboard and focus order

HTML: walk the real DOM — `tabindex`, `disabled`, `visibility`, `inert`, computed
styles. Sort by positive `tabindex` first in ascending order, then document order
for `tabindex="0"`. Detect positive `tabindex`, click handlers on non-interactive
elements, missing skip links, focus traps, elements with no visible focus indicator.

Note that stripping `<script>` tags does **not** remove inline `onclick`
attributes — `[onclick]` on a `div` remains detectable and is the highest-value
finding on the live path.

Figma and image: predicted order per §4A and §4B.

Render as a numbered path overlay on the canvas. Each stop expands to show
element, role, accessible name, flags. Problem stops colour-coded **and**
icon-marked. Tab/Shift+Tab to step, plus on-screen buttons. Include an autoplay
walkthrough — you cannot rely on keyboard focus reaching a projector.

**Overlay coordinates.** Bounding boxes come back in source space (iframe
viewport, Figma canvas, or image pixels) and must be scaled by the render ratio
before positioning. Recompute on scroll and resize, or markers drift on anything
taller than the visible frame.

### C — Screen reader simulation (the demo centrepiece)

HTML: derive the accessibility tree per accname resolution order —
`aria-labelledby` → `aria-label` → native label → content → `title`. Report which
step in that order supplied the name; that is what makes the diff honest rather
than a guess.

Figma: predict from layer names, text content, component names.
Image: predict from visible text only.

Transcript pane printing role, name, state, set position, heading level.
Step / play / pause / rate. Web Speech API playback so the room hears it.

Two views:
- **Says now / should say** — per-item diff. A file reading back as
  "button, Rectangle 47" needs no explanation.
- **Browse mode** — headings outline, landmarks, links, form fields. This is how
  screen reader users actually navigate: by jumping between structures.

Flag announcements that are empty, duplicated, read a filename or default layer
name, or give a role with no accessible name. Flag duplicate link names that
resolve to different destinations.

### D — Structure and semantics

Heading hierarchy gaps, first-heading-is-not-h1, landmark coverage, form label
association, link purpose (2.4.4), target size min 24×24 CSS px (2.5.8), text
under 12px, unnamed layers.

Cheapest to build, highest finding volume. It is also the module that survives
the loss of runtime almost intact, which is why Figma structure is Measured.

---

## 7. Report

Header: verdict per level, counts by severity and POUR principle, and an explicit
statement that automated testing catches roughly a third of WCAG issues, with a
manual-review checklist.

**Never claim conformance.** Overclaiming is itself an accessibility harm.

Colour suggestions must stay within a bounded hue distance of the original brand
colour. "Change your brand blue to black" is advice a designer ignores; "darken
12% to clear 4.5:1" is advice they take. Compute the corrected colour; let the
model write the sentence around it.

Filter by severity, criterion, principle. Export PDF, JSON, Figma-ready comments.

---

## 8. Layout

Left: input, token, module toggles, capability matrix. Collapses after a run,
**except the matrix**, which stays.
Centre: preview canvas + overlays + Keyboard/Screen Reader mode switch. Largest.
Right: issue list, populating live as the audit streams.

Keyboard and screen reader are a mode switch *inside* the canvas, not a fourth
panel — they are two readings of the same overlay space and would fight for width
otherwise.

**Bidirectional linking** — click an issue to highlight it in the preview; hover
an element to surface its issues. This is what makes it feel like a tool rather
than a form that returns a list. The hover direction is the more expensive half
and the half that sells it.

Stream findings into the right rail per module as each completes. A progress bar
is less convincing than results arriving.

Progressive disclosure: severity count → one-line issue → full detail.

---

## 9. Do not build

- Multi-page crawl or sitemap traversal
- Figma OAuth (needs a server for the client secret — PAT instead)
- Authenticated or behind-login pages
- Playwright / Cloud Run / any backend
- Video caption checks
- Clicking through modals or hover states

Leave an adapter seam so a `/audit/url` backend can drop in later without
touching the UI.

Naming these with reasons reads as engineering judgement. Silence reads as an
oversight the judge found first.

---

## 10. Acceptance

Given a deliberately broken input, the tool catches each of these, mapped to its
WCAG 2.2 criterion, with a working fix:

- [ ] Low-contrast button — real ratio in the evidence string
- [ ] `<div onClick>` that Tab skips
- [ ] Image with no alt / unnamed Figma layer
- [ ] Input with no associated label
- [ ] Modal with no focus trap
- [ ] Positive `tabindex` causing an order jump
- [ ] Target under 24×24
- [ ] Heading level skip
- [ ] Duplicate link text to different destinations
- [ ] A near-miss ratio — e.g. 4.48:1 against a 4.5:1 threshold. Nothing
      demonstrates R1 faster than a failure by 0.02.

Plus: the keyboard overlay and the screen-reader transcript both reproduce these
live, and the tool passes its own audit (R3).

---

## 11. Failure modes to avoid

| Symptom | Cause | Fix |
|---|---|---|
| Confident wrong ratio | Model asked for a number | R1 |
| Ratio wrong by a few tenths | Averaged a cluster, not a decile core | §6A |
| "No issues found" on a real site | SPA returned an empty shell | R4 |
| "No issues found" on a screenshot | Region pass returned nothing | R4 |
| "Model did not return an array" | Response truncated at the token ceiling | §4B salvage |
| Target size flagged on a 2× export | Image px treated as CSS px | R5 |
| Figma 403 | PAT can't see that file | Duplicate to own drafts |
| Blank iframe | Missing `<base>` tag | §4C step 1 |
| Overlay misaligned | Boxes in source space, not render space | §6B |
| Panels stack vertically | Arbitrary-value CSS classes not compiled | Use a real stylesheet |
| Judge asks "how is this different from axe?" | Demo led with the live URL | Lead with Figma |

---

## 12. Demo

Lead with **Figma**. That is the HMW and the differentiator. Live URL goes last,
framed as verification — "same engine, run against the built page, to check the
code still matches the intent you designed."

Show the export-scale toggle on the image path. Flipping one control from Unknown
to 2× moves a finding from Predicted to Measured and changes a cell in the matrix.
It is the shortest possible demonstration of what this tool is actually about.

Rehearse with a specific pre-tested Figma file and a specific pre-tested URL.
Duplicate the Figma file into your own drafts and confirm the PAT returns 200
well before you need it.