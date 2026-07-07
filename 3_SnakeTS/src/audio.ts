/**
 * Web Audio API 8-bit 電子聲效合成器 (SoundSynthesizer)
 * 零外部音量檔案依賴，純靠演算法調校波形
 */
export class SoundSynthesizer {
    ctx: AudioContext = null;

  constructor() {
  }

  /**
   * 惰性初始化 AudioContext
   * 避開瀏覽器限制（必須在使用者觸發滑鼠或鍵盤後才能建立）
   */
  init(): void {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // 確保處於 running 狀態
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * 播放吃食物 Coin 音效
   * C5 (523Hz) 快速過渡到 C6 (1046Hz) 8-bit 清脆感
   */
  playCoin(): void {
    try {
      this.init();
      const now: number = this.ctx.currentTime;
      
      const osc: OscillatorNode = this.ctx.createOscillator();
      const gain: GainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      // 頻率快速轉折
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(1046.50, now + 0.05); // C6
      
      // 音量衰減
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn("無法播Coin音效:", e);
    }
  }

  /**
   * 播放碰撞死亡音效
   * 急墜低頻 Triangle 波形伴隨快速音量衰退
   */
  playExplosion(): void {
    try {
      this.init();
      const now: number = this.ctx.currentTime;
      
      const osc: OscillatorNode = this.ctx.createOscillator();
      const gain: GainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      // 頻率從 300Hz 快速跌落至 40Hz
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.5);
      
      // 音量大分貝衰減
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn("無法播Explosion音效:", e);
    }
  }

  /**
   * 播放暫停與恢復音效
   * 雙頻和聲 (440Hz 與 554Hz) 具有清爽的提示感
   */
  playPause(): void {
    try {
      this.init();
      const now: number = this.ctx.currentTime;
      
      // 暫停聲需要兩個音調同時播放產生和音效果
      const frequencies: Array<number> = [440.00, 554.37]; // A4, C#5
      
      frequencies.forEach((freq: number): void => {
        const osc: OscillatorNode = this.ctx.createOscillator();
        const gain: GainNode = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.start(now);
        osc.stop(now + 0.15);
      });
    } catch (e) {
      console.warn("無法播Pause音效:", e);
    }
  }
}
