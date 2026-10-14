/** Deterministic, renderer-independent simulation for Medy Skyhop. */
export const WORLD = Object.freeze({ width: 420, height: 760, groundY: 696 });

const STEP = 1 / 120;
const BIRD_X = 114;
const BIRD_Y = 335;
const BIRD_RADIUS = 17;
const OBSTACLE_WIDTH = 76;
const SPACING = 245;
const FIRST_X = WORLD.width + 140;
const MIN_GAP_Y = 200;
const MAX_GAP_Y = 490;
const MAX_GAP_CHANGE = 90;
const WARMUP_HEIGHTS = [335, 350, 320, 350, 335];
export const GATE_PATTERNS = Object.freeze([
  { id: 'level', offsets: [0, 0, 0, 0, 0], amplitude: 0 },
  { id: 'climb', offsets: [1, 0.5, 0, -0.5, -1], amplitude: 80 },
  { id: 'dive', offsets: [-1, -0.5, 0, 0.5, 1], amplitude: 80 },
  { id: 'wave', offsets: [0, 1, 0, -1, 0], amplitude: 65 },
  { id: 'zigzag', offsets: [0, -1, 1, -1, 0], amplitude: 40 },
  { id: 'arch', offsets: [0, -1, -1.5, -1, 0], amplitude: 55 },
  { id: 'valley', offsets: [0, 1, 1.5, 1, 0], amplitude: 55 },
].map(pattern => Object.freeze({ ...pattern, offsets: Object.freeze(pattern.offsets) })));
export const CLASSIC_SETTINGS = Object.freeze({
  gravity: 1050, impulse: -350, speed: 130, gap: 210,
  maxSpeed: 260, speedGraceGates: 5, speedPerGate: 4, acceleration: 12,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createGame({ random = Math.random } = {}) {
  const game = { _random: typeof random === 'function' ? random : Math.random };
  return resetGame(game);
}

/** Reset in place so renderers may safely retain the game reference. */
export function resetGame(game) {
  game.mode = 'classic';
  game.settings = CLASSIC_SETTINGS;
  game.state = 'ready';
  game.bird = { x: BIRD_X, y: BIRD_Y, vy: 0, rotation: 0, radius: BIRD_RADIUS };
  game.obstacles = [];
  game.score = 0;
  game.coins = 0;
  game.time = 0;
  game.distance = 0;
  game.speed = game.settings.speed;
  game.events = [];
  game._accumulator = 0;
  game._nextId = 1;
  game._patternQueue = WARMUP_HEIGHTS.map(gapY => ({ gapY, pattern: 'warmup' }));
  game._patternBag = [];
  game._lastPattern = null;
  return game;
}

export function startGame(game) {
  if (game.state !== 'ready') return false;
  game.state = 'playing';
  addObstacle(game, FIRST_X);
  return true;
}

/** A tap starts the run and applies one flap. Restart is always explicit. */
export function flap(game) {
  if (game.state === 'ready') startGame(game);
  if (game.state !== 'playing') return false;
  game.bird.vy = game.settings.impulse;
  game.bird.rotation = -0.38;
  game.events.push({ type: 'flap', x: game.bird.x, y: game.bird.y });
  return true;
}

export function pauseGame(game) {
  if (game.state !== 'playing') return false;
  game.state = 'paused';
  return true;
}

export function resumeGame(game) {
  if (game.state !== 'paused') return false;
  game.state = 'playing';
  return true;
}

function randomUnit(game) {
  const rawRandom = game._random();
  return Number.isFinite(rawRandom) ? clamp(rawRandom, 0, 1) : 0.5;
}

function planPattern(game) {
  // A shuffled bag gives each flight variety without repeating a block twice.
  if (!game._patternBag.length) {
    game._patternBag = [...GATE_PATTERNS];
    for (let i = game._patternBag.length - 1; i > 0; i -= 1) {
      const j = Math.min(i, Math.floor(randomUnit(game) * (i + 1)));
      [game._patternBag[i], game._patternBag[j]] = [game._patternBag[j], game._patternBag[i]];
    }
    if (game._patternBag.at(-1).id === game._lastPattern) {
      const last = game._patternBag.length - 1;
      [game._patternBag[0], game._patternBag[last]] = [game._patternBag[last], game._patternBag[0]];
    }
  }
  const pattern = game._patternBag.pop();
  const amplitude = pattern.amplitude * (0.9 + randomUnit(game) * 0.2);
  const anchor = clamp(BIRD_Y + (randomUnit(game) - 0.5) * 80,
    MIN_GAP_Y - Math.min(...pattern.offsets) * amplitude,
    MAX_GAP_Y - Math.max(...pattern.offsets) * amplitude);
  const heights = pattern.offsets.map(offset => anchor + offset * amplitude);
  let previousGapY = game.obstacles.at(-1)?.gapY ?? BIRD_Y;
  // Bridge distant entries before the block, preserving the pattern's shape.
  while (Math.abs(heights[0] - previousGapY) > MAX_GAP_CHANGE) {
    previousGapY += Math.sign(heights[0] - previousGapY) * MAX_GAP_CHANGE;
    game._patternQueue.push({ gapY: previousGapY, pattern: 'transition' });
  }
  game._patternQueue.push(...heights.map(gapY => ({ gapY, pattern: pattern.id })));
  game._lastPattern = pattern.id;
}

function addObstacle(game, x) {
  if (!game._patternQueue.length) planPattern(game);
  const { gapY, pattern } = game._patternQueue.shift();
  const gap = game.settings.gap;
  game.obstacles.push({
    id: game._nextId++, x, gapY, gap, pattern, width: OBSTACLE_WIDTH, passed: false,
    coin: { x: x + OBSTACLE_WIDTH / 2, y: gapY, radius: 12, collected: false },
  });
}

function circleTouchesRect(bird, left, top, right, bottom) {
  const dx = bird.x - clamp(bird.x, left, right);
  const dy = bird.y - clamp(bird.y, top, bottom);
  return dx * dx + dy * dy <= bird.radius * bird.radius;
}

function crash(game, reason, obstacleId) {
  game.state = 'over';
  game.bird.vy = 0;
  game._accumulator = 0;
  game.events.push({ type: 'crash', reason, obstacleId, x: game.bird.x, y: game.bird.y });
}

function stepGame(game) {
  const bird = game.bird;
  game.time += STEP;
  const targetSpeed = Math.min(game.settings.maxSpeed, game.settings.speed
    + Math.max(0, game.score - game.settings.speedGraceGates) * game.settings.speedPerGate);
  // Ease toward the score's pace so clearing a gate never causes a speed jump.
  game.speed = Math.min(targetSpeed, game.speed + game.settings.acceleration * STEP);
  const travel = game.speed * STEP;
  game.distance += travel;
  bird.y += bird.vy * STEP + 0.5 * game.settings.gravity * STEP * STEP;
  bird.vy += game.settings.gravity * STEP;
  const targetRotation = clamp(bird.vy / 500, -0.42, 1.15);
  bird.rotation += (targetRotation - bird.rotation) * (1 - Math.exp(-9 * STEP));

  for (const obstacle of game.obstacles) {
    obstacle.x -= travel;
    if (obstacle.coin) obstacle.coin.x = obstacle.x + obstacle.width / 2;
  }

  if (bird.y - bird.radius <= 0) {
    bird.y = bird.radius;
    crash(game, 'ceiling');
    return;
  }
  if (bird.y + bird.radius >= WORLD.groundY) {
    bird.y = WORLD.groundY - bird.radius;
    crash(game, 'ground');
    return;
  }

  for (const obstacle of game.obstacles) {
    const top = obstacle.gapY - obstacle.gap / 2;
    const bottom = obstacle.gapY + obstacle.gap / 2;
    if (circleTouchesRect(bird, obstacle.x, 0, obstacle.x + obstacle.width, top)
      || circleTouchesRect(bird, obstacle.x, bottom, obstacle.x + obstacle.width, WORLD.groundY)) {
      crash(game, 'obstacle', obstacle.id);
      return;
    }
  }

  for (const obstacle of game.obstacles) {
    const coin = obstacle.coin;
    if (coin && !coin.collected) {
      const radius = bird.radius + (coin.radius || 12);
      if ((bird.x - coin.x) ** 2 + (bird.y - coin.y) ** 2 <= radius ** 2) {
        coin.collected = true;
        game.coins += 1;
        game.events.push({ type: 'coin', obstacleId: obstacle.id, coins: game.coins, x: coin.x, y: coin.y });
      }
    }
    if (!obstacle.passed && obstacle.x + obstacle.width < bird.x) {
      obstacle.passed = true;
      game.score += 1;
      game.events.push({ type: 'score', obstacleId: obstacle.id, score: game.score });
    }
  }

  game.obstacles = game.obstacles.filter(obstacle => obstacle.x + obstacle.width > -20);
  const last = game.obstacles.at(-1);
  if (!last) addObstacle(game, FIRST_X);
  else if (last.x < WORLD.width + 140) addObstacle(game, last.x + SPACING);
}

/**
 * Advance seconds, with fixed physics steps independent of display frame rate.
 * Events describe only this call; consume flap events immediately after flap().
 * A long browser stall advances at most 250 ms; visibility handlers should pause.
 */
export function updateGame(game, dt) {
  game.events = [];
  if (game.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
  game._accumulator += Math.min(dt, 0.25);
  while (game._accumulator + 1e-10 >= STEP && game.state === 'playing') {
    game._accumulator -= STEP;
    if (game._accumulator < 0) game._accumulator = 0;
    stepGame(game);
  }
  return game;
}
