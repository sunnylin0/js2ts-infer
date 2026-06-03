const path = require('path');

module.exports = function (babel) {
  const { types: t } = babel;

  // 輔助函式：取得函式名稱
  function getFunctionName(pathNode) {
    if (pathNode.node.id) {
      return pathNode.node.id.name;
    }
    
    // 檢查是否為 Class 方法
    if (pathNode.isClassMethod()) {
      if (t.isIdentifier(pathNode.node.key)) {
        return pathNode.node.key.name;
      }
      return 'computed_method';
    }

    // 檢查是否為物件屬性方法
    if (pathNode.isObjectMethod()) {
      if (t.isIdentifier(pathNode.node.key)) {
        return pathNode.node.key.name;
      }
      return 'computed_method';
    }

    // 檢查是否被賦值給變數
    const parentDecl = pathNode.findParent(p => p.isVariableDeclarator());
    if (parentDecl && t.isIdentifier(parentDecl.node.id)) {
      return parentDecl.node.id.name;
    }

    const parentAssign = pathNode.findParent(p => p.isAssignmentExpression());
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

  // 獲取相對於工作目錄的相對路徑
  function getRelativeFilePath(state) {
    const filename = state.file.opts.filename || 'unknown.js';
    return path.relative(process.cwd(), filename).replace(/\\/g, '/');
  }

  return {
    visitor: {
      Program: {
        enter(programPath, state) {
          // 標記已經插樁過，避免二次插樁
          if (state.file.metadata.js2ts_instrumented) return;
          state.file.metadata.js2ts_instrumented = true;
          
          state.filePath = getRelativeFilePath(state);
        }
      },

      Function(funcPath, state) {
        // 跳過 Generator 函數或 AsyncGenerator 函數的內部插樁以簡化
        if (funcPath.node.generator) return;

        const filePath = state.filePath;
        const funcName = getFunctionName(funcPath);
        
        // 1. 在函式入口：插樁參數
        const paramStatements = [];
        funcPath.node.params.forEach((param, idx) => {
          let paramName = `param_${idx}`;
          if (t.isIdentifier(param)) {
            paramName = param.name;
            // 產生：param = globalThis.__typeTracker("file::func::param::name", param);
            const trackerId = `${filePath}::${funcName}::param::${paramName}`;
            
            // 使用 AssignmentExpression 重新賦值（支援 Callback 自動包裹）
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

        // 確保函數 body 是 BlockStatement
        if (funcPath.node.body.type !== 'BlockStatement') {
          // 例如箭頭函數 () => expr，改寫為 () => { return expr; }
          const expr = funcPath.node.body;
          funcPath.node.body = t.blockStatement([
            t.returnStatement(expr)
          ]);
        }

        // 將參數側錄插入到 body 開頭
        if (paramStatements.length > 0) {
          funcPath.get('body').unshiftContainer('body', paramStatements);
        }

        // 2. 在函式出口：插樁回傳值
        // 我們需要在函數的 ReturnStatement 進行攔截
        funcPath.traverse({
          ReturnStatement(returnPath) {
            // 避免干擾巢狀函數的 return
            if (returnPath.findParent(p => p.isFunction()) !== funcPath) {
              return;
            }

            const argument = returnPath.node.argument;
            const trackerId = `${filePath}::${funcName}::return`;

            if (argument) {
              // 改寫：return globalThis.__typeTracker("file::func::return", argument);
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
              // 改寫：return globalThis.__typeTracker("file::func::return", undefined);
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
      },

      // 變數賦值與宣告插樁
      VariableDeclarator(declPath, state) {
        const id = declPath.node.id;
        const init = declPath.node.init;
        
        // 排除無初始值的宣告，以及 require/import 等語法，和非 Identifier 的解構宣告
        if (!init || !t.isIdentifier(id)) return;
        
        // 排除 require 呼叫，不需側錄 import 引用本身
        if (t.isCallExpression(init) && t.isIdentifier(init.callee) && init.callee.name === 'require') {
          return;
        }

        // 找到父級函數名稱以建立 scope 路徑
        const parentFunc = declPath.findParent(p => p.isFunction());
        const funcName = parentFunc ? getFunctionName(parentFunc) : 'global';
        const filePath = state.filePath;
        const varName = id.name;
        const trackerId = `${filePath}::${funcName}::var::${varName}`;

        // 改寫 init：globalThis.__typeTracker("...", init)
        declPath.get('init').replaceWith(
          t.callExpression(
            t.memberExpression(
              t.identifier('globalThis'),
              t.identifier('__typeTracker')
            ),
            [t.stringLiteral(trackerId), init]
          )
        );
        declPath.skip();
      }
    }
  };
};
