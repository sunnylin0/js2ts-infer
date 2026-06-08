

/**
 * 儲存於 multilineVars 的譜號定義。
 */
interface AbcClef {
  type: string;
  verticalPos: number;
}

/**
 * 儲存於 multilineVars 的調號定義。
 */
interface AbcKey {
  accidentals: unknown[];
  root: string;
  acc: string;
  mode: string;
}




/**
 * 記錄於 multilineVars.voices[id] 的聲部位置描述。
 */
interface AbcVoiceEntry {
  staffNum: number;
  index: number;
  scale?: number;
  color?: string;
}

/**
 * 記錄於 multilineVars.staves[] 的譜表描述。
 */
interface AbcStave {
  index: number;
  numVoices: number;
  bracket?: 'start' | 'continue' | 'end';
  brace?: 'start' | 'continue' | 'end';
  connectBarLines?: 'start' | 'continue' | 'end';
}

/**
 * 為反覆段落（repeat ending）儲存的連音（tie）跨越狀態。
 */
interface AbcEndingHoldOver {
  inTie: Array<unknown[]>;
  inTieChord: Record<string, unknown>;
}

/**
 * 由 parseFontChangeLine 產生的字型切換文字片段。
 */
interface AbcTextSegment {
  text: string;
  font?: Font;
}

/** 字型切換文字的聯合型別：純字串或片段陣列。 */
type AbcFontChangeLine = string | AbcTextSegment[];

/**
 * 排隊等待下一行樂譜輸出的段落（Part）參考。
 */
interface AbcPartForNextLine {
  title: AbcFontChangeLine;
  startChar: number;
  endChar: number;
}

/**
 * 人聲/力度/和弦/裝飾音/音量等元素的垂直位置選項。
 */
type AbcPositionChoice = 'auto' | 'above' | 'below' | 'hidden';

/**
 * 貫穿整個 abc-js 解析流程的共用狀態物件。
 *
 * 每首曲子開始時透過 reset() 重設，並由
 * tokeniser、標頭解析器、指令解析器、樂譜解析器各自就地修改。
 */
interface MultilineVars {
  // ─── 生命週期 ────────────────────────────────────────────────────────────────

  /** 將所有自有資料屬性重設為初始值。 */
  reset(): void;

  // ─── 字元位置追蹤 ────────────────────────────────────────────────────────────

  /** 目前解析位置在原始字串中的絕對字元偏移量。 */
  iChar: number;

  // ─── 調號 / 拍號 / 音符長度 ──────────────────────────────────────────────────

  key: AbcKey;
  meter: Meter | null;
  origMeter: Meter | null;
  /** 預設音符長度（例如 0.125 代表八分音符）。 */
  default_length: number;
  /** 尚未透過 L: 或 M: 設定音符長度時為 true。 */
  havent_set_length: boolean;

  // ─── 譜號 / 八度 ─────────────────────────────────────────────────────────────

  clef: AbcClef;
  octave: number;

  // ─── 解析狀態旗標 ────────────────────────────────────────────────────────────

  /** 尚在標頭區域（第一個 K: 行之前）時為 true。 */
  is_in_header: boolean;
  /** 已看到 T: 標題行後為 true。 */
  hasMainTitle: boolean;
  /** 有未完成的音符行延續時為 true。 */
  start_new_line: boolean;

  // ─── 聲部 / 譜表佈局 ─────────────────────────────────────────────────────────

  /** 聲部 id 字串對應聲部位置描述的映射表。 */
  voices: Record<string, AbcVoiceEntry>;
  staves: AbcStave[];
  /** 已出現 %%score 或 %%staves 指令後為 true。 */
  score_is_present: boolean;
  /** 目前正在解析的聲部物件（由 parseVoice 設定）。 */
  currentVoice?: AbcVoiceEntry;

  // ─── 小節 / 反覆追蹤 ─────────────────────────────────────────────────────────

  currBarNumber: number;
  barCounter: Record<string, number>;
  inEnding: boolean;
  endingHoldOver: AbcEndingHoldOver;
  /** 各聲部的連音（tie）跨越陣列。 */
  inTie: Array<unknown[]>;
  inTieChord: Record<string, unknown>;
  openSlurs: unknown[];

