import * as path from 'path';
import * as fs from 'fs';

let config: any = null;
/**
 * 載入專案的 `js2ts.config.json` 設定檔。
 * 
 * @description
 * 採用 Lazy-loading 緩存策略，僅在第一次呼叫時同步讀取並解析根目錄設定檔。
 * 
 * @returns {any} 返回解析後的設定檔內容物件，若讀取失敗則返回空物件。
 */
function loadConfig() {
  if (config) return config;
  const configPath = path.resolve(process.cwd(), 'js2ts.config.json');
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      config = {};
    }
  } else {
    config = {};
  }
  return config;
}

/**
 * 將簡化的 Glob 匹配模式字串轉為 RegExp 正則表達式。
 * 
 * @description
 * 支援將 `**` 轉為 `.*`，`*` 轉為 `[^/]*`，`?` 轉為 `.`，以適應檔案路徑的排除比對。
 * 
 * @param {string} pattern - 欲轉換的 Glob 匹配模式字串。
 * @returns {RegExp} 用於路徑比對的正則表達式對象。
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * 判定指定的檔案路徑是否符合任何排除規則。
 * 
 * @description
 * 將路徑與排除 Glob 規則轉換為正則表達式，逐一比對測試是否需要忽略插樁。
 * 
 * @param {string} filePath - 待檢查的絕對或相對檔案路徑。
 * @param {string[]} excludePatterns - 設定檔中定義的排除規則清單。
 * @returns {boolean} 若路徑符合排除規則則回傳 `true`，否則回傳 `false`。
 */
function isExcluded(filePath: string, excludePatterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return excludePatterns.some(pattern => {
    const cleanPattern = pattern.replace(/\\/g, '/');
    const regex = globToRegex(cleanPattern);
    return regex.test(normalizedPath);
  });
}

/**
 * Babel 轉譯器插樁插件的預設導出函數。
 * 
 * @description
 * 提供程式碼的 AST 遍歷訪問器，在函數與變數聲明處注入 Proxy 的偵測與包裝邏輯。
 * 
 * @param {any} babel - Babel 插件 API 對象。
 * @returns {object} Babel 插件 visitor 定義對象。
 */
