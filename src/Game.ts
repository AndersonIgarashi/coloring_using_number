import { sdk } from '@smoud/playable-sdk';
import { Howl, Howler } from 'howler';
import { config } from './config';
import { GameEvents } from './GameEvents';
import { ImagesResources, SoundResources } from './GameResources';
import { furTexture, glossTexture } from './cellTextures';

type Cell = {
  el: HTMLElement;
  color: number;
  filled: boolean;
};

export class Game {
  public isReady: boolean = false;
  public isFinished: boolean = false;
  public isWon: boolean = false;

  public cols: number;
  public rows: number;
  public cells: Cell[] = [];
  public currentColor: number = 1;
  public completedColors: Set<number> = new Set();

  private root: HTMLElement;
  private content: HTMLElement;
  private boardArea: HTMLElement;
  private boardHeader: HTMLElement;
  private fxLayer: HTMLElement;
  private confettiLayer: HTMLElement;
  private field: HTMLElement;
  private table: HTMLElement;
  private palette: HTMLElement;
  private paletteMarker: HTMLElement;
  // Palette width in button sizes (from the slot layout) — drives button sizing on resize
  private paletteUnits: number = 1;
  private bottomBar: HTMLElement;
  private bottomCta: HTMLElement;
  private tutorial: HTMLElement;
  private swatches: Map<number, HTMLElement> = new Map();
  private colorStyle: HTMLStyleElement;

  private sounds: Record<string, Howl> = {};
  private isPainting: boolean = false;
  private lastFillVibration: number = 0;
  private headerSpans: HTMLElement[] = [];
  private lastFillAt: number = -Infinity;
  private tutorialIdleTimer: number = 0;
  private filledCount: number = 0;
  private coloredTotal: number = 0;
  private remainingByColor: number[] = [];
  // Colours whose drop/wave is in flight — blocks double taps on the same colour
  private pendingColors: Set<number> = new Set();
  private waveAnims: Animation[] = [];
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  private winAt: number = 0;
  private pendingSize: [number, number] | null = null;

  constructor(width: number, height: number) {
    this.cols = config.game.pixels[0];
    this.rows = (config.game.pixels.length - 1) / this.cols;

    this.createSounds();
    this.createColorStyles();
    this.build();
    this.bindInput();

    this.applyResize(width, height);

    this.startEntrance();

    this.initRedirectToGameStoreRules();

    this.isReady = true;
  }

