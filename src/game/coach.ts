// ── Coach Marks (first-session tutorial) ─────────────────────────────────────
// Two-step guided hint for brand-new players: point at the BUILD tab, then at
// the STATION upgrade button. Each step has a "GOT IT" dismiss, matching the
// Reddit-style onboarding hint shown at the start of a session.

export type CoachStep = 'open_build' | 'upgrade_station' | 'pick_skin' | 'undock' | 'navigate_dock' | 'scan' | 'help' | 'congrats' | 'done';

const STEP_ORDER: CoachStep[] = ['open_build', 'upgrade_station', 'pick_skin', 'undock', 'navigate_dock', 'scan', 'help', 'congrats', 'done'];

const COACH_DONE_KEY = 'spacehunt_coach_done';

/** Steps shown to the player as "n/7"; congrats is the unnumbered finale. */
const NUMBERED_STEPS = 7;

let _step: CoachStep = 'done';
let _active = false;
let _acked = false;   // GOT IT pressed on the current step — callout collapses to a nudge
let _skipped = false; // dismissed before finishing — resumable, but won't auto-start

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
  _skipped = false;
  console.log('[COACH] started', force ? '(forced)' : '');
}

export function isCoachActive(): boolean {
  return _active && _step !== 'done';
}

export function isCoachSkipped(): boolean {
  return _skipped;
}

/** Whether there is a partially-completed run to pick up. */
export function canResumeCoach(): boolean {
  return _step !== 'done' && !_active;
}

/** Human-facing step counter, e.g. "4/7". Empty for the finale. */
export function getCoachStepLabel(step: CoachStep = _step): string {
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0 || idx >= NUMBERED_STEPS) return '';
  return `${idx + 1}/${NUMBERED_STEPS}`;
}

/** Pick up where the player left off, or restart if there is nothing to resume. */
export function resumeCoach(): void {
  if (_step === 'done') {
    startCoach(true);
    return;
  }
  _active = true;
  _acked = false;
  _skipped = false;
  console.log('[COACH] resumed at', _step);
}

/** Restore persisted progress. Only auto-activates a run that was never skipped. */
export function restoreCoach(step: string, skipped = false): void {
  if (STEP_ORDER.indexOf(step as CoachStep) < 0) return;
  _step = step as CoachStep;
  _skipped = skipped;
  if (_step !== 'done' && !skipped) {
    _active = true;
    _acked = false;
    console.log('[COACH] restored at step', step);
  }
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
  if (to === 'done') completeCoach();
}

/** GOT IT on the current step: keep guiding, but collapse to a compact nudge. */
export function ackCoachStep(): void {
  _acked = true;
}

export function isCoachAcked(): boolean {
  return _acked;
}

/** Dismissed early (SKIP). Keeps the step so the player can continue later. */
export function dismissCoach(): void {
  _active = false;
  _acked = false;
  _skipped = true;
  console.log('[COACH] skipped at', _step);
}

/** Finished the whole sequence. */
export function completeCoach(): void {
  _step = 'done';
  _active = false;
  _acked = false;
  _skipped = false;
  try { localStorage.setItem(COACH_DONE_KEY, '1'); } catch { /* ignore */ }
  console.log('[COACH] complete');
}

/** 0..1 pulse used for the highlight ring. */
export function getCoachPulse(): number {
  return 0.5 + 0.5 * Math.sin(performance.now() / 350);
}

// ── Ships Topic (post-onboarding guide) ──────────────────────────────────────
// Reached from Help → More Tutorials → BUILD A SHIP. Separate from the linear
// onboarding sequence above so it can be launched any time onboarding is done.

export type ShipsTopicStep = 'info' | 'open_ships' | 'pick_probe' | 'done';

let _shipsTopicActive = false;
let _shipsTopicStep: ShipsTopicStep = 'done';

export function startShipsTopic(): void {
  _shipsTopicActive = true;
  _shipsTopicStep = 'info';
  console.log('[SHIPS-TOPIC] started');
}

export function isShipsTopicActive(): boolean {
  return _shipsTopicActive && _shipsTopicStep !== 'done';
}

export function getShipsTopicStep(): ShipsTopicStep {
  return _shipsTopicStep;
}

/** NEXT on the info card that explains the Dock requirement. */
export function shipsTopicNext(): void {
  if (_shipsTopicActive && _shipsTopicStep === 'info') _shipsTopicStep = 'open_ships';
}

/** Player actually opened the SHIPS tab. */
export function shipsTopicShipsOpened(): void {
  if (_shipsTopicActive && _shipsTopicStep === 'open_ships') _shipsTopicStep = 'pick_probe';
}

/** Player actually clicked the Basic Probe build button (regardless of whether it fired). */
export function shipsTopicProbeClicked(): void {
  if (_shipsTopicActive && _shipsTopicStep === 'pick_probe') {
    _shipsTopicStep = 'done';
    _shipsTopicActive = false;
    console.log('[SHIPS-TOPIC] complete');
  }
}

export function dismissShipsTopic(): void {
  _shipsTopicActive = false;
  _shipsTopicStep = 'done';
}

// ── Colonization Topic ──────────────────────────────────────────────────────
// Separate from onboarding and the Ships topic so expansion can be resumed
// across a long ship build/transit without changing the first-session flow.

export type ColonizationTopicStep = 'info' | 'open_ships' | 'build_probe' | 'colony_building' | 'build_colony' | 'open_fleet' | 'send_colony' | 'arrival' | 'visit' | 'locate_planet' | 'orbit' | 'done';

