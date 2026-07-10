const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    if (force) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(id) {
    this.id = id;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.textContent = "";
    this.value = "";
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) {
      listener({ target: this, ...event });
    }
  }
}

class FakeAudio {
  constructor(src = "") {
    this.src = src;
    this.volume = 1;
    this.currentTime = 0;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  play() {
    return Promise.resolve();
  }

  pause() {}
}

const createHarness = () => {
  const ids = Array.from(html.matchAll(/id="([^"]+)"/g), (match) => match[1]);
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const context2d = {
    fillRect() {},
    fillText() {},
    strokeRect() {},
  };
  Object.assign(elements.game, {
    width: 320,
    height: 180,
    getContext: () => context2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
  });

  const equipmentOptions = ["feather", "guidance", "shotgun"].map((value) => ({
    value,
    checked: true,
    addEventListener() {},
  }));
  const windowListeners = new Map();
  const fakeWindow = {
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
  };
  const sandbox = {
    Audio: FakeAudio,
    clearTimeout,
    console,
    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: () => equipmentOptions,
    },
    Math,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    setTimeout,
    window: fakeWindow,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(gameSource, context, { filename: "game.js" });

  return {
    click(id) {
      elements[id].dispatch("click");
    },
    elements,
    evaluate(expression) {
      return vm.runInContext(expression, context);
    },
    keydown(key) {
      const event = { key, preventDefault() {} };
      for (const listener of windowListeners.get("keydown") || []) listener(event);
    },
  };
};

const assertVisibleOverlay = (harness, expectedId) => {
  for (const id of ["startMenu", "settingsMenu", "pauseMenu", "gameOverMenu"]) {
    assert.equal(
      harness.elements[id].classList.contains("visible"),
      id === expectedId,
      `${id} visibility`
    );
  }
};

test("pause menu can restart or return to the title", () => {
  const harness = createHarness();
  harness.click("startGameBtn");
  harness.evaluate("state.time = 12");
  harness.keydown("Escape");

  assert.equal(harness.evaluate("state.scene"), "paused");
  assertVisibleOverlay(harness, "pauseMenu");

  harness.click("restartFromPauseBtn");
  assert.equal(harness.evaluate("state.scene"), "playing");
  assert.equal(harness.evaluate("state.time"), 0);
  assertVisibleOverlay(harness, null);

  harness.keydown("Escape");
  harness.click("backToMenuBtn");
  assert.equal(harness.evaluate("state.scene"), "menu");
  assertVisibleOverlay(harness, "startMenu");
});

test("game over menu can restart or return to the title", () => {
  const harness = createHarness();
  harness.click("startGameBtn");
  harness.evaluate("state.time = 27.8; state.kills = 4; player.hp = 0; update(0)");

  assert.equal(harness.evaluate("state.scene"), "gameOver");
  assert.equal(harness.evaluate("state.gameOver"), true);
  assert.equal(harness.elements.gameOverSummary.textContent, "坚持 27 秒，击败 4 个敌人");
  assertVisibleOverlay(harness, "gameOverMenu");

  harness.click("restartGameBtn");
  assert.equal(harness.evaluate("state.scene"), "playing");
  assert.equal(harness.evaluate("state.gameOver"), false);
  assertVisibleOverlay(harness, null);

  harness.evaluate("player.hp = 0; update(0)");
  harness.click("gameOverBackToMenuBtn");
  assert.equal(harness.evaluate("state.scene"), "menu");
  assertVisibleOverlay(harness, "startMenu");
});

test("R closes pause and game over menus when restarting", () => {
  const harness = createHarness();
  harness.click("startGameBtn");
  harness.keydown("Escape");
  harness.keydown("r");
  assert.equal(harness.evaluate("state.scene"), "playing");
  assertVisibleOverlay(harness, null);

  harness.evaluate("player.hp = 0; update(0)");
  harness.keydown("r");
  assert.equal(harness.evaluate("state.scene"), "playing");
  assert.equal(harness.evaluate("state.gameOver"), false);
  assertVisibleOverlay(harness, null);
});

test("enemies move outside attack range and only fire after entering it", () => {
  const harness = createHarness();
  harness.click("startGameBtn");

  const result = harness.evaluate(`
    enemies.length = 0;
    enemyBullets.length = 0;
    player.x = 0;
    player.y = 0;
    enemies.push({
      x: ENEMY_DETECTION_RANGE + 40,
      y: 0,
      radius: 1,
      speed: 10,
      hp: 10,
      maxHp: 10,
      color: "#fff",
      bulletCooldown: 1,
      bulletTimer: 0,
      bulletSpeed: 10,
      pattern: "single",
      contactTimer: 1,
      damage: 1,
    });

    const initialX = enemies[0].x;
    updateEnemies(1);
    const outsideRange = {
      moved: enemies[0].x < initialX,
      bulletCount: enemyBullets.length,
    };

    enemies[0].x = ENEMY_DETECTION_RANGE - 10;
    enemies[0].bulletTimer = 0;
    updateEnemies(0);

    ({
      outsideRange,
      insideRangeBulletCount: enemyBullets.length,
    });
  `);

  assert.equal(result.outsideRange.moved, true);
  assert.equal(result.outsideRange.bulletCount, 0);
  assert.equal(result.insideRangeBulletCount, 1);
});
