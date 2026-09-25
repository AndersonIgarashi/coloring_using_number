// Pixel grid: first value = columns; 0 = empty, 1-6 = paintable colors (6 = black outline)
// prettier-ignore
const pixels = [
  21,
  0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,
  0,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,0,
  0,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,0,
  0,6,6,6,6,6,0,0,0,0,0,0,0,0,0,6,6,6,6,6,0,
  0,0,6,6,6,6,6,0,0,0,0,0,0,0,6,6,6,6,6,0,0,
  0,0,6,1,1,2,6,0,0,0,0,0,0,0,6,2,1,1,6,0,0,
  0,0,6,1,1,1,2,6,0,0,0,0,0,6,2,1,1,1,6,0,0,
  0,0,0,6,1,1,1,2,6,0,0,0,6,2,1,1,1,6,0,0,0,
  0,0,0,6,1,1,1,2,6,0,0,0,6,2,1,1,1,6,0,0,0,
  0,0,0,0,6,1,1,1,2,6,6,6,2,1,1,1,6,0,0,0,0,
  0,0,0,6,1,1,1,1,1,1,1,1,1,1,1,1,1,6,0,0,0,
  0,0,6,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,6,0,0,
  0,6,1,1,1,6,6,1,1,1,1,1,1,1,6,6,1,1,1,6,0,
  6,1,1,1,6,5,6,6,1,1,1,1,1,6,5,6,6,1,1,1,6,
  6,1,1,1,6,6,6,6,1,1,1,1,1,6,6,6,6,1,1,1,6,
  6,1,1,1,6,6,6,6,1,1,1,1,1,6,6,6,6,1,1,1,6,
  6,1,1,1,1,6,6,1,1,1,6,1,1,1,6,6,1,1,1,1,6,
  6,1,3,3,1,1,1,1,1,6,1,6,1,1,1,1,1,3,3,1,6,
  6,3,3,3,3,1,1,1,6,4,4,4,6,1,1,1,3,3,3,3,6,
  6,3,3,3,3,1,1,1,6,3,3,3,6,1,1,1,3,3,3,3,6,
  0,6,3,3,1,1,1,1,1,6,6,6,1,1,1,1,1,3,3,6,0,
  0,0,6,2,2,1,1,1,1,1,1,1,1,1,1,1,2,2,6,0,0,
  0,0,0,6,6,2,2,2,2,2,2,2,2,2,2,2,6,6,0,0,0,
  0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0
];

// [hex color, darkColor flag] — dark colors get white text and a white checkmark
// 1 = yellow fur, 2 = amber shading, 3 = cheeks and tongue, 4 = mouth, 5 = eye highlights,
// 6 = black outline, eyes and ear tips. Every colour of the artwork gets its own button.
const palette: [string, number][] = [
  ['#ffd43b', 0],
  ['#f59f1c', 0],
  ['#ef3b36', 1],
  ['#8a1c2b', 1],
  ['#ffffff', 0],
  ['#1e1b2e', 1]
];

