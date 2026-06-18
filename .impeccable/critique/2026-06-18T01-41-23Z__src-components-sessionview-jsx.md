---
target: SessionView
total_score: 22
p0_count: 0
p1_count: 2
p2_count: 4
p3_count: 2
timestamp: 2026-06-18T01-41-23Z
slug: src-components-sessionview-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Progress bar + timer are solid; loading is plain text with no skeleton |
| 2 | Match System / Real World | 3 | "TARGETS" tab uses English; "LVN/FÁC" abbreviations in footer unexplained |
| 3 | User Control and Freedom | 2 | No exercise deletion affordance; "FINALIZAR SESIÓN" implies irreversible close but isn't |
| 4 | Consistency and Standards | 3 | Day heading uses Bebas Neue but DESIGN.md spec defines it as DM Mono — internal drift |
| 5 | Error Prevention | 2 | Raw JSON textarea for targets is an error trap; no confirmation on session finalize |
| 6 | Recognition Rather Than Recall | 2 | Empty state doesn't connect to day selector; targets JSON schema undiscoverable |
| 7 | Flexibility and Efficiency of Use | 1 | No auto-fill from last session; no keyboard shortcuts; no "go to today" shortcut |
| 8 | Aesthetic and Minimalist Design | 3 | Clean dark monolith; footer legend is anxious 11px clutter; tab nav has low discoverability |
| 9 | Error Recovery | 2 | Target import error is decent; Firebase failures are silent; no undo for done toggles |
| 10 | Help and Documentation | 1 | Footer legend is the only help in the app; targets import requires known JSON schema |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**LLM assessment**: This does NOT look AI-generated. The Bebas Neue + DM Mono pairing is a committed, distinctive typographic choice. The near-black monolith palette with severity-coded RIR colors is intentional and holds up. No SaaS cream, no gradient text, no identical card grids, no hero-metric template. The component passes both the first-order and second-order slop tests — a gym tracker built like a powerlifting scoresheet is a specific aesthetic lane, and the code reflects it genuinely.

Where the AI slop test is borderline: the `transition: width` on the progress bar (a common lazy implementation) and the raw JSON textarea for targets (a developer-mode control leaked into the UI) break the craft signal. These aren't aesthetic failures — they're execution gaps.

**Deterministic scan**: 6 findings total — 1 warning, 5 advisories.

- `transition: width` (line 197) — **REAL**: animating `width` directly causes layout thrash. Should be `transform: scaleX()` with `transform-origin: left center`.
- `borderRadius: 3px` (line 193) — **FALSE POSITIVE**: 3px on a 5px-tall progress bar track is geometrically correct. The DESIGN.md scale just doesn't list this micro value. Add `xs-bar: 3px` to the scale.
- `borderRadius: 10px` (lines 289, 348) — **REAL DRIFT**: DESIGN.md scale is 4/6/8/12. 10px is undocumented. Both should be `rounded.lg` (8px) or `rounded.card` (12px).
- `#1a0a0a` (line 331) — **FALSE POSITIVE**: This is the `button-session-active.backgroundColor` token, defined in DESIGN.md components. The detector doesn't cross-check component specs.
- `#fff` (line 343) — **ADVISORY**: The "✓ COPIADO" state uses `#fff` instead of `#f0f0f0` (ink-primary). Minor drift but inconsistent with the token.

---

## Overall Impression

The foundational design is genuinely strong — the dark monolith, the typographic identity, the RIR severity vocabulary, the session state machine in the header. This is not a generic AI UI. The failures are in the depth layer: the features that require more than tapping a button (importing targets, removing exercises, auto-filling from last session) are either missing or brutally developer-facing. The single highest-leverage improvement is replacing the JSON textarea for targets with a guided form — that one change would move the app from "usable by people who built it" to "usable by anyone."

---

## What's Working

**1. Typographic hierarchy is earned and readable.** The 38px Bebas Neue wordmark, the 28px volume counter, the 22px day title, the 13px label layer — the scale has real rhythm. In a gym environment where eyes are tired and hands are sweaty, the size differentiation does real work. This isn't default-large-font; it's a considered hierarchy.

