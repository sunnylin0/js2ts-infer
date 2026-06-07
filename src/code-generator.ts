import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Project, SourceFile } from 'ts-morph';
import chalk from 'chalk';
import * as diff from 'diff';
import { globSync } from 'glob';
import {
	processFileRefactoring,
	runGlobalReversePropagation,
	runGlobalForwardPropagation,
	runGlobalReturnTypePropagation,
	writeInterfaceDeclarations
} from './ast-refactorer';
import { runFeedbackLoop } from './feedback-loop';

/**
 * 檢查指定的專案目錄 Git 工作區狀態。
 * 
 * @description
 * 使用 `git status --porcelain` 執行同步子程序，若回傳內容不為空，
 * 代表工作區有未提交的變更。如果發生錯誤（如未安裝 git 或非 git 專案），預設回傳 `true` 以容錯。
 * 
 * @param {string} [dir=process.cwd()] - 欲檢查的工作目錄，預設為目前的執行目錄。
 * @returns {boolean} 若工作區乾淨無未提交變更則回傳 `true`，否則回傳 `false`。
 */
function checkGitStatus(dir: string = process.cwd()): boolean {
	try {
		const status = execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' }).trim();
		return status === '';
	} catch (e) {
		return true;
	}
}

/**
 * 執行專案源碼轉譯與型別注入的 Pipeline 核心調度函數。
 * 
 * @description
 * 1. 解析輸入與輸出路徑，並讀取專案的設定檔與動態型別側錄檔 `types-observed.json`。
 * 2. 載入輸入目錄下所有 `*.d.ts` 宣告檔至單一 `Project` 實例，作為型別優先對齊之字典。
 * 3. 處理輸出目錄複製。
 * 4. 進行「全專案語境載入」：讀取所有待轉換的 JS 原始碼，並在 Project 記憶體中建立對應的虛擬 `.ts` 檔案。
 * 5. 取得單一全域 `TypeChecker` 實例，並以記憶體方式在虛擬節點上重構所有檔案。
 * 6. 重構完成後執行原子交易落盤：若是 `--dry-run` 模式，直接輸出 Diff；若是寫入模式，一次性存檔並批次移除舊 JS 檔案。
 * 
 * @example
 * await runGeneration({
 *   inDir: './src',
 *   outDir: './srcTS',
 *   config: 'js2ts.config.json',
 *   force: true
 * });
 * 
 * @param {any} options - 產生器選項配置。
 * @returns {Promise<void>} 回傳一個 Promise，解析後代表專案型別注入管線執行完畢。
 */
