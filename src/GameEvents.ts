export enum GameEvents {
  // Triggers on any user interaction with the playable (tap/click)
  AnyInteraction = 'any:interaction',

  // Triggers when a single cell is painted. NOT one-per-tap: the brush fills a
  // whole area, so one press can fire this many times.
  CellFill = 'cell:fill',

  // Triggers once per paint action: a palette tap in 'group' mode, a press on
  // the board in 'drag' mode. Can drive the store redirect after N taps
  // (config.directToStore).
  PaintTap = 'paint:tap',

  // Triggers when all cells of one palette color are painted.
  // Can drive the store redirect after N finished colours (config.directToStore).
  // parameters
  // colorNumber - The palette number that was just completed
  ColorComplete = 'color:complete',

  // Triggers when the whole picture is painted (100%).
  // The default store redirect goal (config.directToStore).
  GameComplete = 'game:complete',

  // Triggers once when the playable enters redirect mode (end state shown)
  RedirectMode = 'redirect:mode'
}
