import { Rect } from './geometry.js';
import { Stats } from './stats.js';
import { LEVEL_COUNT } from './map.js';

const font = (size, bold = true) => `${bold ? 'bold ' : ''}${size}px sans-serif`;

function text(ctx, str, x, y, f, color = 'white') {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function box(ctx, r, color = 'white') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
}

/** Every menu exposes draw(ctx, game) and buttons: [{ rect, action }] for hit testing. */
class Menu {
  hit(x, y) {
    const b = this.buttons.find((btn) => btn.rect.contains(x, y));
    return b ? b.action : null;
  }
}

export class MainMenu extends Menu {
  constructor() {
    super();
    this.buttons = [
      { rect: new Rect(300, 200, 225, 50), action: 'levels', label: 'Play', dx: 70 },
      { rect: new Rect(300, 300, 225, 50), action: 'custom', label: 'Customize', dx: 20 },
      { rect: new Rect(300, 400, 225, 50), action: 'controls', label: 'How to Play', dx: 7 },
      { rect: new Rect(300, 500, 225, 50), action: 'stats', label: 'Statistics', dx: 30 },
    ];
  }
  draw(ctx) {
    text(ctx, 'SnacMan', 300, 100, font(50));
    for (const b of this.buttons) {
      text(ctx, b.label, b.rect.x + b.dx, b.rect.y + 40, font(35));
      box(ctx, b.rect);
    }
    text(ctx, '(Definitely not Pac-Man)', 295, 130, font(20, false));
  }
}

export class LevelSelectMenu extends Menu {
  constructor() {
    super();
    const W = 225;
    const H = 50;
    this.buttons = [{ rect: new Rect(20, 20, 200, 50), action: 'menu' }];
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const x = ((level - 1) % 2) * (75 + W) + 120;
      const y = Math.floor((level - 1) / 2) * (20 + H) + 150;
      this.buttons.push({ rect: new Rect(x, y, W, H), action: 'level:' + level, level });
    }
  }
  draw(ctx) {
    text(ctx, 'Level Select', 250, 100, font(50));
    text(ctx, 'Main Menu', 21, 60, font(35));
    box(ctx, this.buttons[0].rect);
    for (const b of this.buttons.slice(1)) {
      text(ctx, 'Level ' + b.level, b.rect.x + 40, b.rect.y + 40, font(35));
      box(ctx, b.rect);
    }
  }
}

export class CustomizationMenu extends Menu {
  constructor() {
    super();
    this.main = new Rect(20, 20, 200, 50);
    this.prev = new Rect(100, 400, 100, 50);
    this.next = new Rect(600, 400, 100, 50);
    this.buttons = [
      { rect: this.main, action: 'menu' },
      { rect: this.prev, action: 'prevHat' },
      { rect: this.next, action: 'nextHat' },
    ];
  }
  draw(ctx, game) {
    text(ctx, 'Skin', 325, 100, font(50));
    text(ctx, 'Customization', 200, 150, font(50));
    box(ctx, this.main);
    text(ctx, 'Main Menu', this.main.x + 10, this.main.y + 40, font(35));
    box(ctx, this.prev);
    text(ctx, 'Prev', this.prev.x + 10, this.prev.y + 40, font(35));
    box(ctx, this.next);
    text(ctx, 'Next', this.next.x + 10, this.next.y + 40, font(35));
    // drawn at native sprite size, like the original
    const body = game.img('playerHappy');
    if (body) ctx.drawImage(body, 250, 325);
    if (game.hatIndex > 0) {
      const hat = game.img('Hat' + game.hatIndex);
      if (hat) ctx.drawImage(hat, 250, 325);
    }
  }
}

