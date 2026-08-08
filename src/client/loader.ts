// ── Deferred Game Loader ────────────────────────────────────────────────────
// Runs instantly: sets inline mode flag, starts splash animation, then waits
// for the user to click play before loading the full game bundle.

// Set inline mode flag (replaces the old inline <script>)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__INLINE_MODE__ = true;

// Start the lightweight splash animation immediately (bundled into this chunk)
import './splash';

// Show idle timeout message if returning from idle
if (location.hash === '#idle') {
  const idleMsg = document.getElementById('idle-msg');
  if (idleMsg) idleMsg.style.display = 'block';
  history.replaceState(null, '', location.pathname + location.search);
}

const playHere = document.getElementById('play-here');
const playFull = document.getElementById('play-full');
let gameLoaded = false;

function loadGame(mode: 'inline' | 'full', event: Event) {
  if (gameLoaded) return;
  gameLoaded = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__DEFERRED_PLAY__ = mode;
  // Save the original trusted event so game.ts can use it for requestExpandedMode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__DEFERRED_EVENT__ = event;
  if (playHere) playHere.textContent = '\u23F3 Loading...';
  if (playFull) playFull.textContent = '\u23F3 Loading...';
  void import('./game');
}

playHere?.addEventListener('click', (e) => loadGame('inline', e));
playFull?.addEventListener('click', (e) => loadGame('full', e));
