import { GameState } from './gameState.js';
import { Snake } from '../engine/snake.js';
import { ParticleSystem } from '../engine/particles.js';

/* --- 1. 首頁選單狀態 (MenuState) --- */
export class MenuState extends GameState {
  constructor(game) {
    super(game);
    this.activeTab = 'easy'; // 預設顯示簡單排行榜
  }

  enter() {
    this.game.showScreen('menu-screen');
    
    // 讀取名稱與設定預設值
    const nameInput = document.getElementById('player-name');
    if (this.game.playerName) {
      nameInput.value = this.game.playerName;
    }

    // 載入與呈現對應的排行榜
    this.loadLeaderboard();

    // 綁定選單特有的事件監聽器（透過統一管理，防止事件重複綁定）
    this.setupListeners();
  }

  setupListeners() {
    // 難度按鈕點擊
    const diffButtons = document.querySelectorAll('.difficulty-buttons .btn');
    diffButtons.forEach(btn => {
      // 為免重複綁定，先複製節點或移除舊事件，此處我們使用 gameEngine 提供的統一綁定或在此手動處理
      btn.onclick = (e) => {
        const difficulty = btn.getAttribute('data-difficulty');
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim() || 'Anonymous';
        
        // 儲存玩家名稱到 Engine 中
        this.game.playerName = name;
        this.game.audio.playCoin(); // 播放 Coin 音效作為確認回饋
        
        // 設定遊戲難度並啟動遊戲
        this.game.setDifficulty(difficulty);
        this.game.changeState(new PlayingState(this.game));
      };
    });

    // 排行榜 Tab 切換
    const tabButtons = document.querySelectorAll('.leaderboard-tabs .tab-btn');
    tabButtons.forEach(btn => {
      btn.onclick = () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.getAttribute('data-tab');
        this.loadLeaderboard();
      };
    });
  }

  loadLeaderboard() {
    const listContainer = document.getElementById('leaderboard-rows');
    listContainer.innerHTML = '';

    // 自 localStorage 載入數據
    const rawScores = localStorage.getItem('neon_snake_highscores');
    let scores = rawScores ? JSON.parse(rawScores) : {};
    
    // 取得當前 Tab 難度模式下的分數
    let modeScores = scores[this.activeTab] || [];
    
    // 排序（防備意外，以分數高到低，同分則以時間少到多）
    modeScores.sort((a, b) => b.score - a.score || a.playTime - b.playTime);

    if (modeScores.length === 0) {
      listContainer.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">暫無排行紀錄</td></tr>`;
      return;
    }

    modeScores.slice(0, 10).forEach((entry, index) => {
      const rank = index + 1;
      let rankBadge = `<span class="rank-badge rank-${rank}">${rank}</span>`;
      if (rank > 3) {
        rankBadge = `<span class="rank-badge" style="color: var(--text-muted);">${rank}</span>`;
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${rankBadge}</td>
        <td>${entry.playerName}</td>
        <td class="neon-green-text" style="font-weight:700;">${entry.score}</td>
        <td>${this.formatTime(entry.playTime)}</td>
      `;
      listContainer.appendChild(row);
    });
  }

  formatTime(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  exit() {
    // 清理事件，防記憶體洩漏
    const diffButtons = document.querySelectorAll('.difficulty-buttons .btn');
    diffButtons.forEach(btn => btn.onclick = null);
    const tabButtons = document.querySelectorAll('.leaderboard-tabs .tab-btn');
    tabButtons.forEach(btn => btn.onclick = null);
  }
}

/* --- 2. 遊戲進行狀態 (PlayingState) --- */
export class PlayingState extends GameState {
  constructor(game) {
    super(game);
    this.snake = null;
    this.food = { x: 0, y: 0 };
    this.score = 0;
    
    this.gameTimer = null;
    this.playTimeSeconds = 0;
    
    this.lastStepTime = 0;
    this.isDead = false;
    this.particles = null;
  }

  enter() {
    this.game.showScreen('game-screen');
    
    // 初始化 HUD
    document.getElementById('hud-player').innerText = this.game.playerName;
    document.getElementById('hud-score').innerText = '0';
    document.getElementById('hud-time').innerText = '00:00';

    // 初始化 SVG 畫布內容 (defs 濾鏡定義)
    this.initSvgCanvas();

    // 建立蛇與粒子系統
    this.snake = new Snake(this.game.gridSize, this.game.gridSize);
    this.particles = new ParticleSystem(this.game.svgCanvas);

    this.score = 0;
    this.playTimeSeconds = 0;
    this.isDead = false;

    // 隨機生成首個食物
    this.spawnFood();

    // 啟動遊戲計時器 (每秒累加)
    this.gameTimer = setInterval(() => {
      this.playTimeSeconds++;
      document.getElementById('hud-time').innerText = this.formatTime(this.playTimeSeconds);
    }, 1000);

    // 綁定行動端暫停按鈕與鍵盤輸入 (透過 Engine 轉發至 state)
    this.setupListeners();
    
    // 重置動態計時參數
    this.lastStepTime = 0;
  }

  initSvgCanvas() {
    const svg = this.game.svgCanvas;
    svg.innerHTML = ''; // 清空畫布
    
    // 設定 viewBox 符合網格尺寸
    svg.setAttribute('viewBox', `0 0 ${this.game.gridSize} ${this.game.gridSize}`);

    // 新增 SVG filter 定義（讓蛇與食物發出迷人霓虹光輝）
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="0.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-pink" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="0.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);
  }

  setupListeners() {
    // 行動端暫停按鈕
    const pauseBtn = document.getElementById('mobile-pause-btn');
    if (pauseBtn) {
      pauseBtn.onclick = () => this.togglePause();
    }
  }

  togglePause() {
    this.game.audio.playPause();
    this.game.changeState(new PausedState(this.game, this));
  }

  handleInput(e) {
    if (e.type === 'keydown') {
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
        return;
      }
      
      // 傳遞按鍵到蛇的緩衝區
      this.snake.handleKeydown(e);
    } else if (e.type === 'dpad') {
      // 處理來自 D-Pad 按鈕的點擊
      this.snake.pushDirection(e.detail.direction);
    } else if (e.type === 'swipe') {
      // 處理行動端滑動
      this.snake.pushDirection(e.detail.direction);
    }
  }

  spawnFood() {
    let newFood;
    let attempts = 0;
    const maxAttempts = 500;
    let overlap;

    do {
      overlap = false;
      newFood = {
        x: Math.floor(Math.random() * this.game.gridSize),
        y: Math.floor(Math.random() * this.game.gridSize)
      };

      // 檢查是否生成在蛇身上
      for (const segment of this.snake.body) {
        if (segment.x === newFood.x && segment.y === newFood.y) {
          overlap = true;
          break;
        }
      }

      attempts++;
    } while (overlap && attempts < maxAttempts);

    // 防死鎖安全檢索：如果地圖全滿，玩家獲勝！
    if (attempts >= maxAttempts) {
      this.isDead = true;
      this.game.audio.playExplosion();
      this.game.changeState(new GameOverState(this.game, this.score, this.playTimeSeconds, "恭喜！你填滿了整個地圖，完美通關！"));
      return;
    }

    this.food = newFood;
  }

  update(timestamp) {
    // 更新爆炸粒子
    this.particles.update();

    if (this.isDead) return;

    if (!this.lastStepTime) this.lastStepTime = timestamp;
    const elapsed = timestamp - this.lastStepTime;

    // 控制蛇的移動步長（速度）
    if (elapsed >= this.game.speed) {
      this.lastStepTime = timestamp;

      // 蛇前進一步
      const head = this.snake.move();

      // 1. 碰撞牆壁檢測
      if (head.x < 0 || head.x >= this.game.gridSize || head.y < 0 || head.y >= this.game.gridSize) {
        this.triggerDeath("你撞到牆壁了！");
        return;
      }

      // 2. 碰撞自己身體檢測
      if (this.snake.checkSelfCollision()) {
        this.triggerDeath("你咬到自己的身體了！");
        return;
      }

      // 3. 吃食物檢測
      if (head.x === this.food.x && head.y === this.food.y) {
        this.score += 10;
        document.getElementById('hud-score').innerText = this.score;
        this.game.audio.playCoin();
        
        // 增長蛇身
        this.snake.grow();

        // 噴灑霓虹粒子效果
        this.particles.spawn(this.food.x + 0.5, this.food.y + 0.5, '#ff007f');

        // 生成新食物
        this.spawnFood();
      }
    }
  }

  triggerDeath(message) {
    this.isDead = true;
    this.game.audio.playExplosion();
    this.game.changeState(new GameOverState(this.game, this.score, this.playTimeSeconds, message));
  }

  draw() {
    const svg = this.game.svgCanvas;

    // 清除舊繪製（只保留 defs 濾鏡）
    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs);

    // 1. 繪製食物
    const foodEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    foodEl.setAttribute('x', this.food.x + 0.15);
    foodEl.setAttribute('y', this.food.y + 0.15);
    foodEl.setAttribute('width', 0.7);
    foodEl.setAttribute('height', 0.7);
    foodEl.setAttribute('rx', 0.35); // 圓角
    foodEl.setAttribute('fill', 'var(--neon-pink)');
    foodEl.setAttribute('filter', 'url(#glow-pink)');
    // 增加一個動態縮放呼吸燈動畫（以 CSS 或 SVG 屬性）
    foodEl.innerHTML = `
      <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite"/>
    `;
    svg.appendChild(foodEl);

    // 2. 繪製蛇身
    this.snake.body.forEach((seg, index) => {
      const isHead = index === 0;
      const segEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      segEl.setAttribute('x', seg.x + 0.05);
      segEl.setAttribute('y', seg.y + 0.05);
      segEl.setAttribute('width', 0.9);
      segEl.setAttribute('height', 0.9);
      
      if (isHead) {
        segEl.setAttribute('rx', 0.3); // 蛇頭帶點圓角
        segEl.setAttribute('fill', '#ffffff'); // 蛇頭白色突出
      } else {
        segEl.setAttribute('rx', 0.2);
        segEl.setAttribute('fill', 'var(--neon-green)');
      }
      
      segEl.setAttribute('filter', 'url(#glow-green)');
      svg.appendChild(segEl);
    });

    // 3. 繪製粒子特效
    this.particles.draw();
  }

  formatTime(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  exit() {
    // 清理定時器與監聽
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    const pauseBtn = document.getElementById('mobile-pause-btn');
    if (pauseBtn) pauseBtn.onclick = null;
  }
}

/* --- 3. 遊戲暫停狀態 (PausedState) --- */
export class PausedState extends GameState {
  /**
   * @param {GameEngine} game 
   * @param {PlayingState} playingState - 持有暫停前的遊戲狀態以利繼續
   */
  constructor(game, playingState) {
    super(game);
    this.playingState = playingState;
  }

  enter() {
    this.game.showOverlay('pause-overlay');

    // 綁定暫停按鈕
    document.getElementById('resume-btn').onclick = () => {
      this.game.audio.playPause();
      this.game.changeState(this.playingState);
    };

    document.getElementById('pause-home-btn').onclick = () => {
      this.game.changeState(new MenuState(this.game));
    };
  }

  handleInput(e) {
    // 空白鍵繼續遊戲
    if (e.type === 'keydown' && e.code === 'Space') {
      e.preventDefault();
      this.game.audio.playPause();
      this.game.changeState(this.playingState);
    }
  }

  update(timestamp) {
    // 暫停時粒子可能仍在半空慢慢飄散
    this.playingState.particles.update();
  }

  draw() {
    // 保持畫面靜止繪製
    this.playingState.draw();
  }

  exit() {
    this.game.hideOverlay('pause-overlay');
    document.getElementById('resume-btn').onclick = null;
    document.getElementById('pause-home-btn').onclick = null;
    // 恢復暫停前蛇的最後步進時間，防止繼續遊戲時蛇瞬間暴衝
    this.playingState.lastStepTime = performance.now();
  }
}

/* --- 4. 遊戲結束狀態 (GameOverState) --- */
export class GameOverState extends GameState {
  constructor(game, score, playTime, deathMessage) {
    super(game);
    this.score = score;
    this.playTime = playTime;
    this.deathMessage = deathMessage;
  }

  enter() {
    this.game.showOverlay('game-over-overlay');
    
    // 設定結算文字
    document.getElementById('game-over-msg').innerText = this.deathMessage;
    document.getElementById('final-score').innerText = this.score;
    document.getElementById('final-time').innerText = this.formatTime(this.playTime);

    // 排行榜結算儲存
    this.saveToLeaderboard();

    // 綁定按鈕
    document.getElementById('restart-btn').onclick = () => {
      this.game.audio.playCoin();
      this.game.changeState(new PlayingState(this.game));
    };

    document.getElementById('game-over-home-btn').onclick = () => {
      this.game.changeState(new MenuState(this.game));
    };
  }

  saveToLeaderboard() {
    const rawScores = localStorage.getItem('neon_snake_highscores');
    let scores = rawScores ? JSON.parse(rawScores) : {};
    const mode = this.game.difficulty; // 'easy', 'medium', 'hard'
    
    if (!scores[mode]) {
      scores[mode] = [];
    }

    // 新增一筆記錄
    const newRecord = {
      playerName: this.game.playerName || 'Anonymous',
      score: this.score,
      playTime: this.playTime,
      date: new Date().toLocaleDateString()
    };

    scores[mode].push(newRecord);

    // 排序：分數由高到低，時間由少到多
    scores[mode].sort((a, b) => b.score - a.score || a.playTime - b.playTime);

    // 只保留前十名
    scores[mode] = scores[mode].slice(0, 10);

    // 寫入 localStorage
    localStorage.setItem('neon_snake_highscores', JSON.stringify(scores));
  }

  handleInput(e) {
    // 遊戲結束時按下 Space 可以快速重玩
    if (e.type === 'keydown' && e.code === 'Space') {
      e.preventDefault();
      this.game.audio.playCoin();
      this.game.changeState(new PlayingState(this.game));
    }
  }

  formatTime(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  exit() {
    this.game.hideOverlay('game-over-overlay');
    document.getElementById('restart-btn').onclick = null;
    document.getElementById('game-over-home-btn').onclick = null;
  }
}
