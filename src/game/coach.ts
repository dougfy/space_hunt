// ── Coach Marks (first-session tutorial) ─────────────────────────────────────
// Two-step guided hint for brand-new players: point at the BUILD tab, then at
// the STATION upgrade button. Each step has a "GOT IT" dismiss, matching the
// Reddit-style onboarding hint shown at the start of a session.

export type CoachStep = 'open_build' | 'upgrade_station' | 'pick_skin' | 'undock' | 'navigate_dock' | 'scan' | 'help' | 'congrats' | 'done';

const STEP_ORDER: CoachStep[] = ['open_build', 'upgrade_station', 'pick_skin', 'undock', 'navigate_dock', 'scan', 'help', 'congrats', 'done'];

const COACH_DONE_KEY = 'spacehunt_coach_done';

let _step: CoachStep = 'done';
let _active = false;
let _acked = false; // GOT IT pressed on the current step — callout collapses to a nudge

/** Start the coach marks. `force` ignores the local "already seen" flag (admin review). */
export function startCoach(force = false): void {
  if (!force) {
    try {
      if (localStorage.getItem(COACH_DONE_KEY) === '1') return;
    } catch { /* ignore */ }
  }
  _step = 'open_build';
  _active = true;
  _acked = false;
  console.log('[COACH] started', force ? '(forced)' : '');
}

export function isCoachActive(): boolean {
  return _active && _step !== 'done';
}

/** Resume a partially-completed sequence from the server profile. */
export function restoreCoach(step: string): void {
  const idx = STEP_ORDER.indexOf(step as CoachStep);
  if (idx < 0 || step === 'done') return;
  _step = step as CoachStep;
  _active = true;
  _acked = false;
  console.log('[COACH] restored at step', step);
}

export function getCoachStep(): CoachStep {
  return _step;
}

/** Advance to a later step. Ignored if the coach is inactive or already past it. */
export function coachAdvance(to: CoachStep): void {
  if (!_active || _step === 'done') return;
  if (STEP_ORDER.indexOf(to) <= STEP_ORDER.indexOf(_step)) return;
  _step = to;
  _acked = false;
  console.log('[COACH] step →', to);
  if (to === 'done') dismissCoach();
}

/** GOT IT on the current step: keep guiding, but collapse to a compact nudge. */
export function ackCoachStep(): void {
  _acked = true;
}

export function isCoachAcked(): boolean {
  return _acked;
}

/** Dismiss the whole coach sequence (SKIP, or completion). */
export function dismissCoach(): void {
  _step = 'done';
  _active = false;
  _acked = false;
  try { localStorage.setItem(COACH_DONE_KEY, '1'); } catch { /* ignore */ }
}

/** 0..1 pulse used for the highlight ring. */
export function getCoachPulse(): number {
  return 0.5 + 0.5 * Math.sin(performance.now() / 350);
}
