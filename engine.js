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
const MAX_GAP_CHANGE = 140;
export const CLASSIC_SETTINGS = Object.freeze({ gravity: 1050, impulse: -350, speed: 150, gap: 190 });

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
  return game;
}

export function startGame(game) {
  if (game.state !== 'ready') return false;
  game.state = 'playing';
  addObstacle(game, FIRST_X, true);
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

function addObstacle(game, x, first = false) {
  const gap = game.settings.gap;
  const rawRandom = game._random();
  const random = Number.isFinite(rawRandom) ? clamp(rawRandom, 0, 1) : 0.5;
  const previousGapY = game.obstacles.at(-1)?.gapY ?? BIRD_Y;
  const targetGapY = MIN_GAP_Y + random * (MAX_GAP_Y - MIN_GAP_Y);
  // Keep the next opening reachable without a sudden climb or dive.
  const gapY = first ? BIRD_Y : clamp(targetGapY,
    Math.max(MIN_GAP_Y, previousGapY - MAX_GAP_CHANGE),
    Math.min(MAX_GAP_Y, previousGapY + MAX_GAP_CHANGE));
  game.obstacles.push({
    id: game._nextId++, x, gapY, gap, width: OBSTACLE_WIDTH, passed: false,
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
  game.speed = game.settings.speed;
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
