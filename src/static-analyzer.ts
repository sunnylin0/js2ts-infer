import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { globSync } from 'glob';

function getTypeOfNode(node: any): string {
  if (!node) return 'unknown';
  if (node.type === 'FunctionDeclaration' || 
      node.type === 'FunctionExpression' || 
      node.type === 'ArrowFunctionExpression') {
    return 'function';
  }
  if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
    return 'class';
  }
  return 'unknown';
}

function getFunctionName(pathNode: any): string {
  const node = pathNode.node;
  if (node.id && node.id.name) {
    return node.id.name;
  }
  if (pathNode.isClassMethod() || pathNode.isObjectMethod()) {
    if (node.key && node.key.type === 'Identifier') {
      return node.key.name;
    }
    return 'computed_method';
  }
  const parentDecl = pathNode.findParent((p: any) => p.isVariableDeclarator());
  if (parentDecl && parentDecl.node.id && parentDecl.node.id.type === 'Identifier') {
    return parentDecl.node.id.name;
  }
  const parentAssign = pathNode.findParent((p: any) => p.isAssignmentExpression());
  if (parentAssign && parentAssign.node.left && parentAssign.node.left.type === 'Identifier') {
    return parentAssign.node.left.name;
  }
  if (parentAssign && parentAssign.node.left && parentAssign.node.left.type === 'MemberExpression') {
    const property = parentAssign.node.left.property;
    if (property && property.type === 'Identifier') {
      return property.name;
    }
  }
  return 'anonymous';
}

function getParentFunctionName(astPath: any): string {
  const parentFunc = astPath.findParent((p: any) => p.isFunction());
  if (!parentFunc) return 'global';
  return getFunctionName(parentFunc);
}

function resolveImportPath(currentFile: string, importSource: string, projectFiles: string[]): string | null {
  if (!importSource.startsWith('.')) {
    return null;
  }
  const absoluteImport = path.resolve(path.dirname(currentFile), importSource);
  const possiblePaths = [
    absoluteImport,
    absoluteImport + '.js',
    absoluteImport + '.ts',
    absoluteImport + '.jsx',
    absoluteImport + '.tsx',
    path.join(absoluteImport, 'index.js'),
    path.join(absoluteImport, 'index.ts')
  ];

  for (const p of possiblePaths) {
    const normalized = p.replace(/\\/g, '/').toLowerCase();
    const found = projectFiles.find(pf => pf.replace(/\\/g, '/').toLowerCase() === normalized);
    if (found) {
      return path.relative(process.cwd(), found).replace(/\\/g, '/');
    }
  }
  return null;
}

