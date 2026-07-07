/**
 * 輕量級 SVG 粒子爆炸特效系統 (Particle System)
 * 吃食物時動態向四周爆裂出帶霓虹光的碎屑，並自動衰減淡出
 */
class Particle {
    element: SVGCircleElement;
    vy: number;
    vx: number;
    color: string;
    y: number;
    x: number;
    svg: SVGSVGElement;
    /** 粒子半徑 */
    radius: number = 0.08 + Math.random() * 0.12;
    alpha: number = 1.0;
    /** 摩擦力 (減速) 與淡出衰減率 */
    friction: number = 0.94;
    decay: number = 0.02 + Math.random() * 0.025;

  /**
   * @param {SVGElement} svg - SVG 畫布容器
   * @param {number} x - 初始 X 座標 (網格單位)
   * @param {number} y - 初始 Y 座標 (網格單位)
   * @param {string} color - 霓虹色彩碼
   */
  constructor(svg: SVGSVGElement, x: number, y: number, color: string) {
    this.svg = svg;
    this.x = x;
    this.y = y;
    this.color = color;
    
    // 隨機發散角度與速度 (網格單位/幀)
    const angle: number = Math.random() * Math.PI * 2;
    const speed: number = 0.05 + Math.random() * 0.12;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    // 動態建立 SVG 圓形元件
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.element.setAttribute('fill', this.color);
    this.element.setAttribute('filter', 'url(#glow-pink)'); // 使用 HUD 食物相同的粉紅濾鏡
    this.svg.appendChild(this.element);
  }

  /**
   * 更新物理特性
   * @returns {boolean} 粒子是否已消逝
   */
  update(): boolean {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;

    if (this.alpha <= 0) {
      // 從 DOM 樹中自我移除
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      return true; // 代表已死，需從列表中清除
    }
    return false;
  }

  /**
   * 同步更新 SVG 節點的渲染屬性
   */
  draw(): void {
    this.element.setAttribute('cx', this.x);
    this.element.setAttribute('cy', this.y);
    this.element.setAttribute('r', this.radius);
    this.element.setAttribute('fill-opacity', this.alpha);
  }
}

export class ParticleSystem {
    svg: SVGSVGElement;
    particles: Array<any> = [];

  /**
   * @param {SVGElement} svgCanvas - SVG 畫布
   */
  constructor(svgCanvas: SVGSVGElement) {
    this.svg = svgCanvas;
  }

  /**
   * 噴發粒子群
   * @param {number} x - 爆裂點 X
   * @param {number} y - 爆裂點 Y
   * @param {string} color - 霓虹色彩碼
   */
  spawn(x: number, y: number, color: string): void {
    const count: number = 12 + Math.floor(Math.random() * 6);
    for (let i: number = 0; i < count; i++) {
      this.particles.push(new Particle(this.svg, x, y, color));
    }
  }

  /**
   * 物理步進
   */
  update(): void {
    // 倒序遍歷以便安全移除陣列元素
    for (let i: number = this.particles.length - 1; i >= 0; i--) {
      const isDead: boolean = this.particles[i].update();
      if (isDead) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * 渲染更新所有粒子
   */
  draw(): void {
    this.particles.forEach((p: Particle): void => p.draw());
  }

  /**
   * 清除所有殘留粒子 (遊戲重置時使用)
   */
  clear(): void {
    this.particles.forEach((p: Particle): void => {
      if (p.element.parentNode) {
        p.element.parentNode.removeChild(p.element);
      }
    });
    this.particles = [];
  }
}
