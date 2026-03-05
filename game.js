const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const MAX_DELTA_TIME = 1 / 30;

const world = {
  width: canvas.width,
  height: canvas.height,
};

const input = {
  keys: new Set(),
  mouse: { x: world.width / 2, y: world.height / 2, down: false },
};

const player = {
  x: world.width / 2,
  y: world.height / 2,
  radius: 6,
  speed: 70,
  hp: 100,
  maxHp: 100,
  fireRate: 0.22,
  fireTimer: 0,
  bulletSpeed: 150,
  damage: 12,
};

const state = {
  time: 0,
  spawnTimer: 0,
  kills: 0,
  gameOver: false,
  lastTime: performance.now(),
};

const enemyTypes = [
  {
    id: "crawler",
    color: "#f77fbe",
    radius: 6,
    speed: 26,
    hp: 40,
    bulletCooldown: 1.6,
    bulletSpeed: 70,
    pattern: "single",
  },
  {
    id: "stinger",
    color: "#ffd43b",
    radius: 5,
    speed: 34,
    hp: 28,
    bulletCooldown: 1.2,
    bulletSpeed: 85,
    pattern: "spread",
  },
  {
    id: "guardian",
    color: "#63e6be",
    radius: 8,
    speed: 20,
    hp: 70,
    bulletCooldown: 2.4,
    bulletSpeed: 60,
    pattern: "burst",
  },
];