export async function runGeneration(options: any) {
	const inDir = options.inDir ? path.resolve(process.cwd(), options.inDir) : process.cwd();
	const configPath = path.isAbsolute(options.config)
		? options.config
		: path.resolve(inDir, options.config);

	let config = {
		include: ["src/**/*.js", "modules/**/*.js", "*.js"],
		exclude: ["node_modules/**", "**/dist/**", "**/*.test.js", "**/test/**"],
		confidenceThreshold: 5,
		aiApiKey: "",
		aiModel: "gemini-2.5-flash",
		maxFeedbackIterations: 5
	};

	if (fs.existsSync(configPath)) {
		try {
			config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
		} catch (e) { }
	}

	if (!options.force && !options.dryRun) {
		if (!checkGitStatus(inDir)) {
			console.error(chalk.red('❌ Git 工作區有未提交的變更！請先 commit 您的變更。'));
			console.error(chalk.red('   或者使用 --force 旗標強制執行。'));
			process.exit(1);
		}
	}

	const observedTypesPath = path.resolve(inDir, 'types-observed.json');
	let typeDB = {};
	if (fs.existsSync(observedTypesPath)) {
		try {
			typeDB = JSON.parse(fs.readFileSync(observedTypesPath, 'utf-8'));
		} catch (e: any) {
			console.error(chalk.red(`❌ 無法讀取型別觀測檔: ${observedTypesPath}, error: ${e.message}`));
			process.exit(1);
		}
	}

	const files = globSync(config.include, {
		cwd: inDir,
		ignore: config.exclude,
		nodir: true,
		absolute: true
	});

	console.log(chalk.blue(`\n📝 開始重構與注入型別，共 ${files.length} 個檔案...`));

	// 載入所有的 d.ts
	const project = new Project();
	const dtsFiles = globSync('**/*.d.ts', {
		cwd: inDir,
		ignore: config.exclude,
		nodir: true,
		absolute: true
	});
	console.log(chalk.blue(`📂 正在加載 ${dtsFiles.length} 個 *.d.ts 宣告檔...`));
	for (const dtsFile of dtsFiles) {
		project.addSourceFileAtPath(dtsFile);
	}

	const outDir = options.outDir ? path.resolve(process.cwd(), options.outDir) : null;
	if (outDir && !options.dryRun) {
		if (outDir === inDir) {
			console.error(chalk.red('❌ 輸出目錄不能與輸入目錄相同！'));
			process.exit(1);
		}
		console.log(chalk.blue(`📂 正在複製來源目錄至: ${outDir}...`));
		fs.mkdirSync(outDir, { recursive: true });
		fs.cpSync(inDir, outDir, {
			recursive: true,
			filter: (srcPath) => {
				const relative = path.relative(inDir, srcPath);
				const parts = relative.split(path.sep);
				if (parts.includes('node_modules') || parts.includes('.git') || parts.includes('dist') || parts.includes('dist-esm') || parts.includes('temp')) {
					return false;
				}
				if (path.resolve(srcPath) === outDir || path.resolve(srcPath).startsWith(outDir + path.sep)) {
					return false;
				}
				const destPath = path.join(outDir, relative);
				if (fs.existsSync(destPath)) {
					try {
						if (fs.statSync(srcPath).isFile()) {
							return false; // 已有檔案，不覆蓋
						}
					} catch (e) { }
				}
				return true;
			}
		});
	}

	const filesToProcess: {
		absolutePath: string;
		newPath: string;
		copiedJsPath: string;
		relPath: string;
		sourceFile: SourceFile;
	}[] = [];

	// 1. 全專案語境載入 (Whole-Project Context)
	for (const absolutePath of files) {
		const baseName = path.basename(absolutePath);
		// 設定檔與宣告檔不轉譯
		if (baseName.startsWith('vite.config') ||
			baseName.startsWith('webpack.config') ||
			baseName.endsWith('.d.ts')) {
			continue;
		}

		const relPath = path.relative(inDir, absolutePath).replace(/\\/g, '/');
		const ext = path.extname(absolutePath);
		const newPath = outDir
			? path.join(outDir, relPath.slice(0, -ext.length) + '.ts')
			: path.join(path.dirname(absolutePath), path.basename(absolutePath, ext) + '.ts');
		const copiedJsPath = outDir
			? path.join(outDir, relPath)
			: absolutePath;

		try {
			const originalCode = fs.readFileSync(absolutePath, 'utf-8');
			// 在記憶體中建立虛擬 .ts 檔案並保留在 project 中
			const sourceFile = project.createSourceFile(newPath, originalCode, { overwrite: true });
			filesToProcess.push({
				absolutePath,
				newPath,
				copiedJsPath,
				relPath,
				sourceFile
			});
		} catch (err: any) {
			console.error(chalk.red(`❌ 載入檔案至記憶體失敗: ${relPath}, 錯誤: ${err.message}`));
		}
	}

	// 2. 單一全域 TypeChecker 快取共用與記憶體重構
	console.log(chalk.blue(`📂 正在建立編譯器 TypeChecker 並進行記憶體重構...`));
	const typeChecker = project.getTypeChecker();

	const fileInterfaces = new Map<string, Record<string, string>>();

	console.log(chalk.blue(`📂 正在執行第一階段：基礎 AST 注入與重構...`));
	for (const file of filesToProcess) {
		try {
			const interfacesToDeclare: Record<string, string> = {};
			fileInterfaces.set(file.sourceFile.getFilePath(), interfacesToDeclare);

			processFileRefactoring(file.sourceFile, typeChecker, typeDB, config, inDir, project, interfacesToDeclare);
			console.log(chalk.green(`✔ 第一階段重構完成: ${file.relPath}`));
		} catch (err: any) {
			console.error(chalk.red(`❌ 第一階段重構失敗: ${file.relPath}, 錯誤: ${err.message}`));
			console.error(err.stack);
		}
	}

	console.log(chalk.blue(`📂 正在執行第二階段：全專案反向型別傳播...`));
	try {
		runGlobalReversePropagation(project);
		console.log(chalk.green(`✔ 第二階段全專案反向傳播完成`));
	} catch (err: any) {
		console.error(chalk.red(`❌ 第二階段傳播失敗, 錯誤: ${err.message}`));
	}

	console.log(chalk.blue(`📂 正在執行第三階段：全專案局部變數正向型別傳播 (3輪迭代)...`));
	try {
		runGlobalForwardPropagation(project);
		console.log(chalk.green(`✔ 第三階段全專案正向傳播完成`));
	} catch (err: any) {
		console.error(chalk.red(`❌ 第三階段傳播失敗, 錯誤: ${err.message}`));
	}

	console.log(chalk.blue(`📂 正在執行第四階段：全專案回傳型別推導與注入...`));
	try {
		runGlobalReturnTypePropagation(project, typeDB, config, fileInterfaces, inDir);
		console.log(chalk.green(`✔ 第四階段全專案回傳傳播完成`));
	} catch (err: any) {
		console.error(chalk.red(`❌ 第四階段傳播失敗, 錯誤: ${err.message}`));
	}

	console.log(chalk.blue(`📂 正在執行第五階段：寫入所有 Shape 介面宣告...`));
	for (const file of filesToProcess) {
		const interfacesToDeclare = fileInterfaces.get(file.sourceFile.getFilePath());
		if (interfacesToDeclare) {
			writeInterfaceDeclarations(file.sourceFile, interfacesToDeclare);
		}
	}

	// 3. 記憶體原子交易落盤 (Memory-based Transaction Commit)
	if (options.dryRun) {
		console.log(chalk.yellow('\n--- [Dry Run Diffs] ---'));
		for (const file of filesToProcess) {
			const originalContent = fs.readFileSync(file.absolutePath, 'utf-8');
			const newContent = file.sourceFile.getFullText();
			const fileDiff = diff.createTwoFilesPatch(file.relPath, file.relPath.replace(/\.js$/, '.ts'), originalContent, newContent);
			console.log(fileDiff);
		}
		console.log(chalk.yellow('\n⚠ 目前為 Dry Run 模式，未對磁碟檔案進行任何修改。'));
	} else {
		console.log(chalk.blue(`\n📂 正在將重構後的檔案落盤寫入...`));
		// 確保目標資料夾存在並存檔
		for (const file of filesToProcess) {
			fs.mkdirSync(path.dirname(file.newPath), { recursive: true });
		}
		await project.save();

		// 存檔成功後，批次刪除舊的 JS 檔案以達成交易原子性
		console.log(chalk.blue(`🗑 正在清理原始的 JS 檔案...`));
		for (const file of filesToProcess) {
			if (outDir) {
				if (fs.existsSync(file.copiedJsPath)) {
					try {
						fs.unlinkSync(file.copiedJsPath);
					} catch (e: any) {
						console.warn(chalk.yellow(`⚠ 刪除暫存 JS 檔案失敗 (Windows 檔案鎖定): ${file.copiedJsPath}, 錯誤: ${e.message}`));
					}
				}
			} else {
				if (fs.existsSync(file.absolutePath)) {
					try {
						fs.unlinkSync(file.absolutePath);
					} catch (e: any) {
						console.warn(chalk.yellow(`⚠ 刪除原始 JS 檔案失敗: ${file.absolutePath}, 錯誤: ${e.message}`));
					}
				}
			}
		}

		const targetDir = outDir || inDir;
		// 暫時關閉 TSC 診斷與 AI 反饋循環
		// await runFeedbackLoop(targetDir, config);
		console.log(chalk.green('\n✔ 程式碼型別注入與重構完成！'));
	}
}
