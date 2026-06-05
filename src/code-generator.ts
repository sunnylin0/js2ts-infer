import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Project, SyntaxKind } from 'ts-morph';
import chalk from 'chalk';
import * as diff from 'diff';
import { mergeSingleVal } from './type-merger';
import { globSync } from 'glob';

function checkGitStatus(dir: string = process.cwd()): boolean {
  try {
    const status = execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' }).trim();
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

function formatInterfaceKey(key: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return key;
  }
  return JSON.stringify(key);
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

    const formattedKey = formatInterfaceKey(key);
    body += `${indent}${formattedKey}${isOptional ? '?' : ''}: ${finalType};\n`;
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

  let result = finalType.replace(/\[object Object\]/g, '{ [key: string]: any }');
  while (result.includes('<>')) {
    result = result.replace(/<>/g, '<any>');
  }
  return result;
}

function getCleanTypeText(type: any): string {
  let text = type.getText();

  // 排除複雜的 inline object 或者是 import 等型別
  if (text.includes('import(') || text.includes('{') || text.includes('typeof') || text.includes('=>') || text.includes('prototype')) {
    return '';
  }

  // 排除 some basic cases
  if (text === 'any' || text === 'null' || text === 'undefined' || text === 'unknown') {
    return '';
  }

  return text;
}

function findInterfaceInProject(project: Project, name: string): any {
  for (const sourceFile of project.getSourceFiles()) {
    const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
    const matched = interfaces.find(i => i.getName() === name);
    if (matched) return matched;
  }
  return undefined;
}

function getPropertyTypeString(prop: any): string {
  const type = prop.getType();
  if (type) {
    const typeStr = type.getText();
    if (!typeStr.includes('import(')) {
      return typeStr;
    }
  }
  const typeNode = prop.getTypeNode();
  if (typeNode) {
    return typeNode.getText();
  }
  return 'any';
}

function safeAddProperty(cls: any, propName: string, typeStr: string = 'any') {
  try {
    cls.insertProperty(0, {
      name: propName,
      type: typeStr,
      hasQuestionToken: false
    });
  } catch (err: any) {
    try {
      const ctor = cls.getConstructors()[0];
      if (ctor) {
        cls.insertText(ctor.getStart(), `${propName}: ${typeStr};\n  `);
      } else {
        const firstMethod = cls.getMethods()[0];
        if (firstMethod) {
          cls.insertText(firstMethod.getStart(), `${propName}: ${typeStr};\n  `);
        } else {
          const classText = cls.getText();
          const braceIdx = classText.indexOf('{');
          if (braceIdx !== -1) {
            cls.insertText(cls.getStart() + braceIdx + 1, `\n  ${propName}: ${typeStr};`);
          }
        }
      }
    } catch (fallbackErr: any) {
      console.warn(`⚠ [SafeAddProperty] 降級寫入成員屬性 ${propName} 失敗: ${fallbackErr.message}`);
    }
  }
}

function cleanCommentToJSDoc(comment: string): string {
  if (comment.startsWith('/**')) {
    return comment.replace(/^\/\*\*+/, '').replace(/\*+\/$/, '').trim();
  }
  if (comment.startsWith('/*')) {
    return comment.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim();
  }
  return comment.split('\n').map(line => line.replace(/^\/\/+/, '').trim()).join('\n');
}

function processFileRefactoring(filePath: string, typeDB: any, config: any, inDir: string, project: Project): string {
  const originalCode = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = project.createSourceFile(filePath.replace(/\.js$/, '.ts'), originalCode, { overwrite: true });
  const relPath = path.relative(inDir, filePath).replace(/\\/g, '/');

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
    const className = cls.getName();
    const dtsInterface = className ? findInterfaceInProject(project, className) : undefined;
    const classMethods = new Set(cls.getMethods().map((m: any) => m.getName()));
    // 1. 收集 Class 中所有 `this.xxx` 賦值
    const properties = new Set<string>();
    cls.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach(expr => {
      const left = expr.getLeft();
      if (left.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = left as any;
        if (propAccess.getExpression().getText() === 'this') {
          const name = propAccess.getName();
          if (name !== 'constructor') {
            properties.add(name);
          }
        }
      }
    });

    // 1.5 將 constructor 內無依賴的 this 賦值移至 Class 頂部作為屬性初始值
    const ctor = cls.getConstructors()[0];
    if (ctor) {
      const ctorParams = ctor.getParameters().map((p: any) => p.getName());
      const localVars = new Set<string>();
      ctor.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((decl: any) => {
        localVars.add(decl.getName());
      });

      const statements = ctor.getStatements();
      const propertiesToMigrate: { propName: string; rightText: string; commentText: string }[] = [];

      const collectedPropNames = new Set<string>();

      // 第一階段：唯讀收集
      statements.forEach((stmt: any) => {
        if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
          const expr = stmt.getExpression();
          if (expr.getKind() === SyntaxKind.BinaryExpression) {
            const binary = expr;
            const left = binary.getLeft();
            const right = binary.getRight();

            if (left.getKind() === SyntaxKind.PropertyAccessExpression && binary.getOperatorToken().getText() === '=') {
              const propAccess = left;
              if (propAccess.getExpression().getText() === 'this') {
                const propName = propAccess.getName();
                const rightText = right.getText();

                // 1. 避免與 Class 方法同名衝突
                if (classMethods.has(propName)) {
                  return;
                }

                // 2. 避免重複宣告
                if (collectedPropNames.has(propName)) {
                  return;
                }

                // 3. 避免依賴 `this.` (實例屬性或方法引用，在 class properties 階段可能尚未初始化)
                if (rightText.includes('this.')) {
                  return;
                }

                // 檢查是否含有對 constructor 參數或內部變數的參照
                let isSafe = true;
                for (const param of ctorParams) {
                  const regex = new RegExp(`\\b${param}\\b`);
                  if (regex.test(rightText)) {
                    isSafe = false;
                    break;
                  }
                }
                if (isSafe) {
                  for (const localVar of localVars) {
                    const regex = new RegExp(`\\b${localVar}\\b`);
                    if (regex.test(rightText)) {
                      isSafe = false;
                      break;
                    }
                  }
                }

                if (isSafe && propName !== 'constructor') {
                  const leadingCommentRanges = stmt.getLeadingCommentRanges();
                  let commentText = '';
                  if (leadingCommentRanges && leadingCommentRanges.length > 0) {
                    commentText = leadingCommentRanges.map((r: any) => r.getText()).join('\n');
                  }

                  collectedPropNames.add(propName);
                  propertiesToMigrate.push({
                    propName,
                    rightText,
                    commentText
                  });
                }
              }
            }
          }
        }
      });

      // 第二階段：執行修改（一次性批量插入屬性宣告，包含將註解轉換為 JSDoc 注入，避免 Node 失效錯誤）
      const propertiesStructures = propertiesToMigrate.map(item => {
        let propType: string | undefined = undefined;
        if (dtsInterface) {
          const dtsProp = dtsInterface.getProperty(item.propName);
          if (dtsProp) {
            propType = getPropertyTypeString(dtsProp);
          }
        }

        const struct: any = {
          name: item.propName,
          initializer: item.rightText,
          type: propType,
          hasQuestionToken: false
        };
        if (item.commentText) {
          struct.docs = [cleanCommentToJSDoc(item.commentText)];
        }
        return struct;
      });

      if (propertiesStructures.length > 0) {
        cls.insertProperties(0, propertiesStructures);
      }

      propertiesToMigrate.forEach(item => {
        properties.delete(item.propName); // 移除了就不必再以 any 補宣告
      });

      // 第三階段：從後往前移除 constructor 內已被搬移的賦值語句
      const migratedPropsSet = new Set(propertiesToMigrate.map(x => x.propName));
      const currentStatements = ctor.getStatements();
      for (let i = currentStatements.length - 1; i >= 0; i--) {
        const stmt = currentStatements[i] as any;
        if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
          const expr = stmt.getExpression();
          if (expr.getKind() === SyntaxKind.BinaryExpression) {
            const left = expr.getLeft();
            if (left.getKind() === SyntaxKind.PropertyAccessExpression && expr.getOperatorToken().getText() === '=') {
              const propAccess = left;
              if (propAccess.getExpression().getText() === 'this') {
                const propName = propAccess.getName();
                if (migratedPropsSet.has(propName)) {
                  stmt.remove();
                }
              }
            }
          }
        }
      }
    }

    const existingProps = new Set(cls.getProperties().map(p => p.getName()));

    // 2. 自動在頂部補上未宣告的屬性
    properties.forEach(prop => {
      if (!existingProps.has(prop) && !classMethods.has(prop)) {
        let propType = 'any';
        if (dtsInterface) {
          const dtsProp = dtsInterface.getProperty(prop);
          if (dtsProp) {
            propType = getPropertyTypeString(dtsProp);
          }
        }
        safeAddProperty(cls, prop, propType);
      }
    });

    // 3. 標註方法
    cls.getMethods().forEach(method => {
      const fnName = method.getName();
      if (typeof method.removeReturnType === 'function') method.removeReturnType();
      annotateFunction(method, `${cls.getName()}.${fnName}`, relPath, typeDB, interfacesToDeclare, config, dtsInterface);
    });

    // 3.5 標註建構函式
    cls.getConstructors().forEach(ctor => {
      annotateFunction(ctor, `${cls.getName()}.constructor`, relPath, typeDB, interfacesToDeclare, config, dtsInterface);
    });

    // 4. 對齊既有屬性的型別與 dts 中的定義
    // 4. 對齊既有屬性的型別與 dts 中的定義
    if (dtsInterface) {
      cls.getProperties().forEach(prop => {
        const propName = prop.getName();
        const dtsProp = dtsInterface.getProperty(propName);
        if (dtsProp) {
          const dtsTypeStr = getPropertyTypeString(dtsProp);
          const currentType = prop.getTypeNode()?.getText() || '';
          if (!currentType || currentType === 'any' || currentType.includes('any')) {
            prop.setType(dtsTypeStr);
          }
        }
      });
    }

    // 5. 區域變數型別正向傳播
    cls.getMethods().forEach(method => {
      method.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(decl => {
        if (!decl.getTypeNode()) {
          const init = decl.getInitializer();
          if (init) {
            const type = init.getType();
            const typeText = getCleanTypeText(type);
            if (typeText) {
              decl.setType(typeText);
            }
          }
        }
      });
    });

    // 6. 方法參數反向傳播 (透過類別內部的 this.method(...) 呼叫)
    cls.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr as any;
        if (propAccess.getExpression().getText() === 'this') {
          const methodName = propAccess.getName();
          const targetMethod = cls.getMethod(methodName);
          if (targetMethod) {
            const args = call.getArguments();
            const params = targetMethod.getParameters();
            args.forEach((arg, idx) => {
              const param = params[idx];
              if (param && !param.getTypeNode()) {
                const argType = arg.getType();
                const argTypeText = getCleanTypeText(argType);
                if (argTypeText) {
                  param.setType(argTypeText);
                }
              }
            });
          }
        }
      }
    });

    // 7. 方法傳回值型別推導與傳播
    cls.getMethods().forEach(method => {
      if (!method.getReturnTypeNode()) {
        const returnType = method.getReturnType();
        const returnTypeText = getCleanTypeText(returnType);
        if (returnTypeText) {
          method.setReturnType(returnTypeText);
        }
      }
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

  const newContent = sourceFile.getFullText();
  project.removeSourceFile(sourceFile);
  return newContent;
}

function annotateFunction(
  fnNode: any,
  fnName: string,
  relPath: string,
  typeDB: any,
  interfacesToDeclare: Record<string, string>,
  config: any,
  dtsInterface?: any
) {
  const confidenceThreshold = config.confidenceThreshold || 5;
  const params = fnNode.getParameters();

  const shortFnName = fnName.includes('.') ? fnName.split('.').pop()! : fnName;
  let dtsMethodOrType: any = undefined;
  if (dtsInterface && shortFnName) {
    dtsMethodOrType = dtsInterface.getMethod(shortFnName);
    if (!dtsMethodOrType) {
      const dtsProp = dtsInterface.getProperty(shortFnName);
      if (dtsProp) {
        const typeNode = dtsProp.getTypeNode();
        if (typeNode && (typeNode.getKind() === SyntaxKind.FunctionType || typeNode.getKind() === SyntaxKind.TypeLiteral)) {
          dtsMethodOrType = typeNode;
        }
      }
    }
  }

  params.forEach((param: any, paramIdx: number) => {
    const paramName = param.getName();

    let dtsParamTypeStr: string | undefined = undefined;
    if (dtsMethodOrType) {
      if (dtsMethodOrType.getKind() === SyntaxKind.MethodSignature || dtsMethodOrType.getKind() === SyntaxKind.FunctionType) {
        const dtsParams = dtsMethodOrType.getParameters();
        const dtsParam = dtsParams.find((p: any) => p.getName() === paramName) || dtsParams[paramIdx];
        if (dtsParam) {
          const typeNode = dtsParam.getTypeNode();
          if (typeNode) {
            dtsParamTypeStr = typeNode.getText();
          }
        }
      }
    }

    if (dtsParamTypeStr && dtsParamTypeStr !== 'any') {
      if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
        param.setType(dtsParamTypeStr);
      }
    } else {
      const trackerId = `${relPath}::${fnName}::param::${paramName}`;
      const record = typeDB[trackerId];

      if (record && record.callCount >= confidenceThreshold) {
        const sanitizedFnName = fnName.replace(/\./g, '');
        const baseName = `${sanitizedFnName.charAt(0).toUpperCase()}${sanitizedFnName.slice(1)}${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
        const typeStr = resolveParameterType(record, baseName, interfacesToDeclare);

        if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
          param.setType(typeStr);
        }
      } else if (record && record.callCount > 0) {
        if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
          param.setType('/* @inferred-low-confidence */ any');
        }
      }
    }
  });

  let dtsReturnTypeStr: string | undefined = undefined;
  if (dtsMethodOrType) {
    if (dtsMethodOrType.getKind() === SyntaxKind.MethodSignature || dtsMethodOrType.getKind() === SyntaxKind.FunctionType) {
      const returnTypeNode = dtsMethodOrType.getReturnTypeNode();
      if (returnTypeNode) {
        dtsReturnTypeStr = returnTypeNode.getText();
      }
    }
  }

  if (dtsReturnTypeStr && dtsReturnTypeStr !== 'any' && dtsReturnTypeStr !== 'void') {
    if (typeof fnNode.setReturnType === 'function' && !fnNode.getReturnTypeNode()) {
      fnNode.setReturnType(dtsReturnTypeStr);
    }
  } else {
    const returnTrackerId = `${relPath}::${fnName}::return`;
    const returnRecord = typeDB[returnTrackerId];
    if (returnRecord && returnRecord.callCount >= confidenceThreshold) {
      const sanitizedFnName = fnName.replace(/\./g, '');
      const baseName = `${sanitizedFnName.charAt(0).toUpperCase()}${sanitizedFnName.slice(1)}Return`;
      const typeStr = resolveParameterType(returnRecord, baseName, interfacesToDeclare);

      if (typeof fnNode.setReturnType === 'function' && !fnNode.getReturnTypeNode()) {
        fnNode.setReturnType(typeStr);
      }
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
  const inDir = options.inDir ? path.resolve(process.cwd(), options.inDir) : process.cwd();
  const configPath = path.isAbsolute(options.config)
    ? options.config
    : path.resolve(inDir, options.config);

  let config = {
    include: ["src/**/*.js", "modules/**/*.js", "*.js"],
    exclude: ["node_modules/**", "**/dist/**", "**/*.test.js", "**/test/**"],
    confidenceThreshold: 5
  };

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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

  console.log(chalk.blue(`📝 開始重構與注入型別，共 ${files.length} 個檔案...`));

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
    //設定檔不轉譯
    if (baseName.startsWith('vite.config') || baseName.startsWith('webpack.config')) {
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
    console.log(chalk.green('\n✔ 程式碼型別注入與重構完成！'));
  }
}
