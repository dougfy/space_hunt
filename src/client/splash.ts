// ── Playable Belt Mini-Game Splash (zero heavy imports) ─────────────────────
// Self-contained asteroid belt with ship physics, fuel pods, and dock objectives.
// Runs instantly as the splash screen until the real game takes over.

const c = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (c) {
  const ctx = c.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  let W = c.clientWidth;
  let H = c.clientHeight;

  function resize() {
    W = c!.clientWidth; H = c!.clientHeight;
    c!.width = W * dpr; c!.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Constants ───────────────────────────────────────────────────────────
  const MAP_W = 20, MAP_H = 16; // world units
  const ASTEROID_COUNT = 50;
  const MAX_SPEED = 0.9;
  const ACCEL = 1.35;
  const FUEL_MAX = 100;
  const FUEL_DRAIN = 0.8; // per sec while thrusting
  const POD_COLLECT_R = 0.22;
  const ARRIVE_R = 0.15;

  // ── Seeded RNG ──────────────────────────────────────────────────────────
  let seed = 48271;
  function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // ── Generate asteroids ──────────────────────────────────────────────────
  interface Asteroid {
    x: number; y: number; r: number;
    verts: [number, number][];
    discovered: boolean;
  }
  const asteroids: Asteroid[] = [];
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    let x: number, y: number, ok: boolean;
    do {
      x = (rng() - 0.5) * MAP_W;
      y = (rng() - 0.5) * MAP_H;
      const dist = Math.sqrt(x * x + y * y);
      ok = dist > 1.5; // keep origin clear
      if (ok) {
        for (const a of asteroids) {
          if (Math.abs(a.x - x) + Math.abs(a.y - y) < 0.9) { ok = false; break; }
        }
      }
    } while (!ok);

    const r = 0.28 + rng() * 0.42;
    const n = 8 + (rng() * 5 | 0);
    const verts: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * Math.PI * 2;
      const rr = r * (0.6 + rng() * 0.6);
      verts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    asteroids.push({ x, y, r, verts, discovered: false });
  }

  // ── Generate fuel pods (multi-color discovery system) ─────────────────────
  type PodKind = 'refuel' | 'dock' | 'energy' | 'ore' | 'food' | 'upgrade';
  const POD_TYPE_TABLE: { kind: PodKind; color: string; weight: number; fuel: number }[] = [
    { kind: 'refuel',  color: '#FF5A3D', weight: 15, fuel: 40 },
    { kind: 'dock',    color: '#FFD24A', weight: 10, fuel: 15 },
    { kind: 'energy',  color: '#66CCFF', weight: 25, fuel: 5 },
    { kind: 'ore',     color: '#FF9933', weight: 25, fuel: 5 },
    { kind: 'food',    color: '#66FF66', weight: 20, fuel: 5 },
    { kind: 'upgrade', color: '#CC66FF', weight: 5,  fuel: 0 },
  ];
  const TOTAL_W = POD_TYPE_TABLE.reduce((s, t) => s + t.weight, 0);
  function pickPod(roll: number) {
    const v = roll * TOTAL_W;
    let cum = 0;
    for (const e of POD_TYPE_TABLE) { cum += e.weight; if (v < cum) return e; }
    return POD_TYPE_TABLE[POD_TYPE_TABLE.length - 1]!;
  }

  interface Pod {
    x: number; y: number;
    kind: PodKind;
    color: string;
    fuel: number;
    collected: boolean;
  }
  const pods: Pod[] = [];
  for (const a of asteroids) {
    const angle = rng() * Math.PI * 2;
    const offset = a.r + 0.13;
    const picked = pickPod(rng());
    pods.push({
      x: a.x + Math.cos(angle) * offset,
      y: a.y + Math.sin(angle) * offset,
      kind: picked.kind,
      color: picked.color,
      fuel: picked.fuel,
      collected: false,
    });
  }
  const totalDocks = pods.filter(p => p.kind === 'dock').length;

  // ── Ship state ──────────────────────────────────────────────────────────
  const ship = { x: 0, y: 1.5, vx: 0, vy: 0, angle: 0, fuel: FUEL_MAX, thrusting: false };
  let tgtX = 0, tgtY = 0, tgtActive = false;
  let docksCollected = 0;

  // ── Camera ──────────────────────────────────────────────────────────────
  let camX = 0, camY = 0;
  let ortho = 3.2; // world units visible vertically / 2
  const ZOOM_CLOSE = 0.8;
  const ZOOM_FAR = 3.2;

  // ── Input ───────────────────────────────────────────────────────────────
  c.addEventListener('pointerdown', (e) => {
    const rect = c!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const aspect = W / H;
    tgtX = camX + (px - 0.5) * ortho * 2 * aspect;
    tgtY = camY + (py - 0.5) * ortho * 2;
    tgtActive = true;
  });

  // ── World-to-screen transform ──────────────────────────────────────────
  function w2s(wx: number, wy: number): [number, number] {
    const aspect = W / H;
    const sx = ((wx - camX) / (ortho * 2 * aspect) + 0.5) * W;
    const sy = ((wy - camY) / (ortho * 2) + 0.5) * H;
    return [sx, sy];
  }
  function worldScale(): number {
    return H / (ortho * 2);
  }

  // ── Stars background ───────────────────────────────────────────────────
  const bgStars: { x: number; y: number; s: number; phase: number }[] = [];
  for (let i = 0; i < 80; i++) {
    bgStars.push({ x: rng(), y: rng(), s: 0.5 + rng() * 1.5, phase: rng() * Math.PI * 2 });
  }

  // ── Game loop ──────────────────────────────────────────────────────────
  let lastTime = performance.now();
  let raf = 0;

  function frame() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // ── Update ship physics ───────────────────────────────────────────
    ship.thrusting = false;
    if (tgtActive && ship.fuel > 0) {
      const dx = tgtX - ship.x, dy = tgtY - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > ARRIVE_R) {
        ship.thrusting = true;
        const desiredSpeed = dist < 1.25 ? MAX_SPEED * (dist / 1.25) : MAX_SPEED;
        let dvx = (dx / dist) * desiredSpeed;
        let dvy = (dy / dist) * desiredSpeed;

        // Asteroid avoidance
        for (const a of asteroids) {
          const ax = ship.x - a.x, ay = ship.y - a.y;
          const ad = Math.sqrt(ax * ax + ay * ay);
          const buffer = a.r + 0.2;
          if (ad < buffer && ad > 0.01) {
            const push = (buffer - ad) / buffer * 1.4;
            dvx += (ax / ad) * push;
            dvy += (ay / ad) * push;
          }
        }

        // Smooth acceleration
        const step = ACCEL * dt;
        const edx = dvx - ship.vx, edy = dvy - ship.vy;
        const emag = Math.sqrt(edx * edx + edy * edy);
        if (emag > step) {
          ship.vx += (edx / emag) * step;
          ship.vy += (edy / emag) * step;
        } else {
          ship.vx = dvx; ship.vy = dvy;
        }
      } else {
        tgtActive = false;
        ship.vx *= 0.9; ship.vy *= 0.9;
      }
    } else {
      ship.vx *= 0.98; ship.vy *= 0.98;
    }

    // Clamp speed
    const spd = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (spd > MAX_SPEED) { ship.vx = (ship.vx / spd) * MAX_SPEED; ship.vy = (ship.vy / spd) * MAX_SPEED; }

    // Fuel drain
    if (ship.thrusting) ship.fuel = Math.max(0, ship.fuel - FUEL_DRAIN * dt);

    // Move
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    // Ship angle
    if (spd > 0.01) ship.angle = Math.atan2(ship.vy, ship.vx);

    // Asteroid collision
    for (const a of asteroids) {
      const dx = ship.x - a.x, dy = ship.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < a.r + 0.12 && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        ship.x = a.x + nx * (a.r + 0.12);
        ship.y = a.y + ny * (a.r + 0.12);
        const dot = ship.vx * nx + ship.vy * ny;
        if (dot < 0) { ship.vx -= nx * dot * 1.5; ship.vy -= ny * dot * 1.5; }
      }
    }

    // Pod collection
    for (const p of pods) {
      if (p.collected) continue;
      const dx = ship.x - p.x, dy = ship.y - p.y;
      if (dx * dx + dy * dy < POD_COLLECT_R * POD_COLLECT_R) {
        p.collected = true;
        if (p.kind === 'refuel') {
          ship.fuel = Math.min(FUEL_MAX, ship.fuel + p.fuel);
        } else {
          if (p.kind === 'dock') docksCollected++;
          ship.fuel = Math.min(FUEL_MAX, ship.fuel + p.fuel);
        }
      }
    }

    // Discover asteroids near ship
    for (const a of asteroids) {
      if (!a.discovered) {
        const dx = ship.x - a.x, dy = ship.y - a.y;
        if (dx * dx + dy * dy < ortho * ortho * 4) a.discovered = true;
      }
    }

    // ── Camera ────────────────────────────────────────────────────────
    // Smooth follow
    camX += (ship.x - camX) * 0.08;
    camY += (ship.y - camY) * 0.08;

    // Auto-zoom: close when near asteroid
    let nearAsteroid = false;
    for (const a of asteroids) {
      const dx = ship.x - a.x, dy = ship.y - a.y;
      if (dx * dx + dy * dy < 1.5 * 1.5) { nearAsteroid = true; break; }
    }
    const targetOrtho = nearAsteroid ? ZOOM_CLOSE : ZOOM_FAR;
    ortho += (targetOrtho - ortho) * 0.04;

    // ── Render ────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);
    const t = now / 1000;
    const sc = worldScale();

    // Background stars
    for (const s of bgStars) {
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + s.phase));
      ctx.fillStyle = `rgba(79, 255, 176, ${twinkle * 0.5})`;
      ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }

    // Asteroids
    for (const a of asteroids) {
      const [sx, sy] = w2s(a.x, a.y);
      // Cull off-screen
      if (sx < -100 || sx > W + 100 || sy < -100 || sy > H + 100) continue;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.beginPath();
      const v0 = a.verts[0]!;
      ctx.moveTo(v0[0] * sc, v0[1] * sc);
      for (let j = 1; j < a.verts.length; j++) {
        const v = a.verts[j]!;
        ctx.lineTo(v[0] * sc, v[1] * sc);
      }
      ctx.closePath();
      ctx.strokeStyle = a.discovered ? 'rgba(87, 235, 140, 0.85)' : 'rgba(180, 200, 230, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Pods
    for (const p of pods) {
      if (p.collected) continue;
      const [sx, sy] = w2s(p.x, p.y);
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      const pr = Math.max(3, 0.06 * sc);
      ctx.beginPath();
      ctx.arc(sx, sy, pr, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      // Stem
      const aIdx = pods.indexOf(p);
      if (aIdx < asteroids.length) {
        const a = asteroids[aIdx]!;
        const [asx, asy] = w2s(a.x, a.y);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(asx, asy);
        ctx.strokeStyle = p.color.replace(')', ', 0.3)').replace('rgb(', 'rgba(');
        // Simple alpha for hex colors
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    // Target reticle
    if (tgtActive) {
      const [tx, ty] = w2s(tgtX, tgtY);
      const tr = 0.12 * sc;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.strokeStyle = '#3b82f5';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(tx - tr * 1.5, ty); ctx.lineTo(tx + tr * 1.5, ty);
      ctx.moveTo(tx, ty - tr * 1.5); ctx.lineTo(tx, ty + tr * 1.5);
      ctx.strokeStyle = 'rgba(59, 130, 245, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Ship
    const [ssx, ssy] = w2s(ship.x, ship.y);
    const shipSize = Math.max(6, 0.1 * sc);
    ctx.save();
    ctx.translate(ssx, ssy);
    ctx.rotate(ship.angle);
    ctx.beginPath();
    ctx.moveTo(shipSize * 1.5, 0);
    ctx.lineTo(-shipSize, -shipSize);
    ctx.lineTo(-shipSize * 0.5, 0);
    ctx.lineTo(-shipSize, shipSize);
    ctx.closePath();
    ctx.strokeStyle = ship.thrusting ? '#f59e0b' : '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Engine flame
    if (ship.thrusting) {
      ctx.beginPath();
      ctx.moveTo(-shipSize * 0.5, -shipSize * 0.3);
      ctx.lineTo(-shipSize * 1.4 - Math.random() * shipSize * 0.4, 0);
      ctx.lineTo(-shipSize * 0.5, shipSize * 0.3);
      ctx.strokeStyle = 'rgba(255, 160, 50, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // ── HUD ───────────────────────────────────────────────────────────
    // Fuel bar
    const fuelPct = ship.fuel / FUEL_MAX;
    const barW = 80, barH = 8, barX = 12, barY = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = fuelPct > 0.25 ? '#10b981' : '#ef4444';
    ctx.fillRect(barX, barY, barW * fuelPct, barH);
    ctx.strokeStyle = 'rgba(79, 255, 176, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4fffb0';
    ctx.fillText(`FUEL ${Math.round(fuelPct * 100)}%`, barX, barY + barH + 11);

    // Dock counter
    ctx.fillText(`DOCKS ${docksCollected}/${totalDocks}`, barX, barY + barH + 23);

    // Title (top center)
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText('VALCORDIA SPACE', W / 2 + 1, 21);
    ctx.fillStyle = '#4fffb0';
    ctx.fillText('VALCORDIA SPACE', W / 2, 20);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(79, 255, 176, 0.4)';
    ctx.fillText('tap to navigate \u2022 collect docks', W / 2, 35);

    // Low fuel warning
    if (fuelPct < 0.2 && Math.sin(t * 6) > 0) {
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('LOW FUEL', W / 2, H - 20);
    }

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // Expose stop function for game.ts to call when it takes over
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__stopSplash = () => { cancelAnimationFrame(raf); };
}
