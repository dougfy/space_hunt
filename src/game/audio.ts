// ── Audio Manager ────────────────────────────────────────────────────────────
// Handles sound effects for game events. WAV files served from /sounds/.
// Button click is synthesized via Web Audio API (no file needed).

import versionJson from '../../version.json';

type SoundId = 'docked' | 'low_fuel' | 'fuel_critical' | 'colonize' | 'click' | 'send' | 'arrive' | 'status_docked' | 'begin_building' | 'begin_building_facility' | 'begin_building_ship' | 'undocking' | 'insufficient_resources' | 'dock_low' | 'hey_there' | 'ship_entered' | 'leaving_orbit' | 'construction_complete' | 'construction_complete_building' | 'begin_ship_upgrade' | 'scout_range_exceeded';

// Cache-bust sound URLs with version so updated wavs are fetched fresh
const V = versionJson.version;
const SOUND_FILES: Partial<Record<SoundId, string>> = {
  docked: `/sounds/Ship%20docked.wav?v=${V}`,
  low_fuel: `/sounds/Fuel%20low.wav?v=${V}`,
  fuel_critical: `/sounds/Warning%20fuel%20critical.wav?v=${V}`,
  colonize: `/sounds/Colonize%20complete.wav?v=${V}`,
  arrive: `/sounds/Probe%20arrived.wav?v=${V}`,
  status_docked: `/sounds/Status%20docked%20begin.wav?v=${V}`,
  begin_building: `/sounds/Begin%20building.wav?v=${V}`,
  begin_building_facility: `/sounds/Begin%20building%20facility.wav?v=${V}`,
  begin_building_ship: `/sounds/Begin%20building%20ship.wav?v=${V}`,
  undocking: `/sounds/Undocking%20Safe%20travels.wav?v=${V}`,
  insufficient_resources: `/sounds/Insufficient%20Resources%20Build.wav?v=${V}`,
  dock_low: `/sounds/Dock%20Level%202%20Low.wav?v=${V}`,
  hey_there: `/sounds/Hey%20there%20sailor.wav?v=${V}`,
  ship_entered: `/sounds/Ship%20has%20entered.wav?v=${V}`,
  leaving_orbit: `/sounds/Leaving%20orbit.wav?v=${V}`,
  construction_complete: `/sounds/Construction%20complete%20ship.wav?v=${V}`,
  construction_complete_building: `/sounds/Construction%20complete%20building.wav?v=${V}`,
  begin_ship_upgrade: `/sounds/Begin%20ship%20upgrade.wav?v=${V}`,
  scout_range_exceeded: `/sounds/Scout%20range%20exceeded.wav?v=${V}`,
};

let _audioCtx: AudioContext | null = null;
let _muted = false;
let _volume = 0.5;
const _bufferCache = new Map<string, AudioBuffer>();
const _loadingSet = new Set<string>();

function getAudioContext(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (_audioCtx.state === 'suspended') {
    void _audioCtx.resume();
  }
  return _audioCtx;
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (_bufferCache.has(url)) return _bufferCache.get(url)!;
  if (_loadingSet.has(url)) return null; // already loading
  _loadingSet.add(url);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    const ctx = getAudioContext();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    _bufferCache.set(url, audioBuf);
    return audioBuf;
  } catch {
    return null;
  } finally {
    _loadingSet.delete(url);
  }
}

function playSynthClick(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);
  gain.gain.setValueAtTime(_volume * 0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.06);
}

/** Play a sound effect by id. Non-blocking — fires and forgets. */
export function playSound(id: SoundId): void {
  console.log('[AUDIO] playSound called:', id, 'muted=', _muted);
  if (_muted) return;

  if (id === 'click') {
    playSynthClick();
    return;
  }

  const url = SOUND_FILES[id];
  if (!url) return;

  const cached = _bufferCache.get(url);
  if (cached) {
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = _volume;
    source.buffer = cached;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } else {
    // Load then play
    void loadBuffer(url).then((buf) => {
      if (!buf) return;
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = _volume;
      source.buffer = buf;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    });
  }
}

/** Preload sound files so first play is instant. */
export function preloadSounds(): void {
  for (const url of Object.values(SOUND_FILES)) {
    if (url) void loadBuffer(url);
  }
}

/** Toggle mute state. */
export function toggleMute(): boolean {
  _muted = !_muted;
  return _muted;
}

/** Check if muted. */
export function isMuted(): boolean {
  return _muted;
}

/** Set volume (0–1). */
export function setVolume(v: number): void {
  _volume = Math.max(0, Math.min(1, v));
}
