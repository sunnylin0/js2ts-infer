const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFileAtPath('4_abc662/type/index.d.ts');

const originalCode = fs.readFileSync('4_abc662/src/data/abc_tune.js', 'utf-8');
const sourceFile = project.createSourceFile('abc_tune.ts', originalCode, { overwrite: true });

const cls = sourceFile.getClass('Tune');
const getKeySigMethod = cls.getMethod('getKeySignature');

// 標註變數型別
getKeySigMethod.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(decl => {
  if (decl.getName() === 'line') {
    decl.setType('Lines');
  }
});

// 在此檔案中，j 和 i 也被標註了
getKeySigMethod.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(decl => {
  if (decl.getName() === 'i' || decl.getName() === 'j') {
    decl.setType('number');
  }
});

console.log('Final Method ReturnType:', getKeySigMethod.getReturnType().getText());
