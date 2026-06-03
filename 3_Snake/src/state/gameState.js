/**
 * 抽象遊戲狀態基底類別 (GameState)
 * 供 MenuState, PlayingState, PausedState, GameOverState 繼承
 */
export class GameState {
  /**
   * @param {GameEngine} game - 主遊戲引擎 Controller 實例
   */
  constructor(game) {
    if (this.constructor === GameState) {
      throw new Error("無法直接實例化抽象的 GameState 基類！");
    }
    this.game = game;
  }

  /**
   * 當進入該狀態時觸發
   */
  enter() {}

  /**
   * 當退出該狀態時觸發
   */
  exit() {}

  /**
   * 處理鍵盤與觸控事件
   * @param {Event} e - 事件對象
   */
  handleInput(e) {}

  /**
   * 處理物理更新（例如蛇步進、粒子飄散）
   * @param {number} timestamp - 當前毫秒時間戳記
   */
  update(timestamp) {}

  /**
   * 繪製/更新畫面上 SVG 元素的視覺表現
   */
  draw() {}
}
