// Procedural surface textures for painted cells, drawn once on a canvas at
// startup (no image assets). Both are centred on mid-grey so an 'overlay' /
// 'soft-light' blend keeps the cell's own colour and only adds light/shadow
// detail. Each texture spans the whole board (PX pixels per cell), so the
// pattern runs continuously across neighbouring cells.

const PX = 40;

type Rnd = () => number;

// Deterministic RNG: the texture looks the same on every load
function mulberry32(seed: number): Rnd {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(cols: number, rows: number): [HTMLCanvasElement, CanvasRenderingContext2D, number, number] {
  const canvas = document.createElement('canvas');
  canvas.width = cols * PX;
  canvas.height = rows * PX;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return [canvas, ctx, canvas.width, canvas.height];
}

// Soft light/dark patches so the surface isn't perfectly even
function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, alpha: number, rnd: Rnd): void {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = PX * (1 + rnd() * 2.5);
    const tone = rnd() < 0.5 ? '255,255,255' : '0,0,0';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${tone},${alpha})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// Fine monochrome grain
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, rnd: Rnd): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 2 * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Plush fur: short curled strands combed outward from the face, light tips
// over darker roots
export function furTexture(cols: number, rows: number, originRow: number, originCol: number): string {
  const rnd = mulberry32(13);
  const [canvas, ctx, w, h] = makeCanvas(cols, rows);
  blotches(ctx, w, h, cols * rows * 0.2, 0.1, rnd);

  const ox = originCol * PX;
  const oy = originRow * PX;
  ctx.lineCap = 'round';
  for (let i = 0; i < cols * rows * 16; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const a = Math.atan2(y - oy, x - ox) + (rnd() - 0.5) * 0.8;
    const len = PX * (0.22 + rnd() * 0.3);
    const curl = (rnd() - 0.5) * 0.9;
    ctx.strokeStyle = rnd() < 0.45 ? `rgba(0,0,0,${0.1 + rnd() * 0.16})` : `rgba(255,255,255,${0.14 + rnd() * 0.24})`;
    ctx.lineWidth = PX * (0.025 + rnd() * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a + curl) * len * 0.55,
      y + Math.sin(a + curl) * len * 0.55,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len
    );
    ctx.stroke();
  }

  grain(ctx, w, h, 7, rnd);
  return canvas.toDataURL('image/jpeg', 0.86);
}

// Wet gloss: broad uneven sheen with small tilted specular glints
export function glossTexture(cols: number, rows: number): string {
  const rnd = mulberry32(21);
  const [canvas, ctx, w, h] = makeCanvas(cols, rows);
  blotches(ctx, w, h, cols * rows * 0.3, 0.16, rnd);

  for (let i = 0; i < cols * rows * 0.6; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = PX * (0.12 + rnd() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.4);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r * 0.8, -Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();
  }

  grain(ctx, w, h, 4, rnd);
  return canvas.toDataURL('image/jpeg', 0.86);
}
