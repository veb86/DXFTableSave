export interface DXFTag {
  code: number;
  value: string | number;
}

export interface DXFEntityRaw {
  name: string;
  tags: DXFTag[];
  handle?: string;
  owner?: string;
  layer?: string;
}

export interface TableCell {
  row: number;
  col: number;
  text: string;
  type?: 'text' | 'number' | 'header' | 'title' | 'block';
  cellStyle?: string; // "По строке/столбцу" (AutoCAD Cell Style: By Row/Column)
  rowStyle?: 'Title' | 'Header' | 'Data';
  colStyle?: string; // "нет" (AutoCAD Column Style: not defined)
  cellType?: 'Text' | 'Block';
  alignmentCode?: number;
  alignmentName?: string;
  width?: number;
  height?: number;
  isMerged?: boolean;
  colSpan?: number;
  rowSpan?: number;
  textStyle?: string;
  textHeight?: number;
  rotation?: number;
  overrideFlags?: number;
  virtualEdge?: number;
  autofit?: boolean;
  color?: number;
  bgColor?: number;
}

export type TableFlowDirection = 'Вниз' | 'Вверх';
export type TableBreakDirection = 'Вправо' | 'Вниз' | 'Влево' | 'Вверх';

export interface AutoCADTableProperties {
  // Раздел "Таблица"
  tableStyle: string; // "Standard"
  rows: number; // Строк (15)
  cols: number; // Столбцов (5)
  flowDirection: TableFlowDirection; // Направление таблицы ("Вниз" / "Вверх")
  tableWidth: number; // Ширина таблицы (12.5000)
  tableHeight: number; // Высота таблицы (5.6015)

  // Раздел "Геометрия"
  positionX: number; // Положение X (84.6651)
  positionY: number; // Положение Y (20.5026)
  positionZ: number; // Положение Z (0.0000)

  // Раздел "Разрыв таблиц"
  breakEnabled: boolean; // Включено: Да / Нет
  breakDirection: TableBreakDirection; // Направление: "Вправо" / "Вниз" / "Влево" / "Вверх"
  repeatTopLabels: boolean; // Повторение верхних меток: Да / Нет
  repeatBottomLabels: boolean; // Повторение нижних меток: Да / Нет
  manualPositioning: boolean; // Задание положения вручную: Да / Нет
  manualBreakHeight: boolean; // Задание высоты вручную: Да / Нет
  breakHeight: number; // Высота разбиения (3.7913)
  breakSpacing: number; // Интервал (0.9900)

  // Раздел "Геометрические свойства"
  areaSum: number; // Площадь (сумма) (0.0000)
  lengthSum: number; // Длина (сумма) (0.0000)
  volumeSum: number; // Объем (сумма) (0.0000)

  // Раздел "Геометрические свойства (настройка)"
  linearScaleFactor: number; // Линейный масштабный коэффициент (1.0000)
}

export interface TableBreakOptionInfo {
  rawFlags: number;
  binaryString: string;
  hexString: string;
  breakNone: boolean; // Bit 1 (0x1)
  breakEnabled: boolean; // Bit 2 (0x2) kTableBreakEnable
  autoHeight: boolean; // Bit 3 (0x4) kTableBreakAuto
  manualPositioning: boolean; // Bit 4 (0x8) kTableBreakAllowManualPositioning
  repeatHeader: boolean; // Bit 5 (0x10) kTableBreakRepeatHeader
  breakDirection?: TableBreakDirection;
  breakSpacing?: number;
  summary: string;
}

