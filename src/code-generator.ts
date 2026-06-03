import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Project, SyntaxKind } from 'ts-morph';
import chalk from 'chalk';
import * as diff from 'diff';
import { mergeSingleVal } from './type-merger';
import { globSync } from 'glob';

function checkGitStatus(): boolean {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    return status === '';
  } catch (e) {
    return true;
  }
}

function mergeObjectShapesArray(shapes: any[]): any {
  if (shapes.length === 0) return {};
  if (shapes.length === 1) return shapes[0];

  const combined: any = {};
  
  const allKeys = new Set<string>();
  shapes.forEach(s => {
    Object.keys(s).filter(k => k !== '__nullable').forEach(k => allKeys.add(k));
  });

  for (const key of allKeys) {
    let existCount = 0;
    const valTypes: any[] = [];
    
    shapes.forEach(s => {
      if (s[key] !== undefined) {
        existCount++;
        valTypes.push(s[key]);
      }
    });

    let mergedVal = 'any';
    if (valTypes.length > 0) {
      mergedVal = valTypes.reduce((acc, curr) => mergeSingleVal(acc, curr));
    }

    if (existCount < shapes.length) {
      mergedVal = mergeSingleVal(mergedVal, 'undefined');
    }

    combined[key] = mergedVal;
  }

  if (shapes.some(s => s.__nullable)) {
    combined.__nullable = true;
  }

  return combined;
}

function shapeToInterfaceBody(shape: any, depth = 1): string {
  const indent = '  '.repeat(depth);
  let body = '';
  
  for (const [key, typeVal] of Object.entries(shape)) {
    if (key === '__nullable') continue;

    let isOptional = false;
    let finalType = 'any';

    if (typeof typeVal === 'object') {
      const subBody = shapeToInterfaceBody(typeVal, depth + 1);
      finalType = `{\n${subBody}${'  '.repeat(depth)}}`;
      if ((typeVal as any).__nullable) {
        finalType += ' | null';
      }
    } else {
      let typeStr = typeVal as string;
      const parts = typeStr.split(' | ');
      if (parts.includes('undefined')) {
        isOptional = true;
        typeStr = parts.filter(p => p !== 'undefined').join(' | ') || 'any';
      }
      finalType = typeStr;
    }

    body += `${indent}${key}${isOptional ? '?' : ''}: ${finalType};\n`;
  }

  body += `${indent}[key: string]: any;\n`;
  return body;
}

function resolveParameterType(record: any, baseName: string, interfacesToDeclare: Record<string, string>): string {
  const observedTypes = record.observedTypes || [];
  const objectShapes = record.objectShapes || [];
  
  const isNullable = observedTypes.includes('null');
  const isUndefined = observedTypes.includes('undefined');

  const cleanBasicTypes = observedTypes.filter((t: string) => t !== 'null' && t !== 'undefined');
  let typeNames = [...cleanBasicTypes];

  if (objectShapes.length > 0) {
    const combinedShape = mergeObjectShapesArray(objectShapes);
    const interfaceName = `${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}Shape`;
    
    const body = shapeToInterfaceBody(combinedShape);
    const declaration = `interface ${interfaceName} {\n${body}}`;
    
    interfacesToDeclare[interfaceName] = declaration;
    typeNames.push(interfaceName);
  }

  if (typeNames.length === 0) {
    if (isNullable) return 'null';
    if (isUndefined) return 'undefined';
    return 'any';
  }

  let finalType = typeNames.join(' | ');
  if (isNullable) {
    finalType = `(${finalType}) | null`;
  }
  
  return finalType.replace(/\[object Object\]/g, '{ [key: string]: any }');
}

function processFileRefactoring(filePath: string, typeDB: any, config: any): string {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  sourceFile.getInterfaces().forEach(iface => iface.remove());
  
  sourceFile.getDescendantsOfKind(SyntaxKind.Parameter).forEach(param => {
    param.removeType();
  });

  refactorCjsToEsm(sourceFile);

  const interfacesToDeclare: Record<string, string> = {};

  sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(fn => {
    const fnName = fn.getName() || 'anonymous';
    if (typeof fn.removeReturnType === 'function') fn.removeReturnType();
    annotateFunction(fn, fnName, relPath, typeDB, interfacesToDeclare, config);
  });

  sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration).forEach(cls => {
    cls.getMethods().forEach(method => {
      const fnName = method.getName();
      if (typeof method.removeReturnType === 'function') method.removeReturnType();
      annotateFunction(method, fnName, relPath, typeDB, interfacesToDeclare, config);
    });
  });

  sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((decl: any) => {
    const init = decl.getInitializer();
    if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
      const fnName = decl.getName();
      annotateFunction(init, fnName, relPath, typeDB, interfacesToDeclare, config);
    }
  });

  const interfaceDeclarations = Object.values(interfacesToDeclare).join('\n\n');
  if (interfaceDeclarations) {
    const imports = sourceFile.getImportDeclarations();
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      sourceFile.insertText(lastImport.getEnd(), '\n\n' + interfaceDeclarations + '\n');
    } else {
      sourceFile.insertText(0, interfaceDeclarations + '\n\n');
    }
  }

  return sourceFile.getFullText();
}

