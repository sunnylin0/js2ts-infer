/**
 * MathCal 前端交互主邏輯
 */

import { calculateBMI, calculateArea, calculateVolume } from './modules/calculators.js';
import { convertAll } from './modules/converters.js';

// SVG 線框圖配置表
const SHAPE_SVGS = {
  // 面積形狀
  rectangle: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <rect x="40" y="35" width="120" height="80" rx="4" class="svg-shape-path" />
      <line x1="40" y1="125" x2="160" y2="125" class="svg-helper-line" />
      <text x="100" y="140" class="svg-text">長度 (L)</text>
      <line x1="25" y1="35" x2="25" y2="115" class="svg-helper-line" />
      <text x="12" y="80" class="svg-text" transform="rotate(-90 12 80)">寬度 (W)</text>
    </svg>
  `,
  square: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <rect x="50" y="25" width="100" height="100" rx="4" class="svg-shape-path" />
      <line x1="50" y1="135" x2="150" y2="135" class="svg-helper-line" />
      <text x="100" y="146" class="svg-text">邊長 (a)</text>
    </svg>
  `,
  triangle: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <path d="M 100,25 L 160,115 L 40,115 Z" class="svg-shape-path" />
      <line x1="100" y1="25" x2="100" y2="115" class="svg-helper-line" />
      <text x="112" y="75" class="svg-text">高 (h)</text>
      <line x1="40" y1="125" x2="160" y2="125" class="svg-helper-line" />
      <text x="100" y="140" class="svg-text">底邊 (b)</text>
    </svg>
  `,
  circle: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <circle cx="100" cy="75" r="50" class="svg-shape-path" />
      <line x1="100" y1="75" x2="150" y2="75" class="svg-helper-line" />
      <text x="125" y="68" class="svg-text">半徑 (r)</text>
    </svg>
  `,

  // 體積形狀
  cuboid: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <path d="M 50,60 L 120,60 L 150,30 L 80,30 Z" class="svg-shape-path" style="stroke-dasharray: 2 2; opacity: 0.7;" />
      <path d="M 50,120 L 120,120 L 150,90 L 80,90 Z" class="svg-shape-path" />
      <line x1="50" y1="60" x2="50" y2="120" class="svg-shape-path" />
      <line x1="120" y1="60" x2="120" y2="120" class="svg-shape-path" />
      <line x1="150" y1="30" x2="150" y2="90" class="svg-shape-path" />
      <line x1="80" y1="30" x2="80" y2="90" class="svg-shape-path" style="stroke-dasharray: 2 2; opacity: 0.7;" />
      <text x="85" y="135" class="svg-text">長度 (L)</text>
      <text x="142" y="112" class="svg-text" transform="rotate(-30 142 112)">寬 (W)</text>
      <text x="32" y="90" class="svg-text">高 (H)</text>
    </svg>
  `,
  cube: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <path d="M 60,60 L 120,60 L 150,30 L 90,30 Z" class="svg-shape-path" style="stroke-dasharray: 2 2; opacity: 0.7;" />
      <path d="M 60,120 L 120,120 L 150,90 L 90,90 Z" class="svg-shape-path" />
      <line x1="60" y1="60" x2="60" y2="120" class="svg-shape-path" />
      <line x1="120" y1="60" x2="120" y2="120" class="svg-shape-path" />
      <line x1="150" y1="30" x2="150" y2="90" class="svg-shape-path" />
      <line x1="90" y1="30" x2="90" y2="90" class="svg-shape-path" style="stroke-dasharray: 2 2; opacity: 0.7;" />
      <text x="90" y="135" class="svg-text">邊長 (a)</text>
    </svg>
  `,
  cylinder: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <ellipse cx="100" cy="40" rx="45" ry="15" class="svg-shape-path" />
      <ellipse cx="100" cy="110" rx="45" ry="15" class="svg-shape-path" />
      <line x1="55" y1="40" x2="55" y2="110" class="svg-shape-path" />
      <line x1="145" y1="40" x2="145" y2="110" class="svg-shape-path" />
      <line x1="100" y1="110" x2="145" y2="110" class="svg-helper-line" />
      <text x="122" y="105" class="svg-text">半徑 (r)</text>
      <line x1="40" y1="40" x2="40" y2="110" class="svg-helper-line" />
      <text x="28" y="80" class="svg-text">高 (h)</text>
    </svg>
  `,
  cone: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <ellipse cx="100" cy="115" rx="45" ry="15" class="svg-shape-path" />
      <line x1="55" y1="115" x2="100" y2="30" class="svg-shape-path" />
      <line x1="145" y1="115" x2="100" y2="30" class="svg-shape-path" />
      <line x1="100" y1="30" x2="100" y2="115" class="svg-helper-line" />
      <text x="112" y="70" class="svg-text">高 (h)</text>
      <line x1="100" y1="115" x2="145" y2="115" class="svg-helper-line" />
      <text x="122" y="128" class="svg-text">半徑 (r)</text>
    </svg>
  `,
  sphere: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <circle cx="100" cy="75" r="50" class="svg-shape-path" />
      <ellipse cx="100" cy="75" rx="50" ry="18" class="svg-shape-path" style="stroke-dasharray: 3 3; opacity: 0.6;" />
      <line x1="100" y1="75" x2="150" y2="75" class="svg-helper-line" />
      <text x="125" y="68" class="svg-text">半徑 (r)</text>
    </svg>
  `,
  prism: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <polygon points="80,25 120,25 140,40 120,55 80,55 60,40" class="svg-shape-path" />
      <polygon points="80,95 120,95 140,110 120,125 80,125 60,110" class="svg-shape-path" />
      <line x1="60" y1="40" x2="60" y2="110" class="svg-shape-path" />
      <line x1="140" y1="40" x2="140" y2="110" class="svg-shape-path" />
      <line x1="80" y1="55" x2="80" y2="125" class="svg-shape-path" />
      <line x1="120" y1="55" x2="120" y2="125" class="svg-shape-path" />
      <text x="100" y="44" class="svg-text">底面積 (A)</text>
      <line x1="45" y1="40" x2="45" y2="110" class="svg-helper-line" />
      <text x="32" y="80" class="svg-text">高 (h)</text>
    </svg>
  `,
  pyramid: `
    <svg viewBox="0 0 200 150" class="tech-shape-svg">
      <polygon points="100,125 150,110 80,100" class="svg-shape-path" style="stroke-dasharray: 2 2; opacity: 0.7;" />
      <line x1="100" y1="25" x2="100" y2="110" class="svg-helper-line" />
      <line x1="100" y1="25" x2="100" y2="125" class="svg-shape-path" />
      <line x1="100" y1="25" x2="150" y2="110" class="svg-shape-path" />
      <line x1="100" y1="25" x2="80" y2="100" class="svg-shape-path" />
      <line x1="80" y1="100" x2="100" y2="125" class="svg-shape-path" />
      <line x1="100" y1="125" x2="150" y2="110" class="svg-shape-path" />
      <text x="115" y="118" class="svg-text">底面積 (A)</text>
      <text x="112" y="70" class="svg-text">高 (h)</text>
    </svg>
  `
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化 Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // 2. Accordion 卡片開闔控制
  const cards = document.querySelectorAll('.tool-card');
  cards.forEach(card => {
    const header = card.querySelector('.card-header');
    header.addEventListener('click', (e) => {
      // 避免點擊 header 內部按鈕或連結觸發開闔（此處暫無，防禦性保留）
      if (e.target.closest('button') || e.target.closest('a')) return;
      
      const isExpanded = card.classList.contains('expanded');
      
      // 折疊所有卡片（若需要單開，此處不折疊其他，只 Toggle 自己）
      // 如果要類似 accordion 只能開一個，可以解鎖下段代碼：
      /*
      cards.forEach(c => {
        if (c !== card) c.classList.remove('expanded');
      });
      */
      
      card.classList.toggle('expanded');
    });
  });

  // 3. 頂部 Sticky 導航 Chip 連動
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      // 切換 active class
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const targetId = chip.getAttribute('data-target');
      const targetCard = document.getElementById(targetId);

      if (targetCard) {
        // 確保目標卡片展開
        targetCard.classList.add('expanded');
        
        // 平滑滾動到目標卡片，考慮 sticky header 的高度偏移 (約 90px)
        const headerOffset = 90;
        const cardPosition = targetCard.getBoundingClientRect().top;
        const offsetPosition = cardPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // 監聽滾動，讓頂部 Chip 與當前視窗中的卡片高亮連動 (增強使用者體驗)
  window.addEventListener('scroll', () => {
    const headerOffset = 110;
    let currentCardId = '';

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      // 如果卡片頂部滾動到了 Header 之下，我們就暫定它是當前 active 的卡片
      if (rect.top - headerOffset <= 0) {
        currentCardId = card.id;
      }
    });

    if (currentCardId) {
      chips.forEach(chip => {
        if (chip.getAttribute('data-target') === currentCardId) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
  });

  // 4. 通用防呆錯誤處理輔助函數
  function clearFieldError(input) {
    input.classList.remove('has-error');
    const field = input.closest('.form-field');
    if (field) {
      const errorSpan = field.querySelector('.field-error');
      if (errorSpan) errorSpan.textContent = '';
    }
  }

  function showFieldError(input, msg) {
    input.classList.add('has-error');
    const field = input.closest('.form-field');
    if (field) {
      const errorSpan = field.querySelector('.field-error');
      if (errorSpan) errorSpan.textContent = msg;
    }
  }

  // 5. BMI 計算器邏輯
  const btnCalcBmi = document.getElementById('btn-calc-bmi');
  const hInput = document.getElementById('bmi-height');
  const wInput = document.getElementById('bmi-weight');
  const bmiResultPanel = document.getElementById('bmi-result-panel');
  const bmiValSpan = document.getElementById('bmi-val');
  const bmiBadge = document.getElementById('bmi-badge');
  const bmiPointer = document.getElementById('bmi-pointer');

  // 輸入框打字時清除錯誤標籤
  [hInput, wInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  btnCalcBmi.addEventListener('click', () => {
    const h = parseFloat(hInput.value);
    const w = parseFloat(wInput.value);
    let hasError = false;

    if (isNaN(h) || h <= 0) {
      showFieldError(hInput, '請輸入大於 0 的有效身高');
      hasError = true;
    } else {
      clearFieldError(hInput);
    }

    if (isNaN(w) || w <= 0) {
      showFieldError(wInput, '請輸入大於 0 的有效體重');
      hasError = true;
    } else {
      clearFieldError(wInput);
    }

    if (hasError) {
      bmiResultPanel.classList.add('empty');
      return;
    }

    try {
      const res = calculateBMI(h, w);
      
      // 更新結果面板
      bmiValSpan.textContent = res.bmi;
      bmiBadge.textContent = res.category;
      
      // 重置 Badge 的色彩 Class
      bmiBadge.className = 'bmi-badge';
      bmiBadge.classList.add(res.colorClass);

      // 動態更新指針
      bmiPointer.style.left = `${res.percent}%`;
      
      // 顯示結果
      bmiResultPanel.classList.remove('empty');
    } catch (err) {
      alert(err.message);
    }
  });

  // 6. 面積計算器邏輯
  const areaTabs = document.getElementById('area-tabs');
  const areaVisualBox = document.getElementById('area-visual-box');
  const areaResultPanel = document.getElementById('area-result-panel');
  const btnCalcArea = document.getElementById('btn-calc-area');
  let activeAreaTab = 'rectangle';

  // 面積 Tab 切換
  areaTabs.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.tab-btn');
    if (!tabBtn) return;

    // 高亮按鈕
    areaTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    activeAreaTab = tabBtn.getAttribute('data-tab');

    // 切換輸入欄位
    const fieldsContainer = document.getElementById('area-fields-container');
    fieldsContainer.querySelectorAll('.tab-fields').forEach(f => f.classList.remove('active'));
    
    const targetFields = document.getElementById(`fields-area-${activeAreaTab}`);
    if (targetFields) {
      targetFields.classList.add('active');
      // 清空該欄位內所有 input 的錯誤狀態
      targetFields.querySelectorAll('input').forEach(input => clearFieldError(input));
    }

    // 切換 SVG 線框圖
    if (SHAPE_SVGS[activeAreaTab]) {
      areaVisualBox.innerHTML = SHAPE_SVGS[activeAreaTab];
    }

    // 重置結果區
    areaResultPanel.classList.add('empty');
  });

  // 點擊計算面積
  btnCalcArea.addEventListener('click', () => {
    const container = document.getElementById(`fields-area-${activeAreaTab}`);
    const inputs = container.querySelectorAll('input');
    let hasError = false;
    const params = {};

    inputs.forEach(input => {
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) {
        showFieldError(input, '請輸入大於 0 的有效數值');
        hasError = true;
      } else {
        clearFieldError(input);
        // 將參數對應收集
        if (input.id.includes('rect-len')) params.length = val;
        if (input.id.includes('rect-wid')) params.width = val;
        if (input.id.includes('sq-side')) params.side = val;
        if (input.id.includes('tri-base')) params.base = val;
        if (input.id.includes('tri-height')) params.height = val;
        if (input.id.includes('circ-rad')) params.radius = val;
      }
    });

    if (hasError) {
      areaResultPanel.classList.add('empty');
      return;
    }

    try {
      const res = calculateArea(activeAreaTab, params);
      document.getElementById('area-val').textContent = res.result;
      document.getElementById('area-steps').textContent = res.steps;
      areaResultPanel.classList.remove('empty');
    } catch (err) {
      alert(err.message);
    }
  });

  // 7. 體積計算器邏輯
  const volumeTabs = document.getElementById('volume-tabs');
  const volumeVisualBox = document.getElementById('volume-visual-box');
  const volumeResultPanel = document.getElementById('volume-result-panel');
  const btnCalcVol = document.getElementById('btn-calc-vol');
  let activeVolumeTab = 'cuboid';

  // 體積 Tab 切換
  volumeTabs.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.tab-btn');
    if (!tabBtn) return;

    // 高亮按鈕
    volumeTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    activeVolumeTab = tabBtn.getAttribute('data-tab');

    // 切換輸入欄位
    const fieldsContainer = document.getElementById('volume-fields-container');
    fieldsContainer.querySelectorAll('.tab-fields').forEach(f => f.classList.remove('active'));
    
    const targetFields = document.getElementById(`fields-volume-${activeVolumeTab}`);
    if (targetFields) {
      targetFields.classList.add('active');
      targetFields.querySelectorAll('input').forEach(input => clearFieldError(input));
    }

    // 切換 SVG 線框圖
    if (SHAPE_SVGS[activeVolumeTab]) {
      volumeVisualBox.innerHTML = SHAPE_SVGS[activeVolumeTab];
    }

    // 重置結果區
    volumeResultPanel.classList.add('empty');
  });

  // 點擊計算體積
  btnCalcVol.addEventListener('click', () => {
    const container = document.getElementById(`fields-volume-${activeVolumeTab}`);
    const inputs = container.querySelectorAll('input');
    let hasError = false;
    const params = {};

    inputs.forEach(input => {
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) {
        showFieldError(input, '請輸入大於 0 的有效數值');
        hasError = true;
      } else {
        clearFieldError(input);
        // 將參數對應收集
        if (input.id.includes('cuboid-len')) params.length = val;
        if (input.id.includes('cuboid-wid')) params.width = val;
        if (input.id.includes('cuboid-hei')) params.height = val;
        if (input.id.includes('cube-side')) params.side = val;
        if (input.id.includes('cyl-rad')) params.radius = val;
        if (input.id.includes('cyl-hei')) params.height = val;
        if (input.id.includes('cone-rad')) params.radius = val;
        if (input.id.includes('cone-hei')) params.height = val;
        if (input.id.includes('sph-rad')) params.radius = val;
        if (input.id.includes('prism-base')) params.baseArea = val;
        if (input.id.includes('prism-hei')) params.height = val;
        if (input.id.includes('pyr-base')) params.baseArea = val;
        if (input.id.includes('pyr-hei')) params.height = val;
      }
    });

    if (hasError) {
      volumeResultPanel.classList.add('empty');
      return;
    }

    try {
      const res = calculateVolume(activeVolumeTab, params);
      document.getElementById('volume-val').textContent = res.result;
      document.getElementById('volume-steps').textContent = res.steps;
      volumeResultPanel.classList.remove('empty');
    } catch (err) {
      alert(err.message);
    }
  });

  // 8. 轉換工具 Tables 的統一監聽與聯動邏輯
  const tables = document.querySelectorAll('.converter-table');
  tables.forEach(table => {
    const tableType = table.getAttribute('data-type');
    const inputs = table.querySelectorAll('.conv-input');

    inputs.forEach(input => {
      // 當失去焦點 (Blur) 或按下 Enter 時觸發換算
      input.addEventListener('blur', () => triggerConversion(input, tableType, table));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur(); // blur 會自動調用 triggerConversion
        }
      });

      // 打字時即時清空錯誤標記
      input.addEventListener('input', () => clearFieldError(input));
    });
  });

  /**
   * 觸發單個表格的單位聯動轉換
   */
  function triggerConversion(activeInput, tableType, table) {
    const unit = activeInput.getAttribute('data-unit');
    const valueStr = activeInput.value.trim();

    // 如果輸入為空，清空該表格內所有的輸入框
    if (valueStr === '') {
      table.querySelectorAll('.conv-input').forEach(input => {
        input.value = '';
        clearFieldError(input);
      });
      return;
    }

    const val = parseFloat(valueStr);

    // 溫度允許負數，其餘轉換工具不允許負數或非數字
    if (tableType !== 'temperature' && (isNaN(val) || val < 0)) {
      showFieldError(activeInput, '請輸入大於等於 0 的有效數值');
      return;
    } else {
      clearFieldError(activeInput);
    }

    try {
      const convertedMap = convertAll(tableType, unit, val);
      
      // 將計算結果填入其他單位輸入框，避免覆蓋當前輸入那一格
      Object.keys(convertedMap).forEach(targetUnit => {
        if (targetUnit !== unit) {
          const targetInput = table.querySelector(`.conv-input[data-unit="${targetUnit}"]`);
          if (targetInput) {
            targetInput.value = convertedMap[targetUnit];
            clearFieldError(targetInput); // 計算填入的值肯定是正確的，清空錯誤樣式
          }
        }
      });
    } catch (err) {
      showFieldError(activeInput, err.message);
    }
  }
});
