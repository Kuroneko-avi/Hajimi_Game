const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context2d = {
  fillRect() {},
  fillText() {},
  strokeRect() {},
};

const canvas = {
  width: 960,
  height: 540,
  getContext: () => context2d,
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    width: 960,
    height: 540,
  }),
};

const elements = new Map();
const createElementStub = () => ({
  value: "",
  textContent: "",
  classList: { toggle() {} },
  addEventListener() {},
});

class AudioStub {
  addEventListener() {}
  load() {}
  pause() {}
  play() {
    return Promise.resolve();
  }
}

const sandbox = {
  Audio: AudioStub,
  console,
  clearTimeout,
  document: {
    getElementById(id) {
      if (id === "game") return canvas;
      if (!elements.has(id)) elements.set(id, createElementStub());
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    },
  },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setTimeout,
  window: { addEventListener() {} },
};

const gamePath = path.join(__dirname, "..", "game.js");
const gameSource = fs.readFileSync(gamePath, "utf8");
const assertions = `
  player.equipment = ["guidance"];
  player.x = 100;
  player.y = 100;
  player.bulletSpeed = 150;
  input.mouse.x = 200;
  input.mouse.y = 100;

  enemies.length = 0;
  const lockedTarget = { x: 100, y: 300, hp: 100 };
  enemies.push(lockedTarget);
  firePlayerBullet();

  const bullet = playerBullets[0];
  const launchSpeed = Math.hypot(bullet.vx, bullet.vy);
  const lockedAtLaunch = bullet.homingTarget === lockedTarget;

  const closerTargetAddedLater = { x: 110, y: 110, hp: 100 };
  enemies.push(closerTargetAddedLater);
  let maximumSpeedError = 0;
  for (let i = 0; i < 30; i += 1) {
    updateBullets(playerBullets, 1 / 60, true);
    maximumSpeedError = Math.max(
      maximumSpeedError,
      Math.abs(Math.hypot(bullet.vx, bullet.vy) - launchSpeed)
    );
  }
  const keptOriginalTarget = bullet.homingTarget === lockedTarget;
  const velocityWhileTargetAlive = { vx: bullet.vx, vy: bullet.vy };

  const velocityBeforeTargetDeath = { vx: bullet.vx, vy: bullet.vy };
  lockedTarget.hp = 0;
  lockedTarget.x = 800;
  lockedTarget.y = 500;
  updateBullets(playerBullets, 1 / 60, true);
  const velocityAfterTargetDeath = { vx: bullet.vx, vy: bullet.vy };

  playerBullets.length = 0;
  enemies.length = 0;
  firePlayerBullet();
  const unguidedBullet = playerBullets[0];

  playerBullets.length = 0;
  enemies.length = 0;
  player.x = 400;
  player.y = 270;
  input.mouse.x = 500;
  input.mouse.y = 270;
  const rearTarget = { x: 300, y: 270, hp: 100 };
  enemies.push(rearTarget);
  firePlayerBullet();
  const rearTargetBullet = playerBullets[0];
  updateBullets(playerBullets, 1 / 60, true);
  const rearTargetVelocity = {
    vx: rearTargetBullet.vx,
    vy: rearTargetBullet.vy,
    speed: Math.hypot(rearTargetBullet.vx, rearTargetBullet.vy),
  };

  globalThis.guidanceTestResult = {
    launchSpeed,
    maximumSpeedError,
    lockedAtLaunch,
    keptOriginalTarget,
    velocityWhileTargetAlive,
    velocityBeforeTargetDeath,
    velocityAfterTargetDeath,
    noTargetWithoutEnemies: unguidedBullet.homingTarget === null,
    rearTargetVelocity,
  };
`;

vm.runInNewContext(`${gameSource}\n${assertions}`, sandbox, {
  filename: gamePath,
});

const result = sandbox.guidanceTestResult;
assert.strictEqual(result.launchSpeed, 150);
assert.strictEqual(result.lockedAtLaunch, true);
assert.strictEqual(result.keptOriginalTarget, true);
assert.ok(result.maximumSpeedError < 1e-10);
assert.ok(result.velocityWhileTargetAlive.vx < result.launchSpeed);
assert.ok(result.velocityWhileTargetAlive.vy > 0);
assert.deepStrictEqual(
  result.velocityAfterTargetDeath,
  result.velocityBeforeTargetDeath
);
assert.strictEqual(result.noTargetWithoutEnemies, true);
assert.ok(result.rearTargetVelocity.vx < result.launchSpeed);
assert.ok(Math.abs(result.rearTargetVelocity.vy) > 1);
assert.ok(Math.abs(result.rearTargetVelocity.speed - result.launchSpeed) < 1e-10);

console.log(
  "Guidance target locking, constant speed, and target-death checks passed."
);