**2. Session state machine in the header is coherent.** Three elements — volume counter, timer text, and session button — form a complete status display. `color: #888 "sin iniciar"` → `color: #22c55e "⏱ 12:43"` with the accompanying `#1a0a0a / #fca5a5` session button is a clean, color-coded state machine. Reading the header alone tells you everything about the current session state.

**3. RIR severity vocabulary is consistent and meaningful.** Red/orange/yellow/green/gray maps cleanly to athletic performance zones. When the done-button turns green it means something different from when RIR 3 fires green. The discipline of the Monolith Rule (no decorative color) makes these semantic signals land with authority.

---

## Priority Issues

**[P1] Day heading uses Bebas Neue — violates The Bebas Ceiling rule**
- **What**: Line 228 — `fontFamily: "'Bebas Neue'"` on `{dayInfo?.full}` (e.g., "LUNES", "MIÉRCOLES PUSH"). DESIGN.md's typography spec explicitly defines the Title role as "DM Mono, 500, 22px" and The Bebas Ceiling rule permits Bebas Neue in exactly two contexts: the wordmark and volume totals. The day heading is neither.
- **Why it matters**: Bebas Neue in a functional navigation label turns a design system rule into a guideline, which erodes the whole vocabulary. If "LUNES" uses Bebas Neue, why not the tab labels? Why not the exercise names? The rarity is the meaning.
- **Fix**: Change line 228 `fontFamily: "'Bebas Neue'"` → `fontFamily: "'DM Mono', monospace"`, `fontWeight: 500`. Keep `fontSize: "22px"` and `letterSpacing: "2px"`.
- **Suggested command**: `$impeccable polish SessionView`

**[P1] Raw JSON textarea for target import is a developer-mode control exposed to users**
- **What**: The TARGETS tab shows a multi-line textarea expecting a specific JSON schema (`{ "semana": "...", "targets": { "Exercise": { "series": N, "reps": N, "peso": N } } }`). There's no example rendered, no guided form, no schema documentation. Any user who didn't write this code will fail.
- **Why it matters**: Targets are the second most important data in the app after the workout log itself — they're the number the athlete is trying to beat. Making them inaccessible except via raw JSON means this feature is effectively disabled for any non-developer user. If the app ever reaches a second person, this breaks immediately.
- **Fix**: Replace the textarea with a per-exercise form: select exercise from dropdown (populated from `session.exercises`), enter series/reps/peso, save. The JSON textarea can remain as an "advanced import" below a `<details>` element.
- **Suggested command**: `$impeccable craft targets import form`

**[P2] Empty state doesn't create an affordance to the day selector**
- **What**: On first load (no day selected), the content area shows "SELECCIONÁ UN DÍA" centered in gray text. The day selector row is above the fold and visually disconnected from this message. Nothing points up.
- **Why it matters**: The "Casey" persona (one-handed, distracted) opens the app and sees "SELECCIONÁ UN DÍA" but their thumb is at the bottom of the screen. They don't immediately look at the scrolled-up pill row above.
- **Fix**: Add a subtle visual cue — an upward arrow or a repeated micro day selector in the empty state, or animate the day selector row to pulse briefly on first load.
- **Suggested command**: `$impeccable onboard SessionView`

**[P2] Footer legend is 11px monospace in a gym — functionally unreadable**
- **What**: The fixed footer contains two lines at 11px: `"RIR: 0=FALLO · 1=OBJ · 2=OK · 3=LVN · 4+=FÁC"` and `"FAT: 1=FRESCO · 5=LÍMITE"`. "LVN" and "FÁC" are unexpanded abbreviations. At 11px in a gym environment (sweat on screen, bright lighting, tired eyes), this fails the Mono Data Rule spirit even if the rule technically only requires ≥16px for numeric data entry.
- **Why it matters**: This is the only contextual help in the app. If a user needs to know what RIR 3 means (leve = light effort), they have to squint at footer text while holding a 100kg barbell.
- **Fix**: Expand abbreviations inline: `"3=LEVE"` instead of `"3=LVN"`, `"4+=FÁCIL"` instead of `"4+=FÁC"`. Bump font to 12px. Or remove the footer legend entirely and rely on the RIR pills' color vocabulary (which is already intuitive).
- **Suggested command**: `$impeccable clarify SessionView`

