import { Application } from 'pixi.js';
import { startLoop } from '@/gameLoop';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/constants';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: 0x000000,
  });

  document.body.appendChild(app.canvas);
  startLoop();
}

main().catch(console.error);