export const config = {
  game: {
    pixels,
    palette,
    headerText: 'Tap to Color',
    // Set to 'drag' to restore brush painting and palette selection.
    paintMode: 'group' as 'group' | 'drag',
    // Restore the gray hint on cells of the selected color.
    highlightSelectedCells: false,
    // Painted cell look: 'flat' = plain flat colour,
    // 'bevel' = bevelled blocks (+ textures below), 'sparkle' = glitter overlay.
    cellMaterial: 'flat' as 'flat' | 'bevel' | 'sparkle',
    // Button arrangement: 'arc' = one row bowing gently upwards (fits any
    // number of colours), 'ring' = the earlier circle, clockwise from the top.
    paletteLayout: 'arc' as 'arc' | 'ring',
    paletteArc: {
      // Space between buttons, in button sizes
      gap: 0.2,
      // How much higher the middle sits than the ends, in button sizes
      // (negative = the middle sits lower, ends curving up)
      bow: -0.32
    },
    // Surface texture blended over painted cells — only used with
    // cellMaterial 'bevel' (generated in code, see cellTextures.ts).
    textures: {
      enabled: false,
      // The textures are centred on mid-grey: 'overlay' / 'soft-light' keep the
      // cell colour; 'multiply' also darkens it overall.
      blend: 'overlay' as 'overlay' | 'soft-light' | 'hard-light' | 'multiply',
      furColors: [1, 2],
      glossColors: [3, 4],
      // Fur is combed outward from the middle of the face, [row, col] in cells
      furOrigin: [15, 10.5] as [number, number]
    },
    // Button colour once its paint has been used up
    emptySwatchColor: '#b9bac6',
    ctaGameplayText: 'Install',
    ctaEndcardText: 'Next Level',
    // Paint brush size in cells: each touch fills current-colour cells within
    // this Chebyshev radius of the pointer (1 = a 3x3 area). Bigger = easier.
    brushRadius: 1
  },

  timings: {
    // Win cinematic: confetti -> board shrinks out -> endcard UI.
    boardOutDelay: 550,
    endcardDelay: 1699,
    // Pause after the splash clears before the board's staggered entrance
    entranceStartDelay: 350,
    // Total spread of the entrance sweep (first cell -> last cell), scaled to
    // the board so big pictures don't drag. Per-diagonal step is derived from it.
    entranceSweepMs: 900,
    // Per-cell scale-in duration
    entranceCellMs: 620,
    // Idle time without interaction before the tutorial hand reappears
    tutorialIdleTime: 2999,
    // Beat held on a finished colour before the palette advances to the next one
    colorAdvanceDelay: 650,
    // Paint drop: flight time from the button to the landing cell
    dropMs: 560,
    // Radial paint wave: delay per cell of distance from the landing cell
    waveStepMs: 34,
    // Rise-and-settle of each cell as the wave front passes under it
    waveLiftMs: 440,
    // Extra life of the wave ring after the front has crossed the picture
    // (it fades out over the second half of its life)
    waveFadeMs: 180
  },

  sounds: {
    volume: 1,
    // Minimum gap (ms) between fill notes — one note per paint event, throttled,
    // instead of a voice per cell (glitchy audio pile-up on low-end phones)
    noteMinGap: 60
  },

  // Android webviews only; iOS has no web vibration API
  haptics: {
    enabled: true,
    // Light tick per painted cell (short pulses under ~20ms are ignored by many motors)
    fill: 20,
    // Minimum gap between fill ticks — each vibrate() call cancels the previous
    // one, so rapid swiping needs throttling or the motor never completes a pulse
    fillThrottle: 60,
    // Firmer buzz when a colour finishes
    colorComplete: 60,
    // Celebration pattern on the final colour
    win: [80, 60, 80, 60, 120] as number | number[]
  },

  tutorial: {
    // Is tutorial hand is enabled or not
    enabled: true
  },

  confetti: {
    count: 110,
    // Pieces start falling over this window, so the rain doesn't arrive as one sheet
    spawnWindowMs: 900,
    // Time for a piece to fall across the screen (random in range)
    fallMs: [2600, 4200] as [number, number],
    // Spin in degrees per second: each piece picks a random speed in this range
    // and a random direction, so some turn clockwise and others counter-clockwise
    spin: [120, 720] as [number, number],
    colors: ['#ff4f8b', '#ff8a3d', '#ffc93c', '#34d399', '#22b8f0', '#7b4dff', '#ff77c8', '#8be9ff']
  },

  directToStore: {
    // Seconds without any interaction before the store is opened (idle bailout,
    // 0 = off). Off for the web demo so a visitor is never sent away mid-picture.
    noInteractionPlaytime: 0,

    // Redirect after N of the named event fire. Keyed on 'game:complete' by
    // default so the store only opens once the picture is fully coloured.
    transferToStoreAfterEvents: {
      name: 'game:complete',
      amount: 1
    },

    // 'store'   - open the store immediately at the goal; the playable keeps
    //             running and re-opens on the next interaction.
    // 'endCard' - show the end card; tapping it opens the store, and (if
    //             endCardAutoStoreMs > 0) it also auto-opens after that delay.
    goalAction: 'store' as 'store' | 'endCard',

    // Only used in 'endCard' mode: auto-open the store this many ms after the
    // end card appears (0 = wait for a tap).
    endCardAutoStoreMs: 0
  }
};
