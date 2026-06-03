import { TodoStore } from './src/TodoStore.js';
import { sanitizeHTML } from './src/utils.js';

console.log('🧪 執行 TodoList 測試流程...');

const store = new TodoStore();
const todo1 = store.add('買牛奶');
const todo2 = store.add('撰寫 TypeScript 工具');

if (todo1) {
  store.toggle(todo1.id);
}

store.getFiltered('active');
store.getFiltered('completed');
store.getFiltered('all');

if (todo2) {
  store.delete(todo2.id);
}

store.clearCompleted();

sanitizeHTML('<script>alert("xss")</script>');

console.log('🧪 測試流程執行完畢。');
