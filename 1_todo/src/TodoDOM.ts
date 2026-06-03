import { isNode, sanitizeHTML } from './utils.js';

interface CreateTodoItemTodoShape {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  [key: string]: any;
}


export class TodoDOM {
  /**
   * 建立單一 Todo 的 DOM 節點
   * @param {object} todo
   * @param {function} onToggle
   * @param {function} onDelete
   * @returns {HTMLElement|object}
   */
  static createTodoItem(todo: CreateTodoItemTodoShape, onToggle: any, onDelete: any): HTMLLIElement {
    if (isNode()) {
      return { id: todo.id, mockDOM: true };
    }

    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.dataset.id = todo.id;
    
    li.style.opacity = '0';
    li.style.transform = 'translateY(12px)';
    
    const safeText = sanitizeHTML(todo.text);
    
    li.innerHTML = `
      <label class="todo-checkbox-wrapper">
        <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
        <span class="custom-checkbox"></span>
      </label>
      <span class="todo-text">${safeText}</span>
      <button class="todo-delete-btn" aria-label="刪除待辦事項">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    `;

    const checkbox = li.querySelector('.todo-checkbox');
    checkbox.addEventListener('change', () => {
      li.classList.toggle('completed', checkbox.checked);
      onToggle(todo.id);
    });

    const deleteBtn = li.querySelector('.todo-delete-btn');
    deleteBtn.addEventListener('click', () => {
      li.style.opacity = '0';
      li.style.transform = 'scale(0.95)';
      li.style.maxHeight = '0px';
      li.style.padding = '0px';
      li.style.marginTop = '0px';
      li.style.border = 'none';
      
      setTimeout(() => {
        onDelete(todo.id);
      }, 300);
    });

    requestAnimationFrame(() => {
      li.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      li.style.opacity = '1';
      li.style.transform = 'translateY(0)';
    });

    return li;
  }
}
