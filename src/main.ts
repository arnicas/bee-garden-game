import './styles.css';
import { Garden } from './garden';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('The meadow canvas is missing.');
let game: Garden | undefined;
try {
  game = new Garden(canvas);
} catch (error) {
  console.error(error);
  document.querySelector('#ui')!.innerHTML = '<div style="position:fixed;inset:0;display:grid;place-content:center;background:#eee9d5;color:#334637;font:20px Georgia;text-align:center;padding:32px"><h1>The meadow could not open.</h1><p>Please use a desktop browser with WebGL enabled, then reload.</p><button onclick="location.reload()" style="padding:12px">Try again</button></div>';
}
if (import.meta.hot) import.meta.hot.dispose(() => game?.dispose());
