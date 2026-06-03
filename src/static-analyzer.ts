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

  const uniqueBoundaries: any[] = [];
  const visited = new Set<string>();
  for (const b of boundaries) {
    const key = `${b.filePath}::${b.exportName}`;
    if (!visited.has(key)) {
      visited.add(key);
      uniqueBoundaries.push(b);
    }
  }

  return {
    classes,
    boundaries: uniqueBoundaries
  };
}
