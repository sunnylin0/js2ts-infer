// run-test.js
// Mock document and DOM
globalThis.document = {
  createElementNS(ns, tag) {
    return {
      setAttribute(name, value) {},
      parentNode: {
        removeChild(node) {}
      }
    };
  }
};

import { ParticleSystem } from './src/engine/particles.js';
import { Snake } from './src/engine/snake.js';

console.log('測試 ParticleSystem...');
const mockSvg = {
  appendChild(child) {},
  removeChild(child) {}
};

const sys = new ParticleSystem(mockSvg);
sys.spawn(10, 10, '#ff00ff');
sys.update();
sys.draw();

console.log('測試 Snake...');
const snake = new Snake(20, 20);
snake.pushDirection('right');
snake.move();
snake.grow();
snake.checkSelfCollision();

console.log('測試完成，等待 2 秒讓型別與呼叫鏈完成非同步發送...');
await new Promise(resolve => setTimeout(resolve, 2000));
console.log('結束測試！');
