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

export interface TableBreakOptionInfo {
  rawFlags: number;
  binaryString: string;
  hexString: string;
  breakNone: boolean; // Bit 1 (0x1)
  breakEnabled: boolean; // Bit 2 (0x2) kTableBreakEnable
  autoHeight: boolean; // Bit 3 (0x4) kTableBreakAuto
  manualPositioning: boolean; // Bit 4 (0x8) kTableBreakAllowManualPositioning
  repeatHeader: boolean; // Bit 5 (0x10) kTableBreakRepeatHeader
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
  rowsPerFragment: number;
  fragmentOffsetX: number;
  fragmentOffsetY: number;
  injectionMode: 'native_acad_table' | 'vector_table' | 'both';
}
