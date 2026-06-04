# 頂級提示詞 (Top-Tier Prompt)
## 專案目標：打造極致美學與工業級架構的 SVG 霓虹貪食蛇遊戲 (Neon Snake)

你將扮演一位**頂級資深前端架構師與 UI/UX 設計大師**。請嚴格遵循以下規範，使用最優雅的 ES6 Class 模組化設計、極致的現代 Glassmorphism 視覺美學，開發出一款令人驚嘆的網頁貪食蛇遊戲。

---

## 🛠️ 技術棧與工程規範
1. **核心技術**：純 HTML5、Vanilla CSS (不使用 Tailwind 等框架)、原生 JavaScript (ES6+ Class 與 Module)。
2. **建置工具**：使用 **Vite** 作為開發伺服器，並使用 **`pnpm`** 作為套件管理工具。
3. **畫面渲染**：**完全使用 SVG** 來繪製遊戲區域、蛇身、食物、障礙物與粒子特效，確保任何螢幕解析度下皆能完美平滑縮放。
4. **代碼風格**：
   - 變數與函式命名語意化，強制使用 ES6 模組導入/導出。
   - 保持檔案單一職責（Single Responsibility Principle）。

---

## 🎨 UI/UX 視覺美學：現代 Glassmorphism (玻璃擬態)
1. **色彩計畫 (霓虹暗黑系)**：
   - 背景：深邃暗色 (#080710) 搭配漸層極光微光。
   - 玻璃板：半透明背景 (`rgba(255, 255, 255, 0.05)`) 結合高模糊度 (`backdrop-filter: blur(15px)`)，並帶有細緻的邊框 (`border: 1px solid rgba(255, 255, 255, 0.1)`)。
   - 蛇身：螢光翠綠 (#39FF14) 帶有強烈的 SVG 高斯模糊陰影 (`filter: drop-shadow(0 0 8px #39FF14)`)。
   - 食物：螢光粉紅 (#FF007F) 帶有呼吸燈發光特效 (`filter: drop-shadow(0 0 8px #FF007F)`)。
   - 障礙物：暗金或亮橘 (#FF5E00) 帶有警示霓虹光。
2. **動態微交互**：
   - 主選單按鈕具備滑過時的發光、輕微放大與光影流動特效。
   - 頁面切換採用平滑淡入淡出（Opacity Transition）。
3. **粒子特效 (SVG Particle System)**：
   - 當蛇吃掉食物時，在食物座標處爆裂出 10-15 個隨機方向、大小不一的 SVG 霓虹粒子，並以 `requestAnimationFrame` 驅動，進行平滑的物理擴散、減速與淡出消逝。

---

## 🧱 核心架構設計 (設計模式與演算法)

### 1. 嚴格狀態模式 (State Pattern) 實作狀態機
設計一個抽象狀態類別 `GameState`，並實作以下四個具體狀態子類別：
- `MenuState`：首頁選單，處理難度選擇、玩家名稱輸入、排行榜讀取。
- `PlayingState`：遊戲進行中狀態，驅動遊戲循環（Game Loop）、碰撞偵測與操作緩衝。
- `PausedState`：暫停狀態，凍結遊戲循環，停止蛇移動與計時，允許返回首頁或繼續。
- `GameOverState`：遊戲結束狀態，結算分數、比對排行榜，若進入前十名則儲存至 `localStorage`，顯示結算特效。

> ⚠️ **重要**：所有鍵盤、觸控輸入與畫面更新，必須依託於當前狀態類別的 `handleInput()` 與 `update()`，徹底杜絕暫停時還能操作蛇身、或在選單狀態背景仍在運作等架構漏洞。

### 2. 輸入緩衝佇列 (Input Buffer) - 消除快速反向自殺
- **問題背景**：當蛇向右移動，玩家快速連續按下「下」與「左」時，若下一影格（Frame）尚未更新，蛇的方向會直接被覆寫為「左」，導致蛇在下一影格直接反向撞上自己而死亡。
- **解決方案**：實作一個 `inputBuffer` 佇列（最大長度為 2）。
  - 當玩家按下方向鍵時，先推入（push）佇列。
  - 在每次遊戲循環的 Tick（步進）中，從佇列頭部彈出（shift）一個方向來作為本次更新的轉向指令。
  - 驗證彈出的方向是否與當前蛇的前進方向相反，若是則忽略，確保操作無死角。

### 3. Web Audio API 8-bit 音效合成器
不得載入任何外部 `.mp3` 或 `.wav` 音檔。必須純粹使用 Web Audio API 建立 `OscillatorNode` 與 `GainNode` 合成音效：
- **吃食物音效 (Chiptune Coin)**：快速上升的雙音節（例如 523Hz (C5) 持續 50ms，隨後跳至 1046Hz (C6) 持續 100ms，Sine 波）。
- **碰撞死亡音效 (Explosion/Crash)**：急墜低頻噪聲（例如 Triangle 波，頻率從 300Hz 快速降至 40Hz，伴隨快速衰減的音量增益，持續 500ms）。
- **暫停音效 (Pause)**：中頻和弦雙音（440Hz 與 554Hz 交錯，持續 150ms）。

---

## 🕹️ 遊戲規則與模式參數

### 1. 難度配置
- **簡單 (Easy)**：
  - 網格尺寸：40x40
  - 移動速度：100ms / 步
  - 障礙物：無。
- **中等 (Medium)**：
  - 網格尺寸：60x60
  - 移動速度：80ms / 步
  - 障礙物：無。
- **困難 (Hard)**：
  - 網格尺寸：60x60
  - 移動速度：60ms / 步
  - 障礙物：無。

> ⚠️ *注意：所有食物的生成座標，必須避開蛇身，防止出生即重疊的 Bug。*


### 2. 操控支援
- **鍵盤**：支援 `W`/`A`/`S`/`D` 與 `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` 控制方向，`Space` 鍵控制暫停/繼續。
- **行動裝置**：
  - 實作手勢滑動（Swipe）偵測（監聽 `touchstart` 與 `touchend` 的座標差 $\Delta x, \Delta y$，角度大於閾值即觸發轉向）。
  - 在行動端畫面上顯示一個極具質感的半透明 D-Pad（虛擬方向按鈕）供玩家點擊。

### 3. 分數排行榜 (High Scores)
- 透過 `localStorage` 讀寫，鍵名為 `neon_snake_highscores`。
- 排行榜依據**簡單、中等、困難**三種模式各自獨立存檔。
- 每種模式只保留前 10 名。
- 儲存欄位：`playerName` (玩家輸入名稱)、`score` (分數)、`playTime` (遊戲時間，秒數)、`date` (達成日期)。
- 時間顯示格式需轉換為 `MM:SS`（分:秒）。

---

## 📂 檔案目錄結構與職責建議

請為我生成以下模組化檔案，確保代碼高度解耦：

1. `index.html` - 包含 Glassmorphism UI 容器、SVG 遊戲畫布占位符、行動端 D-Pad 與排行榜顯示結構。
2. `src/style.css` - 現代暗黑霓虹風格、毛玻璃視覺效果、按鈕流光動畫及粒子消逝關鍵影格。
3. `src/audio.js` - `SoundSynthesizer` 類別，負責 Web Audio API 初始化與三大音效的波形合成。
4. `src/state/`
   - `gameState.js` - 抽象基底類別 `GameState`，規範 `enter()`, `handleInput()`, `update()`, `draw()` 介面。
   - `states.js` - 包含 `MenuState`, `PlayingState`, `PausedState`, `GameOverState` 的具體實作。
5. `src/engine/`
   - `gameEngine.js` - 主遊戲控制器，持有當前狀態，設定 `requestAnimationFrame` 或計時器驅動 `PlayingState` 更新，並初始化 SVG 畫布。
   - `snake.js` - 負責蛇的身軀座標管理、移動步進、長度增長及輸入佇列緩衝。
   - `particles.js` - 輕量 SVG 粒子噴灑系統，控制爆炸效果。
6. `src/main.js` - 入口檔案，實作 DOM 載入事件，啟動 `GameEngine` 並切換至 `MenuState`。

---

## 🚀 交付目標與實作細節要求

1. **零外部依賴**：除了 Vite 開發工具外，不使用 any 外部 JS 庫（例如不需要 Lodash, SoundJS, jQuery），所有邏輯純原生寫法。
2. **SVG 的自適應 (Responsive)**：SVG 的 `viewBox` 屬性必須根據選定難度的網格尺寸（例如 `0 0 40 40`）進行動態設定，並配合 CSS `width: 100%; height: 100%`，使遊戲畫面在 PC 與手機上都能自動縮放且不失真。
3. **無縫防死鎖安全檢索**：食物在隨機生成座標時，必須使用 `do-while` 迴圈檢索，且必須加入最大嘗試次數（如 500 次）保護。若地圖已被填滿，應直接判定通關（完美獲勝）。
4. **流暢的暫停還原**：暫停時，必須暫停遊戲內建的時間計時器。

請以最嚴謹、最具擴充性的程式碼實作這款遊戲，並在各個關鍵模組寫上詳細註解。
