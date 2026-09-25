import './index.css';

import { sdk } from '@smoud/playable-sdk';
import { Game } from './Game';

// The board's entrance sweep starts under the splash, so keep it up long
// enough to cover the first beat before fading out
const SPLASH_MIN_MS = 1000;
const splashShownAt = performance.now();

function hideSplash(): void {
  const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashShownAt));
  window.setTimeout(() => document.getElementById('splash')?.classList.add('hidden'), wait);
}

sdk.init((width: number, height: number) => {
  const game = new Game(width, height);
  sdk.on('resize', game.resize, game);
  sdk.on('pause', game.pause, game);
  sdk.on('resume', game.resume, game);
  sdk.on('volume', game.volume, game);
  sdk.on('finish', game.finish, game);

  (window as any).game = game;

  hideSplash();
  sdk.start();
});
