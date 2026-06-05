import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Project } from 'ts-morph';
import chalk from 'chalk';
import * as diff from 'diff';
import { globSync } from 'glob';
import { processFileRefactoring } from './ast-refactorer';
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
 * 3. 處理輸出目錄複製，並逐一對所有匹配的 JS 檔案呼叫 AST 重構程式 `processFileRefactoring`。
 * 4. 將重構注入型別後的代碼寫入對應的 `.ts` 檔案，若指定為 `--dry-run` 則僅輸出 Diff Log。
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

	for (const absolutePath of files) {
		const baseName = path.basename(absolutePath);
		// 設定檔不轉譯
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
			const newContent = processFileRefactoring(absolutePath, typeDB, config, inDir, project);

			if (options.dryRun) {
				const originalContent = fs.readFileSync(absolutePath, 'utf-8');
				const fileDiff = diff.createTwoFilesPatch(relPath, relPath.replace(/\.js$/, '.ts'), originalContent, newContent);
				console.log(chalk.yellow(`\n--- [Dry Run Diff] ${relPath} -> ${relPath.replace(/\.js$/, '.ts')} ---`));
				console.log(fileDiff);
			} else {
				fs.mkdirSync(path.dirname(newPath), { recursive: true });
				fs.writeFileSync(newPath, newContent, 'utf-8');

				if (outDir) {
					if (fs.existsSync(copiedJsPath)) {
						fs.unlinkSync(copiedJsPath);
					}
					console.log(chalk.green(`✔ 已轉換並寫入: ${path.relative(process.cwd(), newPath)}`));
				} else {
					fs.unlinkSync(absolutePath);
					console.log(chalk.green(`✔ 已轉換並寫入: ${path.relative(process.cwd(), newPath)}`));
				}
			}
		} catch (err: any) {
			console.error(chalk.red(`❌ 轉換檔案失敗: ${relPath}, 錯誤: ${err.message}`));
			console.error(err.stack);
		}
	}

	if (options.dryRun) {
		console.log(chalk.yellow('\n⚠ 目前為 Dry Run 模式，未對磁碟檔案進行任何修改。'));
	} else {
		const targetDir = outDir || inDir;
		// 暫時關閉 TSC 診斷與 AI 反饋循環
		// await runFeedbackLoop(targetDir, config);
		console.log(chalk.green('\n✔ 程式碼型別注入與重構完成！'));
	}
}