export class ControlsMenu extends Menu {
  constructor() {
    super();
    this.main = new Rect(20, 20, 200, 50);
    this.buttons = [{ rect: this.main, action: 'menu' }];
  }
  draw(ctx) {
    text(ctx, 'How to Play', 270, 140, font(50));
    text(ctx, 'Objective', 350, 190, font(27));
    text(ctx, 'Monsters, Snacks, & Obstacles', 220, 295, font(27));
    text(ctx, 'Controls', 357, 700, font(27));
    box(ctx, this.main);
    text(ctx, 'Main Menu', this.main.x + 1, this.main.y + 40, font(35));

    const lines = [
      ['The objective of SnacMan is to collect as many coins and snacks as', 30, 220],
      ['possible while avoiding monsters and obstacles.', 30, 245],
      ['In this game there are different types of monsters that will chase/run ', 30, 325],
      ['into your character. If they catch you, you will lose one life and after ', 30, 350],
      ['losing 3 lives in one level, you lose the game. ', 30, 375],
      ['Obstacles, such as lava, will also cause you to lose lives if you crash', 30, 425],
      ['into them.', 30, 450],
      ['Eating a donut will give you a temporary period of invincibility. After', 30, 500],
      ['you will be able to eat monsters (most will run away from you) for ', 30, 525],
      ['points and cross through lava tiles.', 30, 550],
      ['Eating a ghost pepper will give you the temporary ability to walk ', 30, 600],
      ['through walls, but beware: it will still allow you to be damaged by ', 30, 625],
      ['monsters.', 30, 650],
      ['To move your character around the screen, use the arrow keys (or WASD)', 30, 730],
      ['on your keyboard, or the on-screen buttons on a touch device.', 30, 755],
    ];
    for (const [s, x, y] of lines) text(ctx, s, x, y, font(23, false));
  }
}

export class GameOverMenu extends Menu {
  constructor() {
    super();
    this.main = new Rect(310, 250, 225, 50);
    this.buttons = [{ rect: this.main, action: 'menu' }];
  }
  draw(ctx, game) {
    text(ctx, 'GAME OVER', 260, 150, font(50), 'red');
    text(ctx, 'You collected ' + game.totalScore + ' points', 260, 200, font(25), 'red');
    text(ctx, 'Main Menu', this.main.x + 15, this.main.y + 40, font(35), 'red');
    box(ctx, this.main, 'red');
  }
}

export class GameWonMenu extends Menu {
  constructor() {
    super();
    this.main = new Rect(270, 250, 225, 50);
    this.buttons = [{ rect: this.main, action: 'menu' }];
  }
  draw(ctx, game) {
    text(ctx, 'YOU WON', 260, 150, font(50), 'yellow');
    text(ctx, 'You collected ' + game.totalScore + ' points', 230, 200, font(25), 'yellow');
    text(ctx, 'Main Menu', this.main.x + 15, this.main.y + 40, font(35), 'yellow');
    box(ctx, this.main, 'yellow');
  }
}

export class StatisticsMenu extends Menu {
  constructor() {
    super();
    this.main = new Rect(20, 20, 180, 50);
    this.buttons = [{ rect: this.main, action: 'menu' }];
  }
  draw(ctx) {
    box(ctx, this.main);
    text(ctx, 'Main Menu', this.main.x + 20, this.main.y + 35, font(25));
    text(ctx, 'Lifetime Statistics', 220, 80, font(40));

    const [dots, deaths, kills, seconds] = Stats.getLifetimeStats();
    const plain = font(20, false);
    text(ctx, 'Total Dots Collected: ' + dots + ' dots', 240, 120, plain);
    text(ctx, 'Total Times Died: ' + deaths + ' deaths', 240, 160, plain);
    text(ctx, 'Total Monsters Killed: ' + kills + ' monsters', 240, 200, plain);
    text(ctx, 'Total Time Played: ' + Math.floor(seconds / 60) + ' minutes', 240, 240, plain);

    text(ctx, 'Level High Scores', 220, 300, font(40));
    const scores = Stats.getLevelScores();
    let y = 340;
    scores.forEach((s, i) => {
      text(ctx, 'Level: ' + (i + 1) + ', High Score: ' + s + ' points', 240, y, plain);
      y += 40;
    });
  }
}

export function drawScore(ctx, score) {
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 1;
  ctx.strokeRect(640.5, 18.5, 200, 50);
  text(ctx, 'Score: ' + score, 650, 50, font(24), 'yellow');
}
