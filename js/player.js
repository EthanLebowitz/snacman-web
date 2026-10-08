import { Rect, jint, segmentIntersectsRect } from './geometry.js';
import { TILE_SIZE } from './map.js';

export const MAX_HAT = 8;

export class Player {
  static SIZE = 65;
  static TIME_POWERED_UP = 200; // ticks
  static TIME_PEPPER_POWERED = 300; // ticks
  static SPRITE_BLINK_INTERVALS = 10;
  static POWERUP_BLINK_TIME_REMAINING = 75;

  constructor(game, x, y, map, hatIndex = 0) {
    this.game = game;
    this.map = map;
    this.tiles = map.tiles;
    this.walls = map.walls;
    this.dots = map.dots;
    this.x = x;
    this.y = y;
    this.lives = 3;
    this.hatIndex = hatIndex;

    this.xSpeed = 0;
    this.ySpeed = 0;
    this.speedDecay = 0.8;
    this.speedMultiplier = 1;

    this.dotsCollected = 0;
    this.totalDots = map.dots.length;

    this.keys = { up: false, down: false, left: false, right: false };
    this.enemies = [];

    this.donutPowered = false;
    this.turnsDonutPowered = 0;
    this.pepperPowered = false;
    this.turnsPepperPowered = 0;

    this.hitbox = new Rect(x, y, Player.SIZE, Player.SIZE);
  }

  setMonsters(enemies) {
    this.enemies = enemies;
  }

  allDotsCollected() {
    return this.dotsCollected >= this.totalDots;
  }

  updatePosition(x, y) {
    this.x = x;
    this.y = y;
    this.hitbox.x = x;
    this.hitbox.y = y;
  }

  resetSpeed() {
    this.xSpeed = 0;
    this.ySpeed = 0;
  }

  loseLife() {
    this.lives--;
    this.game.increaseDeaths();
    this.game.resetGame();
  }

  currentTiles() {
    return this.tiles.filter((t) => this.hitbox.intersects(t.hitbox));
  }

  updateDonutPower() {
    if (this.donutPowered) {
      this.turnsDonutPowered++;
      if (this.turnsDonutPowered >= Player.TIME_POWERED_UP) {
        this.turnsDonutPowered = 0;
        this.donutPowered = false;
      }
    }
  }

  updatePepperPower() {
    if (this.pepperPowered) {
      this.turnsPepperPowered++;
      if (this.turnsPepperPowered >= Player.TIME_PEPPER_POWERED) {
        this.turnsPepperPowered = 0;
        this.pepperPowered = false;
        this.popFromWall();
      }
    }
  }

  /** When ghost mode ends, snap onto touching dirt, or die if entirely inside a wall. */
  popFromWall() {
    let touchingDirt = false;
    for (const tile of this.currentTiles()) {
      if (tile.type === 'dirt') {
        touchingDirt = true;
        this.updatePosition(tile.xIndex * TILE_SIZE, tile.yIndex * TILE_SIZE);
      }
    }
    if (!touchingDirt) this.loseLife();
  }

  /** One game tick: accelerate/decay, collide, move, collect. */
  update() {
    this.updateDonutPower();
    this.updatePepperPower();

    const { up, down, left, right } = this.keys;
    if (down && !up) this.ySpeed += this.speedMultiplier;
    if (up && !down) this.ySpeed -= this.speedMultiplier;
    if (left && !right) this.xSpeed -= this.speedMultiplier;
    if (right && !left) this.xSpeed += this.speedMultiplier;
    if ((!down && !up) || (down && up)) this.ySpeed *= this.speedDecay;
    if ((!left && !right) || (right && left)) this.xSpeed *= this.speedDecay;

    // cap speed at 5
    if (Math.abs(this.xSpeed) > 5) this.xSpeed = this.xSpeed < 0 ? -5 : 5;
    if (Math.abs(this.ySpeed) > 5) this.ySpeed = this.ySpeed < 0 ? -5 : 5;
    // come to a halt when too slow
    if (Math.abs(this.xSpeed) < 0.75) this.xSpeed = 0;
    if (Math.abs(this.ySpeed) < 0.75) this.ySpeed = 0;

    if (this.pepperPowered) this.collidesWithBorder();
    else this.collidesWithWall();

    this.collidesWithEnemy();

    this.x = jint(this.x + this.xSpeed);
    this.y = jint(this.y + this.ySpeed);
    this.hitbox.x = this.x;
    this.hitbox.y = this.y;

    this.collidesWithDot();
    this.collidesWithLava();
  }

