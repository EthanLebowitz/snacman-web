import { createMap, LEVEL_COUNT } from './map.js';
import { Player, MAX_HAT } from './player.js';
import { makeEnemies } from './monster.js';
import { Stats } from './stats.js';
import {
  MainMenu,
  LevelSelectMenu,
  CustomizationMenu,
  ControlsMenu,
  GameOverMenu,
  GameWonMenu,
  StatisticsMenu,
  drawScore,
} from './menus.js';

export const State = {
  MENU: 'MENU',
  LEVELS: 'LEVELS',
  GAME: 'GAME',
  CUSTOM: 'CUSTOM',
  CONTROLS: 'CONTROLS',
  GAMEOVER: 'GAMEOVER',
  WON: 'WON',
  STATS: 'STATS',
};

export const WORLD_SIZE = 900;
export const TICK_MS = 17; // the original ran its update loop every 17 ms

const POINTS_LOST_PER_INTERVAL = 1;
const POINT_LOSS_INTERVAL = 100; // ms

export class Game {
  /**
   * @param images  map of sprite name -> drawable image (empty in tests)
   * @param clock   () => ms; injectable so tests can control time
   */
  constructor(images = {}, clock = () => Date.now()) {
    this.images = images;
    this.clock = clock;
    this.menus = {
      [State.MENU]: new MainMenu(),
      [State.LEVELS]: new LevelSelectMenu(),
      [State.CUSTOM]: new CustomizationMenu(),
      [State.CONTROLS]: new ControlsMenu(),
      [State.GAMEOVER]: new GameOverMenu(),
      [State.WON]: new GameWonMenu(),
      [State.STATS]: new StatisticsMenu(),
    };
    this.newGame();
  }

  /** Fresh run back at the main menu (used at startup and after game over / win). */
  newGame() {
    this.state = State.MENU;
    this.hatIndex = Stats.getHat();
    this.score = 0;
    this.totalScore = 0;
    this.pendingDeaths = 0;
    this.pendingKills = 0;
    this.keys = { up: false, down: false, left: false, right: false };

    this.loadLevel(1);
  }

  img(name) {
    return this.images[name] || null;
  }

  // ----- level setup -------------------------------------------------------

  /** Builds map, player and enemies for a level. Returns false past the last level. */
  loadLevel(levelNumber) {
    const map = createMap(this, levelNumber);
    if (!map) return false;
    this.currentLevel = levelNumber;
    this.map = map;
    const spawn = map.playerSpawns[0];
    this.playerStart = { x: spawn.x, y: spawn.y };
    this.player = new Player(this, spawn.x, spawn.y, map, this.hatIndex);
    this.player.keys = this.keys;
    this.enemies = makeEnemies(map.level.enemies, this, map, this.player);
    this.player.setMonsters(this.enemies);
    this.levelStart = this.clock();
    this.lastInterval = 0;
    return true;
  }

  /** Called from the level select screen. */
  startLevel(levelNumber) {
    if (this.loadLevel(levelNumber)) {
      this.resetGame();
      this.state = State.GAME;
    }
  }

  /** Puts the player and monsters back at their spawns (after a death, or a new level). */
  resetGame() {
    this.player.updatePosition(this.playerStart.x, this.playerStart.y);
    this.player.resetSpeed();
    this.player.hatIndex = this.hatIndex;
    for (const enemy of this.enemies) enemy.reset();
  }

  removeMonster(enemy) {
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  // ----- scoring / stats ---------------------------------------------------

  addPoints(points) {
    this.score += points;
  }

  subtractPoints(points) {
    this.score = this.score >= points ? this.score - points : 0;
  }

  increaseDeaths() {
    this.pendingDeaths++;
  }

  increaseMonsterKills() {
    this.pendingKills++;
  }

  /** Writes this level's totals to lifetime stats, then clears the counters. */
  flushLifetimeStats(seconds) {
    Stats.addLifetimeData(this.player.dotsCollected, this.pendingDeaths, this.pendingKills, seconds);
    this.pendingDeaths = 0;
    this.pendingKills = 0;
  }

  // ----- main update -------------------------------------------------------

  /** Advance the simulation by one 17 ms tick (only does anything while playing). */
  tick() {
    if (this.state !== State.GAME) return;

    // score slowly drains while time passes
    const interval = Math.floor((this.clock() - this.levelStart) / POINT_LOSS_INTERVAL);
    if (interval !== this.lastInterval) {
      this.lastInterval = interval;
      this.subtractPoints(POINTS_LOST_PER_INTERVAL);
    }

    this.map.tick();
    this.player.update();
    // copy: a donut-powered player can eat monsters, which edits the list
    for (const enemy of this.enemies.slice()) enemy.update();
    this.checkGameOver();
  }

  checkGameOver() {
    const won = this.player.allDotsCollected();
    const lost = this.player.lives <= 0;
    if (!won && !lost) return;

    const seconds = Math.floor((this.clock() - this.levelStart) / 1000);
    this.flushLifetimeStats(seconds);

    if (lost) {
      this.totalScore += this.score;
      this.state = State.GAMEOVER;
      return;
    }

    Stats.storeCompletedRun(this.currentLevel, this.score);
    this.totalScore += this.score;
    this.score = 0;
    this.nextLevel();
  }

  nextLevel() {
    if (this.loadLevel(this.currentLevel + 1)) {
      this.resetGame();
    } else {
      this.state = State.WON;
    }
  }

  // ----- input -------------------------------------------------------------

  setKey(name, down) {
    this.keys[name] = down;
  }

  clearKeys() {
    for (const k of Object.keys(this.keys)) this.keys[k] = false;
  }

  /** Click / tap in world (900x900) coordinates. */
  click(x, y) {
    const menu = this.menus[this.state];
    if (!menu) return;
    const action = menu.hit(x, y);
    if (!action) return;

    if (action === 'menu') {
      if (this.state === State.GAMEOVER || this.state === State.WON) {
        this.newGame(); // fresh game, like the original
      }
      this.state = State.MENU;
    } else if (action === 'levels') this.state = State.LEVELS;
    else if (action === 'custom') this.state = State.CUSTOM;
    else if (action === 'controls') this.state = State.CONTROLS;
    else if (action === 'stats') this.state = State.STATS;
    else if (action === 'nextHat') this.changeHat(1);
    else if (action === 'prevHat') this.changeHat(-1);
    else if (action.startsWith('level:')) this.startLevel(parseInt(action.slice(6), 10));
  }

  changeHat(delta) {
    this.hatIndex = (this.hatIndex + delta + MAX_HAT + 1) % (MAX_HAT + 1);
    this.player.hatIndex = this.hatIndex;
    Stats.setHat(this.hatIndex);
  }

  // ----- drawing -----------------------------------------------------------

  draw(ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    ctx.textBaseline = 'alphabetic';

    if (this.state === State.GAME) {
      this.map.draw(ctx);
      this.player.draw(ctx);
      for (const enemy of this.enemies) enemy.draw(ctx);
      drawScore(ctx, this.score);
    } else {
      this.menus[this.state].draw(ctx, this);
    }
  }
}

export { LEVEL_COUNT };
