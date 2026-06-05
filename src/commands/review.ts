import { runReview } from '../interactor';

interface ReviewOptions {
  config: string;
}

/**
 * 啟動終端機互動式 Review 介面。
 * 
 * @description
 * 此指令會載入目前的設定檔與已側錄的型別資料庫，並提供開發者
 * 一個交談式的 CLI UI，可以用於檢視、手動修正、或是確認重構型別之推導信賴度。
 * 
 * @example
 * review({ config: 'js2ts.config.json' });
 * 
 * @param {ReviewOptions} options - 互動檢視設定。
 * @param {string} options.config - 設定檔路徑。
 * @returns {void} 本方法不回傳任何值。
 */
export default function review(options: ReviewOptions): void {
  runReview(options);
}
