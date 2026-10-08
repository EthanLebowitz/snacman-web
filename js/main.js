import { Game, State, WORLD_SIZE, TICK_MS } from './game.js';

const SPRITES = [
  'allSeeingMonster', 'dirt', 'donut', 'heart', 'pepper', 'wall',
  'Hat1', 'Hat2', 'Hat3', 'Hat4', 'Hat5', 'Hat6', 'Hat7', 'Hat8',
  'lavaPool1', 'lavaPool2', 'lavaPool3',
  'monsterAngry', 'monsterBlind', 'monsterChill', 'monsterEyesClosed', 'monsterScared',
  'playerAngry', 'playerAngryGhost', 'playerGhost', 'playerHappy', 'playerSad',
];

const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

function loadImage(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve([name, img]);
    img.onerror = () => resolve([name, null]); // a missing sprite shouldn't stop the game
    img.src = `sprites/${name}.png`;
  });
}

async function main() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const images = Object.fromEntries(await Promise.all(SPRITES.map(loadImage)));
  const game = new Game(images);

  // optional debug/deep link: ?level=N jumps straight into a level
  const requested = parseInt(new URLSearchParams(location.search).get('level'), 10);
  if (requested >= 1 && requested <= 12) game.startLevel(requested);
  window.snacman = game; // handy for poking around in the console

  // ----- sizing: keep the backing store crisp at the displayed size -----
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const size = Math.max(1, Math.round(canvas.clientWidth * dpr));
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
  }
  window.addEventListener('resize', resize);
  resize();

  // ----- input -----
  window.addEventListener('keydown', (e) => {
    const key = KEY_MAP[e.code];
    if (key) {
      game.setKey(key, true);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const key = KEY_MAP[e.code];
    if (key) {
      game.setKey(key, false);
      e.preventDefault();
    }
  });
  window.addEventListener('blur', () => game.clearKeys());

  const toWorld = (e) => {
    const rect = canvas.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * WORLD_SIZE, ((e.clientY - rect.top) / rect.height) * WORLD_SIZE];
  };
  // touch: the character walks toward wherever the finger is pressing
  const steering = (e) => e.pointerType !== 'mouse' && game.state === State.GAME;
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toWorld(e);
    if (steering(e)) {
      canvas.setPointerCapture(e.pointerId);
      game.setTouchTarget(x, y);
    } else {
      game.click(x, y);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (game.touchTarget && steering(e)) game.setTouchTarget(...toWorld(e));
  });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => game.setTouchTarget(null));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ----- loop: fixed 17 ms logic ticks (same speed on any monitor), draw every frame -----
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(now - last, 250);
    last = now;
    while (acc >= TICK_MS) {
      game.tick();
      acc -= TICK_MS;
    }
    const k = canvas.width / WORLD_SIZE;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    game.draw(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
