# World Cup Dashboard — Design System Brief
**Style:** 90s Fashion Editorial × Sports Analytics  
**Reference:** Vogue / i-D magazine aesthetic applied to live match data  
**Screens exported:** `home.html`, `standings.html`, `match-detail.html` (HTML+Tailwind) + PNG screenshots in this directory

---

## 1. Design Tokens — replace existing globals.css variables

```css
/* globals.css — override ALL existing color variables with these */
:root {
  /* Surfaces */
  --background:   #FFFFFF;
  --surface-dark: #1A1A1A;

  /* Foreground */
  --foreground:          #1A1A1A;
  --foreground-secondary: #666666;
  --foreground-inverse:   #FFFFFF;
  --foreground-accent:    #C8102E;   /* the ONLY accent — World Cup red */

  /* Borders */
  --border:       #E8E8E8;
  --border-strong: #1A1A1A;

  /* Row alternation */
  --row-alt: #FAFAFA;

  /* No rounded corners anywhere */
  --radius: 0px;
  --radius-card: 0px;
}
```

---

## 2. Typography

### Fonts to add (Google Fonts)
```html
<!-- Add to <head> in layout.tsx -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet" />
```

```css
/* In globals.css */
--font-heading: 'Playfair Display', Georgia, serif;
--font-body:    'Geist Mono', 'JetBrains Mono', monospace;
```

### Usage rules (strict)
| Use case | Font | Style | Notes |
|---|---|---|---|
| Page masthead / hero headlines | Playfair Display | **Bold Italic** | 180–240px, letterSpacing: -6 to -10px |
| Team names (hero) | Playfair Display | **Bold Italic** | 80–200px, bleeds past container |
| Scores | Playfair Display | **Bold Italic** | 96–120px |
| Pull quotes | Playfair Display | **Bold** | 64–80px, line-height 0.88–0.96 |
| Tactical callouts | Playfair Display | **Bold** | 72px |
| Stat numbers (editorial) | Playfair Display | **Bold Italic** | 40–80px |
| Nav links | Geist Mono | Regular | 11px, letterSpacing: 2px, ALL CAPS |
| Section labels / headers | Geist Mono | Regular | 9–11px, letterSpacing: 3px, ALL CAPS |
| Table data / stats | Geist Mono | Regular | 10–13px |
| Body copy / analysis | Geist Mono | Regular | 13px, lineHeight: 1.9 |
| Captions / meta | Geist Mono | Regular | 8–10px, letterSpacing: 1.5–3px |

---

## 3. Color Usage Rules

- **#1A1A1A** — primary text, section dividers (2px), group letters, team names in tables
- **#666666** — secondary: nav links (inactive), labels, captions, column headers, body copy
- **#C8102E** — accent (use sparingly): top 2 ranked teams, LIVE indicator, featured match ticker BG, win probability bar (dominant team), active nav item, ARG in matchup contexts, key callout numbers
- **#FFFFFF** — white: page background, reversed text on dark sections
- **#1A1A1A** — dark sections: meta bar, footer, pull quote band, featured match bg
- **#FAFAFA / #FFFFFF** — alternating table row backgrounds
- **#E8E8E8** — light separator rules (1px), probability track background
- **#0A0A0A** — deepest dark: match meta sub-strip

### Accent logic
```
Top-2 qualification rank → red team name
LIVE match → red dot + red text
Dominant probability → red band  
Featured team (home context) → red
All other data → black or gray
```

---

## 4. Layout Principles

### Page structure (all pages)
```
[NAV — 60px] border-bottom: 1px solid #1A1A1A
  Left: "WC" monogram — Playfair Display 22px bold
  Center: nav links — Geist Mono 11px 2px-tracking ALL CAPS
  Right: current date — Geist Mono 10px 1.5px-tracking

[HERO ZONE] — varies per page, see below

[CONTENT SECTIONS] — separated by full-width rules
  Thick rule: 2px #1A1A1A (major section breaks)
  Thin rule:  1px #1A1A1A (sub-section headers)
  Light rule: 1px #E8E8E8 (table rows)

[FOOTER — 60px] background: #1A1A1A
  "© 2026 WORLD CUP MMXXVI" · red dot · "PREDICTIVE MODEL — UPDATED DAILY"
  All Geist Mono 10px 2px-tracking white
```

### Typography as space
The editorial key gesture: **text bleeds past the container edge on both sides simultaneously**. On the HOME and STANDINGS pages, the masthead headline (`WORLD CUP` / `GROUPES`) overflows the container left and right — `overflow: hidden` on the container clips it. The letterforms become spatial objects, not text.

```tsx
// Implementation pattern for bleeding headlines
<div className="overflow-hidden w-full">
  <h1 className="font-['Playfair_Display'] text-[240px] font-bold italic leading-none tracking-[-10px] -mx-2 whitespace-nowrap">
    GROUPES
  </h1>
</div>
```

---

## 5. Page-by-Page Component Guide

### HOME (`/`)

