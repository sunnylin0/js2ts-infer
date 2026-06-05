const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project();
const dtsPath = 'c:/Users/ESAO_NB27/Desktop/abc_js2ts/4_abc662/type/index.d.ts';
project.addSourceFileAtPath(dtsPath);

console.log('Source files loaded:', project.getSourceFiles().map(f => f.getFilePath()));

function findMatchingInterface(project, shape) {
  const shapeKeys = Object.keys(shape).filter(k => k !== '__nullable');
  console.log('Shape keys to match:', shapeKeys);
  if (shapeKeys.length === 0) return null;

  for (const sourceFile of project.getSourceFiles()) {
    const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
    console.log('Total interfaces in file:', sourceFile.getBaseName(), interfaces.length);
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

      if (ifaceName === 'Meter' || ifaceName === 'Tune') {
        console.log(`Checking ${ifaceName}: matched ${matchCount}/${shapeKeys.length}, props in iface:`, Array.from(ifacePropNames));
      }

      if (matchCount === shapeKeys.length && shapeKeys.length >= 2) {
        return ifaceName;
      }
    }
  }
  return null;
}

// 測試 getMeter 側錄到的 shape: { type: 'string', value: 'Array' }
const shape = {
  type: "string",
  value: "Array<{ [key: string]: any }>"
};

const result = findMatchingInterface(project, shape);
console.log('Match Result:', result);
