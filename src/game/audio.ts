// ── Audio Manager ────────────────────────────────────────────────────────────
// Handles sound effects for game events. WAV files served from /sounds/.
// Button click is synthesized via Web Audio API (no file needed).

import versionJson from '../../version.json';

type SoundId = 'docked' | 'low_fuel' | 'fuel_critical' | 'colonize' | 'click' | 'send' | 'arrive' | 'status_docked' | 'ship_is_docked' | 'begin_building' | 'begin_building_facility' | 'begin_building_ship' | 'undocking' | 'undocking_alt' | 'insufficient_resources' | 'dock_low' | 'hey_there' | 'ship_entered' | 'leaving_orbit' | 'construction_complete' | 'construction_complete_building' | 'begin_ship_upgrade' | 'scout_range_exceeded' | 'freighter_arrived' | 'freighter_unloading' | 'shields_activated' | 'shields_up' | 'shields_deactivated' | 'shields_down' | 'hostile_raider' | 'unidentified_ship' | 'new_comm' | 'fleet_command' | 'scan_nothing_planet' | 'scan_nothing_station' | 'scan_ore' | 'scan_food' | 'scan_energy' | 'scan_fuel' | 'scan_artifact' | 'scan_anomaly' | 'scan_blueprint' | 'begin_scan' | 'buff_hyperdrive' | 'buff_resonance' | 'buff_chrono' | 'buff_void_shield' | 'buff_scanner_amp' | 'raid_launched' | 'raid_incoming' | 'alliance_formed' | 'alliance_broken' | 'luminari_gate' | 'colony_established' | 'reverse_engineered' | 'max_level_reached' | 'upgrade_failed' | 'upgrade_in_progress' | 'purifier_warning' | 'purifier_capacity_reduced' | 'purifier_critical' | 'purifier_unit_recovered' | 'purifier_restored' | 'purifier_order_opened' | 'purifier_order_funded' | 'purifier_payment_accepted' | 'purifier_order_failed' | 'purifier_unit_received' | 'purifier_repair_unavailable' | 'purifier_no_incident';

