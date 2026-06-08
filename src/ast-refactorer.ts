/**
 * @file ast-refactorer.ts
 * @description
 * AST 重構工具的主入口（Re-export 聚合模組）。
 *
 * 本檔案僅做 re-export，確保所有原有呼叫者（如 code-generator.ts）
 * 不需修改 import 路徑，即可享受拆分後的模組化架構。
 *
 * 模組拆分結構：
 * ┌─────────────────────────────────────────────────────┐
 * │  src/refactor/                                      │
 * │  ├── tsquery-ext.ts   Node.prototype.query patch    │
 * │  ├── type-utils.ts    型別推導工具函式群             │
 * │  ├── annotate.ts      函數標注 + CJS→ESM 重構        │
 * │  ├── process-file.ts  單一檔案 AST 重構管線           │
 * │  └── propagation.ts   全域型別傳播                   │
 * └─────────────────────────────────────────────────────┘
 *
 * ⚠️  tsquery-ext 必須最先被 import（Side-Effect：patch Node.prototype）
 */

// ── Side-Effect：確保 Node.prototype.query 在所有模組前被 patch ──────────────
import './refactor/tsquery-ext';

// ── 主要 public API re-export ────────────────────────────────────────────────
export { processFileRefactoring } from './refactor/process-file';

export {
  runGlobalReversePropagation,
  runGlobalForwardPropagation,
  runGlobalReturnTypePropagation,
  writeInterfaceDeclarations,
} from './refactor/propagation';
