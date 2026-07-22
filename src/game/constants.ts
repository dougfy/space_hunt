// ── Game Constants ──────────────────────────────────────────────────────────
// Ported from DotsDemoRuntime.cs

export const CANVAS_W = 9.6;
export const CANVAS_H = 6.4;
export const SAFE_INSET = 0.25;

export const SHIP_MAX_SPEED = 0.9;
export const SHIP_ACCELERATION = 1.35;
export const SHIP_ARRIVE_RADIUS = 1.25;
export const SHIP_SIZE = 0.08;
export const SHIP_RADIUS = 0.16;

export const ASTEROID_COUNT = 60;
export const ASTEROID_MIN_RADIUS = 0.28;
export const ASTEROID_MAX_RADIUS = 0.7;
export const ASTEROID_GAP = 0.45;
export const SPAWN_CLEAR_RADIUS = 1.3;

export const MAP_HALF_X = 10;
export const MAP_HALF_Y = 8;

export const IMPACT_BUFFER_PIXELS = 15;
export const AVOID_LOOKAHEAD = 0.08;
export const AVOID_STRENGTH = 1.4;

export const BASE_ORTHO = CANVAS_H * 0.5;
export const CLOSE_ORTHO = BASE_ORTHO / 5;
export const ZOOM_TRIGGER_PIXELS = 100;
export const ZOOM_TRANSITION_DURATION = 0.35;
export const ZOOM_DWELL_SECONDS = 0.5;
export const ZOOM_GRACE_SECONDS = 0.4;

export const SHIP_LINE_WIDTH = 0.025;
export const ASTEROID_LINE_WIDTH = 0.018;
export const TARGET_LINE_WIDTH = 0.018;
export const TARGET_RING_RADIUS = 0.12;
export const POD_LINE_WIDTH = 0.016;

export const FUEL_MAX = 100;
export const FUEL_PER_WORLD_UNIT = 2;
export const FUEL_DRAIN_PER_SECOND = 0.8;

export const POD_COUNT_PER_ASTEROID = 1;
export const POD_CHANCE = 0.75;
export const RED_DOCK_FRACTION = 0.40;
export const POD_SURFACE_GAP = 0.13;
export const POD_SURFACE_OFFSET = 0.13;
export const POD_SIZE = 0.06;
export const POD_PICKUP_RADIUS = 0.22;
export const POD_COLLECT_RADIUS = 0.22;
export const NON_RED_DOCK_FUEL_BONUS = 10;
export const LOW_FUEL_THRESHOLD = 25;
export const LOW_FUEL_WARNING_THRESHOLD = 25;
export const LOW_FUEL_BLINK_PERIOD = 0.4;

export const SHIP_IMPACT_BUFFER = 0.12;

// Colors (CSS rgba strings)
export const BG_COLOR = '#000000';
export const SHIP_COLOR = '#10b981';
export const SHIP_THRUST_COLOR = '#fb923c';
export const LOW_FUEL_BASE_COLOR = '#ffb833';
export const LOW_FUEL_WARNING_COLOR = '#ff3833';
export const TARGET_COLOR = '#3b82f5';
export const ASTEROID_COLOR = 'rgba(180, 200, 230, 0.85)';
export const ASTEROID_DISCOVERED_COLOR = 'rgba(87, 235, 140, 0.95)';
export const REFUEL_DOCK_COLOR = '#ff4747';

export const GHOST_PALETTE = [
  '#7AF0C6', // slot 1
  '#6EC1FF', // slot 2
  '#FFD166', // slot 3
  '#FF7AAE', // slot 4
];

export const POD_PALETTE = [
  '#ffd147', // amber
  '#66ffda', // cyan
  '#ff738c', // pink
  '#99d6ff', // sky blue
  '#b3ff73', // lime
  '#d99eff', // violet
];

// ── Shooting ────────────────────────────────────────────────────────────────
export const SHOOTING_ENABLED = true;           // Master toggle
export const SHOT_BURST_COUNT = 3;              // Projectiles per burst
export const SHOT_SPREAD_DEG = 12;              // Total spread angle (degrees)
export const SHOT_SPEED = 3.5;                  // World units per second
export const SHOT_LIFETIME = 2.0;               // Seconds before projectile dies
export const SHOT_COOLDOWN = 2.5;               // Seconds between bursts
export const SHOT_HIT_RADIUS = 0.35;            // Hitbox radius for hit detection
export const SHOT_LINE_WIDTH = 0.012;
export const SHOT_TRAIL_LENGTH = 0.18;          // World units of trail
export const PLAYER_MAX_HP = 3;
export const HIT_INVULN_TIME = 0.8;             // Brief invulnerability after any hit
export const RESPAWN_INVULN_TIME = 3.0;         // Seconds of invulnerability after death
export const SHOT_COLOR_OWN = 'rgba(140, 240, 255, 0.9)';
export const SHOT_COLOR_ENEMY = 'rgba(255, 100, 80, 0.85)';
export const SHOT_HIT_COLOR = 'rgba(255, 220, 100, 0.95)';