  public on(event: GameEvents, fn: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  public emit(event: GameEvents, ...args: any[]): void {
    for (const fn of this.listeners.get(event) || []) fn(...args);
  }

  private cellColorAt(row: number, col: number): number {
    return config.game.pixels[1 + row * this.cols + col];
  }

  // Staggered bouncy scale-in sweeping top-left -> bottom-right, then the tutorial.
  // The per-diagonal step is derived from a fixed sweep budget so big pictures
  // (e.g. 24x26) enter just as fast as small ones instead of dragging for seconds.
  private startEntrance(): void {
    const maxDiag = Math.max(1, this.rows - 1 + this.cols - 1);
    const step = config.timings.entranceSweepMs / maxDiag;
    const cellMs = config.timings.entranceCellMs;
    this.field.style.setProperty('--enter-ms', `${cellMs}ms`);

    this.cells.forEach((cell, i) => {
      const row = Math.floor(i / this.cols);
      const col = i % this.cols;
      cell.el.style.animationDelay = `${Math.round((row + col) * step)}ms`;
    });
    window.setTimeout(() => this.root.classList.add('board-enter'), config.timings.entranceStartDelay);

    const entranceTotal = config.timings.entranceStartDelay + config.timings.entranceSweepMs + cellMs;
    window.setTimeout(() => {
      // Drop the finished entrance animation so cells lose their transforms —
      // a kept transform makes each cell a stacking context, lifting the
      // sparkle overlay above the grey highlight and numbers
      this.root.classList.replace('board-enter', 'board-entered');
      for (const cell of this.cells) cell.el.style.animationDelay = '';
      if (config.tutorial.enabled && !this.isWon && !this.isPainting && !this.pendingColors.size) {
        this.showTutorial();
      }
    }, entranceTotal);
  }

  // Palette-dependent rules are generated at runtime
  private createColorStyles(): void {
    const rules: string[] = [];
    const tex = config.game.textures;
    const textureUrl: Record<number, string> = {};
    if (tex.enabled && config.game.cellMaterial === 'bevel') {
      const fur = furTexture(this.cols, this.rows, tex.furOrigin[0], tex.furOrigin[1]);
      const gloss = glossTexture(this.cols, this.rows);
      for (const n of tex.furColors) textureUrl[n] = fur;
      for (const n of tex.glossColors) textureUrl[n] = gloss;
    }
    config.game.palette.forEach(([hex], i) => {
      const n = i + 1;
      rules.push(`.field .cell-${n}.filled .fill-layer { opacity: 1 !important; background-color: ${hex} !important; }`);
      if (config.game.cellMaterial === 'bevel') {
        // Same block material as the outline: domed face + light top/left and
        // dark bottom/right bevel edges, in this colour's own shades
        const dome = `radial-gradient(circle at 35% 30%, ${mixHex(hex, '#ffffff', 0.12)} 0%, ${hex} 45%, ${mixHex(hex, '#000000', 0.1)} 100%)`;
        if (textureUrl[n]) {
          // Board-sized texture on top, offset per cell (--col/--row) so it runs
          // continuously across cells; blended into the dome + cell colour
          rules.push(
            `.field .cell-${n}.filled .fill-layer { background-image: url(${textureUrl[n]}), ${dome}; background-blend-mode: ${tex.blend}, normal; background-repeat: no-repeat; background-size: calc(var(--pitch) * ${this.cols}) calc(var(--pitch) * ${this.rows}), 100% 100%; background-position: calc(var(--pitch) * var(--col) * -1) calc(var(--pitch) * var(--row) * -1), 0 0; }`
          );
        } else {
          rules.push(`.field .cell-${n}.filled .fill-layer { background-image: ${dome}; }`);
        }
      }
      if (config.game.highlightSelectedCells) {
        rules.push(
          `.current-${n} .field .cell.cell-${n} { background: #ccc; transition: background-color 0.2s ease-in-out; }`
        );
        rules.push(`.current-${n} .field .cell.cell-${n}:not(.filled) .number { color: #000; }`);
        rules.push(`.current-${n} .field .cell.cell-${n} .cell-border { background: #ccc; }`);
      }
    });
    this.colorStyle = document.createElement('style');
    this.colorStyle.textContent = rules.join('\n');
    document.head.appendChild(this.colorStyle);
  }

  private createSounds(): void {
    for (const key in SoundResources) {
      this.sounds[key] = new Howl({ src: [SoundResources[key]], volume: config.sounds.volume });
    }
  }

  private build(): void {
    const g = config.game;

    this.root = el('div', `playable layout-reversed current-1 tutorial-1 material-${config.game.cellMaterial}`);

    const content = el('div', 'content');
    const boardArea = el('div', 'board-area');
    this.boardArea = boardArea;
    const boardColumn = el('div', 'board-column');

    const header = el('div', 'header');
    const headerText = document.createElement('span');
    headerText.textContent = g.headerText;
    header.appendChild(headerText);
    this.headerSpans.push(headerText);
    this.boardHeader = header;

    this.field = el('div', 'field');
    this.table = el('div', 'table');

    // Per-cell inline custom properties stop the browser from sharing computed
    // styles between cells, so they're only set when the textures need them
    const texturedCells = g.textures.enabled && g.cellMaterial === 'bevel';
    for (let row = 0; row < this.rows; row++) {
      const rowEl = el('div', 'row');
      for (let col = 0; col < this.cols; col++) {
        const color = this.cellColorAt(row, col);
        const cell = el('div', `cell cell-${color}`);
        if (texturedCells) {
          cell.style.setProperty('--col', String(col));
          cell.style.setProperty('--row', String(row));
        }
        const number = el('div', 'number');
        number.textContent = String(color);
        cell.appendChild(number);
        cell.appendChild(el('div', 'fill-layer'));
        cell.appendChild(el('div', 'cell-border'));
        rowEl.appendChild(cell);
        this.cells.push({ el: cell, color, filled: false });
        if (color > 0 && color <= g.palette.length) {
          this.coloredTotal++;
          this.remainingByColor[color] = (this.remainingByColor[color] || 0) + 1;
        }
      }
      this.table.appendChild(rowEl);
    }
    this.field.appendChild(this.table);

    boardColumn.appendChild(header);
    boardColumn.appendChild(this.field);
    boardArea.appendChild(boardColumn);
    content.appendChild(boardArea);

    const palette = el('div', 'palette');
    this.palette = palette;
    const swatchRow = el('div', 'swatch-row');
    const slots = paletteSlots(g.palette.length);
    this.paletteUnits = slots.width;
    palette.style.width = `calc(var(--button-size) * ${slots.width.toFixed(3)})`;
    palette.style.height = `calc(var(--button-size) * ${slots.height.toFixed(3)})`;
    g.palette.forEach(([hex, dark], i) => {
      const n = i + 1;
      const swatch = el('div', `swatch ${dark ? 'swatch-dark' : 'swatch-light'}`);
      setColorVars(swatch, hex);
      swatch.style.setProperty('--wave-i', String(i));
      swatch.style.left = `calc(var(--button-size) * ${slots.pos[i].x.toFixed(3)})`;
      swatch.style.top = `calc(var(--button-size) * ${slots.pos[i].y.toFixed(3)})`;
      const face = el('div', 'swatch-face');
      const number = el('span', 'swatch-number');
      number.textContent = String(n);
      face.appendChild(number);
      face.appendChild(el('div', 'swatch-check'));
      face.appendChild(el('div', 'swatch-shine'));
      swatch.appendChild(face);
      swatch.addEventListener('pointerdown', (e) => {
        if (e.isPrimary && e.button === 0) this.selectColor(n);
      });
      swatchRow.appendChild(swatch);
      this.swatches.set(n, swatch);
    });
    palette.appendChild(swatchRow);
    this.paletteMarker = el('div', 'palette-marker');
    const segment = 100 / g.palette.length;
    this.paletteMarker.style.width = `${segment * 0.52}%`;
    palette.appendChild(this.paletteMarker);
    content.appendChild(palette);
    this.moveMarkerTo(this.currentColor);

    const bottomBar = el('div', 'bottom-bar');
    this.bottomBar = bottomBar;
    const bottomHeader = el('div', 'header');
    const bottomHeaderText = document.createElement('span');
    bottomHeaderText.textContent = g.headerText;
    bottomHeader.appendChild(bottomHeaderText);
    this.headerSpans.push(bottomHeaderText);
    bottomBar.appendChild(bottomHeader);
    bottomBar.appendChild(this.createLogo());
    this.bottomCta = this.createCta(g.ctaGameplayText);
    bottomBar.appendChild(this.bottomCta);
    content.appendChild(bottomBar);

    this.content = content;
    this.root.appendChild(content);

    this.confettiLayer = el('div', 'confetti');
    this.root.appendChild(this.confettiLayer);

    this.fxLayer = el('div', 'fx-layer');
    this.root.appendChild(this.fxLayer);

    // Endcard: game logo on top and a "Next Level" button a hand keeps
    // pressing on a transparent overlay.
    const endcard = el('div', 'endcard');
    endcard.appendChild(this.createLogo());
    const nextBtnWrap = el('div', 'next-btn-wrap');
    const nextBtn = el('div', 'cta next-btn');
    nextBtn.textContent = g.ctaEndcardText;
    nextBtnWrap.appendChild(nextBtn);
    const pressHand = document.createElement('img');
    pressHand.className = 'press-hand';
    pressHand.src = ImagesResources.pointer;
    nextBtnWrap.appendChild(pressHand);
    endcard.appendChild(nextBtnWrap);
    endcard.addEventListener('pointerdown', () => {
      if (this.isFinished) sdk.install();
    });
    this.root.appendChild(endcard);

    document.body.appendChild(this.root);
  }

  private createLogo(): HTMLElement {
    const wrap = el('div', 'logo-wrap');
    const img = document.createElement('img');
    img.className = 'logo';
    img.src = ImagesResources.logo;
    wrap.appendChild(img);
    return wrap;
  }

  private createCta(text: string): HTMLElement {
    const cta = el('div', 'cta');
    cta.textContent = text;
    cta.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      sdk.install();
    });
    return cta;
  }

  // In 'group' mode only the palette buttons paint (see the swatch listeners in build)
  private bindInput(): void {
    if (config.game.paintMode === 'drag') this.bindDragInput();
  }

  // Brush painting, used when config.game.paintMode = 'drag'.
  private bindDragInput(): void {
    let boardRect: DOMRect | null = null;

    // Pointer -> cell by arithmetic on the table rect (cached per stroke):
    // document.elementFromPoint forced a hit-test plus a DOM search on every
    // touchmove, which is what janks low-end phones during a swipe.
    // animate=false skips the squash pop: drag-fills land under the moving
    // finger where the pop is invisible, and per-fill animation churn was the
    // single biggest frame-time cost during swipes on low-end devices.
    const paint = (x: number, y: number, animate: boolean): boolean => {
      if (this.isWon || !boardRect || !boardRect.width || !boardRect.height) return false;
      const nx = (x - boardRect.left) / boardRect.width;
      const ny = (y - boardRect.top) / boardRect.height;
      if (nx < 0 || nx >= 1 || ny < 0 || ny >= 1) return false;
      const row = Math.floor(ny * this.rows);
      const col = Math.floor(nx * this.cols);

      // Bigger brush: fill every unfilled current-colour cell within brushRadius
      // of the pointer, so a single tap/swipe covers a small area (easier fill).
      const color = this.currentColor;
      const r = config.game.brushRadius;
      let filled = 0;
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          const rr = row + dr;
          const cc = col + dc;
          if (rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) continue;
          const cell = this.cells[rr * this.cols + cc];
          if (cell.color === color && !cell.filled) {
            if (!animate) cell.el.classList.add('no-pop');
            this.fillCell(cell);
            filled++;
          }
        }
      }
      if (filled > 0) this.playFillNote();
      return true;
    };

    const onDown = (x: number, y: number) => {
      boardRect = this.table.getBoundingClientRect();
      this.isPainting = true;
      this.onInteraction();
      if (paint(x, y, true)) this.emit(GameEvents.PaintTap);
    };
    const onMove = (x: number, y: number) => {
      if (!this.isPainting) return;
      paint(x, y, false);
    };
    const onUp = () => {
      if (!this.isPainting) return;
      this.isPainting = false;
      this.restartTutorialIdleTimer();
    };

    this.root.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
    this.root.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onUp);
    // Non-passive with preventDefault: the browser must not turn a paint swipe
    // into a pan/scroll gesture (that fires touchcancel and interrupts painting)
    this.root.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false }
    );
    this.root.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false }
    );
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
  }

  private onInteraction(): void {
    // Unlock audio on touchstart: Howler's own unlock waits for a touchend or
    // click on the document, which some ad-network wrappers swallow (overlays,
    // gesture interception, touchcancel) — leaving the AudioContext suspended
    // and every sound silent for the whole session.
    if (Howler.ctx && Howler.ctx.state !== 'running') {
      Howler.ctx.resume();
    }
    this.clearTutorialIdleTimer();
    this.hideTutorial();
    this.emit(GameEvents.AnyInteraction);
  }

  public selectColor(n: number): void {
    if (config.game.paintMode === 'group') {
      this.paintColorGroup(n);
      return;
    }
    if (this.isWon || n < 1 || n > config.game.palette.length || this.completedColors.has(n)) return;
    this.sounds.selectSfx.play();
    this.setCurrentColor(n);
  }

  private paintColorGroup(n: number): void {
    if (this.isWon || n <= 0 || n > config.game.palette.length || !this.remainingByColor[n] || this.completedColors.has(n)) return;
    if (this.pendingColors.has(n)) return;
    this.pendingColors.add(n);
    this.onInteraction();
    this.setCurrentColor(n);
    this.sounds.selectSfx.play();
    this.emit(GameEvents.PaintTap);
    this.pressSwatch(n);
    this.emptySwatch(n);
    const origin = this.waveOrigin(n);
    this.launchDrop(n, origin, () => this.paintWave(n, origin));
    this.restartTutorialIdleTimer();
  }

  // The paint has left the button: it fades to grey (the colour variables are
  // registered with @property, so the swap transitions) and stops idling
  private emptySwatch(n: number): void {
    const swatch = this.swatches.get(n);
    if (!swatch || swatch.classList.contains('empty')) return;
    swatch.classList.add('empty');
    setColorVars(swatch, config.game.emptySwatchColor);
  }

  private pressSwatch(n: number): void {
    const swatch = this.swatches.get(n);
    if (!swatch) return;
    swatch.classList.remove('launch');
    void swatch.offsetWidth;
    swatch.classList.add('launch');
    window.setTimeout(() => swatch.classList.remove('launch'), 420);
  }

  // Where the drop lands: the unpainted cell of this colour closest to the
  // colour's centroid (scattered colours like highlights still land on-colour)
  private waveOrigin(n: number): number {
    let sr = 0;
    let sc = 0;
    let count = 0;
    this.cells.forEach((cell, i) => {
      if (cell.color !== n || cell.filled) return;
      sr += Math.floor(i / this.cols);
      sc += i % this.cols;
      count++;
    });
    sr /= count;
    sc /= count;
    let best = -1;
    let bestD = Infinity;
    this.cells.forEach((cell, i) => {
      if (cell.color !== n || cell.filled) return;
      const d = Math.hypot(Math.floor(i / this.cols) - sr, (i % this.cols) - sc);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private launchDrop(n: number, targetIndex: number, onLand: () => void): void {
    const hex = config.game.palette[n - 1][0];
    const face = this.swatches.get(n)!.querySelector('.swatch-face') as HTMLElement;
    const from = face.getBoundingClientRect();
    const to = this.cells[targetIndex].el.getBoundingClientRect();
    const sx = from.left + from.width / 2;
    const sy = from.top + from.height / 2;
    const ex = to.left + to.width / 2;
    const ey = to.top + to.height / 2;
    const size = Math.max(18, from.width * 0.62);
    const dist = Math.max(1, Math.hypot(ex - sx, ey - sy));
    // Quadratic arc whose control point sits above both ends -> a jump, not a slide
    const cx = (sx + ex) / 2;
    const cy = Math.min(sy, ey) - Math.max(50, dist * 0.35);
    const endScale = Math.min(1, (to.width * 1.2) / size);

    const drop = el('div', 'drop');
    const body = el('div', 'drop-body');
    drop.appendChild(body);
    setColorVars(drop, hex);
    drop.style.width = drop.style.height = `${size}px`;
    drop.style.left = drop.style.top = `${-size / 2}px`;
    this.fxLayer.appendChild(drop);

    const moveFrames: Keyframe[] = [];
    const bodyFrames: Keyframe[] = [];
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      const x = u * u * sx + 2 * u * t * cx + t * t * ex;
      const y = u * u * sy + 2 * u * t * cy + t * t * ey;
      const dx = 2 * u * (cx - sx) + 2 * t * (ex - cx);
      const dy = 2 * u * (cy - sy) + 2 * t * (ey - cy);
      const grow = t < 0.14 ? 0.35 + 0.65 * (t / 0.14) : 1;
      const s = grow * (1 + (endScale - 1) * t * t);
      // Stretch along the velocity: long and thin when fast, round at the apex
      const stretch = Math.min(1.55, 1 + 0.28 * (Math.hypot(dx, dy) / dist));
      moveFrames.push({ transform: `translate(${x}px, ${y}px) scale(${s})`, offset: t });
      bodyFrames.push({ transform: `rotate(${Math.atan2(dy, dx)}rad) scale(${stretch}, ${1 / stretch})`, offset: t });
    }
    const timing: KeyframeAnimationOptions = {
      duration: config.timings.dropMs,
      easing: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
      fill: 'forwards'
    };
    body.animate(bodyFrames, timing);
    const move = drop.animate(moveFrames, timing);
    move.onfinish = () => {
      drop.remove();
      this.splash(ex, ey, hex, to.width);
      onLand();
    };
  }

  // Landing splat: a ring punches out and a few droplets spray radially
  private splash(x: number, y: number, hex: string, cellPx: number): void {
    const ringSize = cellPx * 1.3;
    const ring = el('div', 'splash-ring');
    setColorVars(ring, hex);
    ring.style.cssText += `width:${ringSize}px;height:${ringSize}px;left:${x - ringSize / 2}px;top:${y - ringSize / 2}px;`;
    this.fxLayer.appendChild(ring);
    ring.animate(
      [
        { transform: 'scale(0.3)', opacity: 1 },
        { transform: 'scale(3.4)', opacity: 0 }
      ],
      { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
    ).onfinish = () => ring.remove();

    const count = 9;
    for (let i = 0; i < count; i++) {
      const dot = el('div', 'splash-dot');
      setColorVars(dot, hex);
      const d = cellPx * (0.3 + Math.random() * 0.22);
      dot.style.cssText += `width:${d}px;height:${d}px;left:${x - d / 2}px;top:${y - d / 2}px;`;
      this.fxLayer.appendChild(dot);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = cellPx * (1.6 + Math.random() * 1.4);
      const tx = Math.cos(a) * r;
      const ty = Math.sin(a) * r;
      dot.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: `translate(${tx * 0.8}px, ${ty * 0.8 - cellPx * 0.4}px) scale(0.85)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${tx}px, ${ty + cellPx * 0.3}px) scale(0.2)`, opacity: 0 }
        ],
        { duration: 480 + Math.random() * 120, easing: 'cubic-bezier(0.15, 0.6, 0.35, 1)' }
      ).onfinish = () => dot.remove();
    }
  }

  // Radial wave from the landing cell: every visible cell rises as the front
  // passes (a ripple across the whole picture); cells of this colour rise
  // highest and get painted on the crest, in a chain outward from the centre.
  private paintWave(n: number, originIndex: number): void {
    const step = config.timings.waveStepMs;
    const liftMs = config.timings.waveLiftMs;
    const lead = liftMs * 0.35;
    const or = Math.floor(originIndex / this.cols);
    const oc = originIndex % this.cols;
    const originRect = this.cells[originIndex].el.getBoundingClientRect();
    const cs = originRect.width;

    let maxD = 0;
    const entries: { cell: Cell; d: number; paints: boolean }[] = [];
    this.cells.forEach((cell, i) => {
      if (cell.color === 0) return;
      const d = Math.hypot(Math.floor(i / this.cols) - or, (i % this.cols) - oc);
      maxD = Math.max(maxD, d);
      entries.push({ cell, d, paints: cell.color === n && !cell.filled });
    });

    const fills: { cell: Cell; at: number }[] = [];
    for (const { cell, d, paints } of entries) {
      const amp = paints ? 1 : 0.45 * Math.max(0.3, 1 - d / (maxD + 1));
      const delay = Math.max(0, d * step - lead);
      const sc = 1 + 0.32 * amp;
      const ty = -cs * 0.16 * amp;
      const anim = cell.el.animate(
        [
          { transform: 'translateY(0px) scale(1)', easing: 'ease-out' },
          { transform: `translateY(${ty}px) scale(${sc})`, offset: 0.35, easing: 'ease-in-out' },
          { transform: `translateY(${-ty * 0.2}px) scale(${1 - 0.07 * amp})`, offset: 0.7, easing: 'ease-out' },
          { transform: 'translateY(0px) scale(1)' }
        ].map((k, i) => (paints ? { ...k, zIndex: i === 1 ? 5 : 4 } : k)),
        { duration: liftMs, delay }
      );
      this.waveAnims.push(anim);
      anim.onfinish = () => {
        const k = this.waveAnims.indexOf(anim);
        if (k >= 0) this.waveAnims.splice(k, 1);
      };
      if (paints) fills.push({ cell, at: delay + lead * 0.6 });
    }
    fills.sort((a, b) => a.at - b.at);

    this.spawnWaveRing(n, originRect, (maxD + 1.5) * cs, (maxD + 1.5) * step);

    const start = performance.now();
    let idx = 0;
    const tick = () => {
      const t = performance.now() - start;
      let painted = 0;
      while (idx < fills.length && fills[idx].at <= t) {
        this.fillCell(fills[idx].cell);
        idx++;
        painted++;
      }
      // Rising pitch as the chain spreads outward
      if (painted) this.playFillNote(1 + 0.55 * (idx / fills.length));
      if (idx < fills.length) requestAnimationFrame(tick);
      else this.pendingColors.delete(n);
    };
    requestAnimationFrame(tick);
  }

  // Soft coloured ring expanding with the wave front. Lives in the full-screen
  // fx layer (not clipped to the board) so it rolls past the picture's edges
  // and fades out in open space.
  private spawnWaveRing(n: number, originRect: DOMRect, frontRadius: number, frontMs: number): void {
    const duration = frontMs + config.timings.waveFadeMs;
    // Same speed as the wave the whole way; it just runs a little past the last cell
    const radius = frontRadius * (duration / frontMs);
    const ring = el('div', 'wave-ring');
    const { r, g, b } = hexToRgb(config.game.palette[n - 1][0]);
    ring.style.setProperty('--ring', `rgba(${r}, ${g}, ${b}, 0.55)`);
    const x = originRect.left + originRect.width / 2;
    const y = originRect.top + originRect.height / 2;
    ring.style.cssText += `width:${radius * 2}px;height:${radius * 2}px;left:${x - radius}px;top:${y - radius}px;`;
    this.fxLayer.appendChild(ring);
    ring.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration, easing: 'linear', fill: 'forwards' });
    // Soft transparency fade over the second half of its life
    ring.animate(
      [
        { opacity: 1 },
        { opacity: 0.9, offset: 0.4, easing: 'cubic-bezier(0.3, 0, 0.35, 1)' },
        { opacity: 0 }
      ],
      { duration, fill: 'forwards' }
    ).onfinish = () => ring.remove();
  }

  private setCurrentColor(n: number): void {
    this.root.classList.remove(`current-${this.currentColor}`, `tutorial-${this.currentColor}`);
    this.currentColor = n;
    this.root.classList.add(`current-${n}`, `tutorial-${n}`);
    const selected = this.swatches.get(n)!;
    for (const [, swatch] of this.swatches) swatch.classList.remove('selected');
    selected.classList.add('selected');
    this.moveMarkerTo(n);
  }

  private moveMarkerTo(n: number): void {
    if (this.completedColors.has(n)) {
      this.paletteMarker.style.opacity = '0';
      return;
    }
    this.paletteMarker.style.opacity = '1';
    const segment = 100 / config.game.palette.length;
    this.paletteMarker.style.left = `${(n - 0.5) * segment}%`;
  }

  private fillCell(cell: Cell): void {
    if (cell.color < 1 || cell.color > config.game.palette.length || cell.filled) return;
    cell.filled = true;
    cell.el.classList.add('filled');
    this.filledCount++;
    this.remainingByColor[cell.color]--;
    const now = performance.now();
    if (now - this.lastFillVibration >= config.haptics.fillThrottle) {
      this.lastFillVibration = now;
      this.vibrate(config.haptics.fill);
    }
    this.emit(GameEvents.CellFill, cell);

    if (this.remainingByColor[cell.color] === 0) this.completeColor(cell.color);
  }

  private playFillNote(rate: number = 1): void {
    const now = performance.now();
    if (now - this.lastFillAt < config.sounds.noteMinGap) return;
    this.lastFillAt = now;
    const id = this.sounds.fillSfx.play();
    if (rate !== 1) this.sounds.fillSfx.rate(rate, id);
  }

  // Android webviews only — iOS ignores navigator.vibrate, silently a no-op there
  private vibrate(pattern: number | number[]): void {
    if (!config.haptics.enabled) return;
    let result: boolean | string;
    try {
      result = navigator.vibrate ? navigator.vibrate(pattern) : 'no API';
    } catch (e) {
      result = 'threw';
    }
    if (__DEV__) this.updateHapticsDebug(pattern, result);
  }

  private hapticsDebugEl?: HTMLElement;
  private hapticsCallCount: number = 0;

  private updateHapticsDebug(pattern: number | number[], result: boolean | string): void {
    if (!this.hapticsDebugEl) {
      this.hapticsDebugEl = el('div', '');
      this.hapticsDebugEl.style.cssText =
        'position:fixed;left:4px;bottom:4px;z-index:9999;background:#000c;color:#0f0;' +
        'font:11px monospace;padding:4px 8px;border-radius:6px;pointer-events:none;';
      document.body.appendChild(this.hapticsDebugEl);
    }
    this.hapticsCallCount++;
    this.hapticsDebugEl.textContent = `haptics #${this.hapticsCallCount} vibrate(${JSON.stringify(pattern)}) -> ${result}`;
  }

  private completeColor(n: number): void {
    this.completedColors.add(n);
    this.root.classList.add(`color-${n}`);
    this.emptySwatch(n);
    this.swatches.get(n)!.classList.add('filled');
    if (n === this.currentColor) this.moveMarkerTo(n);
    this.sounds.colorCompleteSfx.play();
    this.vibrate(config.haptics.colorComplete);
    this.emit(GameEvents.ColorComplete, n);

    if (this.completedColors.size === config.game.palette.length) {
      this.win();
      return;
    }

    if (config.game.paintMode === 'group') return;

    let next = 0;
    for (let i = 1; i <= config.game.palette.length; i++) {
      if (!this.completedColors.has(i) && this.remainingByColor[i] > 0) {
        next = i;
        break;
      }
    }
    if (next) window.setTimeout(() => this.setCurrentColor(next), config.timings.colorAdvanceDelay);
  }

  // Confetti and ripple, then the painted board exits and the endcard appears.
  private win(): void {
    this.isWon = true;
    this.winAt = performance.now();
    this.clearTutorialIdleTimer();
    this.hideTutorial();
    this.root.classList.add('win');
    this.playCompletionRipple();
    this.spawnConfetti();
    this.sounds.winSfx.play();
    this.vibrate(config.haptics.win);
    this.emit(GameEvents.GameComplete);

    window.setTimeout(() => {
      for (const anim of this.waveAnims.splice(0)) anim.cancel();
      this.root.classList.add('ui-fade', 'board-out');
      this.cells.forEach((cell, i) => {
        const row = Math.floor(i / this.cols);
        const col = i % this.cols;
        cell.el.style.animationDelay = `${(row + col) * 55}ms`;
      });
    }, config.timings.boardOutDelay);

    // Hard-hide the painted board once the exit sweep is over: the sweep relies
    // on animation-fill-mode holding scale(0) on every cell, which some
    // webviews/browsers drop (throttled or skipped animations) — leaving the
    // finished painting visible behind the endcard. visibility does not depend
    // on animations, so this guarantees the final state everywhere.
    const exitSweepEnd = config.timings.boardOutDelay + (this.rows - 1 + this.cols - 1) * 55 + 400;
    window.setTimeout(() => this.root.classList.add('board-gone'), exitSweepEnd);

    window.setTimeout(() => this.finish(), config.timings.endcardDelay);
  }

  // Celebratory pulse: a jiggle wave rolls across the picture from the top-left corner
  private playCompletionRipple(): void {
    this.cells.forEach((cell, i) => {
      if (cell.color === 0) return;
      const row = Math.floor(i / this.cols);
      const col = i % this.cols;
      cell.el.style.animationDelay = `${Math.sqrt(row * row + col * col) * 22}ms`;
      cell.el.classList.add('jiggle');
    });
  }

  // Confetti rain: every piece falls with a sideways sway and fades out near
  // the bottom, spinning over its lifetime at its own speed and direction.
  // Flat pieces also tumble (scaleX flip) like paper.
  private spawnConfetti(): void {
    const c = config.confetti;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const unit = Math.min(w, h) / 100;
    const shapes = ['rect', 'rect', 'rect', 'square', 'circle', 'triangle', 'star', 'squiggle'];
    const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

    for (let i = 0; i < c.count; i++) {
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const piece = el('div', `confetti-piece confetti-${shape}`);
      // A third of the pieces are smaller and slower: a far layer behind the rest
      const depth = Math.random() < 0.35 ? 0.65 : 1;
      const size = unit * (2.2 + Math.random() * 1.6) * depth;
      piece.style.setProperty('--size', `${size.toFixed(1)}px`);
      piece.style.setProperty('--c', c.colors[Math.floor(Math.random() * c.colors.length)]);
      this.confettiLayer.appendChild(piece);

      const fall = between(c.fallMs) / depth;
      const spin = between(c.spin) * (Math.random() < 0.5 ? -1 : 1);
      const tumbles = shape === 'rect' || shape === 'square' ? 1 + Math.random() * 2.5 : 0;
      const x0 = Math.random() * w;
      const drift = (Math.random() - 0.5) * w * 0.25;
      const sway = unit * (2 + Math.random() * 6);
      const swayTurns = 0.6 + Math.random() * 1.2;
      const phase = Math.random() * Math.PI * 2;
      const y0 = -size * 2 - Math.random() * h * 0.2;
      const y1 = h + size * 2;
      const r0 = Math.random() * 360;

      const frames: Keyframe[] = [];
      const steps = 16;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const x = x0 + drift * t + Math.sin(phase + t * swayTurns * Math.PI * 2) * sway;
        // Starts slow and picks up speed, like it was tossed up first
        const y = y0 + (y1 - y0) * t * (0.35 + 0.65 * t);
        const rotation = r0 + spin * (fall / 1000) * t;
        const flip = tumbles ? Math.cos(t * tumbles * Math.PI * 2) : 1;
        frames.push({
          transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rotation.toFixed(1)}deg) scaleX(${flip.toFixed(3)}) translate(-50%, -50%)`,
          opacity: t > 0.8 ? (1 - t) / 0.2 : 1,
          offset: t
        });
      }
      piece.animate(frames, { duration: fall, delay: Math.random() * c.spawnWindowMs, fill: 'both' }).onfinish = () =>
        piece.remove();
    }
  }


  // Stationary tap hint: over the next colour button in 'group' mode, on a cell
  // of the selected colour in 'drag' mode.
  private showTutorial(): void {
    this.hideTutorial();
    const tutorial = el('div', 'tutorial');
    tutorial.appendChild(el('div', 'tutorial-part hand'));
    if (config.game.paintMode === 'group') {
      const swatch = this.swatches.get(this.nextColorToPaint());
      if (!swatch) return;
      tutorial.classList.add('tutorial-swatch');
      tutorial.style.left = swatch.style.left;
      tutorial.style.top = swatch.style.top;
      swatch.parentElement!.appendChild(tutorial);
      if (tutorial.firstElementChild!.getBoundingClientRect().right > window.innerWidth) {
        tutorial.classList.add('mirrored');
      }
    } else {
      const target = this.cells.find((c) => c.color === this.currentColor && !c.filled);
      if (!target) return;
      target.el.appendChild(tutorial);
    }
    this.tutorial = tutorial;
  }

  // Colours are suggested in order: the lowest number not painted or in flight
  private nextColorToPaint(): number {
    for (let n = 1; n <= config.game.palette.length; n++) {
      if (!this.completedColors.has(n) && !this.pendingColors.has(n) && this.remainingByColor[n] > 0) return n;
    }
    return 0;
  }

  private hideTutorial(): void {
    if (this.tutorial) {
      this.tutorial.remove();
      this.tutorial = undefined!;
    }
  }

  private restartTutorialIdleTimer(): void {
    if (!config.tutorial.enabled || this.isWon) return;
    this.clearTutorialIdleTimer();
    this.tutorialIdleTimer = window.setTimeout(() => this.showTutorial(), config.timings.tutorialIdleTime);
  }

  private clearTutorialIdleTimer(): void {
    window.clearTimeout(this.tutorialIdleTimer);
  }

  private redirectActive: boolean = false;
  private storeTriggered: boolean = false;

  // config.directToStore picks the goal event + count, and goalAction decides
  // whether hitting the goal opens the store immediately ('store', keeps
  // playing) or shows the end card ('endCard').
  private initRedirectToGameStoreRules(): void {
    let noInteractionTimeout: number;
    const ds = config.directToStore;

    const onInteract = () => {
      window.clearTimeout(noInteractionTimeout);
      noInteractionTimeout = window.setTimeout(this.goToStore, ds.noInteractionPlaytime * 1000);
    };

    if (ds.transferToStoreAfterEvents.amount > 0) {
      let eventsCounter = 0;
      this.on(ds.transferToStoreAfterEvents.name as GameEvents, () => {
        eventsCounter++;
        if (eventsCounter >= ds.transferToStoreAfterEvents.amount) this.goToStore();
      });
    }

    if (ds.noInteractionPlaytime) {
      this.on(GameEvents.AnyInteraction, onInteract);
      onInteract();
    }
  }

  // One-shot: the event counter keeps firing on later events, so guard it.
  private goToStore = (): void => {
    if (this.storeTriggered) return;
    this.storeTriggered = true;

    if (config.directToStore.goalAction === 'store') {
      sdk.install();
      this.armTapToStore();
    } else {
      this.enterRedirectMode();
    }
  };

  private armTapToStore(): void {
    if (this.redirectActive) return;
    this.redirectActive = true;
    sdk.on('interaction', () => sdk.install());
  }

  private enterRedirectMode(): void {
    this.emit(GameEvents.RedirectMode);
    this.armTapToStore();
    // When the goal is the finished picture, the win cinematic (board-out ->
    // end card) is already driving finish(); don't preempt
    // it. Only force the end card now for an idle bailout on a partial board.
    if (!this.isWon) this.finish();
  }

  public finish(): void {
    if (this.isFinished === true) return;
    this.isFinished = true;

    this.clearTutorialIdleTimer();
    this.hideTutorial();

    // The win cinematic end card only makes
    // sense once the picture is finished. Any other finish — the idle bailout or
    // a 'store'-goal redirect on a partial board — just ends the ad and arms
    // tap-to-store, without the misleading endcard.
    // Opening the store at the goal finishes the ad right away (the SDK ends it
    // before installing), so the end card still waits for its beat in the
    // cinematic instead of covering the board mid-celebration.
    if (this.isWon) {
      const wait = Math.max(0, this.winAt + config.timings.endcardDelay - performance.now());
      window.setTimeout(() => {
        this.root.classList.add('endcard-shown');
        this.onEndCardShown();
      }, wait);
    }

    sdk.finish();
  }

  // In 'endCard' mode the store auto-opens endCardAutoStoreMs after the end card
  // appears (on top of the tap-to-store armed in enterRedirectMode).
  private onEndCardShown(): void {
    const delay = config.directToStore.endCardAutoStoreMs;
    if (delay > 0) window.setTimeout(() => sdk.install(), delay);
  }

  // Window resizes can arrive several times per frame (e.g. dragging the
  // devtools edge); each one forces style + layout on ~2k nodes, so only the
  // latest size is applied, once per frame
  public resize(width: number, height: number): void {
    const scheduled = this.pendingSize !== null;
    this.pendingSize = [width, height];
    if (scheduled) return;
    requestAnimationFrame(() => {
      const [w, h] = this.pendingSize!;
      this.pendingSize = null;
      this.applyResize(w, h);
    });
  }

  private applyResize(width: number, height: number): void {
    const landscape = width > height;
    this.root.classList.toggle('landscape', landscape);
    this.root.classList.toggle('compact', landscape ? width / height < 1.5 : height / width < 1.5);

    // In landscape the palette moves into the bottom bar, forming the right-side info column
    this.root.classList.toggle('layout-reversed', !landscape);
    this.bottomBar.classList.toggle('info-column', landscape);
    if (landscape) {
      this.bottomBar.insertBefore(this.palette, this.bottomCta);
    } else if (this.palette.parentElement !== this.content) {
      this.content.insertBefore(this.palette, this.bottomBar);
    }

    // Buttons scale with the screen: as big as the row fits across the
    // available width, capped by the screen height
    const rootStyle = getComputedStyle(this.root);
    const padX = parseFloat(rootStyle.paddingLeft || '0') + parseFloat(rootStyle.paddingRight || '0');
    const paletteW = (landscape ? width * 0.38 : width - padX) * 0.96;
    const maxBtn = height * (landscape ? 0.14 : 0.085);
    const btn = Math.max(24, Math.min(paletteW / this.paletteUnits, maxBtn));
    this.setVar(this.palette, '--button-size', `${btn.toFixed(1)}px`);

    const style = getComputedStyle(this.field);
    const fieldWidth = this.field.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
    const availableW = landscape ? Math.min(fieldWidth, height * 0.8) : fieldWidth;
    let availableH = this.boardArea.clientHeight - 4;
    if (this.boardHeader.offsetHeight > 0) {
      const hs = getComputedStyle(this.boardHeader);
      availableH -= this.boardHeader.offsetHeight + parseFloat(hs.marginTop || '0') + parseFloat(hs.marginBottom || '0');
    }
    // Cells overlap by 1px (negative margins), so n cells span n * size - (n - 1)
    const fit = (avail: number, n: number) => Math.floor((avail + n - 1) / n);
    let cellSize = fit(availableW, this.cols);
    if (availableH > 0) cellSize = Math.min(cellSize, fit(availableH, this.rows));
    this.setVar(this.field, '--cell-size', `${Math.max(4, cellSize)}px`);
  }

  // Rewriting an unchanged custom property still restyles the whole subtree
  private setVar(target: HTMLElement, name: string, value: string): void {
    if (target.style.getPropertyValue(name) !== value) target.style.setProperty(name, value);
  }

  public pause(): void {
    for (const key in this.sounds) this.sounds[key].mute(true);
  }

  public resume(): void {
    for (const key in this.sounds) this.sounds[key].mute(false);
  }

  public volume(value: number): void {
    for (const key in this.sounds) this.sounds[key].volume(value);
  }

  public destroy(): void {
    this.clearTutorialIdleTimer();
    this.root.remove();
    this.colorStyle.remove();
  }
}

// Button slots, numbered 1..N. Units are button sizes; pos is each button's
// top-left corner. 'arc': a single row, left to right, with the middle raised
// (a gentle parabola); 'ring': a regular polygon, first at the top, clockwise.
function paletteSlots(count: number): { pos: { x: number; y: number }[]; width: number; height: number } {
  if (config.game.paletteLayout === 'arc') {
    const { gap, bow } = config.game.paletteArc;
    const step = 1 + gap;
    const half = ((count - 1) * step) / 2;
    const pos: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const x = i * step;
      const t = half > 0 ? (x - half) / half : 0;
      // bow > 0: middle raised (ends lower); bow < 0: middle lowered (ends raised)
      pos.push({ x, y: bow >= 0 ? bow * t * t : -bow * (1 - t * t) });
    }
    // + the 3D base depth under the buttons
    return { pos, width: (count - 1) * step + 1, height: (count > 1 ? Math.abs(bow) : 0) + 1 + 0.2 };
  }
  const radius = 1.04;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const a = ((-90 + (360 / count) * i) * Math.PI) / 180;
    pts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxX = Math.max(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  return {
    pos: pts.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    width: maxX - minX + 1,
    // + the 3D base depth under the bottom buttons
    height: maxY - minY + 1 + 0.2
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function mixHex(hex: string, withHex: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  const m = (x: number, y: number) =>
    Math.round(x + (y - x) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${m(a.r, b.r)}${m(a.g, b.g)}${m(a.b, b.b)}`;
}

// Shades used by the glossy buttons and the paint drop
function setColorVars(target: HTMLElement, hex: string): void {
  target.style.setProperty('--c', hex);
  target.style.setProperty('--c-hi', mixHex(hex, '#ffffff', 0.5));
  target.style.setProperty('--c-lo', mixHex(hex, '#000000', 0.22));
  target.style.setProperty('--c-side', mixHex(hex, '#000000', 0.48));
  // Button outline: the button's own colour, slightly darker
  target.style.setProperty('--c-rim', mixHex(hex, '#000000', 0.18));
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
