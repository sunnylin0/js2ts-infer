import { isNode, generateId } from './utils.js';

interface AddReturnShape {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  [key: string]: any;
}


export class TodoStore {
  constructor() {
    /** @type {Array<{id: string, text: string, completed: boolean, createdAt: string}>} */
    this.todos = [];
    this.load();
  }

  /**
   * 載入待辦事項
   */
  load(): undefined {
    if (isNode()) {
      this.todos = [];
      return;
    }
    try {
      const data = localStorage.getItem('antigravity-todos');
      this.todos = data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('無法載入 LocalStorage 資料', e);
      this.todos = [];
    }
  }

  /**
   * 儲存待辦事項
   */
  save(): undefined {
    if (isNode()) return;
    try {
      localStorage.setItem('antigravity-todos', JSON.stringify(this.todos));
    } catch (e) {
      console.error('無法儲存 LocalStorage 資料', e);
    }
  }

  /**
   * 新增一筆待辦事項
   * @param {string} text
   * @returns {object}
   */
  add(text: string): AddReturnShape {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const newTodo = {
      id: generateId(),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.todos.push(newTodo);
    this.save();
    return newTodo;
  }

  /**
   * 切換待辦事項完成狀態
   * @param {string} id
   * @returns {boolean}
   */
  toggle(id: string): boolean {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      this.save();
      return true;
    }
    return false;
  }

  /**
   * 刪除待辦事項
   * @param {string} id
   * @returns {boolean}
   */
  delete(id: string): boolean {
    const initialLength = this.todos.length;
    this.todos = this.todos.filter(t => t.id !== id);
    this.save();
    return this.todos.length < initialLength;
  }

  /**
   * 清除已完成事項
   */
  clearCompleted() {
    this.todos = this.todos.filter(t => !t.completed);
    this.save();
  }

  /**
   * 取得篩選後的待辦清單
   * @param {string} filter 'all' | 'active' | 'completed'
   * @returns {Array<object>}
   */
  getFiltered(filter: string): Array<{ [key: string]: any }> | Array<{ [key: string]: any } | { [key: string]: any }> | Array<any> | Array<{ [key: string]: any }> {
    if (filter === 'active') {
      return this.todos.filter(t => !t.completed);
    } else if (filter === 'completed') {
      return this.todos.filter(t => t.completed);
    }
    return this.todos;
  }
}
