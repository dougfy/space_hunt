// ── Journey / Help System ────────────────────────────────────────────────────
// Tracks player's tutorial journey. Shows contextual hints via tab pulse + voice.

import { playSound } from './audio';

export type JourneyStep = 'first_action' | 'done';

let _currentStep: JourneyStep = 'first_action';
let _stepStartTime = 0;
let _pulseCount = 0;       // how many pulse cycles have fired
let _completed = false;     // journey step completed
let _stabilized = false;    // game has rendered enough frames to be "ready"
let _frameCount = 0;        // frames since init

// Pulse state for tabs
let _pulseActive = false;
let _pulseStartTime = 0;
const PULSE_DURATION = 1500; // ms per pulse cycle

const JOURNEY_DONE_KEY = 'spacehunt_journey_done';

/** Initialize journey tracking. Starts in paused state — call startJourney() after profile loads. */
export function initJourney(): void {
  // Default to done; startJourney() will activate if server says not done
  _currentStep = 'done';
  _completed = true;
  _pulseActive = false;
}

/** Activate the journey/tutorial (call only when server confirms journeyDone is false). */
export function startJourney(): void {
  _currentStep = 'first_action';
  _stepStartTime = 0;
  _pulseCount = 0;
  _completed = false;
  _pulseActive = false;
  _stabilized = false;
  _frameCount = 0;
}

/** Mark journey as already past first step (returning player). */
export function skipJourney(): void {
  _currentStep = 'done';
  _completed = true;
  _pulseActive = false;
  try { localStorage.setItem(JOURNEY_DONE_KEY, '1'); } catch { /* ignore */ }
}

/** Notify the journey system that the player did something (undock, open panel, etc.) */
export function journeyAction(): void {
  if (_completed || _currentStep === 'done') return;
  if (_currentStep === 'first_action') {
    _currentStep = 'done';
    _completed = true;
    _pulseActive = false;
    try { localStorage.setItem(JOURNEY_DONE_KEY, '1'); } catch { /* ignore */ }
  }
}

/** Update journey timers. Call each frame with current time. */
export function updateJourney(): void {
  if (_completed || _currentStep === 'done') return;

  // Wait for game to stabilize (60 frames) before starting the idle timer
  if (!_stabilized) {
    _frameCount++;
    if (_frameCount < 60) return;
    _stabilized = true;
    _stepStartTime = performance.now();
    return;
  }

  const elapsed = performance.now() - _stepStartTime;

  if (_currentStep === 'first_action') {
    // Step 1: Blink only at 5s
    if (_pulseCount === 0 && elapsed >= 5000) {
      _pulseActive = true;
      _pulseStartTime = performance.now();
      _pulseCount = 1;
    }
    // Step 2: Voice + blink at 10s (once only)
    else if (_pulseCount === 1 && elapsed >= 10000) {
      _pulseActive = true;
      _pulseStartTime = performance.now();
      _pulseCount = 2;
      playSound('hey_there');
    }
    // Step 3: Final blink at 15s
    else if (_pulseCount === 2 && elapsed >= 15000) {
      _pulseActive = true;
      _pulseStartTime = performance.now();
      _pulseCount = 3;
    }
  }

  // Auto-expire pulse after duration
  if (_pulseActive && performance.now() - _pulseStartTime > PULSE_DURATION) {
    _pulseActive = false;
  }
}

/** Get the current pulse alpha boost (0.0 = no pulse, 0.0–1.0 = pulse intensity). */
export function getJourneyPulseAlpha(): number {
  if (!_pulseActive) return 0;
  const t = (performance.now() - _pulseStartTime) / PULSE_DURATION;
  if (t >= 1) return 0;
  // Sine wave: rises and falls over the duration
  return Math.sin(t * Math.PI) * 0.8;
}

/** Whether the journey pulse is currently active (for tab rendering). */
export function isJourneyPulseActive(): boolean {
  return _pulseActive;
}

/** Get current journey step for external queries. */
export function getJourneyStep(): JourneyStep {
  return _currentStep;
}

/** Whether the journey has been completed (for server persistence). */
export function isJourneyDone(): boolean {
  return _completed || _currentStep === 'done';
}
