// run-test.js
// Mock document and DOM
globalThis.document = {
  createElementNS(ns, tag) {
    return {
      setAttribute(name, value) { },
      parentNode: {
        removeChild(node) { }
      }
    };
  }
};

import { ParticleSystem } from './src/engine/particles.js';
import { Snake } from './src/engine/snake.js';

console.log('測試 ParticleSystem...');
const mockSvg = {
  appendChild(child) { },
  removeChild(child) { }
};

const sys: ParticleSystem = new ParticleSystem(mockSvg);
sys.spawn(10, 10, '#ff00ff');
sys.update();
sys.draw();

console.log('測試 Snake...');
const snake: Snake = new Snake(20, 20);
snake.handleKeydown({ key: 'w', preventDefault() { } });
snake.handleKeydown({ key: 'a', preventDefault() { } });
snake.handleKeydown({ key: 's', preventDefault() { } });
snake.handleKeydown({ key: 'd', preventDefault() { } });
snake.pushDirection('up');
snake.pushDirection('right');
snake.pushDirection('down');
snake.pushDirection('left');
snake.move();
snake.grow();
snake.checkSelfCollision();

console.log('測試完成，等待 2 秒讓型別與呼叫鏈完成非同步發送...');
await new Promise((resolve: any): NodeJS.Timeout => setTimeout(resolve, 2000));
console.log('結束測試！');
