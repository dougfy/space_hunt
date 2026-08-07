/**
 * Procedural Skin — the default wireframe/line-art rendering.
 * Extracted from renderer.ts drawFeatureIcon(). This is the "classic" look.
 */

import type { FeatureType } from '../galaxy';
import type { RenderSkin, DrawFeatureIconFn } from '../skin';

const G_BRIGHT = '#4fffb0';

const drawFeatureIconProcedural: DrawFeatureIconFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: FeatureType,
  size: number,
  level?: number,
) => {
  ctx.save();
  ctx.strokeStyle = G_BRIGHT;
  ctx.fillStyle = G_BRIGHT;
  ctx.lineWidth = 1.0;
  const s = size;
  const lv = level ?? 1;

  switch (type) {
    case 'mine':
    case 'mine_l2': {
      if (lv <= 2) {
        ctx.beginPath();
        ctx.moveTo(x, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x + s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - s, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.8, y + s); ctx.lineTo(x + s * 0.8, y + s);
        ctx.stroke();
      } else if (lv <= 5) {
        ctx.beginPath();
        ctx.moveTo(x, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x + s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.35, y + s * 0.2); ctx.lineTo(x + s * 0.35, y + s * 0.2);
        ctx.moveTo(x - s * 0.2, y - s * 0.3); ctx.lineTo(x + s * 0.2, y - s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - s, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.8, y + s); ctx.lineTo(x + s * 0.8, y - s * 0.3);
        ctx.moveTo(x + s * 0.5, y + s); ctx.lineTo(x + s * 0.8, y - s * 0.3);
        ctx.moveTo(x + s * 1.1, y + s); ctx.lineTo(x + s * 0.8, y - s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s, y + s); ctx.lineTo(x + s * 1.2, y + s);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x + s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.35, y + s * 0.3); ctx.lineTo(x + s * 0.35, y + s * 0.3);
        ctx.moveTo(x - s * 0.2, y - s * 0.2); ctx.lineTo(x + s * 0.2, y - s * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - s, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y - s * 0.3); ctx.lineTo(x - s * 1.2, y - s * 0.8);
        ctx.moveTo(x + s * 0.5, y - s * 0.3); ctx.lineTo(x + s * 1.2, y - s * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.3, y + s); ctx.lineTo(x - s * 0.3, y + s * 0.4);
        ctx.moveTo(x + s * 0.3, y + s); ctx.lineTo(x + s * 0.3, y + s * 0.4);
        ctx.moveTo(x - s * 0.3, y + s * 0.4); ctx.lineTo(x + s * 0.3, y + s * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 1.1, y + s); ctx.lineTo(x + s * 1.1, y + s);
        ctx.stroke();
      }
      break;
    }

    case 'relay':
      ctx.beginPath();
      ctx.moveTo(x, y + s);
      ctx.lineTo(x, y - s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - s * 0.3, s * 0.7, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.3);
      ctx.lineTo(x + s * 0.8, y - s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * 0.8, y - s, s * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'refinery':
      ctx.strokeRect(x - s, y - s * 0.3, s * 2, s * 1.3);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.3); ctx.lineTo(x - s * 0.5, y - s);
      ctx.moveTo(x, y - s * 0.3); ctx.lineTo(x, y - s * 0.8);
      ctx.moveTo(x + s * 0.5, y - s * 0.3); ctx.lineTo(x + s * 0.5, y - s);
      ctx.stroke();
      break;

    case 'station': {
      if (lv <= 2) {
        ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
        ctx.stroke();
        const portOffsets: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of portOffsets) {
          ctx.beginPath();
          ctx.arc(x + dx * s, y + dy * s, s * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (lv <= 5) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x - s, y);
        ctx.moveTo(x + s * 0.4, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x, y - s);
        ctx.moveTo(x, y + s * 0.4); ctx.lineTo(x, y + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - s * 1.2, y - s * 0.25, s * 0.3, s * 0.5);
        ctx.rect(x + s * 0.9, y - s * 0.25, s * 0.3, s * 0.5);
        ctx.rect(x - s * 0.25, y - s * 1.2, s * 0.5, s * 0.3);
        ctx.rect(x - s * 0.25, y + s * 0.9, s * 0.5, s * 0.3);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2);
          ctx.lineTo(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9);
          ctx.stroke();
        }
        const cardinals = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        for (const a of cardinals) {
          const mx = x + Math.cos(a) * s;
          const my = y + Math.sin(a) * s;
          ctx.beginPath();
          ctx.rect(mx - s * 0.15, my - s * 0.15, s * 0.3, s * 0.3);
          ctx.stroke();
        }
      }
      break;
    }

    case 'outpost':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.6);
      ctx.lineTo(x + s * 0.7, y + s * 0.6);
      ctx.lineTo(x + s * 0.7, y - s * 0.2);
      ctx.lineTo(x, y - s);
      ctx.lineTo(x - s * 0.7, y - s * 0.2);
      ctx.closePath();
      ctx.stroke();
      break;

    case 'colony': {
      if (lv <= 2) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.8, Math.PI, 0);
        ctx.lineTo(x + s * 0.8, y + s * 0.4);
        ctx.lineTo(x - s * 0.8, y + s * 0.4);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - s * 0.3, y - s * 0.1, 1.5, 0, Math.PI * 2);
        ctx.arc(x + s * 0.3, y - s * 0.1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (lv <= 5) {
        ctx.beginPath();
        ctx.arc(x - s * 0.2, y, s * 0.7, Math.PI, 0);
        ctx.lineTo(x + s * 0.5, y + s * 0.4);
        ctx.lineTo(x - s * 0.9, y + s * 0.4);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + s * 0.7, y + s * 0.1, s * 0.4, Math.PI, 0);
        ctx.lineTo(x + s * 1.1, y + s * 0.4);
        ctx.lineTo(x + s * 0.3, y + s * 0.4);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.3, y + s * 0.2); ctx.lineTo(x + s * 0.5, y + s * 0.2);
        ctx.moveTo(x + s * 0.3, y + s * 0.35); ctx.lineTo(x + s * 0.5, y + s * 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 1.0, y + s * 0.4); ctx.lineTo(x + s * 1.2, y + s * 0.4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x - s * 0.3, y + s * 0.1, s * 0.55, Math.PI, 0);
        ctx.lineTo(x + s * 0.25, y + s * 0.5);
        ctx.lineTo(x - s * 0.85, y + s * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x + s * 0.4, y - s * 0.8, s * 0.5, s * 1.3);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const ty = y - s * 0.5 + i * s * 0.35;
          ctx.beginPath();
          ctx.moveTo(x + s * 0.4, ty); ctx.lineTo(x + s * 0.9, ty);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(x - s * 1.0, y + s * 0.5); ctx.lineTo(x + s * 1.1, y + s * 0.5);
        ctx.stroke();
      }
      break;
    }

    case 'solar_array':
    case 'solar_array_l2': {
      if (lv <= 2) {
        ctx.beginPath();
        ctx.rect(x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.25, y); ctx.lineTo(x - s * 0.9, y);
        ctx.moveTo(x + s * 0.25, y); ctx.lineTo(x + s * 0.9, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - s * 0.9, y - s * 0.45, s * 0.65, s * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.58, y - s * 0.45); ctx.lineTo(x - s * 0.58, y + s * 0.45);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x + s * 0.25, y - s * 0.45, s * 0.65, s * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.58, y - s * 0.45); ctx.lineTo(x + s * 0.58, y + s * 0.45);
        ctx.stroke();
      } else if (lv <= 5) {
        ctx.beginPath();
        ctx.rect(x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.25, y); ctx.lineTo(x - s * 0.9, y);
        ctx.moveTo(x + s * 0.25, y); ctx.lineTo(x + s * 0.9, y);
        ctx.moveTo(x, y - s * 0.25); ctx.lineTo(x, y - s * 0.9);
        ctx.moveTo(x, y + s * 0.25); ctx.lineTo(x, y + s * 0.9);
        ctx.stroke();
        const panels: Array<[number, number, number, number]> = [
          [x - s * 0.9, y - s * 0.4, s * 0.65, s * 0.8],
          [x + s * 0.25, y - s * 0.4, s * 0.65, s * 0.8],
          [x - s * 0.4, y - s * 0.9, s * 0.8, s * 0.65],
          [x - s * 0.4, y + s * 0.25, s * 0.8, s * 0.65],
        ];
        for (const [px, py, pw, ph] of panels) {
          ctx.beginPath();
          ctx.rect(px, py, pw, ph);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const px = x + Math.cos(a) * s * 0.7;
          const py = y + Math.sin(a) * s * 0.7;
          ctx.beginPath();
          ctx.rect(px - s * 0.12, py - s * 0.12, s * 0.24, s * 0.24);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(x - s * 0.2, y); ctx.lineTo(x - s * 0.7, y);
        ctx.moveTo(x + s * 0.2, y); ctx.lineTo(x + s * 0.7, y);
        ctx.moveTo(x, y - s * 0.2); ctx.lineTo(x, y - s * 0.7);
        ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x, y + s * 0.7);
        ctx.stroke();
      }
      break;
    }
    case 'warehouse': {
      ctx.beginPath();
      ctx.rect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y); ctx.lineTo(x + s * 0.7, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x, y + s * 0.5);
      ctx.stroke();
      if (lv >= 3) {
        ctx.beginPath();
        ctx.rect(x - s * 0.5, y - s * 0.9, s * 1.0, s * 0.4);
        ctx.stroke();
      }
      break;
    }
    case 'dock': {
      ctx.beginPath();
      ctx.rect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(x - s * 0.5, y - s * 0.3, s * 1.0, s * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.8, y - s * 0.6); ctx.lineTo(x - s * 1.1, y - s * 1.0);
      ctx.moveTo(x + s * 0.8, y - s * 0.6); ctx.lineTo(x + s * 1.1, y - s * 1.0);
      ctx.stroke();
      if (lv >= 3) {
        ctx.beginPath();
        ctx.rect(x - s * 0.5, y + s * 0.4, s * 1.0, s * 0.5);
        ctx.stroke();
      }
      if (lv >= 5) {
        ctx.beginPath();
        ctx.rect(x - s * 0.5, y - s * 1.0, s * 1.0, s * 0.4);
        ctx.stroke();
      }
      break;
    }
    case 'shield': {
      if (lv <= 2) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const hx = x + Math.cos(a) * s * 0.4;
          const hy = y + Math.sin(a) * s * 0.4;
          if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.8, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.4); ctx.lineTo(x, y + s);
        ctx.stroke();
      } else if (lv <= 4) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const hx = x + Math.cos(a) * s * 0.35;
          const hy = y + Math.sin(a) * s * 0.35;
          if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.7, -Math.PI * 0.9, -Math.PI * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.9, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.7, y); ctx.lineTo(x - s, y - s * 0.3);
        ctx.moveTo(x + s * 0.7, y); ctx.lineTo(x + s, y - s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y + s); ctx.lineTo(x + s * 0.5, y + s);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5);
          ctx.lineTo(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8, s * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'cannon': {
      if (lv <= 2) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.6, y + s); ctx.lineTo(x + s * 0.6, y + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y + s);
        ctx.lineTo(x - s * 0.3, y + s * 0.2);
        ctx.lineTo(x + s * 0.3, y + s * 0.2);
        ctx.lineTo(x + s * 0.5, y + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.12, y + s * 0.2);
        ctx.lineTo(x - s * 0.12, y - s * 0.7);
        ctx.moveTo(x + s * 0.12, y + s * 0.2);
        ctx.lineTo(x + s * 0.12, y - s * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.9);
        ctx.lineTo(x - s * 0.2, y - s * 0.7);
        ctx.moveTo(x, y - s * 0.9);
        ctx.lineTo(x + s * 0.2, y - s * 0.7);
        ctx.stroke();
      } else if (lv <= 4) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x + s * 0.7, y + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.6, y + s);
        ctx.lineTo(x - s * 0.35, y + s * 0.1);
        ctx.lineTo(x + s * 0.35, y + s * 0.1);
        ctx.lineTo(x + s * 0.6, y + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + s * 0.1, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.2, y + s * 0.1); ctx.lineTo(x - s * 0.2, y - s * 0.8);
        ctx.moveTo(x + s * 0.2, y + s * 0.1); ctx.lineTo(x + s * 0.2, y - s * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - s * 0.2, y - s * 0.85, s * 0.08, 0, Math.PI * 2);
        ctx.arc(x + s * 0.2, y - s * 0.85, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.8, y + s); ctx.lineTo(x + s * 0.8, y + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - s * 0.6, y + s * 0.3, s * 1.2, s * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + s * 0.1, s * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + s * 0.1, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.3, y + s * 0.1); ctx.lineTo(x - s * 0.3, y - s * 0.9);
        ctx.moveTo(x, y + s * 0.1); ctx.lineTo(x, y - s);
        ctx.moveTo(x + s * 0.3, y + s * 0.1); ctx.lineTo(x + s * 0.3, y - s * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - s * 0.3, y - s * 0.95, s * 0.07, 0, Math.PI * 2);
        ctx.arc(x, y - s * 1.05, s * 0.07, 0, Math.PI * 2);
        ctx.arc(x + s * 0.3, y - s * 0.95, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
};

export const proceduralSkin: RenderSkin = {
  id: 'procedural',
  label: 'Wireframe',
  drawFeatureIcon: drawFeatureIconProcedural,
};
