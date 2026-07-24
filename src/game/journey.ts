// ── Journey / Help System ────────────────────────────────────────────────────
// Tracks player's tutorial journey. Shows contextual hints via tab pulse + voice.

import { playSound } from './audio';

export type JourneyStep = 'first_action' | 'done';

let _currentStep: JourneyStep = 'first_action';
let _stepStartTime = 0;
let _pulseCount = 0;       // how many pulse cycles have fired
let _completed = false;     // journey step completed

// Pulse state for tabs
let _pulseActive = false;
let _pulseStartTime = 0;
const PULSE_DURATION = 1500; // ms per pulse cycle

/** Initialize journey tracking. Call once on game start. */
export function initJourney(): void {
  _currentStep = 'first_action';
  _stepStartTime = performance.now();
  _pulseCount = 0;
  _completed = false;
  _pulseActive = false;
}

/** Mark journey as already past first step (returning player). */
export function skipJourney(): void {
  _currentStep = 'done';
  _completed = true;
  _pulseActive = false;
}

/** Notify the journey system that the player did something (undock, open panel, etc.) */
export function journeyAction(): void {
  if (_completed || _currentStep === 'done') return;
  if (_currentStep === 'first_action') {
    _currentStep = 'done';
    _completed = true;
    _pulseActive = false;
  }
}

/** Update journey timers. Call each frame with current time. */
export function updateJourney(): void {
  if (_completed || _currentStep === 'done') return;

  const elapsed = performance.now() - _stepStartTime;

  if (_currentStep === 'first_action') {
    // First pulse at 5s, second pulse at 10s
    if (_pulseCount === 0 && elapsed >= 5000) {
      _pulseActive = true;
      _pulseStartTime = performance.now();
      _pulseCount = 1;
      playSound('status_docked'); // voice prompt for idle new user
    } else if (_pulseCount === 1 && elapsed >= 10000) {
      _pulseActive = true;
      _pulseStartTime = performance.now();
      _pulseCount = 2;
      playSound('status_docked');
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