**Masthead band** (full-width, bg: #1A1A1A, h: 200px)
- Edition label top-left: `NO. 48 · GROUP STAGE` — Geist Mono 9px #666666
- "WORLD CUP" — Playfair Display 196px Bold Italic white, bleeds both sides
- "MMXXVI" — Geist Mono 11px 4px-tracking #666666, bottom-right

**Featured Match block** (full-width, bg: #111111, h: 320px)
- Left: Team A name — Playfair Display 86px Bold Italic white
- Center: Score — Playfair Display 110px Bold white (centered)
- Right: Team B name — Playfair Display 86px Bold Italic white
- LIVE dot (8px red circle) + `67'` — Geist Mono 10px red
- Sub-strip (bg: #0A0A0A): venue · round · time · attendance · xG — Geist Mono 10px #666666, pipe separators

**Red ticker bar** (full-width, bg: #C8102E, h: 44px)
- "LIVE" — Geist Mono 9px 3px-tracking Bold white
- Scrolling fixture text — Geist Mono 10px 1.5px-tracking white

**Stat Trio** (full-width, h: 160px, 3 equal columns separated by 1px #1A1A1A borders)
- Each cell: giant italic Playfair Display number (80px) + Geist Mono label (9px 3px-tracking #666666)
- Values: `127 GOALS SCORED` · `48 MATCHES PLAYED` · `2.65 AVG xG PER MATCH`

**Fixtures list** (section header "ON THE BOARD" Geist Mono 10px 3px-tracking)
- Each row 55px: Group tag | Time | **Team A** (Playfair 20px) | Score (centered, Playfair 22px, red if LIVE) | **Team B** | xG (right, Geist 9px)
- Alternating bg: #FAFAFA / #FFFFFF

**Qualification probability** (section "ROUND OF 32 — QUALIFICATION PROBABILITY")
- Each team: name (Playfair Display 16px bold) + horizontal progress bar (800px track #EBEBEB, fill #C8102E for top 2 else #1A1A1A) + `96%` number (Playfair 18px bold, red for top 2)

**Editorial pull** (split 2-col)
- Left: `DATA IS THE / NEW UNIFORM.` — Playfair Display 80px bold, letterSpacing -3px
- Right: model methodology note — Geist Mono 13px #666666 lineHeight 1.9

---

### STANDINGS (`/standings`)

**Hero headline** (overflows container)
- `GROUPES` — Playfair Display 240px Bold Italic #1A1A1A, -mx-2, letterSpacing -10px

**Group tables** (2-column grid, Groups A+B top row, C+D bottom row)
- Group letter: Playfair Display 80px Bold Italic (A, B, C, D)
- Column headers: Geist Mono 9px 2px-tracking #666666 (TEAM · MP · W · D · L · GF · GA · PTS)
- Team rows (48px): rank + qualification dot (6px red circle for qualified) + **team name** (Playfair 18px bold) + stats (Geist Mono 13px #666666)
- Row alternation: #FAFAFA / #FFFFFF

**Pull quote band** (full-width, bg: #1A1A1A, h: 260px)
- Left: `THE MODEL SPEAKS / IN PROBABILITIES, / NOT PROMISES.` — Playfair Display 64px Bold white, lineHeight 0.96
- Right: model note — Geist Mono 13px #666666

**Form Guide** (`FORM GUIDE — LAST 5 MATCHES`)
- 2-column layout, 4 teams per column
- Each team: `GRP X` label + team name (Playfair 22px) + 5 result dots (14px circles)
  - W → filled black (or red for top team)
  - D → filled #666666
  - L → outline circle, stroke 1.5px #666666
- Win count suffix: `3W` Geist Mono 9px

**Analytics band** (full-width, bg: #1A1A1A, h: 200px)
- 4 equal columns with 1px #333333 separators
- Each: giant number (Playfair 72px) + label (Geist Mono 9px 3px-tracking)
- Values: `2.65` · `127` · `96%` (red) · `0.41`

---

### MATCH DETAIL (`/match/[id]`)

**Hero** — two team names stacked, both bleed past edges
```
[NAV]
MATCHES / QUARTER-FINAL / MATCH 61  ← Geist Mono 9px breadcrumb
──────────────────────────────────── 1px #E8E8E8

ARGENTINA    ← Playfair Display 200px Bold, x=-8px (bleeds left)
VS           ← Geist Mono 11px 4px-tracking #666666
FRANCE       ← Playfair Display 200px Bold, x=-16px (bleeds left)
```
Red accent: 120px × 4px red rectangle under the VS line

**Meta bar** (full-width, bg: #1A1A1A, h: 52px)
- 5 columns with 1px #666666 right borders: VENUE · DATE · KICK-OFF · ROUND · ATTENDANCE
- Labels: Geist Mono 8px 2px-tracking #666666 / Values: Geist Mono 13px white

**Score display** (centered)
- `LIVE` + red dot + minute — Geist Mono 9px red
- Score: Italic Playfair Display 120px Bold — `2 — 1` (em dash separator at 80px #666666)

**Match Statistics table**
- Section "ARG" (Geist Mono bold 11px #1A1A1A) and "FRA" (gray) flanking
- Each row: left value (Playfair 26px bold #1A1A1A) + centered label (Geist Mono 10px 2px-tracking #666666) + right value (Playfair 26px bold #666666)
- 8 stats: xG · Possession · Total Shots · Shots on Target · Corners · Pass Accuracy · Tackles · Yellow Cards

**Key Events timeline**
- `23' ARG  GOAL — MESSI (pen.)` format
- Minute: Geist Mono 11px #666666
- Team: Geist Mono 11px 2px-tracking, red for home team
- Event: Playfair Display 15px

**Tactical Read** (split)
- Left pull quote: Playfair Display 72px Bold (e.g., `MESSI DICTATES / THE TEMPO.`)
- Right body: Geist Mono 13px #666666 lineHeight 1.9

**xG Timeline** (mirrored bar chart)
- Horizontal axis = 90 minutes (left to right)
- ARG shots: red bars growing **upward** from center axis
- FRA shots: gray (#888888) bars growing **downward** from center axis
- Bar width ∝ xG magnitude, height ∝ xG value (max ~60px for xG=0.78)
- HT marker: 1px vertical line at 45' mark
- xG totals flanking: `2.34` red left, `1.12` gray right (Playfair 40px)

**Win Probability — dramatic full-bleed bands** (h: 180px total)
- Left portion (70% width = ~1008px): bg #1A1A1A, `70%` Playfair 120px Bold Italic white
- Right portion (30% width = ~432px): bg #C8102E, `30%` Playfair 120px Bold Italic white
- Sub-labels: Geist Mono 9px 3px-tracking

**Shot Quality Index** (3-column trio)
- Each: `0.26 vs 0.19` — red value (Playfair 48px) + `vs` (Geist Mono 10px) + gray value (Playfair 48px)
- Label below: Geist Mono 9px 2px-tracking #666666

**The Verdict** (bottom strip)
- `MODEL PREDICTS:` Geist Mono 9px #666666 + `ARGENTINA TO WIN IN EXTRA TIME · 70% CONFIDENCE` Playfair Display 20px red

---

## 6. Key CSS Patterns for Implementation

```css
/* Editorial bleeding headline */
.headline-bleed {
  font-family: 'Playfair Display', serif;
  font-weight: 700;
  font-style: italic;
  font-size: clamp(120px, 16vw, 240px);
  letter-spacing: -0.04em;
  line-height: 0.84;
  white-space: nowrap;
  overflow: visible;
  margin-left: -0.5%;  /* bleeds past container */
}

/* Section divider (major) */
.section-rule { border-top: 2px solid #1A1A1A; }

/* Section divider (minor) */
.section-rule-light { border-top: 1px solid #E8E8E8; }

/* Label style */
.editorial-label {
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  letter-spacing: 3px;
  color: #666666;
  text-transform: uppercase;
}

/* Stat number large */
.stat-large {
  font-family: 'Playfair Display', serif;
  font-weight: 700;
  font-style: italic;
  letter-spacing: -0.03em;
}

/* Form dot */
.form-dot {
  width: 14px; height: 14px;
  border-radius: 50%;
}
.form-dot.win  { background: #1A1A1A; }
.form-dot.draw { background: #666666; }
.form-dot.loss { background: transparent; border: 1.5px solid #666666; }

/* Win probability band */
.prob-band {
  height: 180px;
  display: flex;
  align-items: flex-start;
  padding: 18px 48px;
}
.prob-band__number {
  font-family: 'Playfair Display', serif;
  font-size: 120px;
  font-weight: 700;
  font-style: italic;
  line-height: 0.85;
  letter-spacing: -4px;
  color: white;
}
```

---

## 7. Component Mapping (existing → new)

| Existing component | Design update |
|---|---|
| `SiteNav` | Replace bg/border, use Playfair "WC" monogram, Geist Mono nav links |
| `FeaturedMatch` | Full black bg, team names in large italic Playfair, score centered large |
| `MatchRow` | Alternating rows, team names in Playfair 20px, xG in Geist Mono |
| `StandingsTable` | Group letter italic Playfair 80px, Geist Mono data columns, red qualification dots |
| `TournamentPulse` | Stat trio (3 large italic numbers) + qualification probability bars |
| `TickerBar` | Red bg, Geist Mono white text |
| `StatComparison` | Center-label layout: value (Playfair left) · label (Geist Mono center) · value (Playfair right) |
| `TacticalAnalysis` | Pull quote (Playfair 72px bold) + body (Geist Mono 13px 1.9 lineHeight) |

---

## 8. Do Not

- Do NOT use rounded corners (`border-radius: 0` everywhere)
- Do NOT use orange (#FF8400, the existing primary color)
- Do NOT use any font other than Playfair Display + Geist Mono
- Do NOT add card shadows or elevation
- Do NOT use gradients
- Do NOT use more than one accent color (red #C8102E only)
- Do NOT center-align body text (left-align except centered stat labels in comparison rows)
