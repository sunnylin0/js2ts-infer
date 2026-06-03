const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { globSync } = require('glob');

// 輔助函式：判斷某個節點在靜態下是否為 function
function getTypeOfNode(node) {
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

function analyzeProject(config) {
  const includePatterns = config.include || [];
  const excludePatterns = config.exclude || [];
  
  // 找出所有符合 include 且排除 exclude 的檔案
  const files = globSync(includePatterns, {
    ignore: excludePatterns,
    nodir: true,
    absolute: true
  });

  const classes = {}; // class name -> file path (相對路徑)
  const boundaries = []; // 邊界 export 清單

  for (const absolutePath of files) {
    const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    let code;
    try {
      code = fs.readFileSync(absolutePath, 'utf-8');
    } catch (e) {
      console.warn(`無法讀取檔案: ${absolutePath}, error: ${e.message}`);
      continue;
    }

    let ast;
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
    } catch (err) {
      console.warn(`AST 解析失敗: ${relativePath}, error: ${err.message}`);
      continue;
    }

    traverse(ast, {
      // 收集 Class 定義
      ClassDeclaration(astPath) {
        if (astPath.node.id) {
          classes[astPath.node.id.name] = relativePath;
        }
      },
      
      // ESM 命名匯出
      ExportNamedDeclaration(astPath) {
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
            dec.declarations.forEach(d => {
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
          astPath.node.specifiers.forEach(spec => {
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

      // ESM 預設匯出
      ExportDefaultDeclaration(astPath) {
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

      // CommonJS 匯出
      AssignmentExpression(astPath) {
        const { left, right } = astPath.node;
        
        // 匹配 module.exports = ...
        if (left.type === 'MemberExpression' &&
            left.object.type === 'Identifier' && left.object.name === 'module' &&
            left.property.type === 'Identifier' && left.property.name === 'exports') {
          
          if (right.type === 'ObjectExpression') {
            // module.exports = { foo, bar }
            right.properties.forEach(prop => {
              if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                boundaries.push({
                  filePath: relativePath,
                  exportName: prop.key.name,
                  type: getTypeOfNode(prop.value)
                });
              }
            });
          } else {
            // module.exports = myFunc
            const exportName = right.type === 'Identifier' ? right.name : 'default';
            boundaries.push({
              filePath: relativePath,
              exportName: exportName,
              type: getTypeOfNode(right),
              isDefault: true
            });
          }
        }
        
        // 匹配 exports.foo = ...
        else if (left.type === 'MemberExpression' &&
                 left.object.type === 'Identifier' && left.object.name === 'exports' &&
                 left.property.type === 'Identifier') {
          boundaries.push({
            filePath: relativePath,
            exportName: left.property.name,
            type: getTypeOfNode(right)
          });
        }
        
        // 匹配 module.exports.foo = ...
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

  // 去除重複的邊界（有些寫法可能會被匹配到多次）
  const uniqueBoundaries = [];
  const visited = new Set();
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

module.exports = {
  analyzeProject
};
