/**
 * 偵測當前執行環境是否為 Node.js (例如型別分析器執行期)
 * @returns {boolean}
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
}

/**
 * 產生唯一 ID
 * @returns {string}
 */
export function generateId(): string {
  return 'todo-' + Math.random().toString(36).substring(2, 9);
}

/**
 * 防止 XSS 的 HTML 轉義工具
 * @param {string} str
 * @returns {string}
 */
export function sanitizeHTML(str: string): string {
  if (isNode()) return str;
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}
