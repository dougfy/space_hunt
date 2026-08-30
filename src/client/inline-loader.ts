// CSP-safe inline entry: establish the mode before loading the game module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__INLINE_MODE__ = true;

import { initSplashLeaderboard } from './splash-leaderboard';

initSplashLeaderboard();

void import('./game');
