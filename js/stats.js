// Replaces the original MySQL-backed DatabaseConnection with localStorage.
// Same data: per-level high scores and lifetime totals.

const KEY = 'snacman.stats.v1';
const LEVELS = 12;

function empty() {
  return { levelScores: new Array(LEVELS).fill(0), dots: 0, deaths: 0, monsters: 0, seconds: 0 };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch (e) {
    // storage unavailable: fall through to in-memory defaults
  }
  return empty();
}

let memory = null;

function save(data) {
  memory = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    // ignore: stats just won't persist
  }
}

function current() {
  return memory || (memory = load());
}

export const Stats = {
  /** Keeps only the best score per level. */
  storeCompletedRun(levelNumber, score) {
    const data = current();
    if (levelNumber >= 1 && levelNumber <= LEVELS && score > data.levelScores[levelNumber - 1]) {
      data.levelScores[levelNumber - 1] = score;
    }
    save(data);
  },

  getLevelScores() {
    return current().levelScores.slice();
  },

  /** [dots, deaths, monsters eaten, seconds played] */
  getLifetimeStats() {
    const d = current();
    return [d.dots, d.deaths, d.monsters, d.seconds];
  },

  /** Adds the given deltas to the lifetime totals. */
  addLifetimeData(dots, deaths, monsters, seconds) {
    const data = current();
    data.dots += dots;
    data.deaths += deaths;
    data.monsters += monsters;
    data.seconds += seconds;
    save(data);
  },

  getHat() {
    try {
      return parseInt(localStorage.getItem('snacman.hat') || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  },

  setHat(index) {
    try {
      localStorage.setItem('snacman.hat', String(index));
    } catch (e) {
      // ignore
    }
  },
};