  collidesWithLava() {
    let collided = false;
    for (const tile of this.tiles) {
      if (tile.type === 'lava' && this.hitbox.intersects(tile.hitbox) && !this.donutPowered) {
        this.loseLife();
        collided = true;
      }
    }
    return collided;
  }

  collidesWithDot() {
    let collided = false;
    for (const dot of this.dots) {
      if (this.hitbox.intersects(dot.hitbox)) {
        if (!dot.collected) {
          collided = true;
          if (dot.type === 'donut') this.donutPowered = true;
          else if (dot.type === 'pepper') this.pepperPowered = true;
          this.game.addPoints(dot.pointValue);
          this.dotsCollected++;
        }
        dot.collected = true;
      }
    }
    return collided;
  }

  collidesWithEnemy() {
    let collided = false;
    // index loop on purpose: enemy.die() removes from the list we're walking
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (this.hitbox.intersects(enemy.hitbox)) {
        collided = true;
        if (!this.donutPowered) {
          this.game.subtractPoints(enemy.pointValue);
          this.loseLife();
        } else {
          this.game.addPoints(enemy.pointValue);
          this.game.increaseMonsterKills();
          enemy.die();
        }
      }
    }
    return collided;
  }

  collidesWithWall() {
    return this.moveAgainst(true);
  }

  /** Ghost mode: only the outer screen borders block movement. */
  collidesWithBorder() {
    return this.moveAgainst(false);
  }

  /**
   * Tentatively moves the hitbox on each axis, reverting and zeroing that axis' speed
   * on collision. perObstacle mirrors the original, which re-checked per wall in turn.
   */
  moveAgainst(perObstacle) {
    let collides = false;
    const h = this.hitbox;
    const sources = perObstacle ? this.walls : this.map.borders;
    const hitsOne = (src) =>
      perObstacle
        ? h.intersects(src.hitbox)
        : segmentIntersectsRect(src[0], src[1], src[2], src[3], h);

    h.x = jint(h.x + this.xSpeed);
    for (const src of sources) {
      if (hitsOne(src)) {
        h.x = jint(h.x - this.xSpeed);
        this.xSpeed = 0;
        collides = true;
      }
    }
    h.y = jint(h.y + this.ySpeed);
    for (const src of sources) {
      if (hitsOne(src)) {
        h.y = jint(h.y - this.ySpeed);
        this.ySpeed = 0;
        collides = true;
      }
    }
    return collides;
  }

  spriteName() {
    if (!this.donutPowered && !this.pepperPowered) return 'playerHappy';
    let angry = false;
    let ghostly = false;
    if (this.donutPowered) {
      angry = true;
      const remaining = Player.TIME_POWERED_UP - this.turnsDonutPowered;
      if (remaining <= Player.POWERUP_BLINK_TIME_REMAINING) {
        if (Math.floor(remaining / Player.SPRITE_BLINK_INTERVALS) % 2 === 1) angry = false;
      }
    }
    if (this.pepperPowered) {
      ghostly = true;
      const remaining = Player.TIME_PEPPER_POWERED - this.turnsPepperPowered;
      if (remaining <= Player.POWERUP_BLINK_TIME_REMAINING) {
        if (Math.floor(remaining / Player.SPRITE_BLINK_INTERVALS) % 2 === 1) ghostly = false;
      }
    }
    if (angry && ghostly) return 'playerAngryGhost';
    if (angry) return 'playerAngry';
    if (ghostly) return 'playerGhost';
    return 'playerHappy';
  }

  draw(ctx) {
    const body = this.game.img(this.spriteName());
    if (body) ctx.drawImage(body, this.x, this.y, Player.SIZE, Player.SIZE);
    if (this.hatIndex > 0) {
      const hat = this.game.img('Hat' + this.hatIndex);
      if (hat) ctx.drawImage(hat, this.x, this.y, Player.SIZE, Player.SIZE);
    }
    this.drawLives(ctx);
  }

  drawLives(ctx) {
    const heart = this.game.img('heart');
    if (!heart) return;
    for (let i = 0; i < this.lives; i++) ctx.drawImage(heart, 30 + 60 * i, 20, 50, 50);
  }
}
