(function() {
  // __CONFIG_INJECTION_PLACEHOLDER__

  const port = globalThis.__trackerPort || 9002;
  const config = globalThis.__trackerConfig || { maxDepth: 5 };
  const maxDepth = config.maxDepth || 5;

  const clientDB = {};
  let sendTimeout = null;

  function getBaseUrl() {
    return `http://localhost:${port}`;
  }

  // 將資料非同步 POST 到伺服器
  function flushTypes() {
    if (Object.keys(clientDB).length === 0) return;

    const payload = {};
    for (const [id, data] of Object.entries(clientDB)) {
      payload[id] = {
        observedTypes: Array.from(data.observedTypes),
        objectShapes: data.objectShapes,
        callCount: data.callCount
      };
      // 發送後清空本地緩存的這批增量
      delete clientDB[id];
    }

    const url = `${getBaseUrl()}/types`;

    if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {
        // 忽略連線失敗，避免干擾應用程式運行
      });
    } else {
      // Node.js 環境（若無全域 fetch，則使用 http 模組）
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

  // 排程發送
  function queueFlush() {
    if (sendTimeout) return;
    sendTimeout = setTimeout(() => {
      sendTimeout = null;
      flushTypes();
    }, 1000);
  }

  // 同步發送（用於進程/網頁結束時）
  function flushTypesSync() {
    if (Object.keys(clientDB).length === 0) return;

    const payload = {};
    for (const [id, data] of Object.entries(clientDB)) {
      payload[id] = {
        observedTypes: Array.from(data.observedTypes),
        objectShapes: data.objectShapes,
        callCount: data.callCount
      };
    }

    const url = `${getBaseUrl()}/types`;
    const dataStr = JSON.stringify(payload);

    if (globalThis.navigator && globalThis.navigator.sendBeacon) {
      // 瀏覽器優先使用 sendBeacon
      const blob = new Blob([dataStr], { type: 'application/json' });
      globalThis.navigator.sendBeacon(url, blob);
    } else if (globalThis.XMLHttpRequest) {
      // 瀏覽器同步 XHR
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, false); // 同步
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(dataStr);
      } catch (e) {}
    } else {
      // Node.js 同步發送
      try {
        const http = require('http');
        const { execSync } = require('child_process');
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempFile = path.join(os.tmpdir(), `js2ts_pending_${Date.now()}.json`);
        fs.writeFileSync(tempFile, dataStr, 'utf-8');
        
        // 使用 curl 同步 POST
        try {
          execSync(`curl -X POST -H "Content-Type: application/json" -d "@${tempFile.replace(/\\/g, '/')}" ${url}`, { stdio: 'ignore' });
        } catch (err) {
          // 如果沒有 curl，我們也別崩潰
        }
        try { fs.unlinkSync(tempFile); } catch (e) {}
      } catch (e) {}
    }
  }

  // 註冊生命週期鉤子以確保在結束時發送
  if (globalThis.addEventListener) {
    globalThis.addEventListener('beforeunload', flushTypesSync);
    globalThis.addEventListener('pagehide', flushTypesSync);
  }
  
  // Node.js exit 鉤子
  if (globalThis.process && typeof globalThis.process.on === 'function') {
    globalThis.process.on('exit', () => {
      flushTypesSync();
    });
  }

  function serializeType(val, depth = 0) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';

    const basicType = typeof val;
    if (basicType !== 'object' && basicType !== 'function') {
      return basicType; // string, number, boolean, symbol, bigint
    }

    if (depth > maxDepth) return 'any';

    // 處理 Array
    if (Array.isArray(val)) {
      if (val.length === 0) return 'Array<any>';
      const elementTypes = new Set();
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

    // 處理 Promise
    if (val instanceof Promise || (val && typeof val.then === 'function')) {
      return 'Promise<any>';
    }

    // 處理 Class 實例
    if (val.constructor && val.constructor.name !== 'Object' && typeof val.constructor.name === 'string') {
      return val.constructor.name;
    }

    // 處理 Plain Object
    const shape = {};
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

  globalThis.__typeTracker = function (trackerId, value) {
    if (!clientDB[trackerId]) {
      clientDB[trackerId] = {
        observedTypes: new Set(),
        objectShapes: [],
        callCount: 0
      };
    }

    const record = clientDB[trackerId];
    record.callCount++;

    // 效能優化：同一個點側錄過多時降低採樣頻率
    if (record.callCount > 100 && record.observedTypes.size > 0 && record.callCount % 10 !== 0) {
      // 依然遞迴包裝 function
      if (typeof value === 'function') {
        return wrapFunction(trackerId, value);
      }
      return value;
    }

    // 處理 Promise resolve 的非同步側錄
    if (value instanceof Promise || (value && typeof value.then === 'function')) {
      value.then(
        resolvedVal => {
          globalThis.__typeTracker(`${trackerId}::resolved`, resolvedVal);
          return resolvedVal;
        },
        rejectedErr => {
          globalThis.__typeTracker(`${trackerId}::rejected`, rejectedErr);
          throw rejectedErr;
        }
      );
    }

    // 處理 Callback 包裝
    if (typeof value === 'function') {
      return wrapFunction(trackerId, value);
    }

    const serialized = serializeType(value);
    if (typeof serialized === 'object') {
      const shapeStr = JSON.stringify(serialized);
      const exists = record.objectShapes.some(s => JSON.stringify(s) === shapeStr);
      if (!exists) {
        record.objectShapes.push(serialized);
      }
    } else {
      record.observedTypes.add(serialized);
    }

    queueFlush();
    return value;
  };

  function wrapFunction(trackerId, originalFn) {
    if (originalFn.__isWrapped) return originalFn;

    const wrappedFn = function (...args) {
      // A. 側錄 Callback 被呼叫時傳入的參數型別
      args.forEach((arg, index) => {
        globalThis.__typeTracker(`${trackerId}::cb_param::${index}`, arg);
      });
      
      // B. 執行原本的 Callback
      const result = originalFn.apply(this, args);
      
      // C. 側錄 Callback 執行後的回傳值型別
      globalThis.__typeTracker(`${trackerId}::cb_return`, result);

      return result;
    };

    Object.defineProperty(wrappedFn, '__isWrapped', { value: true, enumerable: false });
    // 複製屬性，如 function 的 name, length 等
    try {
      Object.assign(wrappedFn, originalFn);
    } catch (e) {}
    
    return wrappedFn;
  }

  // 若在 Node.js 中被 require
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalThis.__typeTracker;
  }
})();
