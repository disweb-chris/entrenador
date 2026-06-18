---
name: OVERLOAD
description: Progressive overload tracker for athletes who measure everything.
colors:
  ink-primary: "#f0f0f0"
  ink-secondary: "#cccccc"
  ink-muted: "#888888"
  ink-disabled: "#555555"
  bg-canvas: "#0a0a0a"
  bg-surface: "#111111"
  bg-input: "#0f0f0f"
  bg-divider: "#1a1a1a"
  border-default: "#1e1e1e"
  border-subtle: "#333333"
  accent-done: "#22c55e"
  accent-target: "#3b82f6"
  accent-error: "#ef4444"
  rir-failure: "#ef4444"
  rir-objective: "#f97316"
  rir-ok: "#eab308"
  rir-light: "#22c55e"
  rir-easy: "#6b7280"
  state-error-surface: "#7f1d1d"
typography:
  display:
    fontFamily: "'Bebas Neue', sans-serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "5px"
  title:
    fontFamily: "'DM Mono', monospace"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "2px"
  body:
    fontFamily: "'DM Mono', monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'DM Mono', monospace"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "1px"
  data:
    fontFamily: "'DM Mono', monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
  micro:
    fontFamily: "'DM Mono', monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "1px"
rounded:
  none: "0"
  sm: "4px"
  md: "6px"
  lg: "8px"
  card: "12px"
  pill: "50px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.bg-canvas}"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "#d0d0d0"
    textColor: "{colors.bg-canvas}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
  button-ghost-hover:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.ink-primary}"
  button-session-idle:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.lg}"
    padding: "16px"
  button-session-active:
    backgroundColor: "#1a0a0a"
    textColor: "#fca5a5"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-data:
    backgroundColor: "{colors.bg-input}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "10px 8px"
  done-button-default:
    backgroundColor: "transparent"
    textColor: "transparent"
    rounded: "{rounded.circle}"
    size: "44px"
  done-button-complete:
    backgroundColor: "{colors.accent-done}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.circle}"
    size: "44px"
---

# Design System: OVERLOAD

## 1. Overview

**Creative North Star: "The Competition Sheet"**

OVERLOAD is a training log built like a powerlifting scoresheet. The interface takes its aesthetic cues from the precision instruments athletes actually trust — stopwatches, scoring tablets, weight plates. Everything is dark, dense, and direct. Bebas Neue stamps identity and volume like a scoreboard. DM Mono renders every datum with the flat authority of a measured result: no rendering ambiguity between 0 and O, no kerning that second-guesses a weight entry.

The palette is a near-black monolith. Color exists in exactly two registers: the neutral ink stack and a coded severity vocabulary for RIR and fatigue. A green done-button. A red border when failure fires twice. Nothing else earns a saturated value. The system's restraint is the point — when the accent-done green fires, it means something.

What this system explicitly rejects: the motivational pastel UX of MyFitnessPal and Hevy, where badge animations and gradient progress rings substitute for data. The SaaS dashboard template — Inter typeface, metric cards on white, sidebar icons — is the anti-reference. Every design decision starts from one question: does this serve the set log, or does it make the interface look like a productivity tool?

**Key Characteristics:**
- Near-black monolith: five surface depths, zero decorative color
- Bebas Neue (identity) + DM Mono (data): functional pairing with intentional contrast
- Touch-first: all interactive elements ≥ 44×44px, spaced for single-hand use between sets
- Flat layering: depth via background steps, borders as the only elevation signal
- Aggressive state: RIR 0 fires red across the entire card border, not a subtle icon

## 2. Colors: The Pit Palette

A near-black system with one working accent and a severity vocabulary. The neutrals are achromatic; color appears only when the data demands it.

### Primary
- **Scoresheet White** (`#f0f0f0`): Primary ink. Exercise names, volume totals, inputs. Maximum contrast on all dark surfaces. Used for any text the user must read mid-set.
- **Completion Green** (`#22c55e`): The only accent that fires on user action. Done-button fill, 100% progress bar, session timer when running. Its rarity is its meaning.

### Secondary
- **Target Blue** (`#3b82f6`): Objective display only — the target from last session. Never used for navigation or decoration. Reserved for the number the athlete is trying to beat.
- **Warning Red** (`#ef4444`): RIR 0 (failure) and alarm states. Also used as the full card-border color when a RIR 0 has been recorded more than once in a session.

### Tertiary
- **Objective Orange** (`#f97316`): RIR 1 — target zone. One step from failure.
- **Caution Yellow** (`#eab308`): RIR 2 — acceptable margin, still working.
- **Undertrained Gray** (`#6b7280`): RIR 4+ — too easy, needs progression.

### Neutral
- **Pit Black** (`#0a0a0a`): Body canvas. Every session starts here.
- **Equipment Gray** (`#111111`): Card and container surface. The slight lift from Pit Black defines grouping.
- **Data Well** (`#0f0f0f`): Input backgrounds. Recessed from card surface — deeper than the card, shallower than nothing.
- **Chalk Line** (`#1a1a1a`): Dividers, progress bar track. The separator between entries.
- **Grip Border** (`#1e1e1e`): Default border. Defines component edges without competing with text.
- **Annotation Gray** (`#888888`): Muted labels, secondary metadata, placeholder text.
- **Disabled Gray** (`#555555`): Inactive controls, column headers, footer annotations.

