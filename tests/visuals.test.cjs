const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const drawCalls = [];
const context2d = {
  arc(...args) {
    drawCalls.push({ type: "arc", args });
  },
  beginPath() {
    drawCalls.push({ type: "beginPath" });
  },
  fill() {
    drawCalls.push({ type: "fill" });
  },
  fillRect(...args) {
    drawCalls.push({ type: "fillRect", args });
  },
  fillText(...args) {
    drawCalls.push({ type: "fillText", args });
  },
  lineTo(...args) {
    drawCalls.push({ type: "lineTo", args });
  },
  moveTo(...args) {
    drawCalls.push({ type: "moveTo", args });
  },
  restore() {
    drawCalls.push({ type: "restore" });
  },
  save() {
    drawCalls.push({ type: "save" });
  },
  stroke() {
    drawCalls.push({ type: "stroke" });
  },
  strokeRect() {},
};

const canvas = {
  width: 320,
  height: 180,
  getContext: () => context2d,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }),
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
  const emojiByItemId = Object.fromEntries(
    itemTypes.map((item) => [item.id, item.emoji])
  );

  playerBullets.push({
    x: 20,
    y: 20,
    vx: 100,
    vy: 0,
    radius: 2,
    color: "#a5d8ff",
  });
  enemyBullets.push({
    x: 30,
    y: 30,
    vx: -50,
    vy: 0,
    radius: 2,
    color: "#ff8787",
  });
  items.push({ x: 40, y: 40, radius: 6, emoji: emojiByItemId.health });

  drawBullets(playerBullets, true);
  drawBullets(enemyBullets);
  drawItems();
  globalThis.visualTestResult = { emojiByItemId };
`;

vm.runInNewContext(`${gameSource}\n${assertions}`, sandbox, {
  filename: gamePath,
});

assert.deepStrictEqual(
  { ...sandbox.visualTestResult.emojiByItemId },
  {
    health: "❤️",
    speed: "👟",
    fire: "⚡",
    damage: "⚔️",
  }
);

assert.ok(drawCalls.some(({ type }) => type === "stroke"), "player bullet has a trail");
assert.ok(
  drawCalls.some(
    ({ type, args }) =>
      type === "arc" && args[0] === 20 && args[1] === 20 && args[2] === 2
  ),
  "player bullet is circular"
);
assert.ok(
  drawCalls.some(
    ({ type, args }) =>
      type === "fillRect" &&
      args[0] === 28 &&
      args[1] === 28 &&
      args[2] === 4 &&
      args[3] === 4
  ),
  "enemy bullet remains square"
);
assert.ok(
  drawCalls.some(
    ({ type, args }) =>
      type === "fillText" && args[0] === "❤️" && args[1] === 40 && args[2] === 40
  ),
  "item is rendered as an emoji"
);

console.log("Item and bullet visual checks passed.");