**[P2] No exercise deletion**
- **What**: Exercises added to a session have no visible way to be removed. The ExerciseCard component (via `onUpdate`) can update data but the SessionView has no `onDelete` handler. An exercise added by mistake lives in the session forever.
- **Why it matters**: Mistyped exercise names, wrong day exercises, accidentally added exercises — all are permanent. Users who notice this will feel the app is broken.
- **Fix**: Add a delete handler in SessionView: `function deleteExercise(name) { const { [name]: _, ...rest } = session.exercises; persist({ ...session, exercises: rest }); }`. Pass as `onDelete` prop to ExerciseCard with a long-press or swipe trigger.
- **Suggested command**: `$impeccable harden SessionView`

---

## Persona Red Flags

**Casey (Distracted Mobile User — Primary Persona)**
- Opens app mid-rest, sees "SELECCIONÁ UN DÍA" — no thumb-reachable action below it. Has to scroll up to the day row.
- The "FINALIZAR SESIÓN" button is not pinned to the bottom; it's in the scroll content. After a long session with many exercises, it's buried and requires scrolling.
- Footer legend at 11px is invisible without glasses at arm's length. Sweat-covered screen makes it worse.
- Sessions notes textarea with `rows={1}` expands awkwardly on mobile when typing a long note — mobile keyboard + expanding textarea can cause layout jumps.

**Alex (Regular Trainer / Power User)**
- Weight and reps inputs are blank every session — zero auto-fill from `lastData` despite the prop being passed to ExerciseCard. Must mentally remember last week's numbers before every set. This is the single biggest efficiency failure for a weekly user.
- No "go to today" — if you navigated to Wednesday but it's Monday, you have to scan and tap the day pill manually. No default or shortcut.
- The INFORME and TARGETS tabs are discovered by accident. A regular user may log for weeks without knowing the report feature exists.

**Marco (The Serious Trainee — Project-Specific Persona)**
- Profile: does 4-day PPL, tracks RIR every set, uses targets set by a coach. The blue target values and last-session comparison are the core value of the app.
- Red flags: the target import JSON flow requires Marco's coach to write raw JSON, which no coach will do. The targets feature is effectively inaccessible to any coach-athlete relationship. Marco opens TARGETS tab, sees a raw JSON textarea, closes it, never uses targets.
- The session timer requires explicit "INICIAR SESIÓN" tap. Marco often forgets to tap it before the first set. Session reports then show "00:00" duration, undermining the log's usefulness.

---

## Minor Observations

- `transition: width` on the progress bar (line 197) should be `transform: scaleX()` — this is a real performance issue on mid-range Android devices, not just a theoretical concern.
- `borderRadius: 10px` on the add-exercise container (line 289) and report `<pre>` block (line 348) should align to the 8px or 12px scale.
- `#fff` in the "✓ COPIADO" state (line 343) should use `#f0f0f0` (ink-primary token) for consistency.
- The `<style>` block importing fonts and setting global resets is inline in every render — should be moved to `index.html` or a CSS file to avoid re-parsing.
- The three-tab navigation (HOY / INFORME / TARGETS) has no indication that HOY is the default — a new user who accidentally taps INFORME and sees an empty state may not know to tap back.
- `activeDateKey` is set to `dateKey` (today) on initial load, but `activeDay` is null — there's a latent inconsistency where the date key doesn't match the day if the user never selects a day. Only relevant if `activeDateKey` is used somewhere before day selection, but worth noting.

---

## Questions to Consider

- "What if targets were set inline, per exercise, from within the session view itself — the way coaches actually write them?"
- "The session timer requires manual activation. What would it take to make it start automatically on the first 'done' set, removing that conscious overhead?"
- "The footer legend assumes users don't already know what RIR means. Does it belong in the UI at all, or in a first-run tooltip that disappears after one session?"
