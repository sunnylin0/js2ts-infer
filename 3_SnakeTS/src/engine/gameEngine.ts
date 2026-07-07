import { SoundSynthesizer } from '../audio.js';

export class GameEngine {
    svgCanvas: SVGSVGElement = document.getElementById('game-canvas');
    audio: SoundSynthesizer = new SoundSynthesizer();
    currentState: MenuState | PlayingState | GameOverState | PausedState = null;
    /** 玩家屬性與難度預設值 */
    playerName: string = 'Player 1';
    difficulty: string = 'easy';
    gridSize: number = 40;
    /** 每個 step 的毫秒數 */
    speed: number = 100;
    /** 滑動手勢座標暫存 */
    touchStartX: number = 0;
    touchStartY: number = 0;

  constructor() {
  }

  /**
   * 啟動遊戲引擎與主循環
   */
  start(initialState: MenuState): void {
    this.initGlobalEvents();
    this.changeState(initialState);
    
    // 啟動 requestAnimationFrame 主循環
    const loop = (timestamp: number): void => {
      if (this.currentState) {
        this.currentState.update(timestamp);
        this.currentState.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * 切換遊戲狀態 (狀態模式生命週期管理)
   * @param {GameState} newState 
   */
  changeState(newState: MenuState | PlayingState | GameOverState | PausedState): void {
    if (this.currentState) {
      this.currentState.exit();
    }
    this.currentState = newState;
    this.currentState.enter();
  }

  /**
   * 統一網頁區塊 (Screen) 顯隱切換
   * @param {string} activeScreenId 
   */
  showScreen(activeScreenId: string): void {
    const screens: NodeList = document.querySelectorAll('.screen');
    screens.forEach((screen: HTMLElement): void => {
      if (screen.id === activeScreenId) {
        screen.classList.add('active');
      } else {
        screen.classList.remove('active');
      }
    });
  }

  /**
   * 顯示遊戲覆蓋面板 (Pause, Game Over)
   * @param {string} overlayId 
   */
  showOverlay(overlayId: string): void {
    const overlay: HTMLDivElement = document.getElementById(overlayId);
    if (overlay) overlay.classList.add('active');
  }

  /**
   * 隱藏遊戲覆蓋面板
   * @param {string} overlayId 
   */
  hideOverlay(overlayId: string): void {
    const overlay: HTMLDivElement = document.getElementById(overlayId);
    if (overlay) overlay.classList.remove('active');
  }

  /**
   * 設定難度參數
   * @param {string} diff - 'easy' | 'medium' | 'hard'
   */
  setDifficulty(diff: string): void {
    this.difficulty = diff;
    switch (diff) {
      case 'easy':
        this.gridSize = 40;
        this.speed = 100;
        break;
      case 'medium':
        this.gridSize = 60;
        this.speed = 80;
        break;
      case 'hard':
        this.gridSize = 60;
        this.speed = 60;
        break;
    }
  }

  /**
   * 初始化全域事件監聽，包含鍵盤、Logo 返回首頁、D-Pad 觸碰與行動端手勢滑動
   */
  initGlobalEvents(): void {
    // 1. 鍵盤輸入事件轉發
    window.addEventListener('keydown', (e: KeyboardEvent): void => {
      if (this.currentState) {
        this.currentState.handleInput(e);
      }
    });

    // 2. 點擊 Logo 返回主頁面
    const logo: HTMLHeadingElement = document.getElementById('logo-btn');
    if (logo) {
      logo.addEventListener('click', (): void => {
        // 先暫停或停止任何進行中的遊戲
        this.audio.playPause();
        if (this.MenuStateClass) {
          this.changeState(new this.MenuStateClass(this));
        }
      });
    }

    // 3. 行動端虛擬 D-Pad 按鈕點擊監聽
    const dpadButtons: Array<{ [key: string]: any }> = [
      { id: 'dpad-up', dir: 'up' },
      { id: 'dpad-down', dir: 'down' },
      { id: 'dpad-left', dir: 'left' },
      { id: 'dpad-right', dir: 'right' }
    ];

    dpadButtons.forEach((btnInfo: any): void => {
      const btnEl: HTMLButtonElement = document.getElementById(btnInfo.id);
      if (btnEl) {
        // 使用 touchstart 提升行動端響應靈敏度，並預留 click 作為相容機制
        const handleDpadInput = (e): void => {
          e.preventDefault();
          if (this.currentState) {
            this.currentState.handleInput({
              type: 'dpad',
              detail: { direction: btnInfo.dir }
            });
          }
        };
        btnEl.addEventListener('touchstart', handleDpadInput, { passive: false });
        btnEl.addEventListener('click', (e: KeyboardEvent): void => {
          // 若是滑鼠點擊且尚未被 touchstart 處理
          if (e.pointerType !== 'touch') {
            handleDpadInput(e);
          }
        });
      }
    });

    // 4. 行動端滑動手勢 (Swipe) 偵測
    const canvasWrapper: HTMLDivElement = document.querySelector('.canvas-wrapper');
    if (canvasWrapper) {
      canvasWrapper.addEventListener('touchstart', (e: KeyboardEvent): void => {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }, { passive: true });

      canvasWrapper.addEventListener('touchend', (e: KeyboardEvent): void => {
        if (!this.currentState) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const dx: number = touchEndX - this.touchStartX;
        const dy: number = touchEndY - this.touchStartY;
        
        const minDistance: number = 30; // 滑動最少 30px 才觸發轉向
        
        if (Math.abs(dx) > Math.abs(dy)) {
          // 水平滑動
          if (Math.abs(dx) > minDistance) {
            const dir: string = dx > 0 ? 'right' : 'left';
            this.currentState.handleInput({
              type: 'swipe',
              detail: { direction: dir }
            });
          }
        } else {
          // 垂直滑動
          if (Math.abs(dy) > minDistance) {
            const dir: string = dy > 0 ? 'down' : 'up';
            this.currentState.handleInput({
              type: 'swipe',
              detail: { direction: dir }
            });
          }
        }
      }, { passive: true });
    }
  }
}