### Named Rules
**The Monolith Rule.** The only saturated colors permitted are the semantic data vocabulary (RIR scale, done-state, target). No decorative use of any named color outside its defined semantic role. If a design decision requires a new accent, it means the semantic vocabulary is incomplete — extend it, don't decorate with it.

**The No-Softening Rule.** Error states are aggressive by design. When RIR 0 fires twice, the entire card border turns `#7f1d1d` (deep red). The app does not soften bad training data with neutral warnings. The athlete needs to see it.

## 3. Typography

**Display Font:** Bebas Neue, sans-serif (condensed all-caps grotesque)
**Data / UI Font:** DM Mono, monospace (weights 300 / 400 / 500)

**Character:** Bebas Neue is used exclusively for identity and large numeric display — the OVERLOAD wordmark, volume totals, the day heading. DM Mono carries everything else: all data entry, labels, buttons, notes. The contrast between a condensed display grotesque and a technical monospace is functional, not decorative. Monospace ensures numeric columns align without table markup and eliminates legibility ambiguity in the gym (0/O, 1/l, 6/b).

### Hierarchy
- **Display** (Bebas Neue, 400, 38px, lh 1, ls 5px): App wordmark and session volume total. Two uses only.
- **Title** (DM Mono, 500, 22px, lh 1.2, ls 2px): Day name heading. Uppercase, functional section label.
- **Body** (DM Mono, 400, 15px, lh 1.5): Notes, textarea content, general prose. Max line length 65ch on desktop.
- **Label** (DM Mono, 400, 13px, ls 1px): Buttons, tab navigation, section headers, day selector pills. Always uppercase.
- **Data** (DM Mono, 400, 16px, lh 1): Weight and reps inputs. Center-aligned. Never smaller than 16px — these are the numbers the athlete enters with one thumb.
- **Micro** (DM Mono, 400, 11px, ls 1px): Footer annotations, column headers (PESO / REPS), RIR/Fatigue labels. Muted ink only.

### Named Rules
**The Mono Data Rule.** All numeric data entry and display uses DM Mono at ≥ 16px. Anything smaller loses legibility under gym lighting. The monospace columns are a feature, not a style choice — they let the athlete scan progression without table overhead.

**The Bebas Ceiling.** Bebas Neue appears in exactly two contexts: the OVERLOAD wordmark and volume totals formatted as `[n]kg`. It is never used in form labels, button copy, navigation, or data. Using it in UI copy turns the interface into a gym poster.

## 4. Elevation

This system uses tonal layering exclusively. There are no shadows. Depth is communicated by three background steps and borders.

**Surface stack (dark to light):**
- Level 0 — Canvas: `#0a0a0a` (body)
- Level 1 — Surface: `#111111` (cards, exercise containers)
- Level 2 — Recess: `#0f0f0f` (inputs — slightly darker than the card they sit in)
- Borders: `#1e1e1e` (default), `#333333` (subtle), `#7f1d1d` (error state)

The RestTimer floats above level 0 as a fixed element. It uses `#111111` surface with a `#333333` border — same vocabulary as cards, differentiated by position only.

### Named Rules
**The Flat-By-Default Rule.** No `box-shadow` on any component. If a component needs to appear "above" others, it uses `position: fixed` with a border — not a shadow. Shadows read as soft and polished; this system is hard and precise.

## 5. Components

### Buttons

Tactile and direct. Every button gives transform feedback on `:active` (`scale(0.97)`). No hover color changes on touch devices (media-queried).

- **Shape:** Gently squared edges (8px radius)
- **Primary** (white fill `#f0f0f0`, black text `#0a0a0a`, padding 12px 18px): Used for positive confirmation — AGREGAR, IMPORTAR, COPIAR. The only button that visually "pops" against the dark surface.
- **Ghost** (transparent bg, `#cccccc` text, `#1e1e1e` border, same radius and padding): Day selector inactive state, SALIR, tab navigation. Disappears into the surface.
- **Day selector active** (white fill, same as primary): The selected day. Inverts from ghost instantly — no animation.
- **Session control** (idle: `#1a1a1a` bg, muted text; active: `#1a0a0a` bg, red-tinted text `#fca5a5`): Full-width. State shift communicates session running. Red tint on active is intentional — the session clock is running, don't ignore it.
- **Dashed add-button** (`1px dashed #1e1e1e` border, transparent bg): + SERIE and + AGREGAR EJERCICIO. Lower visual weight than any other button; it's an option, not a call to action.
- **Active state (all):** `transform: scale(0.97)`, `transition: transform 120ms ease-out`. `touch-action: manipulation` prevents double-tap zoom.

### Cards / Containers

