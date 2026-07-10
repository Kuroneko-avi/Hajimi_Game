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
  player.equipment = ["shotgun"];
  player.x = 100;
  player.y = 100;
  player.bulletSpeed = 150;
  input.mouse.x = 200;
  input.mouse.y = 100;

  const fireWithRandomValue = (value) => {
    playerBullets.length = 0;
    Math.random = () => value;
    firePlayerBullet();
    return playerBullets.map((bullet) => ({
      angle: Math.atan2(bullet.vy, bullet.vx),
      speed: Math.hypot(bullet.vx, bullet.vy),
    }));
  };

  const sequence = [0];
  for (let i = 0; i < SHOTGUN_MIN_PELLETS; i += 1) {
    sequence.push(0.5, i % 2 === 0 ? 0.25 : 0.75);
  }
  let sequenceIndex = 0;
  playerBullets.length = 0;
  Math.random = () => sequence[sequenceIndex++];
  firePlayerBullet();
  const sequencedSpeeds = playerBullets.map((bullet) =>
    Math.hypot(bullet.vx, bullet.vy)
  );

  const minimumPellets = fireWithRandomValue(0);
  const maximumPellets = fireWithRandomValue(1 - Number.EPSILON);
  const fireRateUpgrade = itemTypes.find((item) => item.id === "fire");

  player.fireRate = SHOTGUN_FIRE_RATE;
  fireRateUpgrade.apply();
  const firstUpgradedFireRate = player.fireRate;
  fireRateUpgrade.apply();
  const secondUpgradedFireRate = player.fireRate;
  player.fireRate = 0.081;
  fireRateUpgrade.apply();

  globalThis.shotgunTestResult = {
    minimumPellets,
    maximumPellets,
    sequencedSpeeds,
    firstUpgradedFireRate,
    secondUpgradedFireRate,
    cappedFireRate: player.fireRate,
  };
`;

vm.runInNewContext(`${gameSource}\n${assertions}`, sandbox, {
  filename: gamePath,
});

const result = sandbox.shotgunTestResult;
assert.strictEqual(result.minimumPellets.length, 15);
assert.strictEqual(result.maximumPellets.length, 22);
assert.strictEqual(result.sequencedSpeeds.length, 15);

result.minimumPellets.forEach(({ angle, speed }) => {
  assert.ok(Math.abs(angle + Math.PI / 4) < 1e-12);
  assert.ok(Math.abs(speed - 105) < 1e-12);
});

result.maximumPellets.forEach(({ angle, speed }) => {
  assert.ok(angle <= Math.PI / 4 && angle > Math.PI / 4 - 1e-12);
  assert.ok(speed <= 195 && speed > 195 - 1e-10);
});

result.sequencedSpeeds.forEach((speed, index) => {
  const expectedSpeed = index % 2 === 0 ? 127.5 : 172.5;
  assert.ok(Math.abs(speed - expectedSpeed) < 1e-12);
});

assert.ok(Math.abs(result.firstUpgradedFireRate - 0.9) < 1e-12);
assert.ok(Math.abs(result.secondUpgradedFireRate - 0.81) < 1e-12);
assert.strictEqual(result.cappedFireRate, 0.08);

console.log(
  "Shotgun spread, pellet speed, and fire-rate upgrade checks passed."
);