export function analyzeProject(config: any) {
  const includePatterns = config.include || [];
  const excludePatterns = config.exclude || [];
  
  const files = globSync(includePatterns, {
    ignore: excludePatterns,
    nodir: true,
    absolute: true
  });

  const classes: Record<string, string> = {};
  const boundaries: any[] = [];
  const staticCallGraph = {
    files: [] as { from: string, to: string }[],
    functions: [] as { from: string, to: string }[],
    classes: [] as { from: string, to: string }[]
  };

  const parsedFiles: { relativePath: string; absolutePath: string; ast: any }[] = [];

  // 第一階段：讀取並解析所有檔案的 AST，建立 Class 名冊與邊界
  for (const absolutePath of files) {
    const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    let code: string;
    try {
      code = fs.readFileSync(absolutePath, 'utf-8');
    } catch (e: any) {
      console.warn(`無法讀取檔案: ${absolutePath}, error: ${e.message}`);
      continue;
    }

    let ast: any;
    try {
      ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: [
          'jsx',
          'classProperties',
          'objectRestSpread',
          'dynamicImport',
          'optionalChaining',
          'nullishCoalescingOperator'
        ]
      });
    } catch (err: any) {
      console.warn(`AST 解析失敗: ${relativePath}, error: ${err.message}`);
      continue;
    }

    parsedFiles.push({ relativePath, absolutePath, ast });

    // @ts-ignore
    const traverseFn = typeof traverse === 'function' ? traverse : (traverse as any).default;

    traverseFn(ast, {
      ClassDeclaration(astPath: any) {
        if (astPath.node.id) {
          classes[astPath.node.id.name] = relativePath;
        }
      },
      
      ExportNamedDeclaration(astPath: any) {
        if (astPath.node.declaration) {
          const dec = astPath.node.declaration;
          if (dec.type === 'FunctionDeclaration' && dec.id) {
            boundaries.push({
              filePath: relativePath,
              exportName: dec.id.name,
              type: 'function'
            });
          } else if (dec.type === 'ClassDeclaration' && dec.id) {
            boundaries.push({
              filePath: relativePath,
              exportName: dec.id.name,
              type: 'class'
            });
          } else if (dec.type === 'VariableDeclaration') {
            dec.declarations.forEach((d: any) => {
              if (d.id && d.id.type === 'Identifier') {
                boundaries.push({
                  filePath: relativePath,
                  exportName: d.id.name,
                  type: getTypeOfNode(d.init)
                });
              }
            });
          }
        }
        if (astPath.node.specifiers) {
          astPath.node.specifiers.forEach((spec: any) => {
            if (spec.exported && spec.exported.type === 'Identifier') {
              boundaries.push({
                filePath: relativePath,
                exportName: spec.exported.name,
                type: 'unknown'
              });
            }
          });
        }
      },

      ExportDefaultDeclaration(astPath: any) {
        const dec = astPath.node.declaration;
        let exportName = 'default';
        let type = 'unknown';

        if (dec.type === 'FunctionDeclaration') {
          exportName = dec.id ? dec.id.name : 'default';
          type = 'function';
        } else if (dec.type === 'ClassDeclaration') {
          exportName = dec.id ? dec.id.name : 'default';
          type = 'class';
        } else if (dec.type === 'Identifier') {
          exportName = dec.name;
        } else {
          type = getTypeOfNode(dec);
        }

        boundaries.push({
          filePath: relativePath,
          exportName: exportName,
          type: type,
          isDefault: true
        });
      },

      AssignmentExpression(astPath: any) {
        const { left, right } = astPath.node;
        
        if (left.type === 'MemberExpression' &&
            left.object.type === 'Identifier' && left.object.name === 'module' &&
            left.property.type === 'Identifier' && left.property.name === 'exports') {
          
          if (right.type === 'ObjectExpression') {
            right.properties.forEach((prop: any) => {
              if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                boundaries.push({
                  filePath: relativePath,
                  exportName: prop.key.name,
                  type: getTypeOfNode(prop.value)
                });
              }
            });
          } else {
            const exportName = right.type === 'Identifier' ? right.name : 'default';
            boundaries.push({
              filePath: relativePath,
              exportName: exportName,
              type: getTypeOfNode(right),
              isDefault: true
            });
          }
        }
        
        else if (left.type === 'MemberExpression' &&
                 left.object.type === 'Identifier' && left.object.name === 'exports' &&
                 left.property.type === 'Identifier') {
          boundaries.push({
            filePath: relativePath,
            exportName: left.property.name,
            type: getTypeOfNode(right)
          });
        }
        
        else if (left.type === 'MemberExpression' &&
                 left.object.type === 'MemberExpression' &&
                 left.object.object.type === 'Identifier' && left.object.object.name === 'module' &&
                 left.object.property.type === 'Identifier' && left.object.property.name === 'exports' &&
                 left.property.type === 'Identifier') {
          boundaries.push({
            filePath: relativePath,
            exportName: left.property.name,
            type: getTypeOfNode(right)
          });
        }
      }
    });
  }

  // 第二階段：再度掃描各 AST，分析依賴關係（此時已具備完整的 Class 名冊）
  for (const { relativePath, absolutePath, ast } of parsedFiles) {
    const fileImports: Record<string, { sourceFile: string, exportName: string }> = {};
    const fileLocalFunctions = new Set<string>();

    // @ts-ignore
    const traverseFn = typeof traverse === 'function' ? traverse : (traverse as any).default;

    traverseFn(ast, {
      ImportDeclaration(astPath: any) {
        const sourceVal = astPath.node.source.value;
        const resolved = resolveImportPath(absolutePath, sourceVal, files);
        if (resolved) {
          staticCallGraph.files.push({ from: relativePath, to: resolved });
          astPath.node.specifiers.forEach((spec: any) => {
            if (spec.type === 'ImportSpecifier') {
              fileImports[spec.local.name] = { sourceFile: resolved, exportName: spec.imported.name };
            } else if (spec.type === 'ImportDefaultSpecifier') {
              fileImports[spec.local.name] = { sourceFile: resolved, exportName: 'default' };
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              fileImports[spec.local.name] = { sourceFile: resolved, exportName: '*' };
            }
          });
        }
      },

      VariableDeclarator(astPath: any) {
        const id = astPath.node.id;
        const init = astPath.node.init;

        if (init && init.type === 'CallExpression' && init.callee.type === 'Identifier' && init.callee.name === 'require') {
          if (init.arguments.length > 0 && init.arguments[0].type === 'StringLiteral') {
            const sourceVal = init.arguments[0].value;
            const resolved = resolveImportPath(absolutePath, sourceVal, files);
            if (resolved) {
              staticCallGraph.files.push({ from: relativePath, to: resolved });
              if (id.type === 'Identifier') {
                fileImports[id.name] = { sourceFile: resolved, exportName: '*' };
              } else if (id.type === 'ObjectPattern') {
                id.properties.forEach((prop: any) => {
                  if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && prop.value.type === 'Identifier') {
                    fileImports[prop.value.name] = { sourceFile: resolved, exportName: prop.key.name };
                  }
                });
              }
            }
          }
        }

        if (id.type === 'Identifier' && init && (init.type === 'FunctionExpression' || init.type === 'ArrowFunctionExpression')) {
          fileLocalFunctions.add(id.name);
        }
      },

      FunctionDeclaration(astPath: any) {
        if (astPath.node.id) {
          fileLocalFunctions.add(astPath.node.id.name);
        }
      },

      ClassDeclaration(astPath: any) {
        if (astPath.node.id) {
          fileLocalFunctions.add(astPath.node.id.name);
        }
        
        astPath.node.body.body.forEach((member: any) => {
          if (member.type === 'ClassMethod' && member.key && member.key.type === 'Identifier') {
            fileLocalFunctions.add(member.key.name);
          }
        });
      }
    });

    // 收集 CallExpression 關係 (檔案與函數層級)
    traverseFn(ast, {
      CallExpression(astPath: any) {
        const callee = astPath.node.callee;
        const parentFuncName = getParentFunctionName(astPath);
        const callerId = `${relativePath}::${parentFuncName}`;

        if (callee.type === 'Identifier') {
          const name = callee.name;
          if (fileImports[name]) {
            const imp = fileImports[name];
            if (imp.exportName !== '*') {
              staticCallGraph.functions.push({
                from: callerId,
                to: `${imp.sourceFile}::${imp.exportName}`
              });
            }
          } else if (fileLocalFunctions.has(name)) {
            staticCallGraph.functions.push({
              from: callerId,
              to: `${relativePath}::${name}`
            });
          }
        }

        else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
          const propName = callee.property.name;
          
          if (callee.object.type === 'ThisExpression') {
            if (fileLocalFunctions.has(propName)) {
              staticCallGraph.functions.push({
                from: callerId,
                to: `${relativePath}::${propName}`
              });
            }
          } else if (callee.object.type === 'Identifier') {
            const objName = callee.object.name;
            if (fileImports[objName]) {
              const imp = fileImports[objName];
              if (imp.exportName === '*') {
                staticCallGraph.functions.push({
                  from: callerId,
                  to: `${imp.sourceFile}::${propName}`
                });
              }
            }
          }
        }
      }
    });

    // 收集 Class-to-Class 靜態依賴關係
    traverseFn(ast, {
      ClassDeclaration(classPath: any) {
        const className = classPath.node.id ? classPath.node.id.name : null;
        if (!className) return;
        const classId = `${relativePath}::${className}`;

        classPath.traverse({
          NewExpression(subPath: any) {
            if (subPath.node.callee.type === 'Identifier') {
              const targetName = subPath.node.callee.name;
              if (classes[targetName]) {
                const targetId = `${classes[targetName]}::${targetName}`;
                if (targetId !== classId) {
                  staticCallGraph.classes.push({ from: classId, to: targetId });
                }
              }
            }
          },
          CallExpression(subPath: any) {
            const callee = subPath.node.callee;
            if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
              const targetName = callee.object.name;
              if (classes[targetName]) {
                const targetId = `${classes[targetName]}::${targetName}`;
                if (targetId !== classId) {
                  staticCallGraph.classes.push({ from: classId, to: targetId });
                }
              }
            }
          }
        });
      }
    });
  }

  // 去重處理
  const uniqueBoundaries: any[] = [];
  const visitedBoundaries = new Set<string>();
  for (const b of boundaries) {
    const key = `${b.filePath}::${b.exportName}`;
    if (!visitedBoundaries.has(key)) {
      visitedBoundaries.add(key);
      uniqueBoundaries.push(b);
    }
  }

  const uniqueStaticFiles: { from: string, to: string }[] = [];
  const visitedFiles = new Set<string>();
  for (const f of staticCallGraph.files) {
    const key = `${f.from}->${f.to}`;
    if (!visitedFiles.has(key)) {
      visitedFiles.add(key);
      uniqueStaticFiles.push(f);
    }
  }

  const uniqueStaticFuncs: { from: string, to: string }[] = [];
  const visitedFuncs = new Set<string>();
  for (const f of staticCallGraph.functions) {
    const key = `${f.from}->${f.to}`;
    if (!visitedFuncs.has(key)) {
      visitedFuncs.add(key);
      uniqueStaticFuncs.push(f);
    }
  }

  const uniqueStaticClasses: { from: string, to: string }[] = [];
  const visitedClasses = new Set<string>();
  for (const c of staticCallGraph.classes) {
    const key = `${c.from}->${c.to}`;
    if (!visitedClasses.has(key)) {
      visitedClasses.add(key);
      uniqueStaticClasses.push(c);
    }
  }

  return {
    classes,
    boundaries: uniqueBoundaries,
    staticCallGraph: {
      files: uniqueStaticFiles,
      functions: uniqueStaticFuncs,
      classes: uniqueStaticClasses
    }
  };
}
