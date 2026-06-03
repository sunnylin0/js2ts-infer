/**
 * 蛇的核心邏輯類別 (Snake)
 * 處理身體移動、增長、自撞判定，並包含「輸入緩衝佇列」技術防止極速連續轉彎的反向自殺
 */
export class Snake {
  /**
   * @param {number} gridW - 地圖網格寬度
   * @param {number} gridH - 地圖網格高度
   */
  constructor(gridW, gridH) {
    const midX = Math.floor(gridW / 2);
    const midY = Math.floor(gridH / 2);

    // 初始身體長度為 3，垂直或水平居中
    this.body = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY }
    ];

    // 初始移動方向：右
    this.direction = { x: 1, y: 0 };
    
    // 輸入緩衝佇列，最多緩衝 2 個按鍵輸入
    this.inputBuffer = [];
    
    // 暫存上次移動時被 pop 掉的尾巴，以利 grow() 時無縫加回
    this.lastPopped = null;

    // 方向向量對照表
    this.DIR_MAP = {
      'up':    { x: 0, y: -1 },
      'down':  { x: 0, y: 1 },
      'left':  { x: -1, y: 0 },
      'right': { x: 1, y: 0 }
    };
  }

  /**
   * 將鍵盤按鍵轉換為轉向指令推入緩衝區
   * @param {KeyboardEvent} e 
   */
  handleKeydown(e) {
    let dir = null;
    switch (e.key) {
      case 'w':
      case 'W':
      case 'ArrowUp':
        dir = 'up';
        break;
      case 's':
      case 'S':
      case 'ArrowDown':
        dir = 'down';
        break;
      case 'a':
      case 'A':
      case 'ArrowLeft':
        dir = 'left';
        break;
      case 'd':
      case 'D':
      case 'ArrowRight':
        dir = 'right';
        break;
    }

    if (dir) {
      e.preventDefault(); // 防止網頁捲動
      this.pushDirection(dir);
    }
  }

  /**
   * 推入新方向指令至緩衝佇列中（最大容載量為 2）
   * @param {string} dirName - 'up' | 'down' | 'left' | 'right'
   */
  pushDirection(dirName) {
    const targetDirVector = this.DIR_MAP[dirName];
    if (!targetDirVector) return;

    // 如果緩衝區已滿，忽略此次輸入以防效能卡頓
    if (this.inputBuffer.length >= 2) return;

    // 取得最新要比較的參考方向
    // 如果緩衝區有方向，則拿最新的；若無，則拿目前正前進的方向
    const referenceDir = this.inputBuffer.length > 0 
      ? this.inputBuffer[this.inputBuffer.length - 1] 
      : this.direction;

    // 檢查推入方向是否與參考方向互為反方向 (180度)
    // 如果是反向，直接過濾掉以防自殺
    const isOpposite = (targetDirVector.x + referenceDir.x === 0) && 
                        (targetDirVector.y + referenceDir.y === 0);

    if (!isOpposite) {
      this.inputBuffer.push(targetDirVector);
    }
  }

  /**
   * 蛇步進移動一格
   * @returns {Object} 新的蛇頭座標
   */
  move() {
    // 從輸入緩衝佇列首部彈出一個轉向指令
    if (this.inputBuffer.length > 0) {
      const nextDir = this.inputBuffer.shift();
      
      // 二次安全閥：確認此指令非當前蛇身實際正反向 (當身體大於 1 時)
      let actualCurrentDir = this.direction;
      if (this.body.length > 1) {
        actualCurrentDir = {
          x: this.body[0].x - this.body[1].x,
          y: this.body[0].y - this.body[1].y
        };
      }

      const isOpposite = (nextDir.x + actualCurrentDir.x === 0) && 
                          (nextDir.y + actualCurrentDir.y === 0);

      if (!isOpposite) {
        this.direction = nextDir;
      }
    }

    // 計算新頭部
    const head = this.body[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y
    };

    // 插在陣列最前端
    this.body.unshift(newHead);
    
    // 預先剪去尾巴並暫存
    this.lastPopped = this.body.pop();

    return newHead;
  }

  /**
   * 蛇吃食物成長：將剛才 pop 掉的尾巴補回
   */
  grow() {
    if (this.lastPopped) {
      this.body.push(this.lastPopped);
      this.lastPopped = null; // 清空暫存
    }
  }

  /**
   * 檢測蛇頭是否咬到自己的身體
   * @returns {boolean} 
   */
  checkSelfCollision() {
    const head = this.body[0];
    // 從 index 1 開始遍歷，即排除頭部本身
    for (let i = 1; i < this.body.length; i++) {
      if (this.body[i].x === head.x && this.body[i].y === head.y) {
        return true;
      }
    }
    return false;
  }
}