const itemTypes = [
  {
    id: "health",
    color: "#ff6b6b",
    label: "生命+",
    apply: () => {
      player.maxHp += 8;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: "speed",
    color: "#4dabf7",
    label: "速度+",
    apply: () => {
      player.speed += 6;
    },
  },
  {
    id: "fire",
    color: "#ffd43b",
    label: "射速+",
    apply: () => {
      player.fireRate = Math.max(0.08, player.fireRate - 0.02);
    },
  },
  {
    id: "damage",
    color: "#b197fc",
    label: "伤害+",
    apply: () => {
      player.damage += 3;
    },
  },
];

const enemies = [];
const playerBullets = [];
const enemyBullets = [];
const items = [];
const floatingTexts = [];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomRange = (min, max) => min + Math.random() * (max - min);

const getDifficulty = () => 1 + state.time / 60;

const resetGame = () => {
  player.x = world.width / 2;
  player.y = world.height / 2;
  player.speed = 70;
  player.hp = 100;
  player.maxHp = 100;
  player.fireRate = 0.22;
  player.fireTimer = 0;
  player.bulletSpeed = 150;
  player.damage = 12;
  state.time = 0;
  state.spawnTimer = 0;
  state.kills = 0;
  state.gameOver = false;
  enemies.length = 0;
  playerBullets.length = 0;
  enemyBullets.length = 0;
  items.length = 0;
  floatingTexts.length = 0;
};

const spawnEnemy = () => {
  const tier = Math.min(
    enemyTypes.length - 1,
    Math.floor(state.time / 35)
  );
  const available = enemyTypes.slice(0, tier + 1);
  const type = available[Math.floor(Math.random() * available.length)];
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const padding = 10;
  if (side === 0) {
    x = randomRange(0, world.width);
    y = -padding;
  } else if (side === 1) {
    x = world.width + padding;
    y = randomRange(0, world.height);
  } else if (side === 2) {
    x = randomRange(0, world.width);
    y = world.height + padding;
  } else {
    x = -padding;
    y = randomRange(0, world.height);
  }
  const difficulty = getDifficulty();
  enemies.push({
    x,
    y,
    radius: type.radius,
    speed: type.speed * (1 + state.time / 180),
    hp: type.hp * difficulty,
    maxHp: type.hp * difficulty,
    color: type.color,
    bulletCooldown: type.bulletCooldown,
    bulletTimer: randomRange(0, type.bulletCooldown),
    bulletSpeed: type.bulletSpeed * (1 + state.time / 200),
    pattern: type.pattern,
    contactTimer: 0,
    damage: 6 * difficulty,
  });
};

const spawnItem = (x, y) => {
  const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  items.push({
    x,
    y,
    radius: 4,
    color: type.color,
    label: type.label,
    apply: type.apply,
    lifetime: 12,
  });
};

const createBullet = (collection, x, y, vx, vy, radius, color, damage) => {
  collection.push({ x, y, vx, vy, radius, color, damage });
};

const firePlayerBullet = () => {
  const dx = input.mouse.x - player.x;
  const dy = input.mouse.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const vx = (dx / distance) * player.bulletSpeed;
  const vy = (dy / distance) * player.bulletSpeed;
  createBullet(
    playerBullets,
    player.x,
    player.y,
    vx,
    vy,
    2,
    "#a5d8ff",
    player.damage
  );
};

const fireEnemyBullets = (enemy) => {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const baseAngle = Math.atan2(dy, dx);
  const speed = enemy.bulletSpeed;
  const damage = enemy.damage;
  if (enemy.pattern === "single") {
    createBullet(
      enemyBullets,
      enemy.x,
      enemy.y,
      Math.cos(baseAngle) * speed,
      Math.sin(baseAngle) * speed,
      2,
      "#ff8787",
      damage
    );
    return;
  }
  if (enemy.pattern === "spread") {
    [-0.35, 0, 0.35].forEach((offset) => {
      const angle = baseAngle + offset;
      createBullet(
        enemyBullets,
        enemy.x,
        enemy.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2,
        "#ffd43b",
        damage
      );
    });
    return;
  }
  for (let i = 0; i < 6; i += 1) {
    const angle = baseAngle + (Math.PI * 2 * i) / 6;
    createBullet(
      enemyBullets,
      enemy.x,
      enemy.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      2,
      "#63e6be",
      damage
    );
  }
};

const updatePlayer = (dt) => {
  let moveX = 0;
  let moveY = 0;
  if (input.keys.has("w") || input.keys.has("arrowup")) moveY -= 1;
  if (input.keys.has("s") || input.keys.has("arrowdown")) moveY += 1;
  if (input.keys.has("a") || input.keys.has("arrowleft")) moveX -= 1;
  if (input.keys.has("d") || input.keys.has("arrowright")) moveX += 1;
  const length = Math.hypot(moveX, moveY) || 1;
  const speed = player.speed * dt;
  player.x += (moveX / length) * speed;
  player.y += (moveY / length) * speed;
  player.x = clamp(player.x, player.radius, world.width - player.radius);
  player.y = clamp(player.y, player.radius, world.height - player.radius);

  player.fireTimer -= dt;
  if (input.mouse.down && player.fireTimer <= 0) {
    firePlayerBullet();
    player.fireTimer = player.fireRate;
  }
};

const updateBullets = (collection, dt) => {
  for (let i = collection.length - 1; i >= 0; i -= 1) {
    const bullet = collection[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (
      bullet.x < -10 ||
      bullet.x > world.width + 10 ||
      bullet.y < -10 ||
      bullet.y > world.height + 10
    ) {
      collection.splice(i, 1);
    }
  }
};

const updateEnemies = (dt) => {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / distance) * enemy.speed * dt;
    enemy.y += (dy / distance) * enemy.speed * dt;

    enemy.bulletTimer -= dt;
    if (enemy.bulletTimer <= 0) {
      fireEnemyBullets(enemy);
      const difficulty = getDifficulty();
      enemy.bulletTimer =
        enemy.bulletCooldown / Math.min(2.5, 1 + difficulty * 0.25);
    }

    enemy.contactTimer -= dt;
    if (distance < enemy.radius + player.radius && enemy.contactTimer <= 0) {
      player.hp = Math.max(0, player.hp - enemy.damage);
      enemy.contactTimer = 0.7;
      const push = 8;
      enemy.x -= (dx / distance) * push;
      enemy.y -= (dy / distance) * push;
    }
  }
};

const handleCollisions = () => {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    for (let j = playerBullets.length - 1; j >= 0; j -= 1) {
      const bullet = playerBullets[j];
      const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
      if (distance < enemy.radius + bullet.radius) {
        enemy.hp -= bullet.damage;
        playerBullets.splice(j, 1);
        if (enemy.hp <= 0) {
          enemies.splice(i, 1);
          state.kills += 1;
          if (Math.random() < 0.28) {
            spawnItem(enemy.x, enemy.y);
          }
        }
        break;
      }
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    const distance = Math.hypot(player.x - bullet.x, player.y - bullet.y);
    if (distance < player.radius + bullet.radius) {
      player.hp = Math.max(0, player.hp - bullet.damage);
      enemyBullets.splice(i, 1);
    }
  }

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const distance = Math.hypot(player.x - item.x, player.y - item.y);
    if (distance < player.radius + item.radius) {
      item.apply();
      floatingTexts.push({
        text: item.label,
        x: item.x,
        y: item.y,
        time: 1.2,
      });
      items.splice(i, 1);
    }
  }
};

