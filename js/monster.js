import { Rect, segmentIntersectsRect } from './geometry.js';
import { Player } from './player.js';

export const Direction = { UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT' };

export function isDirectionOpposite(a, b) {
  return (
    (a === Direction.DOWN && b === Direction.UP) ||
    (a === Direction.UP && b === Direction.DOWN) ||
    (a === Direction.RIGHT && b === Direction.LEFT) ||
    (a === Direction.LEFT && b === Direction.RIGHT)
  );
}

/** Wanders at random, never reversing unless it's a dead end. */
export class RandomStraightDirection {
  getNewDirection(xDir, yDir, monster, legal) {
    if (legal.length === 0) return null;
    if (legal.length === 1) return legal[0];
    const current = monster.convertToDirection(xDir, yDir);
    let turn;
    do {
      turn = legal[Math.floor(Math.random() * legal.length)];
    } while (isDirectionOpposite(current, turn));
    return turn;
  }
}

/** Turns toward the player (or away, if the player is donut-powered). */
export class TurnCloserToPlayer {
  getNewDirection(xDir, yDir, monster, legal) {
    if (legal.length === 0) return null;
    if (legal.length === 1) return legal[0];
    const player = monster.player;
    const lastDirection = monster.convertToDirection(xDir, yDir);

    const xDiff = player.x - monster.x;
    const yDiff = player.y - monster.y;
    let sx = Math.sign(xDiff);
    let sy = Math.sign(yDiff);
    if (player.donutPowered) {
      sx = -sx;
      sy = -sy;
    }
    const xChoice = monster.convertToDirection(sx, 0);
    const yChoice = monster.convertToDirection(0, sy);

    if (Math.abs(xDiff) > Math.abs(yDiff) && legal.includes(xChoice)) return xChoice;
    if (Math.abs(xDiff) < Math.abs(yDiff) && legal.includes(yChoice)) return yChoice;

    // neither direction toward the player is legal: keep going without reversing
    let result = null;
    for (const dir of legal) {
      if (!isDirectionOpposite(lastDirection, dir)) result = dir;
    }
    return result;
  }
}

/** Chases the player when there's a clear line of sight, otherwise wanders. */
export class FollowWithVision {
  constructor() {
    this.random = new RandomStraightDirection();
    this.chase = new TurnCloserToPlayer();
  }
  getNewDirection(xDir, yDir, monster, legal) {
    if (monster.canSeePlayer()) {
      monster.seesPlayer = true;
      return this.chase.getNewDirection(xDir, yDir, monster, legal);
    }
    monster.seesPlayer = false;
    return this.random.getNewDirection(xDir, yDir, monster, legal);
  }
}

export class Monster {
  static IMAGE_SIZE = 80;
  static SPEED = 4;

  constructor(x, y, pointValue, strategy, game, map, player) {
    this.game = game;
    this.map = map;
    this.tiles = map.tiles;
    this.player = player;
    this.strategy = strategy;
    this.pointValue = pointValue;
    this.x = x;
    this.y = y;
    this.width = Monster.IMAGE_SIZE;
    this.height = Monster.IMAGE_SIZE;
    this.xDirection = 0;
    this.yDirection = 0;
    this.xSpeed = 0;
    this.ySpeed = 0;
    this.seesPlayer = false;
    this.sprites = { angry: 'monsterAngry', chill: 'monsterEyesClosed', scared: 'monsterScared' };
    this.hitbox = new Rect(x, y, this.width, this.height);
    this.lastTile = this.currentTiles()[0];
    this.reset();
  }

  setSprites(angry, chill, scared) {
    this.sprites = { angry, chill, scared };
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.hitbox.x = x;
    this.hitbox.y = y;
  }

  die() {
    this.game.removeMonster(this);
  }

  currentTiles() {
    return this.tiles.filter((t) => this.hitbox.intersects(t.hitbox));
  }

  /** True when exclusively on one tile that differs from the last such tile. */
  checkNewTile() {
    const tiles = this.currentTiles();
    if (tiles.length === 1) {
      const current = tiles[0];
      if (!current.sameAs(this.lastTile)) {
        this.lastTile = current;
        return true;
      }
    }
    return false;
  }

  getLegalDirections(tile) {
    const legal = [];
    for (let h = -1; h < 2; h++) {
      for (let v = -1; v < 2; v++) {
        if (Math.abs(h + v) === 1) {
          const adj = this.map.tileAt(tile.xIndex + h, tile.yIndex + v);
          if (adj && adj.type !== 'wall' && adj.type !== 'lava') legal.push(this.convertToDirection(h, v));
        }
      }
    }
    return legal;
  }

  checkIntersection() {
    return this.getLegalDirections(this.lastTile).length > 2;
  }

  convertToDirection(xDir, yDir) {
    if (xDir === 1 && yDir === 0) return Direction.RIGHT;
    if (xDir === -1 && yDir === 0) return Direction.LEFT;
    if (xDir === 0 && yDir === 1) return Direction.DOWN;
    if (xDir === 0 && yDir === -1) return Direction.UP;
    return null;
  }

  applyDirection(direction) {
    if (direction === Direction.UP) [this.xDirection, this.yDirection] = [0, -1];
    else if (direction === Direction.DOWN) [this.xDirection, this.yDirection] = [0, 1];
    else if (direction === Direction.LEFT) [this.xDirection, this.yDirection] = [-1, 0];
    else if (direction === Direction.RIGHT) [this.xDirection, this.yDirection] = [1, 0];
    this.updateSpeeds();
  }

  updateSpeeds() {
    this.xSpeed = this.xDirection * Monster.SPEED;
    this.ySpeed = this.yDirection * Monster.SPEED;
  }

  /** Would the next step run into a wall or lava? */
  checkCollision() {
    const h = this.hitbox;
    h.x += this.xSpeed;
    h.y += this.ySpeed;
    let willCollide = false;
    for (const tile of this.tiles) {
      if (h.intersects(tile.hitbox) && (tile.type === 'wall' || tile.type === 'lava')) willCollide = true;
    }
    h.x -= this.xSpeed;
    h.y -= this.ySpeed;
    return willCollide;
  }

  update() {
    let direction = null;
    // short-circuit matters: checkNewTile() only runs when there's no collision
    if (this.checkCollision() || (this.checkNewTile() && this.checkIntersection())) {
      const legal = this.getLegalDirections(this.lastTile);
      direction = this.strategy.getNewDirection(this.xDirection, this.yDirection, this, legal);
    }
    if (direction) {
      this.applyDirection(direction);
      return;
    }
    this.updateSpeeds();
    this.move();
  }

  move() {
    this.x += this.xSpeed;
    this.y += this.ySpeed;
    this.hitbox.x = this.x;
    this.hitbox.y = this.y;
  }

  reset() {
    const spawns = this.map.monsterSpawns;
    const spawn = spawns[Math.floor(Math.random() * spawns.length)];
    this.setPosition(spawn.x + 10, spawn.y + 10);
    this.lastTile = this.currentTiles()[0];
    const legal = this.getLegalDirections(this.lastTile);
    this.applyDirection(legal[Math.floor(Math.random() * legal.length)]);
  }

  lineIntersectsWall(x1, y1, x2, y2) {
    return this.tiles.some((t) => t.type === 'wall' && segmentIntersectsRect(x1, y1, x2, y2, t.hitbox));
  }

  /**
   * Line of sight from the monster's centre to any corner of the player.
   * (Like the original, a successful look also points the monster's direction at the player.)
   */
  canSeePlayer() {
    const px = this.player.x;
    const py = this.player.y;
    const size = Player.SIZE;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    for (let xc = 0; xc < 2; xc++) {
      for (let yc = 0; yc < 2; yc++) {
        if (!this.lineIntersectsWall(cx, cy, px + xc * size, py + yc * size)) {
          this.xDirection = Math.sign(px - cx);
          this.yDirection = Math.sign(py - cy);
          return true;
        }
      }
    }
    return false;
  }

  draw(ctx) {
    let name;
    if (this.seesPlayer) name = this.player.donutPowered ? this.sprites.scared : this.sprites.angry;
    else name = this.sprites.chill;
    const img = this.game.img(name);
    if (img) ctx.drawImage(img, this.x, this.y, Monster.IMAGE_SIZE, Monster.IMAGE_SIZE);
  }
}

export function makeEnemy(type, game, map, player) {
  const spawns = map.monsterSpawns;
  const spawn = spawns[Math.floor(Math.random() * spawns.length)];
  if (type === 'standard') {
    return new Monster(spawn.x, spawn.y, 300, new FollowWithVision(), game, map, player);
  }
  if (type === 'all seeing') {
    const m = new Monster(spawn.x, spawn.y, 500, new TurnCloserToPlayer(), game, map, player);
    m.setSprites('allSeeingMonster', 'allSeeingMonster', 'allSeeingMonster');
    m.seesPlayer = true;
    return m;
  }
  if (type === 'blind') {
    const m = new Monster(spawn.x, spawn.y, 150, new RandomStraightDirection(), game, map, player);
    m.setSprites('monsterBlind', 'monsterBlind', 'monsterBlind');
    return m;
  }
  return null;
}

export function makeEnemies(types, game, map, player) {
  return types.map((t) => makeEnemy(t, game, map, player));
}
