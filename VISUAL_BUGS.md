# Visual Bug List

Bugs detected by automated E2E visual verification (GPT-4o vision).

---

## BUG-001: Player name overlaps ship designation (Mobile/Fullscreen)

**Detected:** 2026-08-15  
**Test:** `all-modes-overlap.spec.ts` → `mobile-overlap-check`, `fullscreen-overlap-check`  
**Modes affected:** Mobile, Fullscreen  
**Status:** Open  

**Description:**  
"Red Raider (S1)" ship designation label overlaps with the "Red Raider" player/ghost name label near the ship sprite. Both labels are rendered at approximately the same position, making them difficult to read.

**Screenshots:**  
- `test-screenshots/all-modes-overlap/mobile-overlap-check-*.png`
- `test-screenshots/all-modes-overlap/fullscreen-overlap-check-*.png`
- `test-screenshots/expanded-mode/no-overlapping-ui-1786796361261.png`

**AI Assessment:**  
> "The label 'Red Raider (S1)' overlaps with the 'Red Raider' ship label, causing text to collide."

**Root Cause:**  
The ship name label (white, drawn by ship renderer) and the player ghost name (green, drawn by ghost system) are both positioned relative to the ship's screen coordinates without offset to avoid collision.

**Suggested Fix:**  
In `renderer.ts`, when rendering the player's own ship:
- Suppress the ghost name label (ship designation already identifies the player)
- OR offset the ghost name below the ship designation by ~14px

---

## BUG-002: Subreddit description text overlaps game (Desktop)

**Detected:** 2026-08-15  
**Test:** `all-modes-overlap.spec.ts` → `desktop-overlap-check`  
**Mode affected:** Desktop  
**Status:** Open  

**Description:**  
In Desktop mode, the text "Test subreddit for valcordia-space" (from the Reddit subreddit description/sidebar) overlaps with in-game text elements, making them difficult to read.

**Screenshot:**  
- `test-screenshots/all-modes-overlap/desktop-overlap-check-*.png`

**AI Assessment:**  
> "The text 'Test subreddit for valcordia-space' overlaps with in-game text elements, making them difficult to read."

**Root Cause:**  
In Devvit's Desktop preview mode, the subreddit description or header text from Reddit's page layout bleeds over/into the game iframe area. This may be a Devvit platform rendering issue rather than a game bug, or the game canvas isn't properly clipping to its container.

**Suggested Fix:**  
- Investigate if this is a Devvit preview-mode artifact vs. real user experience
- If real: ensure game canvas has `overflow: hidden` and proper z-index
- May be platform-level issue (Reddit's CSS overlapping the Devvit iframe)

---

## Summary

| Mode | Status | Issues |
|------|--------|--------|
| Inline | ✓ Clean | No overlaps detected |
| Mobile | ✗ Bug | BUG-001: Ship name collision |
| Desktop | ✗ Bug | BUG-001, BUG-002, BUG-003 |
| Fullscreen | ✗ Bug | BUG-001, BUG-003 |

---

## BUG-003: Return report badge overlaps info panel text

**Detected:** 2026-08-15  
**Test:** `006-scan-raster.spec.ts` → `after-scan-station`  
**Modes affected:** Desktop, Fullscreen  
**Status:** Open  

**Description:**  
The orange pulsing `!` return report badge (positioned at y=84) overlaps the "RESOURCES:" and "RICHNESS:" lines in the top-left info panel, making them partially unreadable.

**Screenshot:**  
- `test-screenshots/006-scan-raster/after-scan-station-1786799271970.png`

**Root Cause:**  
The badge was moved from vertically-centered (y=screenH/2) to upper-left (y=84) to be "just under the upper left area." But y=84 sits directly on top of the info panel text lines that extend below the star name/type info.

**Suggested Fix:**  
Move the badge further down (y=120+) or to the right of the info panel text. Alternatively, make it position-aware — check the info panel height and place below it.

---

## BUG-004: Station type label overlaps station name

**Detected:** 2026-08-15  
**Test:** `006-scan-raster.spec.ts` → `after-scan-station`  
**Modes affected:** Desktop, Fullscreen  
**Status:** Open  

**Description:**  
The word "Station" (feature type label below the station icon) partially merges with the "Druen I Station" name label above it.

**Screenshot:**  
- `test-screenshots/006-scan-raster/after-scan-station-1786799271970.png`

**Suggested Fix:**  
Increase vertical spacing between the station name label and the feature type label, or suppress the type label when it's redundant with the name.

---

## Template for new bugs

```
## BUG-XXX: Title

**Detected:** YYYY-MM-DD  
**Test:** `test-file.spec.ts` → `check-name`  
**Mode:** Mobile / Desktop / Fullscreen / Inline  
**Status:** Open / Fixed (version)  

**Description:**  
What's wrong.

**Screenshot:**  
`test-screenshots/folder/filename.png`

**AI Assessment:**  
> Quote from GPT-4o

**Root Cause:**  
Why it happens.

**Suggested Fix:**  
How to fix.
```
