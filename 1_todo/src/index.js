import { isNode } from './utils.js';
import { TodoStore } from './TodoStore.js';
import { TodoDOM } from './TodoDOM.js';

let store;
let currentFilter = 'all';

function initApp() {
  if (isNode()) return;

  store = new TodoStore();

  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const clearCompletedBtn = document.getElementById('clear-completed');
  const itemsLeftSpan = document.getElementById('items-left');

  function render() {
    todoList.innerHTML = '';
    const filtered = store.getFiltered(currentFilter);

    if (filtered.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'todo-empty-state';
      placeholder.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p>目前沒有待辦事項</p>
      `;
      todoList.appendChild(placeholder);
    } else {
      filtered.forEach(todo => {
        const element = TodoDOM.createTodoItem(
          todo,
          (id) => {
            store.toggle(id);
            updateStatus();
          },
          (id) => {
            store.delete(id);
            render();
          }
        );
        todoList.appendChild(element);
      });
    }

    updateStatus();
  }

  function updateStatus() {
    const activeCount = store.getFiltered('active').length;
    itemsLeftSpan.textContent = `${activeCount} 個未完成`;

    const completedCount = store.getFiltered('completed').length;
    if (completedCount > 0) {
      clearCompletedBtn.style.opacity = '1';
      clearCompletedBtn.style.pointerEvents = 'auto';
    } else {
      clearCompletedBtn.style.opacity = '0';
      clearCompletedBtn.style.pointerEvents = 'none';
    }
  }

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = todoInput.value.trim();
    if (val) {
      store.add(val);
      todoInput.value = '';
      render();
    }
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  clearCompletedBtn.addEventListener('click', () => {
    store.clearCompleted();
    render();
  });

  render();
}

// 偵測並分流執行環境
if (isNode()) {
  console.log('[js-to-ts-profiler] 偵測到 Node.js 執行期，啟動 TodoList 核心邏輯模擬採集...');
  const mockStore = new TodoStore();

  const item1 = mockStore.add('學習 AST 抽象語法樹編譯技術');
  const item2 = mockStore.add('打造高質感的玻璃擬態 UI');
  const item3 = mockStore.add('完成 TypeScript 型別自動生成驗證');

  if (item1) {
    mockStore.toggle(item1.id);
  }

  const activeList = mockStore.getFiltered('active');
  const completedList = mockStore.getFiltered('completed');
  const allList = mockStore.getFiltered('all');

  console.log(`[js-to-ts-profiler] 模擬狀態：全部共 ${allList.length} 筆，未完成 ${activeList.length} 筆，已完成 ${completedList.length} 筆。`);

  if (item2) {
    mockStore.delete(item2.id);
  }

  mockStore.clearCompleted();
  console.log('[js-to-ts-profiler] ✅ 模擬操作採集完成！');
} else {
  document.addEventListener('DOMContentLoaded', initApp);
}
