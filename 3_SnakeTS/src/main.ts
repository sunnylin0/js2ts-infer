import { GameEngine } from './engine/gameEngine.js';
import { MenuState } from './state/states.js';

/**
 * 遊戲應用程式入口點 (main.js)
 * 當 DOM 完全載入後，初始化 GameEngine 並啟動第一個狀態 (MenuState)
 */
document.addEventListener('DOMContentLoaded', (): void => {
  const engine: GameEngine = new GameEngine();
  
  // 掛載選單狀態類別，用以解除 gameEngine 對 states.js 的循環依賴
  engine.MenuStateClass = MenuState;
  
  // 啟動引擎並將初始狀態指向選單狀態
  engine.start(new MenuState(engine));
  
  console.log("Neon Snake 初始化成功！已切換至 MenuState。");
});
