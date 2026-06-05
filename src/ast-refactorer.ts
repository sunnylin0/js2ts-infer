import * as fs from 'fs';
import * as path from 'path';
import { Project, SyntaxKind } from 'ts-morph';
import { mergeSingleVal } from './type-merger';

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

function findMatchingInterface(project: Project, shape: any): string | null {
  const shapeKeys = Object.keys(shape).filter(k => k !== '__nullable');
  if (shapeKeys.length === 0) return null;

  for (const sourceFile of project.getSourceFiles()) {
    const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
    for (const iface of interfaces) {
      const ifaceName = iface.getName();
      if (ifaceName.endsWith('Shape')) continue;

      const ifaceProps = iface.getProperties();
      const ifacePropNames = new Set(ifaceProps.map(p => p.getName()));

      let matchCount = 0;
      for (const key of shapeKeys) {
        if (ifacePropNames.has(key)) {
          matchCount++;
        }
      }

      if (matchCount === shapeKeys.length && shapeKeys.length >= 2) {
        return ifaceName;
      }
    }
  }
  return null;
}

function widenTypeName(t: string): string {
  if (t.includes(' | ')) {
    const parts = t.split(' | ').map(p => widenTypeName(p));
    return Array.from(new Set(parts)).join(' | ');
  }
  const clean = t.trim();
  if (clean === 'true' || clean === 'false') {
    return 'boolean';
  }
  if (!clean) return t;
  if (!isNaN(Number(clean))) {
    return 'number';
  }
  if ((clean.startsWith('"') && clean.endsWith('"')) || 
      (clean.startsWith("'") && clean.endsWith("'")) || 
      (clean.startsWith("`") && clean.endsWith("`"))) {
    return 'string';
  }
  return t;
}

function resolveParameterType(record: any, baseName: string, interfacesToDeclare: Record<string, string>, project?: Project): string {
  const observedTypes = record.observedTypes || [];
  const objectShapes = record.objectShapes || [];

  const isNullable = observedTypes.includes('null');
  const isUndefined = observedTypes.includes('undefined');

  const cleanBasicTypes = observedTypes
    .filter((t: string) => t !== 'null' && t !== 'undefined')
    .map((t: string) => widenTypeName(t));
  let typeNames = Array.from(new Set(cleanBasicTypes));

  if (objectShapes.length > 0) {
    const combinedShape = mergeObjectShapesArray(objectShapes);
    let matchedInterface: string | null = null;
    if (project) {
      matchedInterface = findMatchingInterface(project, combinedShape);
    }

    if (matchedInterface) {
      typeNames.push(matchedInterface);
    } else {
      const interfaceName = `${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}Shape`;
      const body = shapeToInterfaceBody(combinedShape);
      const declaration = `interface ${interfaceName} {\n${body}}`;

      interfacesToDeclare[interfaceName] = declaration;
      typeNames.push(interfaceName);
    }
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

  // 排除複雜的 inline object 或者是 import 等型別，或是包含臨時產生的 Shape
  const isComplexObject = /\{\s*[a-zA-Z_$][\w_$]*\s*:/.test(text) || text.includes(';');

  if (text.includes('import(') || isComplexObject || text.includes('typeof') || text.includes('=>') || text.includes('prototype') || text.includes('Shape')) {
    return '';
  }

  // 排除 some basic cases
  if (text === 'any' || text === 'null' || text === 'undefined' || text === 'unknown') {
    return '';
  }

  return widenTypeName(text);
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
    if (typeof dtsInterface.getMethodSignature === 'function') {
      dtsMethodOrType = dtsInterface.getMethodSignature(shortFnName);
    } else if (typeof dtsInterface.getMethod === 'function') {
      dtsMethodOrType = dtsInterface.getMethod(shortFnName);
    }

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
        const typeStr = resolveParameterType(record, baseName, interfacesToDeclare, fnNode.getProject());

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
  }
}

function resolveAndSetReturnType(
  fnNode: any,
  fnName: string,
  relPath: string,
  typeDB: any,
  interfacesToDeclare: Record<string, string>,
  config: any
) {
  if (typeof fnNode.setReturnType !== 'function' || fnNode.getReturnTypeNode()) {
    return;
  }

  // 1. 優先嘗試 AST 推導
  const returnType = fnNode.getReturnType();
  let returnTypeText = getCleanTypeText(returnType);

  // 如果型別被 Widen 為 '{}' 或為空，手動收集 ReturnStatement 表達式型別以防過度簡化
  if (returnTypeText === '{}' || returnTypeText === '') {
    const returnStatements = fnNode.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    if (returnStatements.length > 0) {
      const types = new Set<string>();
      returnStatements.forEach(ret => {
        const expr = ret.getExpression();
        if (expr) {
          const exprType = expr.getType();
          const exprTypeText = getCleanTypeText(exprType);
          if (exprTypeText) {
            types.add(exprTypeText);
          } else {
            const exprText = expr.getText().trim();
            if (exprText === '{}') {
              types.add('{}');
            }
          }
        }
      });
      if (types.size > 0) {
        returnTypeText = Array.from(types).join(' | ');
      }
    }
  }

  if (returnTypeText && returnTypeText !== 'any') {
    fnNode.setReturnType(returnTypeText);
    return;
  }

  // 2. 如果 AST 無法推導出有效型別，使用 typeDB 兜底
  const confidenceThreshold = config.confidenceThreshold || 5;
  const returnTrackerId = `${relPath}::${fnName}::return`;
  const returnRecord = typeDB[returnTrackerId];
  if (returnRecord && returnRecord.callCount >= confidenceThreshold) {
    const sanitizedFnName = fnName.replace(/\./g, '');
    const baseName = `${sanitizedFnName.charAt(0).toUpperCase()}${sanitizedFnName.slice(1)}Return`;
    const typeStr = resolveParameterType(returnRecord, baseName, interfacesToDeclare, fnNode.getProject());
    if (typeStr && typeStr !== 'any') {
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

export function processFileRefactoring(filePath: string, typeDB: any, config: any, inDir: string, project: Project): string {
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

                if (classMethods.has(propName)) return;
                if (collectedPropNames.has(propName)) return;
                if (rightText.includes('this.')) return;

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
        properties.delete(item.propName);
      });

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

    cls.getMethods().forEach(method => {
      const fnName = method.getName();
      if (typeof method.removeReturnType === 'function') method.removeReturnType();
      annotateFunction(method, `${cls.getName()}.${fnName}`, relPath, typeDB, interfacesToDeclare, config, dtsInterface);
    });

    cls.getConstructors().forEach(ctor => {
      annotateFunction(ctor, `${cls.getName()}.constructor`, relPath, typeDB, interfacesToDeclare, config, dtsInterface);
    });

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

    cls.getMethods().forEach(method => {
      const fnName = method.getName();
      resolveAndSetReturnType(method, `${cls.getName()}.${fnName}`, relPath, typeDB, interfacesToDeclare, config);
    });
  });

  sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((decl: any) => {
    const init = decl.getInitializer();
    if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
      const fnName = decl.getName();
      annotateFunction(init, fnName, relPath, typeDB, interfacesToDeclare, config);
      resolveAndSetReturnType(init, fnName, relPath, typeDB, interfacesToDeclare, config);
    }
  });

  sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(fn => {
    const fnName = fn.getName() || 'anonymous';
    resolveAndSetReturnType(fn, fnName, relPath, typeDB, interfacesToDeclare, config);
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
