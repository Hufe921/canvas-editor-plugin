import { ISnakeTheme } from '../interface'

export const DEFAULT_WIDTH = 600
export const DEFAULT_HEIGHT = 400
export const DEFAULT_SPEED = 150
export const GRID_SIZE = 20
export const SNAKE_MESSAGE_TYPE = 'canvas-editor-snake:game-over'
export const SNAKE_SCORE_MESSAGE_TYPE = 'canvas-editor-snake:score'

export const DEFAULT_THEME: Required<ISnakeTheme> = {
  background: '#0b1220',
  gridLine: 'rgba(125, 211, 252, 0.07)',
  snakeHead: '#a7f3d0',
  snakeBody: '#34d399',
  food: '#fb7185',
  text: '#e2e8f0'
}

export interface ISnakeGameConfig {
  gameId: string
  width: number
  height: number
  speed: number
  theme: Required<ISnakeTheme>
}

// 生成自包含的贪吃蛇游戏 HTML，作为 block iframe 的 srcdoc 使用
export function createSnakeGameHTML(config: ISnakeGameConfig): string {
  const json = JSON.stringify(config)
  const messageType = JSON.stringify(SNAKE_MESSAGE_TYPE)
  const scoreMessageType = JSON.stringify(SNAKE_SCORE_MESSAGE_TYPE)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: ${config.theme.background};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
    user-select: none;
  }
  #wrap {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* iframe 实际尺寸可能小于画布逻辑尺寸（文档缩放），等比缩放避免裁剪 */
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  #overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.72), rgba(2, 6, 23, 0.92));
    backdrop-filter: blur(3px);
    color: ${config.theme.text};
    text-align: center;
    cursor: pointer;
  }
  #overlay.hidden {
    display: none;
  }
  #overlay .logo {
    font-size: 44px;
    line-height: 1;
    filter: drop-shadow(0 0 14px rgba(52, 211, 153, 0.65));
    animation: bounce 1.6s ease-in-out infinite;
  }
  #overlay .title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 6px;
    background: linear-gradient(90deg, #6ee7b7, #22d3ee, #6ee7b7);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  #overlay .desc {
    font-size: 12px;
    opacity: 0.7;
    letter-spacing: 1px;
  }
  #overlay .pulse {
    font-size: 14px;
    font-weight: 600;
    color: #6ee7b7;
    animation: blink 1.4s ease-in-out infinite;
  }
  #overlay .go-title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 4px;
    background: linear-gradient(90deg, #fda4af, #fbbf24);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  #overlay .stats {
    display: flex;
    gap: 10px;
  }
  #overlay .stat {
    min-width: 72px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.22);
  }
  #overlay .stat b {
    display: block;
    font-size: 20px;
    color: #6ee7b7;
  }
  #overlay .stat span {
    font-size: 11px;
    opacity: 0.65;
  }
  #overlay button {
    margin-top: 4px;
    padding: 10px 34px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 2px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, #34d399, #22d3ee);
    color: #04220f;
    cursor: pointer;
    box-shadow: 0 0 18px rgba(52, 211, 153, 0.45);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  #overlay button:hover {
    transform: translateY(-1px) scale(1.03);
    box-shadow: 0 0 26px rgba(52, 211, 153, 0.7);
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
</style>
</head>
<body>
<div id="wrap">
  <canvas id="game"></canvas>
  <div id="overlay">
    <div class="logo">🐍</div>
    <div class="title">贪 吃 蛇</div>
    <div class="desc">方向键 / WASD 控制 · 吃到食物加速 · 失焦自动暂停</div>
    <div class="pulse">— 点击开始 —</div>
  </div>
