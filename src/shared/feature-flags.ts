// ── Feature Flags ─────────────────────────────────────────────────────────────
// Toggle features on/off without code removal.

/** Enable video coms from Fleet Command (tutorial/milestone videos in DM channel). */
export const ENABLE_VIDEO_COMS = true;

/**
 * Legacy journey hints (tab pulse, UNDOCK pulse, idle voice prompts).
 * Now scoped to players who have already seen the coach-mark tutorial and have
 * stalled without taking an action — they never run alongside the coach.
 */
export const ENABLE_JOURNEY_HINTS = true;

/** Fleet Command sender name for system video messages. */
export const FLEET_COMMAND_SENDER = 'Fleet Command';

/** Video catalog — maps video IDs to file paths and descriptions. */
export const VIDEO_CATALOG: Record<string, { path: string; title: string }> = {
  colonize: {
    path: 'videos/Colonize Star System.mp4',
    title: 'Colonizing a Star System',
  },
  exploration: {
    path: 'videos/ship ready for galaxy exploration.mp4',
    title: 'Galaxy Exploration',
  },
};