export default function (babel: any) {
  const { types: t } = babel;

  /**
   * 取得 AST 節點所代表的函數或方法的識別名稱。
   * 
   * @description
   * 向上查找 class 宣告或變數定義，推導出如 `ClassName.methodName` 或一般變數函數名。
   * 
   * @param {any} pathNode - Babel AST 節點的路徑對象。
   * @returns {string} 函數或方法的識別字串，若無法識別則返回 'anonymous'。
   */
  function getFunctionName(pathNode: any): string {
    if (pathNode.isClassMethod()) {
      const classDecl = pathNode.findParent((p: any) => p.isClassDeclaration());
      const className = classDecl && classDecl.node.id ? classDecl.node.id.name : 'UnknownClass';
      if (t.isIdentifier(pathNode.node.key)) {
        return `${className}.${pathNode.node.key.name}`;
      }
      return `${className}.computed_method`;
    }

    const parentProp = pathNode.findParent((p: any) => p.isClassProperty?.() || p.isClassPrivateProperty?.() || p.node.type === 'ClassProperty' || p.node.type === 'ClassPrivateProperty' || p.node.type === 'PropertyDefinition');
    if (parentProp && t.isIdentifier(parentProp.node.key)) {
      const classDecl = parentProp.findParent((p: any) => p.isClassDeclaration());
      const className = classDecl && classDecl.node.id ? classDecl.node.id.name : 'UnknownClass';
      return `${className}.${parentProp.node.key.name}`;
    }

    if (pathNode.node.id) {
      return pathNode.node.id.name;
    }

    if (pathNode.isObjectMethod()) {
      if (t.isIdentifier(pathNode.node.key)) {
        const propName = pathNode.node.key.name;
        const parentDecl = pathNode.findParent((p: any) => p.isVariableDeclarator());
        if (parentDecl && t.isIdentifier(parentDecl.node.id)) {
          return `${parentDecl.node.id.name}.${propName}`;
        }
        const parentAssign = pathNode.findParent((p: any) => p.isAssignmentExpression());
        if (parentAssign && t.isIdentifier(parentAssign.node.left)) {
          return `${parentAssign.node.left.name}.${propName}`;
        }
        return propName;
      }
      return 'computed_method';
    }

    const objectProp = pathNode.findParent((p: any) => p.isObjectProperty());
    if (objectProp && t.isIdentifier(objectProp.node.key)) {
      const firstFunc = pathNode.findParent((p: any) => p.isFunction() && p !== pathNode);
      const propFunc = objectProp.findParent((p: any) => p.isFunction());
      if (firstFunc === propFunc) {
        const propName = objectProp.node.key.name;
        const parentDecl = objectProp.findParent((p: any) => p.isVariableDeclarator());
        if (parentDecl && t.isIdentifier(parentDecl.node.id)) {
          return `${parentDecl.node.id.name}.${propName}`;
        }
        const parentAssign = objectProp.findParent((p: any) => p.isAssignmentExpression());
        if (parentAssign && t.isIdentifier(parentAssign.node.left)) {
          return `${parentAssign.node.left.name}.${propName}`;
        }
      }
    }

    const parentDecl = pathNode.findParent((p: any) => p.isVariableDeclarator());
    if (parentDecl && t.isIdentifier(parentDecl.node.id)) {
      return parentDecl.node.id.name;
    }

    const parentAssign = pathNode.findParent((p: any) => p.isAssignmentExpression());
    if (parentAssign && t.isIdentifier(parentAssign.node.left)) {
      return parentAssign.node.left.name;
    }
    
    if (parentAssign && t.isMemberExpression(parentAssign.node.left)) {
      const property = parentAssign.node.left.property;
      if (t.isIdentifier(property)) {
        return property.name;
      }
    }

    return 'anonymous';
  }

  /**
   * 取得相對於專案執行目錄的統一斜線格式相對檔案路徑。
   * 
   * @description
   * 解析 Babel 處理中的檔案名稱，計算其相對路徑並統一將反斜線 `\` 轉換為斜線 `/`。
   * 
   * @param {any} state - Babel 插件的執行期狀態。
   * @returns {string} 格式化後的相對路徑。
   */
  function getRelativeFilePath(state: any): string {
    const filename = state.file.opts.filename || 'unknown.js';
    return path.relative(process.cwd(), filename).replace(/\\/g, '/');
  }

  return {
    visitor: {
      Program: {
        enter(programPath: any, state: any) {
          if (state.file.metadata.js2ts_instrumented) return;
          state.file.metadata.js2ts_instrumented = true;
          state.filePath = getRelativeFilePath(state);
        }
      },

      Function(funcPath: any, state: any) {
        if (funcPath.node.generator) return;

        const filePath = state.filePath;
        const funcName = getFunctionName(funcPath);
        
        const paramStatements: any[] = [];
        funcPath.node.params.forEach((param: any, idx: number) => {
          let paramName = `param_${idx}`;
          if (t.isIdentifier(param)) {
            paramName = param.name;
            const trackerId = `${filePath}::${funcName}::param::${paramName}`;
            
            const stmt = t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.identifier(paramName),
                t.callExpression(
                  t.memberExpression(
                    t.identifier('globalThis'),
                    t.identifier('__typeTracker')
                  ),
                  [t.stringLiteral(trackerId), t.identifier(paramName)]
                )
              )
            );
            paramStatements.push(stmt);
          } else if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
            paramName = param.left.name;
            const trackerId = `${filePath}::${funcName}::param::${paramName}`;
            const stmt = t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.identifier(paramName),
                t.callExpression(
                  t.memberExpression(
                    t.identifier('globalThis'),
                    t.identifier('__typeTracker')
                  ),
                  [t.stringLiteral(trackerId), t.identifier(paramName)]
                )
              )
            );
            paramStatements.push(stmt);
          }
        });

        if (funcPath.node.body.type !== 'BlockStatement') {
          const expr = funcPath.node.body;
          funcPath.node.body = t.blockStatement([
            t.returnStatement(expr)
          ]);
        }

        funcPath.traverse({
          ReturnStatement(returnPath: any) {
            if (returnPath.findParent((p: any) => p.isFunction()) !== funcPath) {
              return;
            }

            const argument = returnPath.node.argument;
            const trackerId = `${filePath}::${funcName}::return`;

            if (argument) {
              returnPath.replaceWith(
                t.returnStatement(
                  t.callExpression(
                    t.memberExpression(
                      t.identifier('globalThis'),
                      t.identifier('__typeTracker')
                    ),
                    [t.stringLiteral(trackerId), argument]
                  )
                )
              );
              returnPath.skip();
            } else {
              returnPath.replaceWith(
                t.returnStatement(
                  t.callExpression(
                    t.memberExpression(
                      t.identifier('globalThis'),
                      t.identifier('__typeTracker')
                    ),
                    [t.stringLiteral(trackerId), t.identifier('undefined')]
                  )
                )
              );
              returnPath.skip();
            }
          }
        }, state);

        const projectConfig = loadConfig();
        const excludeCallGraph = projectConfig.excludeCallGraph || [];
        const skipCallGraph = isExcluded(filePath, excludeCallGraph);

        if (!skipCallGraph) {
          const funcId = `${filePath}::${funcName}`;

          const enterStatement = t.expressionStatement(
            t.callExpression(
              t.memberExpression(
                t.memberExpression(t.identifier('globalThis'), t.identifier('__typeTracker')),
                t.identifier('enter')
              ),
              [t.stringLiteral(funcId)]
            )
          );

          const exitStatement = t.expressionStatement(
            t.callExpression(
              t.memberExpression(
                t.memberExpression(t.identifier('globalThis'), t.identifier('__typeTracker')),
                t.identifier('exit')
              ),
              [t.stringLiteral(funcId)]
            )
          );

          const tryBody = [
            ...paramStatements,
            ...funcPath.node.body.body
          ];

          const tryStmt = t.tryStatement(
            t.blockStatement(tryBody),
            null,
            t.blockStatement([exitStatement])
          );

          funcPath.node.body.body = [
            enterStatement,
            tryStmt
          ];
        } else {
          if (paramStatements.length > 0) {
            funcPath.get('body').unshiftContainer('body', paramStatements);
          }
        }
      },

      VariableDeclarator(declPath: any, state: any) {
        const id = declPath.node.id;
        const init = declPath.node.init;
        
        if (!init || !t.isIdentifier(id)) return;
        
        if (t.isCallExpression(init) && t.isIdentifier(init.callee) && init.callee.name === 'require') {
          return;
        }

        const parentFunc = declPath.findParent((p: any) => p.isFunction());
        const funcName = parentFunc ? getFunctionName(parentFunc) : 'global';
        const filePath = state.filePath;
        const varName = id.name;
        const trackerId = `${filePath}::${funcName}::var::${varName}`;

        declPath.get('init').replaceWith(
          t.callExpression(
            t.memberExpression(
              t.identifier('globalThis'),
              t.identifier('__typeTracker')
            ),
            [t.stringLiteral(trackerId), init]
          )
        );
      },

      AssignmentExpression(assignPath: any, state: any) {
        const left = assignPath.node.left;
        const right = assignPath.node.right;
        
        if (assignPath.node.operator !== '=') return;
        
        // 偵測 this.xxx = yyy
        if (
          t.isMemberExpression(left) &&
          t.isThisExpression(left.object) &&
          t.isIdentifier(left.property)
        ) {
          const propName = left.property.name;
          const classDecl = assignPath.findParent((p: any) => p.isClassDeclaration());
          const className = classDecl && classDecl.node.id ? classDecl.node.id.name : 'UnknownClass';
          const filePath = state.filePath;
          const trackerId = `${filePath}::${className}::prop::${propName}`;
          
          assignPath.get('right').replaceWith(
            t.callExpression(
              t.memberExpression(
                t.identifier('globalThis'),
                t.identifier('__typeTracker')
              ),
              [t.stringLiteral(trackerId), right]
            )
          );
        }
      }
    }
  };
}