const updateItems = (dt) => {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    item.lifetime -= dt;
    if (item.lifetime <= 0) {
      items.splice(i, 1);
    }
  }
};

const updateFloatingTexts = (dt) => {
  for (let i = floatingTexts.length - 1; i >= 0; i -= 1) {
    const text = floatingTexts[i];
    text.time -= dt;
    text.y -= 12 * dt;
    if (text.time <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
};

const update = (dt) => {
  if (state.gameOver) return;
  state.time += dt;
  state.spawnTimer -= dt;
  const spawnInterval = Math.max(0.45, 2.3 - state.time / 35);
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = spawnInterval;
  }
  updatePlayer(dt);
  updateBullets(playerBullets, dt);
  updateBullets(enemyBullets, dt);
  updateEnemies(dt);
  updateItems(dt);
  updateFloatingTexts(dt);
  handleCollisions();

  if (player.hp <= 0) {
    state.gameOver = true;
  }
};

const drawPlayer = () => {
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(player.x - 4, player.y - 4, 8, 8);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x - 2, player.y - 1, 1, 1);
  ctx.fillRect(player.x + 1, player.y - 1, 1, 1);
};

const drawEnemies = () => {
  enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(
      enemy.x - enemy.radius,
      enemy.y - enemy.radius,
      enemy.radius * 2,
      enemy.radius * 2
    );
    ctx.fillStyle = "#111827";
    const hpRatio = enemy.hp / enemy.maxHp;
    ctx.fillRect(
      enemy.x - enemy.radius,
      enemy.y - enemy.radius - 4,
      enemy.radius * 2 * hpRatio,
      2
    );
  });
};

const drawBullets = (collection) => {
  collection.forEach((bullet) => {
    ctx.fillStyle = bullet.color;
    ctx.fillRect(
      bullet.x - bullet.radius,
      bullet.y - bullet.radius,
      bullet.radius * 2,
      bullet.radius * 2
    );
  });
};

const drawItems = () => {
  items.forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.fillRect(
      item.x - item.radius,
      item.y - item.radius,
      item.radius * 2,
      item.radius * 2
    );
  });
};

const drawFloatingTexts = () => {
  ctx.font = "8px monospace";
  ctx.fillStyle = "#f8f9fa";
  floatingTexts.forEach((text) => {
    ctx.fillText(text.text, text.x - 6, text.y);
  });
};

const drawHud = () => {
  ctx.fillStyle = "#111827";
  ctx.fillRect(6, 6, 120, 44);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(8, 8, 116 * (player.hp / player.maxHp), 6);
  ctx.fillStyle = "#f8f9fa";
  ctx.font = "8px monospace";
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, 10, 20);
  ctx.fillText(`击败 ${state.kills}`, 10, 32);
  ctx.fillText(`时间 ${state.time.toFixed(0)}s`, 10, 42);
};

const drawBackground = () => {
  ctx.fillStyle = "#10131f";
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = "#1b2233";
  for (let x = 0; x < world.width; x += 16) {
    ctx.fillRect(x, 0, 1, world.height);
  }
  for (let y = 0; y < world.height; y += 16) {
    ctx.fillRect(0, y, world.width, 1);
  }
};

const drawGameOver = () => {
  if (!state.gameOver) return;
  ctx.fillStyle = "rgba(15, 17, 23, 0.7)";
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = "#f8f9fa";
  ctx.font = "12px monospace";
  ctx.fillText("游戏结束", world.width / 2 - 24, world.height / 2 - 4);
  ctx.font = "8px monospace";
  ctx.fillText("按 R 重新开始", world.width / 2 - 36, world.height / 2 + 12);
};

const render = () => {
  drawBackground();
  drawItems();
  drawBullets(playerBullets);
  drawBullets(enemyBullets);
  drawEnemies();
  drawPlayer();
  drawFloatingTexts();
  drawHud();
  drawGameOver();
};

const loop = (timestamp) => {
  const dt = Math.min(MAX_DELTA_TIME, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
};

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "r") {
    resetGame();
    return;
  }
  input.keys.add(key);
});

window.addEventListener("keyup", (event) => {
  input.keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  input.mouse.x = (event.clientX - rect.left) * scaleX;
  input.mouse.y = (event.clientY - rect.top) * scaleY;
});

canvas.addEventListener("mousedown", () => {
  input.mouse.down = true;
});

window.addEventListener("mouseup", () => {
  input.mouse.down = false;
});

canvas.addEventListener("mouseleave", () => {
  input.mouse.down = false;
});

resetGame();
requestAnimationFrame(loop);