export interface TableFragment {
  id: string;
  handle: string;
  owner?: string;
  layer: string;
  x: number;
  y: number;
  z: number;
  rows: number;
  cols: number;
  columnWidths: number[];
  rowHeights: number[];
  breakHeight: number; // Total height of fragment (after which rows wrap to next fragment)
  manualBreakHeight?: number; // User-defined manual break height constraint
  isManualBreakHeight?: boolean; // Whether manual height setting is applied
  headerHeight?: number; // Height of header/title row(s)
  dataHeight?: number; // Height of data rows
  fragmentIndex?: number; // 1-based index of this fragment
  totalFragments?: number; // Total count of fragments
  positionMode?: 'auto' | 'manual'; // Auto-offset vs manual arbitrary positioning
  deltaFromPrevious?: { dx: number; dy: number }; // Offset from preceding fragment
  flowDirection: TableFlowDirection; // Направление таблицы: 'Вниз' | 'Вверх'
  breakDirection: TableBreakDirection; // Направление разрыва таблиц: 'Вправо' | 'Вниз' | 'Влево' | 'Вверх'
  breakSpacing: number; // Интервал разрыва таблиц (напр. 0.9900)
  repeatTopLabels: boolean; // Определение повторения верхних меток (Title & Header до первой строки Data)
  topLabelsRowCount: number; // Число начальных строк Title и Header, повторяемых на фрагментах
  topLabelRowStyles?: string[]; // Стили строк верхних меток (напр. ['Title', 'Header', 'Header'])
  topLabelsHeight?: number; // Суммарная высота верхних меток
  repeatBottomLabels: boolean; // Повторение нижних меток (Да/Нет)
  isManualPositioning: boolean; // Задание положения вручную (Да/Нет)
  totalTableRows?: number; // Общее количество строк во всей исходной таблице
  totalTableHeight?: number; // Общая высота всей таблицы (мм)
  cadProperties?: AutoCADTableProperties; // Полная структура свойств по спецификации AutoCAD
  styleHandle?: string;
  styleName?: string;
  blockRecord?: string;
  breakFlags?: number;
  breakOptionInfo?: TableBreakOptionInfo;
  cells: TableCell[];
  rawTagCount: number;
  isFragmentOfMultiTable?: boolean;
}

export interface DXFLineEntity {
  type: 'LINE';
  layer: string;
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  color?: number;
}

export interface DXFLwPolylineEntity {
  type: 'LWPOLYLINE';
  layer: string;
  points: { x: number; y: number }[];
  closed: boolean;
  color?: number;
}

export interface DXFCircleEntity {
  type: 'CIRCLE';
  layer: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  color?: number;
}

export interface DXFTextEntity {
  type: 'TEXT' | 'MTEXT';
  layer: string;
  x: number;
  y: number;
  z: number;
  text: string;
  height: number;
  color?: number;
}

export type DXFRenderableEntity =
  | DXFLineEntity
  | DXFLwPolylineEntity
  | DXFCircleEntity
  | DXFTextEntity;

export interface DXFAnalysisResult {
  fileName: string;
  fileSizeBytes: number;
  version: string;
  encoding: string;
  headerVars: Record<string, string | number>;
  sectionCounts: Record<string, number>;
  entityCounts: Record<string, number>;
  tables: TableFragment[];
  renderableEntities: DXFRenderableEntity[];
  layers: string[];
  maxHandleHex: string;
  extents: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  hasTableStyle: boolean;
  tableStyles: {
    handle: string;
    name: string;
    textHeight?: number;
  }[];
}

export interface TableFragmentConfig {
  name: string;
  startRow: number;
  rowCount: number;
  x: number;
  y: number;
  z: number;
  breakHeight: number;
  manualBreakHeight?: number;
  isManualHeight?: boolean;
  repeatTopLabels?: boolean;
  topLabelsRowCount?: number;
  rows?: string[][];
}

export interface NewTableDefinition {
  title: string;
  styleName: string;
  headers: string[];
  columnWidths: number[];
  rowHeight: number;
  textHeight: number;
  rows: string[][];
  insertX: number;
  insertY: number;
  insertZ: number;
  layer: string;
  enableSplitting: boolean;
  splitMethod: 'rows' | 'manual_height'; // Break by fixed row count or manual height threshold
  rowsPerFragment: number;
  manualBreakHeight: number; // Manual break height in mm after which rows transfer to next fragment
  repeatHeaderOnSplit: boolean; // Retain title/header rows on each broken fragment
  repeatTopLabels: boolean; // Определение повторения верхних меток: первые строчки Title и Header до первой Data
  topLabelsRowCount?: number; // Количество строк Title и Header
  flowDirection?: TableFlowDirection; // Направление таблицы ("Вниз" | "Вверх")
  breakDirection?: TableBreakDirection; // Направление разрыва ("Вправо" | "Вниз" | "Влево" | "Вверх")
  breakSpacing?: number; // Интервал разбиения в мм (напр. 0.9900)
  fragmentOffsetX: number;
  fragmentOffsetY: number;
  fragmentPositions?: { x: number; y: number }[]; // Arbitrary custom positioning per fragment
  fragmentManualHeights?: number[]; // Individual manual height override per fragment
  injectionMode: 'native_acad_table' | 'vector_table' | 'both';
}
