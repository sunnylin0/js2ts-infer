(function() {
  // __CONFIG_INJECTION_PLACEHOLDER__

  const port = (globalThis as any).__trackerPort || 9002;
  const config = (globalThis as any).__trackerConfig || { maxDepth: 5 };
  const maxDepth = config.maxDepth || 5;

  const clientDB: Record<string, any> = {};
  let sendTimeout: any = null;

  const callStack: string[] = [];
  const callGraph: Record<string, Record<string, number>> = {};

  function getBaseUrl() {
    return `http://localhost:${port}`;
  }

  function flushTypes() {
    if (Object.keys(clientDB).length === 0) return;

    const payload: Record<string, any> = {};
    for (const [id, data] of Object.entries(clientDB)) {
      if (id === '__callGraph') {
        payload[id] = {
          graph: data.graph
        };
      } else {
        payload[id] = {
          observedTypes: Array.from(data.observedTypes),
          objectShapes: data.objectShapes,
          callCount: data.callCount
        };
      }
      delete clientDB[id];
    }

    const url = `${getBaseUrl()}/types`;

    if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } else {
      try {
        const http = require('http');
        const dataStr = JSON.stringify(payload);
        const req = http.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dataStr)
          }
        });
        req.on('error', () => {});
        req.write(dataStr);
        req.end();
      } catch (e) {}
    }
  }

  function queueFlush() {
    if (sendTimeout) return;
    sendTimeout = setTimeout(() => {
      sendTimeout = null;
      flushTypes();
    }, 1000);
  }

  function flushTypesSync() {
    if (Object.keys(clientDB).length === 0) return;

    const payload: Record<string, any> = {};
    for (const [id, data] of Object.entries(clientDB)) {
      if (id === '__callGraph') {
        payload[id] = {
          graph: data.graph
        };
      } else {
        payload[id] = {
          observedTypes: Array.from(data.observedTypes),
          objectShapes: data.objectShapes,
          callCount: data.callCount
        };
      }
    }

    const url = `${getBaseUrl()}/types`;
    const dataStr = JSON.stringify(payload);

    if ((globalThis as any).navigator && (globalThis as any).navigator.sendBeacon) {
      const blob = new Blob([dataStr], { type: 'application/json' });
      (globalThis as any).navigator.sendBeacon(url, blob);
    } else if ((globalThis as any).XMLHttpRequest) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(dataStr);
      } catch (e) {}
    } else {
      try {
        const { execSync } = require('child_process');
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempFile = path.join(os.tmpdir(), `js2ts_pending_${Date.now()}.json`);
        fs.writeFileSync(tempFile, dataStr, 'utf-8');
        
        try {
          execSync(`curl -X POST -H "Content-Type: application/json" -d "@${tempFile.replace(/\\/g, '/')}" ${url}`, { stdio: 'ignore' });
        } catch (err) {}
        try { fs.unlinkSync(tempFile); } catch (e) {}
      } catch (e) {}
    }
  }

  if ((globalThis as any).addEventListener) {
    (globalThis as any).addEventListener('beforeunload', flushTypesSync);
    (globalThis as any).addEventListener('pagehide', flushTypesSync);
  }
  
  if ((globalThis as any).process && typeof (globalThis as any).process.on === 'function') {
    (globalThis as any).process.on('exit', () => {
      flushTypesSync();
    });
  }

  function serializeType(val: any, depth = 0): any {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';

    const basicType = typeof val;
    if (basicType !== 'object' && basicType !== 'function') {
      return basicType;
    }

    if (depth > maxDepth) return 'any';

    if (Array.isArray(val)) {
      if (val.length === 0) return 'Array<any>';
      const elementTypes = new Set<string>();
      val.slice(0, 10).forEach(item => {
        const itemType = serializeType(item, depth + 1);
        if (typeof itemType === 'object') {
          elementTypes.add('{ [key: string]: any }');
        } else {
          elementTypes.add(itemType);
        }
      });
      return `Array<${Array.from(elementTypes).join(' | ')}>`;
    }

    if (val instanceof Promise || (val && typeof val.then === 'function')) {
      return 'Promise<any>';
    }

    if (val.constructor && val.constructor.name !== 'Object' && typeof val.constructor.name === 'string') {
      return val.constructor.name;
    }

    const shape: Record<string, any> = {};
    try {
      const keys = Object.keys(val);
      for (const key of keys) {
        shape[key] = serializeType(val[key], depth + 1);
      }
    } catch (e) {
      return 'any';
    }
    return shape;
  }

  const trackerFn = function (trackerId: string, value: any) {
    if (!clientDB[trackerId]) {
      clientDB[trackerId] = {
        observedTypes: new Set(),
        objectShapes: [],
        callCount: 0
      };
    }

    const record = clientDB[trackerId];
    record.callCount++;

    if (record.callCount > 100 && record.observedTypes.size > 0 && record.callCount % 10 !== 0) {
      if (typeof value === 'function') {
        return wrapFunction(trackerId, value);
      }
      return value;
    }

    if (value instanceof Promise || (value && typeof value.then === 'function')) {
      value.then(
        resolvedVal => {
          (globalThis as any).__typeTracker(`${trackerId}::resolved`, resolvedVal);
          return resolvedVal;
        },
        rejectedErr => {
          (globalThis as any).__typeTracker(`${trackerId}::rejected`, rejectedErr);
          throw rejectedErr;
        }
      );
    }

    if (typeof value === 'function') {
      return wrapFunction(trackerId, value);
    }

    const serialized = serializeType(value);
    if (typeof serialized === 'object') {
      const shapeStr = JSON.stringify(serialized);
      const exists = record.objectShapes.some((s: any) => JSON.stringify(s) === shapeStr);
      if (!exists) {
        record.objectShapes.push(serialized);
      }
    } else {
      record.observedTypes.add(serialized);
    }

    queueFlush();
    return value;
  };

  (trackerFn as any).enter = function (funcId: string) {
    if (callStack.length >= 200) {
      return;
    }
    const caller = callStack[callStack.length - 1];
    if (caller) {
      if (!callGraph[caller]) {
        callGraph[caller] = {};
      }
      callGraph[caller][funcId] = (callGraph[caller][funcId] || 0) + 1;

      if (!clientDB["__callGraph"]) {
        clientDB["__callGraph"] = {
          observedTypes: new Set(),
          objectShapes: [],
          callCount: 0,
          graph: {}
        };
      }
      clientDB["__callGraph"].graph = callGraph;
      queueFlush();
    }
    callStack.push(funcId);
  };

  (trackerFn as any).exit = function (funcId: string) {
    const idx = callStack.lastIndexOf(funcId);
    if (idx !== -1) {
      callStack.splice(idx);
    }
  };

  (globalThis as any).__typeTracker = trackerFn;

  function wrapFunction(trackerId: string, originalFn: any): any {
    if (originalFn.__isWrapped) return originalFn;

    const parentCaller = callStack[callStack.length - 1];

    const wrappedFn = function (this: any, ...args: any[]) {
      const hasParent = !!parentCaller;
      if (hasParent) {
        callStack.push(parentCaller);
      }
      try {
        args.forEach((arg, index) => {
          (globalThis as any).__typeTracker(`${trackerId}::cb_param::${index}`, arg);
        });
        const result = originalFn.apply(this, args);
        (globalThis as any).__typeTracker(`${trackerId}::cb_return`, result);
        return result;
      } finally {
        if (hasParent) {
          const idx = callStack.lastIndexOf(parentCaller);
          if (idx !== -1) {
            callStack.splice(idx);
          }
        }
      }
    };

    Object.defineProperty(wrappedFn, '__isWrapped', { value: true, enumerable: false });
    try {
      Object.assign(wrappedFn, originalFn);
    } catch (e) {}
    
    return wrappedFn;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = (globalThis as any).__typeTracker;
  }
})();