  // ─── 速度（Tempo） ────────────────────────────────────────────────────────────

  tempo?: {
    startChar: number;
    endChar: number;
    duration: number[];
    bpm?: number;
    preString?: string;
    postString?: string;
    suppress?: boolean;
    suppressBpm?: boolean;
  };
  /** 排隊等待下一行樂譜的速度元素：[type, startChar, endChar, tempoObj]。 */
  tempoForNextLine: [] | [string, number, number, unknown];

  // ─── 段落 / 區段 ─────────────────────────────────────────────────────────────

  partForNextLine: AbcPartForNextLine | Record<string, never>;

  // ─── 下一個音符的時值覆蓋 ────────────────────────────────────────────────────

  next_note_duration: number;

  // ─── 巨集 / 使用者自訂符號表 ─────────────────────────────────────────────────

  macros: Record<string, string>;

  // ─── 裝飾音 ──────────────────────────────────────────────────────────────────

  ignoredDecorations: string[];

  // ─── 垂直定位 ────────────────────────────────────────────────────────────────

  vocalPosition: AbcPositionChoice;
  dynamicPosition: AbcPositionChoice;
  chordPosition: AbcPositionChoice;
  ornamentPosition: AbcPositionChoice;
  volumePosition: AbcPositionChoice;

  // ─── 儲存於 multilineVars 的字型（主體範圍，可中途更換） ─────────────────────

  annotationfont: Font;
  gchordfont: Font;
  historyfont: Font;
  infofont: Font;
  measurefont: Font & { box?: boolean };
  partsfont: Font & { box?: boolean };
  repeatfont: Font;
  textfont: Font;
  tripletfont: Font;
  vocalfont: Font;
  wordsfont: Font;

  /** 由 %%setfont 設定的索引字型槽，索引範圍 1–9。 */
  setfont?: Font[];

  // ─── 版面配置 ────────────────────────────────────────────────────────────────

  landscape?: boolean;
  papersize?: string;
  /** 小節號碼顯示間隔。 */
  barNumbers?: number;
  barsperstaff?: number;
  /** 為 true 時隱藏沒有音符的譜表。 */
  staffnonote?: boolean;
  lineBreaks?: number[];
  continueall?: boolean;

  // ─── 警告訊息 ────────────────────────────────────────────────────────────────

  warnings?: string[];
  warningObjects?: Array<{
    message: string;
    line: string;
    startChar: number;
    column: number;
  }>;

  // ─── 移調 ────────────────────────────────────────────────────────────────────

  globalTranspose?: number;

  // ─── 其他旗標 / 狀態 ─────────────────────────────────────────────────────────

  titlecaps?: boolean;
  /** 為 true 時不顯示速度標記。 */
  printTempo?: boolean;
  partsBox?: boolean;
  freegchord: boolean;
  keywarn?: boolean;

  // ─── 字型比較輔助方法 ─────────────────────────────────────────────────────────

  /**
   * 當 multilineVars 上的指定字型與 `defaultFonts` 中對應字型不同時回傳 true。
   */
  differentFont(type: string, defaultFonts: Record<string, Font>): boolean;

  /**
   * 將相關的定位與字型覆蓋複製到元素 `el` 上。
   * @param elType - 'note' | 'bar'
   */
  addFormattingOptions(
    el: Record<string, unknown>,
    defaultFonts: Record<string, Font>,
    elType: 'note' | 'bar',
  ): void;

  // ─── 反覆段落連音跨越輔助方法 ─────────────────────────────────────────────────

  /** 將目前的 inTie / inTieChord 狀態快照存入 endingHoldOver。 */
  duplicateStartEndingHoldOvers(): void;

  /** 從先前儲存的 endingHoldOver 還原 inTie / inTieChord。 */
  restoreStartEndingHoldOvers(): void;

  // ─── 索引簽章 ────────────────────────────────────────────────────────────────

  /**
   * 允許指令處理器動態寫入任意具名值
   * （例如 `multilineVars[cmd] = value`）。
   */
  [key: string]: unknown;
}