// Cache-bust sound URLs with version so updated wavs are fetched fresh
const V = versionJson.version;
const SOUND_FILES: Partial<Record<SoundId, string>> = {
  docked: `/sounds/Ship%20docked.wav?v=${V}`,
  low_fuel: `/sounds/Fuel%20low.wav?v=${V}`,
  fuel_critical: `/sounds/Warning%20fuel%20critical.wav?v=${V}`,
  colonize: `/sounds/Colonize%20complete.wav?v=${V}`,
  arrive: `/sounds/Probe%20arrived.wav?v=${V}`,
  status_docked: `/sounds/Status%20docked%20begin.wav?v=${V}`,
  ship_is_docked: `/sounds/Ship%20is%20docked.wav?v=${V}`,
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
  freighter_arrived: `/sounds/Freighter%20arrived%20at.wav?v=${V}`,
  freighter_unloading: `/sounds/Freighter%20unloading%20cargo.wav?v=${V}`,
  shields_activated: `/sounds/Shields%20are%20activated.wav?v=${V}`,
  shields_up: `/sounds/Shields%20are%20up.wav?v=${V}`,
  shields_deactivated: `/sounds/Shields%20are%20deactivated.wav?v=${V}`,
  shields_down: `/sounds/Shields%20are%20down.wav?v=${V}`,
  hostile_raider: `/sounds/Warning%20hostile%20raider%20(1).wav?v=${V}`,
  unidentified_ship: `/sounds/Warning%20unidentified%20ship.wav?v=${V}`,
  new_comm: `/sounds/New%20comm%20message.wav?v=${V}`,
  fleet_command: `/sounds/Fleet%20command%20message.wav?v=${V}`,
  undocking_alt: `/sounds/Undocking.wav?v=${V}`,
  scan_nothing_planet: `/sounds/Barren%20surface%20nothing.wav?v=${V}`,
  scan_nothing_station: `/sounds/Normal%20starbase%20No.wav?v=${V}`,
  scan_ore: `/sounds/Ore%20deposit%20discovered.wav?v=${V}`,
  scan_food: `/sounds/Organic%20matter%20discovered.wav?v=${V}`,
  scan_energy: `/sounds/Energy%20source%20discovered.wav?v=${V}`,
  scan_fuel: `/sounds/Fuel%20source%20discovered.wav?v=${V}`,
  scan_artifact: `/sounds/Luminari%20artifact%20recovered.wav?v=${V}`,
  scan_anomaly: `/sounds/Anomalous%20signal%20detected%20(2).wav?v=${V}`,
  scan_blueprint: `/sounds/Ship%20blueprint%20found.wav?v=${V}`,
  begin_scan: `/sounds/Begin%20scan.wav?v=${V}`,
  buff_hyperdrive: `/sounds/Hyperdrive%20surge%20activated.wav?v=${V}`,
  buff_resonance: `/sounds/Resonance%20mining%20engaged.wav?v=${V}`,
  buff_chrono: `/sounds/Chrono%20catalyst%20online.wav?v=${V}`,
  buff_void_shield: `/sounds/Void%20shield%20deployed.wav?v=${V}`,
  buff_scanner_amp: `/sounds/Scanner%20amplification%20active.wav?v=${V}`,
  raid_launched: `/sounds/Raid%20fleet%20deployed.wav?v=${V}`,
  raid_incoming: `/sounds/Alert%20incoming%20raid.wav?v=${V}`,
  alliance_formed: `/sounds/Alliance%20established%20Strength.wav?v=${V}`,
  alliance_broken: `/sounds/Alliance%20dissolved%20Trust.wav?v=${V}`,
  luminari_gate: `/sounds/Luminari%20star%20gate.wav?v=${V}`,
  colony_established: `/sounds/Colony%20established%20The.wav?v=${V}`,
  reverse_engineered: `/sounds/Valcordian%20tech%20integrated.wav?v=${V}`,
  max_level_reached: `/sounds/Maximum%20level%20reached.wav?v=${V}`,
  upgrade_failed: `/sounds/Upgrade%20Failed.wav?v=${V}`,
  upgrade_in_progress: `/sounds/Upgrade%20in%20progress.wav?v=${V}`,
  purifier_warning: `/sounds/Warning%20Air%20purification.wav?v=${V}`,
  purifier_capacity_reduced: `/sounds/Starbase%20capacity%20reduced.wav?v=${V}`,
  purifier_critical: `/sounds/Critical%20failure%20Starbase.wav?v=${V}`,
  purifier_unit_recovered: `/sounds/Replacement%20unit%20recovered.wav?v=${V}`,
  purifier_restored: `/sounds/Air%20purification%20restored.wav?v=${V}`,
  purifier_order_opened: `/sounds/Purifier%20replacement%20order.wav?v=${V}`,
  purifier_order_funded: `/sounds/Purifier%20order%20funded.wav?v=${V}`,
  purifier_payment_accepted: `/sounds/Purifier%20payment%20accepted.wav?v=${V}`,
  purifier_order_failed: `/sounds/Purifier%20order%20cannot.wav?v=${V}`,
  purifier_unit_received: `/sounds/Purifier%20replacement%20unit.wav?v=${V}`,
  purifier_repair_unavailable: `/sounds/Purifier%20repair%20unavailable.wav?v=${V}`,
  purifier_no_incident: `/sounds/No%20active%20purifier.wav?v=${V}`,
};

let _audioCtx: AudioContext | null = null;
let _muted = false;
let _volume = 0.5;
const _bufferCache = new Map<string, AudioBuffer>();
const _loadingSet = new Set<string>();

// Sound history for test automation (ring buffer of last 20)
const _soundHistory: Array<{ id: string; time: number }> = [];
export function getSoundHistory(): Array<{ id: string; time: number }> {
  return [..._soundHistory];
}

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
  // Track for test automation (ring buffer of last 20 sounds)
  _soundHistory.push({ id, time: Date.now() });
  if (_soundHistory.length > 20) _soundHistory.shift();

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

/** Sounds likely to fire in the first moments of play — warmed during splash. */
export const CRITICAL_SOUND_IDS: SoundId[] = [
  'docked',
  'undocking',
  'low_fuel',
  'arrive',
  'begin_scan',
  'colonize',
];

/**
 * Warm only the handful of sounds needed for immediate interaction. Runs during
 * splash so it stays off the critical path that gates the loading screen (the
 * profile fetch). The full library is loaded later via preloadSounds().
 */
export function warmCriticalSounds(): void {
  for (const id of CRITICAL_SOUND_IDS) {
    const url = SOUND_FILES[id];
    if (url) void loadBuffer(url);
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