let _colonizationTopicActive = false;
let _colonizationTopicStep: ColonizationTopicStep = 'done';
let _colonizationTargetStar = -1;
let _colonizationHasDirectPath = false;

export function startColonizationTopic(hasDirectPath = false, initialStep: ColonizationTopicStep = 'info'): void {
  _colonizationTopicActive = true;
  _colonizationTopicStep = initialStep;
  _colonizationTargetStar = -1;
  _colonizationHasDirectPath = hasDirectPath;
  console.log('[COLONIZATION-TOPIC] started');
}

export function isColonizationTopicActive(): boolean {
  return _colonizationTopicActive && _colonizationTopicStep !== 'done';
}

export function getColonizationTopicStep(): ColonizationTopicStep {
  return _colonizationTopicStep;
}

export function getColonizationTopicTarget(): number {
  return _colonizationTargetStar;
}

export function colonizationTopicNext(): void {
  if (!_colonizationTopicActive) return;
  const next: Partial<Record<ColonizationTopicStep, ColonizationTopicStep>> = {
    info: _colonizationHasDirectPath ? 'build_colony' : 'open_ships',
    send_colony: 'arrival',
    arrival: 'visit',
    visit: 'locate_planet',
    locate_planet: 'open_fleet',
  };
  const following = next[_colonizationTopicStep];
  if (following) _colonizationTopicStep = following;
}

/** Advance only when the player performs the requested action. */
export function colonizationTopicAction(action: 'ships_opened' | 'probe_built' | 'colony_built' | 'fleet_opened' | 'colony_sent' | 'arrived' | 'visited' | 'planet_found' | 'orbit_reached' | 'colonized', targetStar = -1): void {
  if (!_colonizationTopicActive) return;
  const next: Partial<Record<ColonizationTopicStep, ColonizationTopicStep>> = {
    open_ships: 'build_probe',
    build_probe: 'build_colony',
    colony_building: 'open_fleet',
    build_colony: 'open_fleet',
    open_fleet: 'send_colony',
    send_colony: 'arrival',
    arrival: 'visit',
    visit: 'locate_planet',
    locate_planet: 'orbit',
    orbit: 'orbit',
  };
  const expected: Record<ColonizationTopicStep, string> = {
    info: '', open_ships: 'ships_opened', build_probe: 'probe_built', colony_building: 'colony_built', build_colony: 'colony_built', open_fleet: 'fleet_opened',
    send_colony: 'colony_sent', arrival: 'arrived', visit: 'visited', locate_planet: 'planet_found',
    orbit: 'colonized', done: 'colonized',
  };
  if (expected[_colonizationTopicStep] !== action) return;
  if (action === 'colony_sent' && targetStar >= 0) _colonizationTargetStar = targetStar;
  _colonizationTopicStep = next[_colonizationTopicStep] ?? 'done';
  if (_colonizationTopicStep === 'done') {
    _colonizationTopicActive = false;
    console.log('[COLONIZATION-TOPIC] complete');
  }
}

export function dismissColonizationTopic(): void {
  _colonizationTopicActive = false;
  _colonizationTopicStep = 'done';
  _colonizationTargetStar = -1;
}

// ── Comms Topic (post-onboarding guide) ──────────────────────────────────────
// Reached from Help → More Tutorials → COMMS. Walks all four COMS tabs. PUBLIC
// is explained immediately since it's the default open tab; the remaining
// three require the player to actually tap the tab being pointed at.

export type ComsTopicPhase = 'explain' | 'point' | 'done';

let _comsTopicActive = false;
let _comsTopicIdx = 0; // 0=public, 1=private, 2=alliance, 3=board
let _comsTopicPhase: ComsTopicPhase = 'done';

export function startComsTopic(): void {
  _comsTopicActive = true;
  _comsTopicIdx = 0;
  _comsTopicPhase = 'explain';
  console.log('[COMS-TOPIC] started');
}

export function isComsTopicActive(): boolean {
  return _comsTopicActive && _comsTopicPhase !== 'done';
}

export function getComsTopicIdx(): number {
  return _comsTopicIdx;
}

export function getComsTopicPhase(): ComsTopicPhase {
  return _comsTopicPhase;
}

/** NEXT on the current tab's explanation card. */
export function comsTopicNext(): void {
  if (!_comsTopicActive || _comsTopicPhase !== 'explain') return;
  if (_comsTopicIdx >= 3) {
    _comsTopicPhase = 'done';
    _comsTopicActive = false;
    console.log('[COMS-TOPIC] complete');
    return;
  }
  _comsTopicIdx += 1;
  _comsTopicPhase = 'point';
}

/** Player actually tapped the tab index currently being pointed at. */
export function comsTopicTabClicked(idx: number): void {
  if (!_comsTopicActive || _comsTopicPhase !== 'point' || idx !== _comsTopicIdx) return;
  _comsTopicPhase = 'explain';
}

/** EXPLORE ALLIANCE branch on the alliance explain card — ends the walkthrough so the
 * player can interact with the alliance tab directly (create/join isn't scripted here). */
export function comsTopicBranchToAlliance(): void {
  if (!_comsTopicActive) return;
  _comsTopicActive = false;
  _comsTopicPhase = 'done';
  console.log('[COMS-TOPIC] branched to alliance management');
}

export function dismissComsTopic(): void {
  _comsTopicActive = false;
  _comsTopicPhase = 'done';
}
