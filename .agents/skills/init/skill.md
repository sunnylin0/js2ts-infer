---
name: init
description: Analyze a codebase and generate a structured agent.md project memory file — equivalent to running /init in Claude Code. Use this skill whenever the user asks to "initialize the project", "set up agent.md", "analyze the codebase", "create project docs for Claude", "run init", or wants Claude to learn about their project structure. Also trigger when the user uploads or shares a project and says "understand this" or "get up to speed". This skill produces an agent.md (or updates an existing one) that captures build commands, architecture, conventions, and key patterns so future sessions start with full project context.
---

# Command: init Trigger
- **當偵測到指令 `/init`**：立即啟動「全自動專案地圖繪製」程序。
- **目標**：掃描並生成 `agent.md`，作為後續開發的 Context 指南。

# Analysis Logic (Technology Stack Detection)
請針對以下檔案特徵進行優先掃描：
1. **Node.js/JS/TS**: 掃描 `package.json`, `tsconfig.json`, `pnpm-lock.yaml`。
2. **C#/ASPX**: 掃描 `.csproj`, `.sln`, `Web.config`, `App.config`。
3. **Database**: 辨識 `DbContext` 或 SQL 腳本中的關鍵字（T-SQL 為 MSSQL, PL/SQL 為 Oracle）。
4. **Python**: 掃描 `requirements.txt`, `pyproject.toml`, `venv` 目錄。

# File Template: agent.md Structure
生成的檔案必須包含以下特定區塊：

---
# 🚀 Project Blueprint: [偵測到的專案名稱]

## 1. 核心技術棧 (Multi-Stack Details)
- **Runtime**: [例如：Node.js 20, .NET Framework 4.8, Python 3.11]
- **Languages**: [列出所有偵測到的語言，如 TS, C#, Python]
- **Databases**: [明確區分 MSSQL 或 Oracle 的使用場景]

## 2. 專案架構 (Architecture)
```text
[生成精簡 Tree，若為 ASPX 需標註 Code-behind 結構；若為 TS 需標註 src/dist]
```


## 3.開發規範與禁忌 (Project-Specific Rules)
Legacy Support: 若偵測到 .aspx，必須遵循其特定的生命週期與狀態管理規範。

Type Safety: TS 專案需遵循嚴格型別檢查。

SQL Standards: 區分 MSSQL (T-SQL) 與 Oracle (PL/SQL) 的語法習慣（如 分頁語法、預存程序調用）。

## 4. 關鍵入口與指令
Node.js: npm run dev 等。

Python: python main.py 等。

C#/ASPX: 說明主要的 DLL 引用或 IIS 配置位置。

## 5. AI 協作備忘錄 (Context for Agent)
[分析專案後，給予未來 AI 助理的開發建議。例如：處理 Oracle 連線時需注意 Connection Pool 的釋放。]

## 6.Operational Instructions
排除目錄：node_modules, .git, obj, bin, venv, packages (NuGet)。

輸出完成後，請簡單回報：「agent.md 已根據您的混和技術棧（[偵測到的語言]）生成完畢。」
