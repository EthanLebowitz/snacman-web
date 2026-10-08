// Ported from the original JUnit tests (test/*.java), plus a few extra checks.
// Run with:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import { Game, State } from '../js/game.js';
import { createMap, LEVEL_COUNT, TILE_SIZE } from '../js/map.js';
import { LEVELS } from '../js/levels.js';
import { Direction, TurnCloserToPlayer, isDirectionOpposite } from '../js/monster.js';
import { Rect, segmentIntersectsRect } from '../js/geometry.js';

function gameAtLevel(n) {
  const g = new Game({}, () => 0);
  g.loadLevel(n);
  return g;
}

// ---- CurrentTileTest ----
test('monster reports the tile it is standing on', () => {
  const game = gameAtLevel(1);
  const monster = game.enemies[0];
  for (const [x, y] of [[0, 0], [0, 1], [1, 5], [7, 3], [7, 4], [7, 5]]) {
    monster.setPosition(x * TILE_SIZE, y * TILE_SIZE);
    assert.ok(monster.currentTiles()[0].sameAs(game.map.tileAt(x, y)), `tile ${x},${y}`);
  }
});

// ---- IsDirectionOppositeTest ----
test('opposite directions', () => {
  assert.ok(isDirectionOpposite(Direction.UP, Direction.DOWN));
  assert.ok(isDirectionOpposite(Direction.DOWN, Direction.UP));
  assert.ok(isDirectionOpposite(Direction.LEFT, Direction.RIGHT));
  assert.ok(isDirectionOpposite(Direction.RIGHT, Direction.LEFT));
  assert.ok(!isDirectionOpposite(Direction.UP, Direction.RIGHT));
  assert.ok(!isDirectionOpposite(Direction.RIGHT, Direction.DOWN));
  assert.ok(!isDirectionOpposite(Direction.LEFT, Direction.DOWN));
  assert.ok(new TurnCloserToPlayer());
});

// ---- MapFactoryTesting ----
test('map factory builds the requested level', () => {
  for (const n of [1, 2, 3, 4]) {
    const game = gameAtLevel(n);
    assert.deepEqual(game.map.layout, createMap(game, n).layout);
  }
  const game = gameAtLevel(1);
  assert.notDeepEqual(game.map.layout, createMap(game, 2).layout);
  assert.equal(createMap(game, LEVEL_COUNT + 1), null);
});

test('every level is a valid 10x10 grid with spawns and a one-tile-per-cell tile list', () => {
  LEVELS.forEach((level, i) => {
    assert.equal(level.layout.length, 10, `level ${i + 1} rows`);
    level.layout.forEach((row) => assert.equal(row.length, 10));
    const game = gameAtLevel(i + 1);
    assert.equal(game.map.tiles.length, 100);
    assert.ok(game.map.playerSpawns.length >= 1, `level ${i + 1} player spawn`);
    assert.ok(game.map.monsterSpawns.length >= 1, `level ${i + 1} monster spawn`);
    assert.equal(game.enemies.length, level.enemies.length);
  });
});

// ---- MonsterCollisionsTest ----
test('monster wall collision detection', () => {
  const game = gameAtLevel(1);
  const monster = game.enemies[0];
  monster.setPosition(TILE_SIZE + 20, TILE_SIZE + 5);
  monster.xSpeed = 0;
  monster.ySpeed = 0;
  assert.equal(monster.checkCollision(), false);
  monster.setPosition(TILE_SIZE - 5, TILE_SIZE);
  assert.equal(monster.checkCollision(), true);
});

// ---- PlayerCollisionTest (level 2) ----
test('player collisions', () => {
  const game = gameAtLevel(2);
  const player = game.player;
  const at = (x, y) => player.updatePosition(x * TILE_SIZE, y * TILE_SIZE);

  assert.equal(player.collidesWithWall(), false);

  at(2, 7);
  assert.equal(player.collidesWithDot(), false);
  at(1, 1);
  assert.equal(player.collidesWithDot(), true);

  at(1, 1);
  assert.equal(player.collidesWithEnemy(), false);
  const monster = game.enemies[0];
  player.updatePosition(monster.x, monster.y - 1);
  assert.equal(player.collidesWithEnemy(), true);

  at(1, 1);
  player.updatePosition(player.x - 1, player.y - 1);
  assert.equal(player.collidesWithWall(), true);
  at(1, 1);
  assert.equal(player.collidesWithWall(), false);

  at(6, 5);
  assert.equal(player.collidesWithLava(), false);
  at(5, 5);
  assert.equal(player.collidesWithLava(), true);
});

// ---- extras ----
test('geometry: strict rectangle overlap and closed segment overlap', () => {
  const a = new Rect(0, 0, 10, 10);
  assert.equal(a.intersects(new Rect(10, 0, 10, 10)), false); // edges touching
  assert.equal(a.intersects(new Rect(9, 0, 10, 10)), true);
  assert.equal(segmentIntersectsRect(-5, 5, 15, 5, a), true);
  assert.equal(segmentIntersectsRect(-5, -5, -1, 15, a), false);
  assert.equal(segmentIntersectsRect(0, 0, 0, 900, new Rect(0, 100, 10, 10)), true); // along the edge
});

test('eating a donut makes the player able to eat monsters', () => {
  const game = gameAtLevel(3);
  const { player } = game;
  game.state = State.GAME;
  player.donutPowered = true;
  const monster = game.enemies[0];
  const before = game.enemies.length;
  player.updatePosition(monster.x, monster.y);
  player.collidesWithEnemy();
  assert.equal(game.enemies.length, before - 1);
  assert.equal(game.score, monster.pointValue);
  assert.equal(player.lives, 3);
});

test('losing all three lives ends the game; score is only counted once', () => {
  const game = gameAtLevel(2);
  game.state = State.GAME;
  game.score = 100;
  for (let i = 0; i < 3; i++) game.player.loseLife();
  game.tick();
  assert.equal(game.state, State.GAMEOVER);
  assert.equal(game.totalScore, 100);
});

test('collecting every dot advances to the next level, and past level 12 you win', () => {
  const game = gameAtLevel(1);
  game.state = State.GAME;
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    assert.equal(game.currentLevel, level);
    game.player.dotsCollected = game.player.totalDots;
    game.tick();
  }
  assert.equal(game.state, State.WON);
});

test('hat selection wraps around', () => {
  const game = gameAtLevel(1);
  game.hatIndex = 0;
  game.changeHat(-1);
  assert.equal(game.hatIndex, 8);
  game.changeHat(1);
  assert.equal(game.hatIndex, 0);
});

test('monsters never walk into walls or lava over a long simulated run', () => {
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const game = gameAtLevel(n);
    game.state = State.GAME;
    game.player.lives = 1e9; // immortal; we only care about monster movement
    for (let t = 0; t < 3000; t++) {
      for (const m of game.enemies.slice()) m.update();
      for (const m of game.enemies) {
        const bad = m.currentTiles().some((tile) => tile.type === 'wall' || tile.type === 'lava');
        assert.equal(bad, false, `level ${n} tick ${t}: monster inside wall/lava at ${m.x},${m.y}`);
      }
    }
  }
});
