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
| Desktop | ✗ Bug | BUG-002: Subreddit text bleeds into game |
| Fullscreen | ✗ Bug | BUG-001: Ship name collision |

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
