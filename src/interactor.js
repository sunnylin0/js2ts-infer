const fs = require('fs');
const path = require('path');
const { Project, SyntaxKind } = require('ts-morph');
const chalk = require('chalk');
const prompts = require('prompts');

async function runReview(options) {
  const configPath = path.resolve(process.cwd(), options.config);
  let config = {
    include: ["src/**/*.ts", "modules/**/*.ts", "*.ts"], // 審閱 generate 後的 TS
    exclude: ["node_modules/**", "**/dist/**", "**/*.test.ts", "**/test/**"]
  };

  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // 改為尋找對應的 .ts 檔案
      config.include = (userConfig.include || []).map(p => p.replace(/\.js$/, '.ts'));
      config.exclude = (userConfig.exclude || []).map(p => p.replace(/\.js$/, '.ts'));
    } catch (e) {}
  }

  // 讀取觀測型別
  const observedTypesPath = path.resolve(process.cwd(), 'types-observed.json');
  let typeDB = {};
  if (fs.existsSync(observedTypesPath)) {
    try {
      typeDB = JSON.parse(fs.readFileSync(observedTypesPath, 'utf-8'));
    } catch (e) {}
  }

  const project = new Project();
  project.addSourceFilesAtPaths(config.include);

  const sourceFiles = project.getSourceFiles().filter(sf => {
    // 排除被 ignore 的檔案
    const relPath = path.relative(process.cwd(), sf.getFilePath());
    return !config.exclude.some(ex => relPath.includes(ex.replace(/\*\*/g, '')));
  });

  console.log(chalk.blue(`🔍 開始掃描專案中的 any 與介面定義...`));

  // 1. 審閱 interfaces 重新命名
  for (const sf of sourceFiles) {
    const interfaces = sf.getInterfaces();
    for (const iface of interfaces) {
      const name = iface.getName();
      // 如果名字是自動產生的，例如 ProcessUserUser (沒有明確指示是自訂名)
      // 我們可以讓使用者選擇是否重新命名所有 interface
      if (name.startsWith('Shape_') || /^[A-Z][a-zA-Z0-9]+[A-Z][a-zA-Z0-9]+$/.test(name)) {
        console.log(chalk.yellow(`\nfound interface: ${chalk.bold(name)} in ${path.relative(process.cwd(), sf.getFilePath())}`));
        
        // 印出 interface 的部分結構
        const body = iface.getText();
        console.log(chalk.gray(body));

        const response = await prompts({
          type: 'confirm',
          name: 'rename',
          message: `是否要為這個介面 ${chalk.bold(name)} 重新命名？`,
          initial: false
        });

        if (response.rename) {
          const newNameRes = await prompts({
            type: 'text',
            name: 'newName',
            message: '請輸入新的介面名稱:',
            validate: val => val ? true : '名稱不能為空！'
          });

          if (newNameRes.newName) {
            // ts-morph 自動更新所有引用！
            iface.rename(newNameRes.newName);
            sf.saveSync();
            console.log(chalk.green(`✔ 已重命名為: ${newNameRes.newName}`));
          }
        }
      }
    }
  }

  // 2. 審閱 any 型別補完
  for (const sf of sourceFiles) {
    const relPath = path.relative(process.cwd(), sf.getFilePath()).replace(/\\/g, '/');
    const paramsToReview = [];

    // 收集所有 any 的參數
    sf.getDescendantsOfKind(SyntaxKind.Parameter).forEach(param => {
      const typeNode = param.getTypeNode();
      const typeText = typeNode ? typeNode.getText() : 'any';
      
      if (typeText === 'any' || typeText.includes('/* @inferred-low-confidence */')) {
        paramsToReview.push(param);
      }
    });

    for (const param of paramsToReview) {
      const paramName = param.getName();
      const parentFunc = param.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                         param.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
                         param.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
      
      const fnName = parentFunc && typeof parentFunc.getName === 'function' ? parentFunc.getName() || 'anonymous' : 'anonymous';
      const trackerId = `${relPath.replace(/\.ts$/, '.js')}::${fnName}::param::${paramName}`;
      const record = typeDB[trackerId];

      const line = param.getStartLineNumber();
      const originalCode = sf.getFullText();
      const lines = originalCode.split('\n');
      
      // 獲取上下文 (前後 3 行)
      const startLine = Math.max(0, line - 4);
      const endLine = Math.min(lines.length - 1, line + 2);
      console.log(chalk.yellow(`\n--- 審閱 ${relPath}:${line} (${fnName} 中的 ${paramName}) ---`));
      for (let i = startLine; i <= endLine; i++) {
        if (i + 1 === line) {
          console.log(chalk.cyan(`> ${i + 1}: ${lines[i]}`));
        } else {
          console.log(chalk.gray(`  ${i + 1}: ${lines[i]}`));
        }
      }

      // 提供候選選項
      const choices = [
        { title: '保持為 any', value: 'any' }
      ];

      if (record && record.observedTypes && record.observedTypes.length > 0) {
        choices.push({
          title: `推薦側錄型別: ${record.observedTypes.join(' | ')}`,
          value: record.observedTypes.join(' | ')
        });
      }

      choices.push({ title: '自訂輸入型別', value: '__custom__' });

      const choiceRes = await prompts({
        type: 'select',
        name: 'type',
        message: `請選擇或補完參數 ${chalk.bold(paramName)} 的型別:`,
        choices: choices
      });

      if (!choiceRes.type) continue; // 使用者按 Ctrl+C

      let chosenType = choiceRes.type;
      if (chosenType === '__custom__') {
        const customRes = await prompts({
          type: 'text',
          name: 'val',
          message: '請輸入型別標註 (例如 string, number, MyInterface):',
          validate: val => val ? true : '型別不能為空！'
        });
        if (customRes.val) {
          chosenType = customRes.val;
        } else {
          chosenType = 'any';
        }
      }

      if (chosenType !== 'any') {
        param.setType(chosenType);
        sf.saveSync();
        console.log(chalk.green(`✔ 已更新型別標註為: ${chosenType}`));
      }
    }
  }

  console.log(chalk.green('\n✔ 互動式審閱結束。'));
}

module.exports = {
  runReview
};
