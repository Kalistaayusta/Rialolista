// =============================
// Rialo Bomber Quest — FIXED v3
// with Custom Logo as Player
// =============================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE = 48;
const COLS = Math.floor(canvas.width / TILE);
const ROWS = Math.floor(canvas.height / TILE);

// Load custom player logo
const playerImg = new Image();
playerImg.src = 'logo.png'; // ganti sesuai nama file logomu

// game state
let map;
let player;
let enemies;
let bombs;
let explosions;
let state;

const PLAYER_MOVE_DELAY = 140;
const ENEMY_MOVE_DELAY = 600;
const BOMB_FUSE_MS = 2000;
const EXPLOSION_LIFE_MS = 500;

// -----------------------------
// map generation
// -----------------------------
function generateMap() {
  map = [];
  for (let y = 0; y < ROWS; y++) {
    map[y] = [];
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        map[y][x] = 1;
        continue;
      }
      if (x % 2 === 0 && y % 2 === 0) {
        map[y][x] = 1;
        continue;
      }
      if (x <= 2 && y <= 2) {
        map[y][x] = 0;
        continue;
      }
      map[y][x] = (Math.random() < 0.62) ? 2 : 0;
    }
  }
  map[1][1] = 0; map[1][2] = 0; map[2][1] = 0;
}

// -----------------------------
// helpers
// -----------------------------
function inBounds(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
}
function isSolidTile(tx, ty) {
  if (!inBounds(tx, ty)) return true;
  return map[ty][tx] === 1;
}
function isBreakableTile(tx, ty) {
  if (!inBounds(tx, ty)) return false;
  return map[ty][tx] === 2;
}
function bombAt(tx, ty) {
  return bombs.some(b => b.x === tx && b.y === ty);
}

// -----------------------------
// init / spawn
// -----------------------------
function initGame() {
  generateMap();
  player = {
    x: 1, y: 1,
    lives: 3, bombsAllowed: 1, power: 1,
    lastMoveTime: 0
  };

  enemies = [];
  const spots = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (map[y][x] === 0 && !(x <= 2 && y <= 2)) spots.push({x, y});
    }
  }
  shuffle(spots);
  const enemyCount = 4;
  for (let i = 0; i < Math.min(enemyCount, spots.length); i++) {
    const s = spots[i];
    enemies.push({
      x: s.x, y: s.y,
      dir: randomDir(),
      moveTimer: 0,
      moveDelay: ENEMY_MOVE_DELAY,
      stepsRemaining: randInt(1, 3)
    });
  }

  bombs = [];
  explosions = [];
  state = 'playing';
  updateHUD();
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} }
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function randomDir(){ const ds=[[1,0],[-1,0],[0,1],[0,-1]]; const i=Math.floor(Math.random()*4); return ds[i]; }

// -----------------------------
// input
// -----------------------------
window.addEventListener('keydown', (e)=>{
  if (state !== 'playing') return;
  const now = performance.now();
  if (['ArrowUp','w','W','ArrowDown','s','S','ArrowLeft','a','A','ArrowRight','d','D'].includes(e.key)) {
    if (now - player.lastMoveTime < PLAYER_MOVE_DELAY) return;
    player.lastMoveTime = now;
    if (e.key==='ArrowUp' || e.key==='w' || e.key==='W') tryMove(0,-1);
    if (e.key==='ArrowDown' || e.key==='s' || e.key==='S') tryMove(0,1);
    if (e.key==='ArrowLeft' || e.key==='a' || e.key==='A') tryMove(-1,0);
    if (e.key==='ArrowRight' || e.key==='d' || e.key==='D') tryMove(1,0);
  }
  if (e.key === ' ') placeBomb();
});

['up','down','left','right'].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', ()=>{
    if (state !== 'playing') return;
    tryMove( ...(id==='up'?[0,-1] : id==='down'?[0,1] : id==='left'?[ -1,0] : [1,0]) );
  });
});
const bombBtn = document.getElementById('bomb');
if (bombBtn) bombBtn.addEventListener('click', ()=>{ if (state==='playing') placeBomb(); });
const restartBtn = document.getElementById('restart');
if (restartBtn) restartBtn.addEventListener('click', initGame);

// -----------------------------
// mechanics
// -----------------------------
function tryMove(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!inBounds(nx, ny)) return;
  if (isSolidTile(nx, ny)) return;
  if (bombAt(nx, ny)) return;
  player.x = nx; player.y = ny;
  updateHUD();
}

function placeBomb(){
  if (bombs.length >= player.bombsAllowed) return;
  if (bombAt(player.x, player.y)) return;
  bombs.push({ x: player.x, y: player.y, timer: BOMB_FUSE_MS, power: player.power, exploded:false });
}

