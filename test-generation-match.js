const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');
const { mergeSingleVal } = require('./dist/type-merger');

// 1. 載入 findMatchingInterface 與 resolveParameterType 等邏輯
function findMatchingInterface(project, shape) {
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

function mergeObjectShapesArray(shapes) {
  if (shapes.length === 0) return {};
  if (shapes.length === 1) return shapes[0];
  const combined = {};
  const allKeys = new Set();
  shapes.forEach(s => {
    Object.keys(s).filter(k => k !== '__nullable').forEach(k => allKeys.add(k));
  });
  for (const key of allKeys) {
    let existCount = 0;
    const valTypes = [];
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
  return combined;
}

function resolveParameterType(record, baseName, interfacesToDeclare, project) {
  const observedTypes = record.observedTypes || [];
  const objectShapes = record.objectShapes || [];
  const cleanBasicTypes = observedTypes.filter(t => t !== 'null' && t !== 'undefined');
  let typeNames = [...cleanBasicTypes];

  if (objectShapes.length > 0) {
    const combinedShape = mergeObjectShapesArray(objectShapes);
    console.log(`[resolveParameterType] baseName: ${baseName}, shape keys:`, Object.keys(combinedShape));
    let matchedInterface = null;
    if (project) {
      matchedInterface = findMatchingInterface(project, combinedShape);
      console.log(`[resolveParameterType] matchedInterface for ${baseName}:`, matchedInterface);
    }
    if (matchedInterface) {
      typeNames.push(matchedInterface);
    } else {
      const interfaceName = `${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}Shape`;
      typeNames.push(interfaceName);
    }
  }
  return typeNames.join(' | ');
}

// 2. 模擬執行
const project = new Project();
project.addSourceFileAtPath('4_abc662/type/index.d.ts');

const typeDB = JSON.parse(fs.readFileSync('4_abc662/types-observed.json', 'utf-8'));
const record = typeDB['src/data/abc_tune.js::Tune.getMeter::return'];

console.log('Record found:', JSON.stringify(record, null, 2));

const typeStr = resolveParameterType(record, 'TunegetMeterReturn', {}, project);
console.log('Final resolved typeStr:', typeStr);
