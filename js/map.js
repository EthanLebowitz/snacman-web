import { Rect } from './geometry.js';
import { LEVELS } from './levels.js';

export const TILE_TILES = 10; // tiles per side
export const TILE_SIZE = 900 / 10;

class Tile {
  constructor(game, type, x, y, xIndex, yIndex) {
    this.game = game;
    this.type = type;
    this.x = x;
    this.y = y;
    this.xIndex = xIndex;
    this.yIndex = yIndex;
    this.hitbox = new Rect(x, y, TILE_SIZE, TILE_SIZE);
  }

  /** Same kind of tile at the same grid cell (Tile.equals in the Java version). */
  sameAs(other) {
    return !!other && other.type === this.type && other.xIndex === this.xIndex && other.yIndex === this.yIndex;
  }

  tick() {}

  draw(ctx) {
    // +1 so neighbouring tiles overlap and no seams show when scaled
    const img = this.game.img(this.sprite());
    if (img) ctx.drawImage(img, this.x, this.y, TILE_SIZE + 1, TILE_SIZE + 1);
  }
}

export class Wall extends Tile {
  constructor(game, x, y, xi, yi) {
    super(game, 'wall', x, y, xi, yi);
  }
  sprite() {
    return 'wall';
  }
}

export class Dirt extends Tile {
  constructor(game, x, y, xi, yi) {
    super(game, 'dirt', x, y, xi, yi);
  }
  sprite() {
    return 'dirt';
  }
}

export class Lava extends Tile {
  static SPRITES = ['lavaPool1', 'lavaPool2', 'lavaPool3'];
  static TICKS_PER_SPRITE_CHANGE = 30;

  constructor(game, x, y, xi, yi) {
    super(game, 'lava', x, y, xi, yi);
    this.spriteIndex = Math.floor(Math.random() * 3);
    this.ticks = 0;
  }
  tick() {
    this.ticks++;
    if (this.ticks % Lava.TICKS_PER_SPRITE_CHANGE === 0) {
      this.spriteIndex = (this.spriteIndex + 1) % Lava.SPRITES.length;
    }
  }
  sprite() {
    return Lava.SPRITES[this.spriteIndex];
  }
}

/** A collectable: plain dot, donut (invincibility) or ghost pepper (walk through walls). */
export class Dot {
  constructor(game, type, x, y, xIndex, yIndex) {
    this.game = game;
    this.type = type; // 'dot' | 'donut' | 'pepper'
    this.x = x;
    this.y = y;
    this.xIndex = xIndex;
    this.yIndex = yIndex;
    this.collected = false;
    this.pointValue = type === 'dot' ? 55 : 100;
    this.hitbox = new Rect(x, y, 20, 20);
  }

  draw(ctx) {
    if (this.collected) return;
    if (this.type === 'dot') {
      ctx.fillStyle = 'yellow';
      ctx.beginPath();
      ctx.ellipse(this.x + 10, this.y + 10, 10, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const img = this.game.img(this.type === 'donut' ? 'donut' : 'pepper');
      if (img) ctx.drawImage(img, this.x, this.y, 60, 60);
    }
  }
}

export class Map {
  constructor(game, level) {
    this.game = game;
    this.level = level;
    this.layout = level.layout;
    this.tiles = []; // exactly one per grid cell, row-major
    this.walls = [];
    this.dots = [];
    this.playerSpawns = [];
    this.monsterSpawns = [];

    for (let yi = 0; yi < this.layout.length; yi++) {
      for (let xi = 0; xi < this.layout[yi].length; xi++) {
        const ch = this.layout[yi][xi];
        const x = TILE_SIZE * xi;
        const y = TILE_SIZE * yi;
        if (ch === 'w') {
          const wall = new Wall(game, x, y, xi, yi);
          this.tiles.push(wall);
          this.walls.push(wall);
        } else if (ch === 'l') {
          this.tiles.push(new Lava(game, x, y, xi, yi));
        } else {
          this.tiles.push(new Dirt(game, x, y, xi, yi));
          if (ch === 'c') this.dots.push(new Dot(game, 'dot', x + 40, y + 40, xi, yi));
          else if (ch === 'o') this.dots.push(new Dot(game, 'donut', x + 20, y + 20, xi, yi));
          else if (ch === 'g') this.dots.push(new Dot(game, 'pepper', x + 20, y + 20, xi, yi));
          else if (ch === 'p') this.playerSpawns.push({ x, y });
          else if (ch === 'm') this.monsterSpawns.push({ x, y });
        }
      }
    }

    // Borders the player can't cross even in ghost-pepper mode
    const size = TILE_SIZE * TILE_TILES;
    this.borders = [
      [0, 0, size, 0],
      [0, 0, 0, size],
      [0, size, size, size],
      [size, 0, size, size],
    ];
  }

  tileAt(xIndex, yIndex) {
    return this.tiles[yIndex * this.layout[0].length + xIndex];
  }

  tick() {
    for (const t of this.tiles) t.tick();
  }

  draw(ctx) {
    for (const t of this.tiles) t.draw(ctx);
    for (const d of this.dots) d.draw(ctx);
  }
}

/** Builds the map for a 1-based level number, or null when past the last level. */
export function createMap(game, levelNumber) {
  const level = LEVELS[levelNumber - 1];
  return level ? new Map(game, level) : null;
}

export const LEVEL_COUNT = LEVELS.length;