</div>
<script>
  var CONFIG = ${json};
  var MESSAGE_TYPE = ${messageType};
  var SCORE_MESSAGE_TYPE = ${scoreMessageType};
  var GRID = ${GRID_SIZE};
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var overlay = document.getElementById('overlay');
  // 画布逻辑尺寸向下取整到格子整数倍，保证网格铺满无留白
  var COLS = Math.floor(CONFIG.width / GRID);
  var ROWS = Math.floor(CONFIG.height / GRID);
  canvas.width = COLS * GRID;
  canvas.height = ROWS * GRID;
  var state = 'idle'; // idle | running | paused | over
  var snake, direction, directionQueue, food, score, best, startedAt, timer;
  var elapsedMs = 0; // 暂停前累计用时，恢复时从零重新计时
  var particles = []; // 吃到食物的粒子特效
  var floaters = []; // 漂浮的 +1 文字

  function currentDuration() {
    return Math.floor((elapsedMs + (Date.now() - startedAt)) / 1000);
  }

  function intervalFor() {
    // 每吃 3 个食物提速一档，下限 80ms
    return Math.max(80, CONFIG.speed - Math.floor(score / 3) * 10);
  }

  function reset() {
    snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
    direction = { x: 1, y: 0 };
    directionQueue = [];
    score = 0;
    startedAt = Date.now();
    elapsedMs = 0;
    particles = [];
    floaters = [];
    placeFood();
  }

  function placeFood() {
    while (true) {
      var fx = Math.floor(Math.random() * COLS);
      var fy = Math.floor(Math.random() * ROWS);
      var hit = snake.some(function (s) { return s.x === fx && s.y === fy; });
      if (!hit) {
        food = { x: fx, y: fy };
        return;
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function spawnParticles(cx, cy, color) {
    for (var i = 0; i < 12; i++) {
      var angle = (Math.PI * 2 * i) / 12;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * 1.8, vy: Math.sin(angle) * 1.8,
        life: 1, color: color
      });
    }
  }

  function draw() {
    var now = Date.now();
    // 背景：纵向深空渐变
    var bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#0d1526');
    bg.addColorStop(1, '#0a0f1d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 网格
    ctx.strokeStyle = CONFIG.theme.gridLine;
    ctx.lineWidth = 1;
    for (var i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * GRID, 0);
      ctx.lineTo(i * GRID, canvas.height);
      ctx.stroke();
    }
    for (var j = 1; j < ROWS; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * GRID);
      ctx.lineTo(canvas.width, j * GRID);
      ctx.stroke();
    }
    // 食物：脉动光晕
    var pulse = 1 + Math.sin(now / 180) * 0.12;
    var fx = food.x * GRID + GRID / 2;
    var fy = food.y * GRID + GRID / 2;
    ctx.save();
    ctx.shadowColor = CONFIG.theme.food;
    ctx.shadowBlur = 14 * pulse;
    ctx.fillStyle = CONFIG.theme.food;
    ctx.beginPath();
    ctx.arc(fx, fy, (GRID / 2 - 3) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 蛇身：圆角方块，从头到尾渐变提亮
    for (var k = snake.length - 1; k >= 0; k--) {
      var ratio = snake.length === 1 ? 0 : k / snake.length;
      var sx = snake[k].x * GRID;
      var sy = snake[k].y * GRID;
      ctx.fillStyle = k === 0
        ? CONFIG.theme.snakeHead
        : blendColor(CONFIG.theme.snakeBody, ratio * 0.55);
      if (k === 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(52, 211, 153, 0.75)';
        ctx.shadowBlur = 10;
      }
      roundRect(sx + 1.5, sy + 1.5, GRID - 3, GRID - 3, 5);
      ctx.fill();
      if (k === 0) ctx.restore();
      // 蛇头画眼睛
      if (k === 0) {
        var ex = direction.x, ey = direction.y;
        var e1 = eyePos(sx, sy, ex, ey, 1);
        var e2 = eyePos(sx, sy, ex, ey, -1);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(e1.x, e1.y, 2.1, 0, Math.PI * 2);
        ctx.arc(e2.x, e2.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 粒子特效
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx; pt.y += pt.vy;
      pt.vx *= 0.94; pt.vy *= 0.94;
      pt.life -= 0.04;
      if (pt.life <= 0) { particles.splice(p, 1); continue; }
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
      ctx.globalAlpha = 1;
    }
    // 漂浮的 +1
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    for (var f = floaters.length - 1; f >= 0; f--) {
      var fl = floaters[f];
      fl.y -= 0.7;
      fl.life -= 0.03;
      if (fl.life <= 0) { floaters.splice(f, 1); continue; }
      ctx.globalAlpha = fl.life;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.globalAlpha = 1;
    }
    drawHUD();
  }

  function eyePos(sx, sy, dx, dy, side) {
    // 眼睛垂直于运动方向对称分布
    var cx = sx + GRID / 2 + dx * 4;
    var cy = sy + GRID / 2 + dy * 4;
    return { x: cx + dy * side * 4.5, y: cy + dx * side * 4.5 };
  }

  // 把主题色向黑色方向压暗 ratio（0-1），生成蛇身渐变
  function blendColor(hex, ratio) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * (1 - ratio));
    var g = Math.round(((n >> 8) & 255) * (1 - ratio));
    var b = Math.round((n & 255) * (1 - ratio));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawHUD() {
    // 顶部悬浮计分板：左得分、右用时
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    var scoreText = '🍎 ' + score;
    var timeText = '⏱ ' + currentDuration() + 's';
    pill(scoreText, 10, 10, ctx.measureText(scoreText).width + 24);
    ctx.textAlign = 'right';
    var tw = ctx.measureText(timeText).width + 24;
    pill(timeText, canvas.width - tw - 10, 10, tw);
  }

  function pill(text, x, y, w) {
    var h = 26;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
    roundRect(x, y, w, h, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = CONFIG.theme.text;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 12, y + 17.5);
  }

  var lastPostAt = 0;

  function postScore() {
    lastPostAt = Date.now();
    // 实时把成绩同步给文档（父页面），营造游戏与文档通信的效果
    var target = window.parent || window.top;
    target.postMessage({
      type: SCORE_MESSAGE_TYPE,
      gameId: CONFIG.gameId,
      score: score,
      duration: currentDuration()
    }, '*');
  }

  var scorePoster = null;

  function startScorePoster() {
    stopScorePoster();
    scorePoster = setInterval(postScore, 1000);
  }

  function stopScorePoster() {
    if (scorePoster) {
      clearInterval(scorePoster);
      scorePoster = null;
    }
  }

  function gameOver() {
    state = 'over';
    clearInterval(timer);
    stopScorePoster();
    if (score > best) best = score;
    var duration = currentDuration();
    overlay.innerHTML =
      '<div class="go-title">💥 游戏结束</div>' +
      '<div class="stats">' +
        '<div class="stat"><b>' + score + '</b><span>得分</span></div>' +
        '<div class="stat"><b>' + duration + 's</b><span>用时</span></div>' +
        '<div class="stat"><b>' + best + '</b><span>最高</span></div>' +
      '</div>' +
      '<button id="restart">再来一局</button>';
    overlay.classList.remove('hidden');
    // canvas-editor 会把 iframe 的 window.parent 改写为 null，需降级用 window.top
    var target = window.parent || window.top;
    target.postMessage({
      type: MESSAGE_TYPE,
      gameId: CONFIG.gameId,
      score: score,
      duration: duration
    }, '*');
  }

  function step() {
    if (directionQueue.length) {
      var next = directionQueue.shift();
      // 禁止直接反向
      if (next.x !== -direction.x || next.y !== -direction.y) {
        direction = next;
      }
    }
    var head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if (
      head.x < 0 || head.x >= COLS ||
      head.y < 0 || head.y >= ROWS ||
      snake.some(function (s) { return s.x === head.x && s.y === head.y; })
    ) {
      draw();
      gameOver();
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      spawnParticles(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, CONFIG.theme.food);
      floaters.push({ x: food.x * GRID + GRID / 2, y: food.y * GRID, text: '+1', life: 1 });
      placeFood();
      postScore();
      // 吃到食物提速
      clearInterval(timer);
      timer = setInterval(step, intervalFor());
    } else {
      snake.pop();
    }
  }

  function start() {
    reset();
    state = 'running';
    overlay.classList.add('hidden');
    clearInterval(timer);
    timer = setInterval(step, intervalFor());
    startScorePoster();
    postScore();
  }

  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    clearInterval(timer);
    stopScorePoster();
    elapsedMs += Date.now() - startedAt;
    overlay.innerHTML =
      '<div class="logo" style="font-size:34px">⏸</div>' +
      '<div class="title" style="letter-spacing:3px">已暂停</div>' +
      '<div class="pulse">— 点击继续 —</div>';
    overlay.classList.remove('hidden');
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'running';
    // 暂停期间时间不计入用时
    startedAt = Date.now();
    overlay.classList.add('hidden');
    timer = setInterval(step, intervalFor());
    startScorePoster();
  }

  overlay.addEventListener('click', function (evt) {
    if (state === 'idle' || state === 'paused') {
      if (state === 'idle') start();
      else resume();
    } else if (state === 'over' && evt.target.id === 'restart') {
      start();
    }
  });

  window.addEventListener('keydown', function (evt) {
    var key = evt.key.toLowerCase();
    var map = {
      arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 }
    };
    if (map[key]) {
      evt.preventDefault();
      if (state === 'running' && directionQueue.length < 3) {
        directionQueue.push(map[key]);
      }
    }
  });

  window.addEventListener('blur', function () {
    // 控件值同步会短暂夺走 iframe 焦点，这种失焦不暂停；
    // 仅当距离上次上报超过 500ms 的失焦（用户主动点走）才暂停
    if (Date.now() - lastPostAt < 500) return;
    pause();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
  });

  best = 0;
  reset();
  draw();
  // 持续渲染循环：驱动食物脉动、粒子与漂浮文字动画
  (function loop() {
    if (state === 'running' || state === 'idle' || state === 'paused') draw();
    requestAnimationFrame(loop);
  })();
</${'script'}>
</body>
</html>`
}