// Asteroid name generation
export const ASTEROID_NAME_PREFIXES = [
  'Astra', 'Cinder', 'Drift', 'Ember', 'Halo', 'Ion', 'Keel',
  'Lumen', 'Nova', 'Onyx', 'Pyre', 'Quill', 'Rune', 'Vanta', 'Zephyr',
];
export const ASTEROID_NAME_SUFFIXES = [
  'reach', 'spire', 'hollow', 'gate', 'mark', 'rest', 'drift',
  'point', 'wake', 'crown', 'bloom', 'haven', 'loop', 'trace', 'veil',
];

// ── Galaxy / Navigation Constants ───────────────────────────────────────────

export const GALAXY_SIZE = 100;          // 100×100 unit space
export const STAR_COUNT = 100;
export const STAR_MIN_SPACING = 7;       // minimum distance between stars
export const STAR_ENTER_RADIUS = 3;      // how close ship must get to enter a star system
export const SYSTEM_SIZE = 40;           // 40×40 unit system space
export const SYSTEM_BODY_MIN = 3;
export const SYSTEM_BODY_MAX = 8;
export const BODY_ENTER_RADIUS = 2;      // how close to enter local tier
export const SYSTEM_EXIT_RADIUS = 18;    // distance from system center to exit back to galaxy (must be > max orbit)

export const GALAXY_SHIP_SPEED = 4.5;    // ~5× normal so crossing ~22s matches current local feel
export const SYSTEM_SHIP_SPEED = 1.8;    // slower than galaxy, faster than local

// 100 well-known real star names (one per galaxy star)
export const STAR_NAMES: string[] = [
  'Sirius', 'Canopus', 'Arcturus', 'Vega', 'Capella',
  'Rigel', 'Procyon', 'Betelgeuse', 'Altair', 'Aldebaran',
  'Antares', 'Spica', 'Pollux', 'Fomalhaut', 'Deneb',
  'Regulus', 'Achernar', 'Castor', 'Gacrux', 'Bellatrix',
  'Elnath', 'Miaplacidus', 'Alnilam', 'Alioth', 'Dubhe',
  'Mirfak', 'Wezen', 'Sargas', 'Kaus', 'Avior',
  'Alkaid', 'Menkalinan', 'Atria', 'Alhena', 'Peacock',
  'Mirzam', 'Alphard', 'Hamal', 'Polaris', 'Nunki',
  'Mirach', 'Alpheratz', 'Rasalhague', 'Kochab', 'Saiph',
  'Denebola', 'Algol', 'Tiaki', 'Muhlifain', 'Aspidiske',
  'Suhail', 'Alphecca', 'Mintaka', 'Sadr', 'Eltanin',
  'Diphda', 'Naos', 'Mizar', 'Schedar', 'Aludra',
  'Alderamin', 'Markeb', 'Enif', 'Sabik', 'Phecda',
  'Scheat', 'Algieba', 'Zuben', 'Ankaa', 'Girtab',
  'Kraz', 'Rasalgethi', 'Cebalrai', 'Sheliak', 'Kornephoros',
  'Lesath', 'Izar', 'Dschubba', 'Acrab', 'Unukalhai',
  'Albireo', 'Tarazed', 'Sadalmelik', 'Algenib', 'Markab',
  'Phact', 'Tureis', 'Caph', 'Ruchbah', 'Merak',
  'Alcyone', 'Thuban', 'Hadar', 'Acrux', 'Mimosa',
  'Shaula', 'Alnair', 'Rasalhague', 'Vindemiatrix', 'Zubeneschamali',
];

// Planet / body name generation
export const PLANET_NAME_PREFIXES = [
  'Kra', 'Vel', 'Nor', 'Zel', 'Py', 'Dru', 'Tha', 'Ix',
  'Quo', 'Bre', 'Fen', 'Gol', 'Hyx', 'Jem', 'Cor', 'Alu',
];
export const PLANET_NAME_SUFFIXES = [
  'thos', 'mir', 'vex', 'don', 'nar', 'pex', 'lis', 'gon',
  'ra', 'tek', 'ium', 'or', 'ax', 'en', 'is', 'ul',
];

// Planet feature types and naming
export const FEATURE_TYPES: ('mine' | 'relay' | 'refinery' | 'station' | 'outpost' | 'colony' | 'solar_array' | 'mine_l2' | 'solar_array_l2')[] = [
  'mine', 'relay', 'refinery', 'station', 'outpost', 'colony', 'solar_array', 'mine_l2', 'solar_array_l2',
];
export const FEATURE_LABELS: Record<string, string> = {
  mine: 'Mine',
  mine_l2: 'Deep Mine',
  relay: 'Relay Outpost',
  refinery: 'Refinery Station',
  station: 'Station',
  outpost: 'Outpost',
  colony: 'Colony',
  solar_array: 'Solar Array',
  solar_array_l2: 'Solar Array II',
};