// -----------------------------
// update loop
// -----------------------------
let lastTime = performance.now();
function gameLoop(now){
  const dt = now - lastTime;
  lastTime = now;
  if (state === 'playing') update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function update(dt){
  for (const b of bombs) {
    b.timer -= dt;
    if (b.timer <= 0 && !b.exploded) triggerBomb(b);
  }
  for (const ex of explosions) ex.life -= dt;
  explosions = explosions.filter(ex => ex.life > 0);

  for (const en of enemies) {
    en.moveTimer += dt;
    if (en.moveTimer >= en.moveDelay) {
      en.moveTimer = 0;
      if (en.stepsRemaining <= 0) {
        en.dir = randomDir();
        en.stepsRemaining = randInt(1,3);
      }
      const nx = en.x + en.dir[0];
      const ny = en.y + en.dir[1];
      if (!inBounds(nx,ny) || isSolidTile(nx,ny) || isBreakableTile(nx,ny) || bombAt(nx,ny)) {
        en.stepsRemaining = 0;
      } else {
        en.x = nx; en.y = ny;
        en.stepsRemaining--;
      }
    }
  }

  for (const en of enemies) {
    if (en.x === player.x && en.y === player.y) {
      player.lives--;
      updateHUD();
      if (player.lives > 0) {
        player.x = 1; player.y = 1;
      } else {
        state = 'over';
      }
    }
  }

  if (enemies.length === 0 && state==='playing') {
    state = 'win';
  }
}

// -----------------------------
// bomb explosion
// -----------------------------
function triggerBomb(bomb) {
  bomb.exploded = true;
  const tiles = [{x:bomb.x, y:bomb.y}];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const d of dirs) {
    for (let r=1; r<=bomb.power; r++) {
      const tx = bomb.x + d[0]*r;
      const ty = bomb.y + d[1]*r;
      if (!inBounds(tx,ty)) break;
      if (map[ty][tx] === 1) break;
      tiles.push({x:tx,y:ty});
      if (map[ty][tx] === 2) {
        map[ty][tx] = 0;
        break;
      }
    }
  }
  explosions.push({ tiles: tiles, life: EXPLOSION_LIFE_MS });

  for (const other of bombs) {
    if (!other.exploded && tiles.some(t => t.x === other.x && t.y === other.y)) other.timer = 0;
  }
  enemies = enemies.filter(e => !tiles.some(t => t.x === e.x && t.y === e.y));

  if (tiles.some(t => t.x === player.x && t.y === player.y)) {
    player.lives--;
    updateHUD();
    if (player.lives > 0) player.x = 1, player.y = 1;
    else state = 'over';
  }
  setTimeout(()=>{ bombs = bombs.filter(b => b !== bomb); }, 120);
}

// -----------------------------
// render (with logo)
// -----------------------------
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  for (let y=0;y<ROWS;y++){
    for (let x=0;x<COLS;x++){
      const px = x*TILE, py = y*TILE;
      ctx.fillStyle = '#121212';
      ctx.fillRect(px,py,TILE,TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeRect(px,py,TILE,TILE);
      if (map[y][x] === 1) {
        ctx.fillStyle = '#232426';
        ctx.fillRect(px+2,py+2,TILE-4,TILE-4);
      } else if (map[y][x] === 2) {
        ctx.fillStyle = '#8b5a34';
        ctx.fillRect(px+4,py+4,TILE-8,TILE-8);
      }
    }
  }

  for (const b of bombs) {
    const px = b.x * TILE, py = b.y * TILE;
    ctx.beginPath();
    ctx.fillStyle = '#f2e6c9';
    ctx.arc(px + TILE/2, py + TILE/2, TILE/5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(px + TILE/2 - 2, py + TILE/2 - 10, 4, 6);
  }

  for (const ex of explosions) {
    for (const t of ex.tiles) {
      const px = t.x * TILE, py = t.y * TILE;
      const alpha = Math.max(0.15, ex.life / EXPLOSION_LIFE_MS);
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.fillRect(px+3,py+3,TILE-6,TILE-6);
      ctx.fillStyle = `rgba(255, 250, 180, ${alpha*0.6})`;
      ctx.fillRect(px+8,py+8,TILE-16,TILE-16);
    }
  }

  // 🟡 Player with Logo
  const ppx = player.x * TILE;
  const ppy = player.y * TILE;
  const margin = 6;
  if (playerImg.complete) {
    ctx.drawImage(playerImg, ppx + margin, ppy + margin, TILE - margin * 2, TILE - margin * 2);
  } else {
    ctx.beginPath();
    ctx.fillStyle = '#f2e6c9';
    ctx.arc(ppx + TILE/2, ppy + TILE/2, TILE/3.2, 0, Math.PI*2);
    ctx.fill();
  }

  // enemies
  for (const e of enemies) {
    const ex = e.x * TILE, ey = e.y * TILE;
    ctx.beginPath();
    ctx.fillStyle = '#ff4d6d';
    ctx.arc(ex + TILE/2, ey + TILE/2, TILE/3.2, 0, Math.PI*2);
    ctx.fill();
  }

  if (state === 'over' || state === 'win') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, canvas.height/2 - 50, canvas.width, 100);
    ctx.fillStyle = '#f2e6c9';
    ctx.textAlign = 'center';
    ctx.font = '28px Poppins, sans-serif';
    ctx.fillText(state === 'win' ? '🏆 YOU WIN!' : '💀 GAME OVER', canvas.width/2, canvas.height/2 + 10);
  }
}

// -----------------------------
function updateHUD(){
  const livesEl = document.getElementById('lives');
  const bombsEl = document.getElementById('bombCount');
  const powerEl = document.getElementById('power');
  if (livesEl) livesEl.textContent = player.lives;
  if (bombsEl) bombsEl.textContent = player.bombsAllowed;
  if (powerEl) powerEl.textContent = player.power;
}

// -----------------------------
initGame();
requestAnimationFrame(gameLoop);