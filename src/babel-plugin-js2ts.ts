import * as path from 'path';
import * as fs from 'fs';

let config: any = null;
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

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function isExcluded(filePath: string, excludePatterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return excludePatterns.some(pattern => {
    const cleanPattern = pattern.replace(/\\/g, '/');
    const regex = globToRegex(cleanPattern);
    return regex.test(normalizedPath);
  });
}

export default function (babel: any) {
  const { types: t } = babel;

  function getFunctionName(pathNode: any): string {
    if (pathNode.node.id) {
      return pathNode.node.id.name;
    }
    
    if (pathNode.isClassMethod()) {
      if (t.isIdentifier(pathNode.node.key)) {
        return pathNode.node.key.name;
      }
      return 'computed_method';
    }

    if (pathNode.isObjectMethod()) {
      if (t.isIdentifier(pathNode.node.key)) {
        return pathNode.node.key.name;
      }
      return 'computed_method';
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
        declPath.skip();
      }
    }
  };
}
