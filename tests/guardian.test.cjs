const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
  clearTimeout,
  console,
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
  Math,
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setTimeout,
  window: { addEventListener() {} },
};

const gamePath = path.join(__dirname, "..", "game.js");
const gameSource = fs.readFileSync(gamePath, "utf8");
const assertions = `
  const crawler = enemyTypes.find((type) => type.id === "crawler");
  const stinger = enemyTypes.find((type) => type.id === "stinger");
  const guardian = enemyTypes.find((type) => type.id === "guardian");

  state.time = 70;
  Math.random = () => 1 - Number.EPSILON;
  spawnEnemy();
  const spawnedGuardian = enemies[0];

  player.x = spawnedGuardian.x + 100;
  player.y = spawnedGuardian.y;
  fireEnemyBullets(spawnedGuardian);

  globalThis.guardianTestResult = {
    crawler: {
      speed: crawler.speed,
      bulletSpeed: crawler.bulletSpeed,
      bulletRadius: crawler.bulletRadius,
    },
    stinger: {
      speed: stinger.speed,
      bulletSpeed: stinger.bulletSpeed,
      bulletRadius: stinger.bulletRadius,
    },
    guardian: {
      speed: guardian.speed,
      bulletSpeed: guardian.bulletSpeed,
      bulletRadius: guardian.bulletRadius,
    },
    spawnedGuardian: {
      speed: spawnedGuardian.speed,
      bulletSpeed: spawnedGuardian.bulletSpeed,
      bulletRadius: spawnedGuardian.bulletRadius,
      pattern: spawnedGuardian.pattern,
    },
    bullets: enemyBullets.map((bullet) => ({
      radius: bullet.radius,
      speed: Math.hypot(bullet.vx, bullet.vy),
    })),
  };
`;

vm.runInNewContext(`${gameSource}\n${assertions}`, sandbox, {
  filename: gamePath,
});

const result = sandbox.guardianTestResult;

assert.equal(result.crawler.speed, 26);
assert.equal(result.crawler.bulletSpeed, 70);
assert.equal(result.crawler.bulletRadius, 2);
assert.equal(result.stinger.speed, 34);
assert.equal(result.stinger.bulletSpeed, 85);
assert.equal(result.stinger.bulletRadius, 2);
assert.equal(result.guardian.speed, 16);
assert.equal(result.guardian.bulletSpeed, 48);
assert.equal(result.guardian.bulletRadius, 3);

assert.equal(result.spawnedGuardian.pattern, "burst");
assert.equal(result.spawnedGuardian.bulletRadius, 3);
assert.ok(Math.abs(result.spawnedGuardian.speed - 16 * (1 + 70 / 180)) < 1e-12);
assert.ok(
  Math.abs(result.spawnedGuardian.bulletSpeed - 48 * (1 + 70 / 200)) < 1e-12
);
assert.equal(result.bullets.length, 6);
result.bullets.forEach((bullet) => {
  assert.equal(bullet.radius, 3);
  assert.ok(Math.abs(bullet.speed - result.spawnedGuardian.bulletSpeed) < 1e-12);
});

console.log("Guardian movement and projectile balance checks passed.");
