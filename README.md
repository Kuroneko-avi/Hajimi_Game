# Hajimi_Game

耄耋像素大战是一款2D像素风生存小游戏，玩家操控耄耋猫模因对抗无尽怪物。怪物会从四面八方涌入、随时间增强并发射不同弹幕，地图上随机掉落道具可强化角色。

## 部署文档

### 1. 环境要求

- Node.js 16+（建议使用 LTS 版本）
- npm 8+（通常随 Node.js 一起安装）
- Python 3.6+（用于本地静态文件服务；当前 `package.json` 中 `npm run start` 默认调用 `python3 -m http.server 8000`）
- 现代浏览器（Chrome / Edge / Firefox / Safari）

### 2. 本地部署（开发与自测）

1. 克隆仓库并进入目录：
   ```bash
   git clone https://github.com/Kuroneko-avi/Hajimi_Game.git
   cd Hajimi_Game
   ```
   > 如果你使用的是 Fork 仓库，请将上述地址替换为你自己的仓库 URL。
2. 安装依赖（当前项目依赖较少，仍建议执行以保证脚本环境一致）：
   ```bash
   npm install
   ```
3. 启动本地静态服务器：
   ```bash
   npm run start
   ```
4. 在浏览器访问：
   - `http://localhost:8000`
   - 若未自动加载，请手动打开 `http://localhost:8000/index.html`

### 3. 生产部署说明（静态站点）

本项目是纯前端静态资源（`index.html`、`game.js`、`styles.css`），可部署到任意静态托管平台或 Nginx/Apache。

#### 3.1 需要部署的文件

至少包含以下文件：

- `index.html`
- `game.js`
- `styles.css`

可选文件：

- `LICENSE`
- `README.md`

#### 3.2 Nginx 部署示例

1. 将项目文件上传到服务器目录（例如 `/var/www/hajimi_game`）。
2. 配置站点（示例）：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com; # 替换为你的实际域名

       root /var/www/hajimi_game;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
3. 重载 Nginx：
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

#### 3.3 GitHub Pages 部署示例

1. 将代码推送到 GitHub 仓库默认分支。
2. 打开仓库 `Settings` → `Pages`。
3. 在 **Build and deployment** 中选择：
   - Source: `Deploy from a branch`
   - Branch: `main`（或你的发布分支）/`root`
4. 保存后等待部署完成，访问系统生成的 Pages 链接。

### 4. 部署后验收清单

- 页面可正常打开且无 404（尤其是 `game.js`、`styles.css`）
- 角色可移动（WASD / 方向键）
- 鼠标左键可持续射击
- 怪物正常生成并移动
- 按 `R` 可重开

### 5. 常见问题排查

- **端口被占用**：将 `8000` 替换为其他端口，例如：
  ```bash
  python3 -m http.server 8080
  ```
- **资源加载失败（404）**：检查部署目录中是否遗漏 `game.js` 或 `styles.css`。
- **部署后空白页**：打开浏览器开发者工具查看 Console 报错，确认静态资源路径未被 CDN 或反向代理改写。

## 操作说明

- 移动：WASD 或方向键
- 瞄准：鼠标指向
- 射击：按住鼠标左键
- 暂停/继续：按 `ESC`
- 重新开始：按 R

## 音频资源说明

- 背景音乐会从 `assets/bgm/` 中随机循环播放（已预留路径，需自行放入音频文件）
- 音效路径预留在 `assets/sfx/` 下，包含：
  - `shoot.wav`（射击）
  - `hit.wav`（命中敌人）
  - `kill.wav`（击杀敌人）
  - `item.wav`（获得道具）