function annotateFunction(fnNode: any, fnName: string, relPath: string, typeDB: any, interfacesToDeclare: Record<string, string>, config: any) {
  const confidenceThreshold = config.confidenceThreshold || 5;

  const params = fnNode.getParameters();
  params.forEach((param: any) => {
    const paramName = param.getName();
    const trackerId = `${relPath}::${fnName}::param::${paramName}`;
    const record = typeDB[trackerId];

    if (record && record.callCount >= confidenceThreshold) {
      const baseName = `${fnName.charAt(0).toUpperCase()}${fnName.slice(1)}${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
      const typeStr = resolveParameterType(record, baseName, interfacesToDeclare);
      
      if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
        param.setType(typeStr);
      }
    } else if (record && record.callCount > 0) {
      if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
        param.setType('/* @inferred-low-confidence */ any');
      }
    }
  });

  const returnTrackerId = `${relPath}::${fnName}::return`;
  const returnRecord = typeDB[returnTrackerId];
  if (returnRecord && returnRecord.callCount >= confidenceThreshold) {
    const baseName = `${fnName.charAt(0).toUpperCase()}${fnName.slice(1)}Return`;
    const typeStr = resolveParameterType(returnRecord, baseName, interfacesToDeclare);
    
    if (typeof fnNode.setReturnType === 'function' && !fnNode.getReturnTypeNode()) {
      fnNode.setReturnType(typeStr);
    }
  }
}

function refactorCjsToEsm(sourceFile: any) {
  sourceFile.getVariableStatements().forEach((stmt: any) => {
    if (stmt.getParent().getKind() !== SyntaxKind.SourceFile) return;

    const declarations = stmt.getDeclarations();
    if (declarations.length === 1) {
      const decl = declarations[0];
      const init = decl.getInitializer();
      if (init && init.getKind() === SyntaxKind.CallExpression) {
        const call = init;
        if (call.getExpression().getText() === 'require' && call.getArguments().length === 1) {
          const moduleSpecifier = call.getArguments()[0].getText().replace(/['"]/g, '');
          const nameNode = decl.getNameNode();
          const isDestructured = nameNode.getKind() === SyntaxKind.ObjectBindingPattern;

          if (isDestructured) {
            const elements = nameNode.getElements().map((el: any) => el.getName());
            sourceFile.addImportDeclaration({
              namedImports: elements,
              moduleSpecifier: moduleSpecifier
            });
          } else {
            sourceFile.addImportDeclaration({
              defaultImport: decl.getName(),
              moduleSpecifier: moduleSpecifier
            });
          }
          stmt.remove();
        }
      }
    }
  });

  sourceFile.getStatements().forEach((stmt: any) => {
    if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
      const expr = stmt.getExpression();
      if (expr.getKind() === SyntaxKind.BinaryExpression) {
        const binary = expr;
        const left = binary.getLeft();
        const right = binary.getRight();

        if (left.getText() === 'module.exports') {
          sourceFile.addExportAssignment({
            isExportEquals: false,
            expression: right.getText()
          });
          stmt.remove();
        } else if (left.getText().startsWith('module.exports.')) {
          const propName = left.getText().replace('module.exports.', '');
          sourceFile.addVariableStatement({
            declarationKind: 'const',
            declarations: [{ name: propName, initializer: right.getText() }],
            isExported: true
          });
          stmt.remove();
        } else if (left.getText().startsWith('exports.')) {
          const propName = left.getText().replace('exports.', '');
          sourceFile.addVariableStatement({
            declarationKind: 'const',
            declarations: [{ name: propName, initializer: right.getText() }],
            isExported: true
          });
          stmt.remove();
        }
      }
    }
  });
}

export function runGeneration(options: any) {
  const configPath = path.resolve(process.cwd(), options.config);
  let config = {
    include: ["src/**/*.js", "modules/**/*.js", "*.js"],
    exclude: ["node_modules/**", "**/dist/**", "**/*.test.js", "**/test/**"],
    confidenceThreshold: 5
  };

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {}
  }

  if (!options.force && !options.dryRun) {
    if (!checkGitStatus()) {
      console.error(chalk.red('❌ Git 工作區有未提交的變更！請先 commit 您的變更。'));
      console.error(chalk.red('   或者使用 --force 旗標強制執行。'));
      process.exit(1);
    }
  }

  const observedTypesPath = path.resolve(process.cwd(), 'types-observed.json');
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
    ignore: config.exclude,
    nodir: true,
    absolute: true
  });

  console.log(chalk.blue(`📝 開始重構與注入型別，共 ${files.length} 個檔案...`));

  for (const absolutePath of files) {
    const relPath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    const ext = path.extname(absolutePath);
    const newExt = '.ts';
    const dir = path.dirname(absolutePath);
    const base = path.basename(absolutePath, ext);
    const newPath = path.join(dir, base + newExt);

    try {
      const newContent = processFileRefactoring(absolutePath, typeDB, config);

      if (options.dryRun) {
        const originalContent = fs.readFileSync(absolutePath, 'utf-8');
        const fileDiff = diff.createTwoFilesPatch(relPath, relPath.replace(/\.js$/, '.ts'), originalContent, newContent);
        console.log(chalk.yellow(`\n--- [Dry Run Diff] ${relPath} -> ${relPath.replace(/\.js$/, '.ts')} ---`));
        console.log(fileDiff);
      } else {
        fs.writeFileSync(newPath, newContent, 'utf-8');
        fs.unlinkSync(absolutePath);
        console.log(chalk.green(`✔ 已轉換並寫入: ${path.relative(process.cwd(), newPath)}`));
      }
    } catch (err: any) {
      console.error(chalk.red(`❌ 轉換檔案失敗: ${relPath}, 錯誤: ${err.message}`));
      console.error(err.stack);
    }
  }

  if (options.dryRun) {
    console.log(chalk.yellow('\n⚠ 目前為 Dry Run 模式，未對磁碟檔案進行任何修改。'));
  } else {
    console.log(chalk.green('\n✔ 程式碼型別注入與重構完成！'));
  }
}
