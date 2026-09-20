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

  // ── Background art (supplied) with starfield fallback ─────────────────────
  const bgImg = new Image();
  let bgReady = false;
  bgImg.onload = () => { bgReady = true; };
  bgImg.src = 'background.png';

  // ── Tileable background (seamless wrap for full parallax scroll) ────────
  const tileImg = new Image();
  let tileReady = false;
  tileImg.onload = () => { tileReady = true; };
  tileImg.src = 'backgroundtile.png';

  // ── Logo (top-center title) ───────────────────────────────────────────────
  const logoImg = new Image();
  let logoReady = false;
  logoImg.onload = () => { logoReady = true; };
  logoImg.src = 'logo.png';

  // ── Frigate sprite (white background stripped to transparent) ─────────────
  let shipSprite: HTMLCanvasElement | null = null;
  const shipImg = new Image();
  shipImg.onload = () => { shipSprite = stripWhite(shipImg); };
  shipImg.src = 'icons/ships/frigate.png';

  function stripWhite(img: HTMLImageElement): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const c2 = cv.getContext('2d')!;
    c2.drawImage(img, 0, 0);
    const id = c2.getImageData(0, 0, cv.width, cv.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i]! > 235 && d[i + 1]! > 235 && d[i + 2]! > 235) d[i + 3] = 0;
    }
    c2.putImageData(id, 0, 0);
    return cv;
  }

  // ── Constants ───────────────────────────────────────────────────────────
  const MAP_W = 20, MAP_H = 16; // world units
  const ASTEROID_COUNT = 50;
  const MAX_SPEED = 0.9;
  const ACCEL = 1.35;
  const FUEL_MAX = 100;
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
  // Min surface-to-surface gap between asteroids so the ship can always fit through.
  const NAV_GAP = 0.7;
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    let x: number, y: number, r: number, ok: boolean;
    let attempts = 0;
    do {
      x = (rng() - 0.5) * MAP_W;
      y = (rng() - 0.5) * MAP_H;
      r = 0.28 + rng() * 0.42;
      ok = Math.sqrt(x * x + y * y) > 1.5 + r; // keep origin/spawn clear
      if (ok) {
        for (const a of asteroids) {
          // Reject if the two surfaces would be closer than the ship-passage gap.
          if (Math.hypot(a.x - x, a.y - y) < a.r + r + NAV_GAP) { ok = false; break; }
        }
      }
      attempts++;
    } while (!ok && attempts < 300);
    if (!ok) continue; // no room left with proper spacing — skip rather than crowd

    const n = 8 + (rng() * 5 | 0);
    const verts: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * Math.PI * 2;
      const rr = r * (0.6 + rng() * 0.6);
      verts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    asteroids.push({ x, y, r, verts, discovered: false });
  }

  // ── Docks: the four colored icons attached to asteroids (the objective) ───
  const DOCK_ICON_SRCS = [
    'icons/docks/blue.png',
    'icons/docks/yellow.png',
    'icons/docks/purple.png',
    'icons/docks/red.png',
  ];
  const dockSprites: (HTMLCanvasElement | null)[] = DOCK_ICON_SRCS.map(() => null);
  DOCK_ICON_SRCS.forEach((src, i) => {
    const im = new Image();
    im.onload = () => { dockSprites[i] = stripWhite(im); };
    im.src = src;
  });

  interface Dock {
    x: number; y: number;   // dock icon centre (just off the asteroid surface)
    ax: number; ay: number; // stem anchor on the asteroid surface
    icon: number;           // index into dockSprites
    collected: boolean;
  }
  const DOCK_TARGET = 6;
  const DOCK_REACH_R = 0.5;
  const docks: Dock[] = [];
  for (let i = 0; i < asteroids.length && docks.length < DOCK_TARGET; i++) {
    const a = asteroids[i]!;
    const angle = rng() * Math.PI * 2;
    const off = a.r + 0.3;
    docks.push({
      x: a.x + Math.cos(angle) * off,
      y: a.y + Math.sin(angle) * off,
      ax: a.x + Math.cos(angle) * a.r,
      ay: a.y + Math.sin(angle) * a.r,
      icon: docks.length % DOCK_ICON_SRCS.length,
      collected: false,
    });
  }
  const totalDocks = docks.length;

  // ── Ship state ──────────────────────────────────────────────────────────
  const ship = { x: 0, y: 1.5, vx: 0, vy: 0, angle: 0, fuel: FUEL_MAX, thrusting: false };
  let tgtX = 0, tgtY = 0, tgtActive = false;
  let docksCollected = 0;

  // ── Camera ──────────────────────────────────────────────────────────────
  let camX = 0, camY = 0;
  let ortho = 1.5; // large (zoomed-in) attract view
  const ZOOM_CLOSE = 1.15;
  const ZOOM_FAR = 1.7;  let hasNavigated = false; // hides the tap-to-navigate coach hint after first tap
  // ── Input ───────────────────────────────────────────────────────────────
  c.addEventListener('pointerdown', (e) => {
    const rect = c!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const aspect = W / H;
    tgtX = camX + (px - 0.5) * ortho * 2 * aspect;
    tgtY = camY + (py - 0.5) * ortho * 2;
    tgtActive = true;
    hasNavigated = true;
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
    // Attract autopilot: cruise toward the nearest uncollected dock
    if (!tgtActive) {
      let best: Dock | null = null, bestD = Infinity;
      for (const dk of docks) {
        if (dk.collected) continue;
        const dd = Math.hypot(ship.x - dk.x, ship.y - dk.y);
        if (dd < bestD) { bestD = dd; best = dk; }
      }
      if (best) { tgtX = best.x; tgtY = best.y; tgtActive = true; }
    }
    if (tgtActive) {
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

    // Dock collection — the core mini-game goal
    for (const dk of docks) {
      if (dk.collected) continue;
      if (Math.hypot(ship.x - dk.x, ship.y - dk.y) < DOCK_REACH_R) {
        dk.collected = true;
        docksCollected++;
        ship.fuel = Math.min(FUEL_MAX, ship.fuel + 30);
      }
    }

    // Loop the attract demo once every dock is reached
    if (docksCollected >= totalDocks) {
      for (const dk of docks) dk.collected = false;
      docksCollected = 0;
      ship.fuel = FUEL_MAX;
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

    // Background: seamless tiled parallax (wraps infinitely), with fallbacks.
    if (tileReady) {
      const aspect = W / H;
      const PARALLAX = 0.35;
      const ts = H; // display size of one square tile
      const pxPerUnitX = W / (ortho * 2 * aspect);
      const pxPerUnitY = H / (ortho * 2);
      let offX = (-camX * pxPerUnitX * PARALLAX + t * 8) % ts;
      let offY = (-camY * pxPerUnitY * PARALLAX) % ts;
      if (offX > 0) offX -= ts;
      if (offY > 0) offY -= ts;
      for (let gx = offX; gx < W; gx += ts) {
        for (let gy = offY; gy < H; gy += ts) {
          ctx.drawImage(tileImg, gx, gy, ts, ts);
        }
      }
    } else if (bgReady) {
      const iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
      // Over-scale so the parallax pan never exposes the image edges.
      const bScale = Math.max(W / iw, H / ih) * 1.3;
      const dw = iw * bScale, dh = ih * bScale;
      const slackX = (dw - W) / 2, slackY = (dh - H) / 2;
      const aspect = W / H;
      const PARALLAX = 0.35;
      let panX = -camX * (W / (ortho * 2 * aspect)) * PARALLAX + Math.sin(t * 0.05) * slackX * 0.15;
      let panY = -camY * (H / (ortho * 2)) * PARALLAX + Math.cos(t * 0.04) * slackY * 0.15;
      panX = Math.max(-slackX, Math.min(slackX, panX));
      panY = Math.max(-slackY, Math.min(slackY, panY));
      ctx.drawImage(bgImg, (W - dw) / 2 + panX, (H - dh) / 2 + panY, dw, dh);
    } else {
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, W, H);
    }

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

    // Docks — colored icons attached to their asteroids
    for (const dk of docks) {
      const [dx, dy] = w2s(dk.x, dk.y);
      if (dx < -80 || dx > W + 80 || dy < -80 || dy > H + 80) continue;
      const [ax, ay] = w2s(dk.ax, dk.ay);
      ctx.strokeStyle = dk.collected ? 'rgba(79,255,176,0.7)' : 'rgba(255,210,120,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(dx, dy);
      ctx.stroke();
      const sprite = dockSprites[dk.icon];
      const isz = Math.max(20, 0.4 * sc);
      if (sprite) {
        ctx.save();
        if (dk.collected) ctx.globalAlpha = 0.4;
        ctx.drawImage(sprite, dx - isz / 2, dy - isz / 2, isz, isz);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(dx, dy, isz * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = dk.collected ? '#4fffb0' : '#FF6A3D';
        ctx.fill();
      }
    }

    // Ship
    const [ssx, ssy] = w2s(ship.x, ship.y);
    const shipSize = Math.max(6, 0.1 * sc);
    ctx.save();
    ctx.translate(ssx, ssy);
    if (shipSprite) {
      const px = Math.max(30, shipSize * 6);
      ctx.rotate(ship.angle + Math.PI / 2); // sprite nose points up
      if (ship.thrusting) {
        ctx.beginPath();
        ctx.moveTo(-px * 0.16, px * 0.5);
        ctx.lineTo(0, px * 0.5 + (0.18 + Math.random() * 0.14) * px);
        ctx.lineTo(px * 0.16, px * 0.5);
        ctx.fillStyle = 'rgba(255, 160, 50, 0.85)';
        ctx.fill();
      }
      ctx.drawImage(shipSprite, -px / 2, -px / 2, px, px);
    } else {
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
      if (ship.thrusting) {
        ctx.beginPath();
        ctx.moveTo(-shipSize * 0.5, -shipSize * 0.3);
        ctx.lineTo(-shipSize * 1.4 - Math.random() * shipSize * 0.4, 0);
        ctx.lineTo(-shipSize * 0.5, shipSize * 0.3);
        ctx.strokeStyle = 'rgba(255, 160, 50, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
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

    // Title (top center) — logo image with text fallback
    ctx.textAlign = 'center';
    let hintY = 35;
    if (logoReady) {
      const lw = Math.min(W * 0.66, 460);
      const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
      const ly = Math.max(6, H * 0.04);
      ctx.drawImage(logoImg, (W - lw) / 2, ly, lw, lh);
      hintY = ly + lh + 12;
    } else {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText('VALCORDIA SPACE', W / 2 + 1, 21);
      ctx.fillStyle = '#4fffb0';
      ctx.fillText('VALCORDIA SPACE', W / 2, 20);
    }
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(79, 255, 176, 0.4)';
    ctx.fillText('tap to navigate \u2022 collect docks', W / 2, hintY);

    // Coach-style "tap to navigate" indicator (amber card, matches the tutorial)
    if (!hasNavigated) {
      const amber = '#ffb84d';
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const cardTitle = 'NAVIGATE';
      const cardBody = 'Tap here to navigate now';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '11px monospace';
      const bodyW = ctx.measureText(cardBody).width;
      const boxW = Math.min(bodyW + 24, W - 24);
      const boxH = 48;
      const boxX = (W - boxW) / 2;
      const boxY = H * 0.6;
      // Pulsing outer glow
      ctx.strokeStyle = `rgba(255,184,77,${0.16 + pulse * 0.3})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(boxX - 3, boxY - 3, boxW + 6, boxH + 6, 9);
      ctx.stroke();
      // Card body
      ctx.fillStyle = 'rgba(10,6,0,0.92)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 7);
      ctx.fill();
      ctx.strokeStyle = amber;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 7);
      ctx.stroke();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = amber;
      ctx.fillText(cardTitle, boxX + 12, boxY + 9);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#8ff7cf';
      ctx.fillText(cardBody, boxX + 12, boxY + 27);

      // Target a point a little ahead of the ship and off to one side, so tapping
      // it makes the ship visibly alter course.
      const fx = Math.cos(ship.angle), fy = Math.sin(ship.angle);
      const aheadWX = ship.x + fx * 1.1 - fy * 0.75;
      const aheadWY = ship.y + fy * 1.1 + fx * 0.75;
      let [tX, tY] = w2s(aheadWX, aheadWY);
      // Prefer a nearby dock, but only if it's far enough to not sit on the ship.
      let bestDock: Dock | null = null, bestDockD = Infinity;
      for (const dk of docks) {
        if (dk.collected) continue;
        const d = Math.hypot(ship.x - dk.x, ship.y - dk.y);
        if (d < bestDockD) { bestDockD = d; bestDock = dk; }
      }
      if (bestDock && bestDockD > 1.3) {
        const [dsx, dsy] = w2s(bestDock.x, bestDock.y);
        if (dsx > 16 && dsx < W - 16 && dsy > 16 && dsy < H - 16) { tX = dsx; tY = dsy; }
      }
      tX = Math.max(24, Math.min(W - 24, tX));
      tY = Math.max(24, Math.min(H - 24, tY));
      // Arrow start: point on the card border facing the target.
      const bcx = boxX + boxW / 2, bcy = boxY + boxH / 2;
      const ang = Math.atan2(tY - bcy, tX - bcx);
      const adx = Math.cos(ang), ady = Math.sin(ang);
      const edgeScale = Math.min((boxW / 2 + 4) / Math.max(Math.abs(adx), 1e-3), (boxH / 2 + 4) / Math.max(Math.abs(ady), 1e-3));
      const startX = bcx + adx * edgeScale, startY = bcy + ady * edgeScale;
      const cr = 12 + pulse * 4;
      const gap = cr + 10;
      const fullEndX = tX - adx * gap, fullEndY = tY - ady * gap;
      // Arrow spans about a third of the way toward the crosshair.
      const endX = startX + (fullEndX - startX) * 0.34;
      const endY = startY + (fullEndY - startY) * 0.34;
      ctx.strokeStyle = amber;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      const ah = 10;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - ah * Math.cos(ang - 0.42), endY - ah * Math.sin(ang - 0.42));
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - ah * Math.cos(ang + 0.42), endY - ah * Math.sin(ang + 0.42));
      ctx.stroke();
      // Keep the crosshair close to the shortened arrowhead while preserving its direction.
      tX = endX + adx * (cr + 12);
      tY = endY + ady * (cr + 12);
      // Crosshair at the target.
      ctx.lineWidth = 2;
      const crosshairInner = cr * 0.65;
      const crosshairOuter = cr * 1.15;
      ctx.beginPath();
      ctx.arc(tX, tY, cr, 0, Math.PI * 2);
      ctx.moveTo(tX - crosshairOuter, tY); ctx.lineTo(tX - crosshairInner, tY);
      ctx.moveTo(tX + crosshairInner, tY); ctx.lineTo(tX + crosshairOuter, tY);
      ctx.moveTo(tX, tY - crosshairOuter); ctx.lineTo(tX, tY - crosshairInner);
      ctx.moveTo(tX, tY + crosshairInner); ctx.lineTo(tX, tY + crosshairOuter);
      ctx.stroke();
      ctx.fillStyle = amber;
      ctx.beginPath();
      ctx.arc(tX, tY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'center';
    }

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

export {};