- **ExerciseCard** — Corner style: 12px radius. Background: `#111111` (Equipment Gray). Border: `1px solid #1e1e1e` default; `1px solid #7f1d1d` when RIR 0 has fired more than once. Internal padding: 16px. No shadow.
- **Nested well (last session, add-exercise form):** `#0d0d0d` background, 6px radius. Differentiated from card by darker background, not border.

### Inputs / Fields

- **Data input (weight, reps):** `#0f0f0f` background, `1px solid #1e1e1e` border, 6px radius, padding 10px 8px. DM Mono 16px, center-aligned. `type="number"` — numeric keyboard on mobile. No label inside the input — column headers (PESO / REPS) serve as persistent labels.
- **Textarea (notes, targets):** Same surface and border as data input. DM Mono 14px, left-aligned. `resize: none` — height is controlled, not user-resizable.
- **Focus:** No visible focus ring implemented (single-user app, mobile touch). For WCAG compliance when scaling to more users, add `outline: 2px solid #3b82f6` on `:focus-visible`.

### RIR / Fatigue Pills (Signature Component)

The RIR and Fatigue pill rows are the system's most distinctive component. They are a coded severity display masquerading as a rating UI.

- **Shape:** 6px radius, `flex: 1` width (five equal-width pills per row)
- **Unselected:** transparent bg, `#333` border, `#555` text
- **Selected:** filled with the semantic color for that value (RIR 0 = `#ef4444`, RIR 1 = `#f97316`, RIR 2 = `#eab308`, RIR 3 = `#22c55e`, RIR 4 = `#6b7280`); white text
- **Padding:** 8px top/bottom, 2px left/right. Font: DM Mono 13px.
- **Active feedback:** `transform: scale(0.97)` via global button rule.

### Done Button

- **Shape:** 44×44px circle (50% radius)
- **Default:** transparent bg, `2px solid #444` border, no content
- **Complete:** `#22c55e` fill, white checkmark (18px), `2px solid #22c55e` border
- **Transition:** `background 0.2s ease-out, border-color 0.2s ease-out, transform 120ms ease-out`
- The 44px size is the minimum touch target for gym use. Do not reduce.

### RestTimer

Fixed top-right floating panel. Surfaces mid-rest without covering the set row.

- Background: `#111111`, border `1px solid #333333` (warning: `#ef4444`, done: `#22c55e`)
- SVG arc: 72×72px, radius 30px, strokeWidth 4px. Color tracks timer state. `transition: stroke-dashoffset 1s linear`.
- Text in SVG: Bebas Neue 20px — one of the two permitted Bebas Neue uses (displaying a large number mid-session qualifies as volume display).
- Dismiss behavior: pressing CERRAR or SALTEAR resets the timer completely (`total = 0`) and removes the panel.

### Navigation / Day Selector

- Horizontal scroll row, no scrollbar
- Each day: ghost button shape (8px radius, 10px/18px padding, DM Mono 13px uppercase, `letterSpacing: 1px`)
- Active: inverts to white fill / black text
- SALIR: ghost button, pinned right via `marginLeft: auto`

## 6. Do's and Don'ts

### Do:
- **Do** use DM Mono for all numeric data, labels, buttons, and form text. It is the only UI font.
- **Do** use Bebas Neue exclusively for the OVERLOAD wordmark and volume totals (e.g. `4.320kg`). Two uses, no more.
- **Do** keep all touch targets at ≥ 44×44px. The done button, RIR pills, and day selector are the critical ones.
- **Do** use the RIR color vocabulary consistently: 0=red, 1=orange, 2=yellow, 3=green, 4+=gray. These are the only saturated colors permitted outside completion states.
- **Do** use `border: 1px solid #1e1e1e` as the primary depth signal. No box-shadow on any component.
- **Do** make error states aggressive: RIR 0 firing twice turns the entire card border `#7f1d1d`. The athlete needs to see it.
- **Do** add `touch-action: manipulation` to all buttons to prevent double-tap zoom on mobile.
- **Do** animate `transform` and `opacity` only — never `width`, `height`, or layout properties.
- **Do** confirm actions with `scale(0.97)` on `:active`, `transition: transform 120ms ease-out`.

### Don't:
- **Don't** use `box-shadow` on any component. The system is flat by design — a shadow reads as soft; this system is hard.
- **Don't** use MyFitnessPal-style colorful cards, muscle icons, achievement badges, or motivational copy. The anti-reference by name.
- **Don't** use SaaS dashboard patterns: sidebar navigation, Inter/Poppins typeface, metric card grids on white or near-white backgrounds.
- **Don't** use `border: 1px solid X` and `box-shadow` together on the same element. Pick one.
- **Don't** use `border-radius` greater than 12px on cards or containers. 12px is the ceiling for this system.
- **Don't** use Bebas Neue in buttons, form labels, inputs, or navigation text. It becomes a gym poster.
- **Don't** introduce a new accent color without a defined semantic role. Color is earned, not decorative.
- **Don't** animate anything on keyboard-initiated actions or actions the user repeats more than 10× per session.
- **Don't** use `transition: all` — specify exact properties (`transform`, `background`, `border-color`, `opacity`).
- **Don't** decorate inactive states with saturated color. Ghost buttons are `#cccccc` text on transparent — nothing more.
