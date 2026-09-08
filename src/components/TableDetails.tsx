import React, { useState } from 'react';
import { TableFragment, TableCell } from '../types/dxf';
import {
  Table,
  Download,
  Layers,
  Hash,
  Move,
  Grid,
  Split,
  CheckCircle2,
  XCircle,
  Info,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  FileSpreadsheet,
  Sliders,
  Filter,
} from 'lucide-react';

interface TableDetailsProps {
  table: TableFragment | null;
  allTables: TableFragment[];
  onSelectTable: (table: TableFragment) => void;
}

export const TableDetails: React.FC<TableDetailsProps> = ({
  table,
  allTables,
  onSelectTable,
}) => {
  const [selectedCell, setSelectedCell] = useState<TableCell | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'all-cells'>('grid');
  const [rowStyleFilter, setRowStyleFilter] = useState<'ALL' | 'Title' | 'Header' | 'Data'>('ALL');

  if (!table) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
        <Table className="w-10 h-10 mb-3 text-slate-600" />
        <p className="text-sm font-medium">No ACAD_TABLE selected</p>
        <p className="text-xs text-slate-500 mt-1">
          Select a table fragment from the list or click on one in the CAD canvas
        </p>
      </div>
    );
  }

  // Active cell: either the user-selected cell or default to the first non-empty cell
  const currentCell =
    selectedCell && selectedCell.row < table.rows && selectedCell.col < table.cols
      ? selectedCell
      : table.cells.find((c) => c.text.length > 0) || table.cells[0] || null;

  // Export current table to CSV with rich metadata
  const exportToCSV = () => {
    const headers = [
      'Row',
      'Col',
      'Text',
      'CellStyle',
      'RowStyle',
      'ColumnStyle',
      'Alignment',
      'AlignmentCode_DXF170',
      'CellType_DXF171',
      'ColWidth_DXF142',
      'RowHeight_DXF141',
      'ColSpan_DXF175',
      'RowSpan_DXF176',
      'IsMerged_DXF173',
      'TextStyle_DXF7',
      'TextHeight_DXF140',
      'Rotation_DXF145',
      'OverrideFlags_DXF91',
    ];

    const rows: string[][] = [headers];

    table.cells.forEach((cl) => {
      rows.push([
        String(cl.row),
        String(cl.col),
        `"${(cl.text || '').replace(/"/g, '""')}"`,
        cl.cellStyle || 'по строке/столбцу',
        cl.rowStyle || 'Data',
        cl.colStyle || 'нет',
        cl.alignmentName || 'Middle Center',
        String(cl.alignmentCode ?? 5),
        cl.cellType || 'Text',
        String(cl.width ?? table.columnWidths[cl.col] ?? 2.5),
        String(cl.height ?? table.rowHeights[cl.row] ?? 0.36),
        String(cl.colSpan ?? 1),
        String(cl.rowSpan ?? 1),
        cl.isMerged ? 'TRUE' : 'FALSE',
        cl.textStyle || 'Standard',
        String(cl.textHeight ?? 0.18),
        String(cl.rotation ?? 0),
        String(cl.overrideFlags ?? ''),
      ]);
    });

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `table_${table.handle}_full_cells.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredCells = table.cells.filter((c) => {
    if (rowStyleFilter === 'ALL') return true;
    return (c.rowStyle || 'Data') === rowStyleFilter;
  });

  const getRowStyleBadge = (style?: 'Title' | 'Header' | 'Data') => {
    switch (style) {
      case 'Title':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            TITLE
          </span>
        );
      case 'Header':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            HEADER
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            DATA
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Fragment Selector Pills */}
      {allTables.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Фрагменты ({allTables.length}):
          </span>
          {allTables.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => {
                onSelectTable(t);
                setSelectedCell(null);
              }}
              className={`px-2.5 py-1 text-xs rounded-md font-mono transition-all ${
                t.id === table.id
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Фрагмент #{idx + 1} ({t.handle})
            </button>
          ))}
        </div>
      )}

      {/* Metadata Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Hash className="w-3.5 h-3.5 text-blue-400" />
            <span>Handle</span>
          </div>
          <div className="font-mono text-sm font-semibold text-slate-100">
            {table.handle}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            <span>Insert (X, Y)</span>
          </div>
          <div className="font-mono text-xs font-semibold text-slate-100 truncate">
            {table.x.toFixed(1)}, {table.y.toFixed(1)}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Grid className="w-3.5 h-3.5 text-amber-400" />
            <span>Размер таблицы</span>
          </div>
          <div className="font-mono text-sm font-semibold text-slate-100">
            {table.rows} строк × {table.cols} столбцов
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Слой (Layer)</span>
          </div>
          <div className="font-mono text-xs font-semibold text-slate-100 truncate">
            {table.layer || '0'}
          </div>
        </div>
      </div>

      {/* AutoCAD Table Break Flags (DXF Group Code 90) Analysis */}
      {table.breakOptionInfo && (
        <div className="bg-slate-900/90 border border-purple-900/50 rounded-lg p-3 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Split className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-purple-200">
                Table Break Options (DXF Group Code 90)
              </span>
              <span className="font-mono bg-purple-950/80 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded text-[11px]">
                Значение: {table.breakOptionInfo.rawFlags} ({table.breakOptionInfo.hexString}, {table.breakOptionInfo.binaryString})
              </span>
            </div>
            <div>
              {table.breakOptionInfo.breakEnabled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3 h-3" />
                  Table Break: ВКЛЮЧЁН
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">
                  <XCircle className="w-3 h-3" />
                  Table Break: Отключен
                </span>
              )}
            </div>
          </div>

          {/* Detailed Bit Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 font-mono text-[11px] mb-2.5">
            <div
              className={`p-2 rounded border ${
                table.breakOptionInfo.breakNone
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500'
              }`}
            >
              <div className="text-[10px] text-slate-400">Bit 1 (0x01 = 1)</div>
              <div className="font-semibold">kTableBreakNone</div>
              <div className="mt-0.5">{table.breakOptionInfo.breakNone ? 'SET' : '0 (No)'}</div>
            </div>

            <div
              className={`p-2 rounded border ${
                table.breakOptionInfo.breakEnabled
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200 font-bold'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500'
              }`}
            >
              <div className="text-[10px] text-emerald-400/80">Bit 2 (0x02 = 2)</div>
              <div>kTableBreakEnable</div>
              <div className="mt-0.5 text-emerald-400">
                {table.breakOptionInfo.breakEnabled ? 'SET (ВКЛЮЧЕН!)' : '0 (No)'}
              </div>
            </div>

            <div
              className={`p-2 rounded border ${
                table.breakOptionInfo.autoHeight
                  ? 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500'
              }`}
            >
              <div className="text-[10px] text-blue-400/80">Bit 3 (0x04 = 4)</div>
              <div>kTableBreakAuto</div>
              <div className="mt-0.5 text-blue-300">
                {table.breakOptionInfo.autoHeight ? 'SET (Auto Height)' : '0 (No)'}
              </div>
            </div>

            <div
              className={`p-2 rounded border ${
                table.breakOptionInfo.manualPositioning
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500'
              }`}
            >
              <div className="text-[10px] text-slate-400">Bit 4 (0x08 = 8)</div>
              <div>kAllowManualPos</div>
              <div className="mt-0.5">
                {table.breakOptionInfo.manualPositioning ? 'SET' : '0 (No)'}
              </div>
            </div>

            <div
              className={`p-2 rounded border ${
                table.breakOptionInfo.repeatHeader
                  ? 'bg-purple-950/40 border-purple-800/60 text-purple-200'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500'
              }`}
            >
              <div className="text-[10px] text-purple-400/80">Bit 5 (0x10 = 16)</div>
              <div>kRepeatHeader</div>
              <div className="mt-0.5 text-purple-300">
                {table.breakOptionInfo.repeatHeader ? 'SET (Repeat Header)' : '0 (No)'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
            <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong>ObjectARX AcDbTable specification:</strong> 22 (0x16) = 16 (0x10 RepeatHeader) + 4 (0x04 AutoHeight) + 2 (0x02 BreakEnable).
            </span>
          </div>
        </div>
      )}

      {/* Dimensions & Sizing Indicators (DXF 142 Column Widths, DXF 141 Row Heights) */}
      <div className="space-y-1.5 text-xs text-slate-400 py-1 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-semibold text-slate-300 shrink-0">
            Ширина столбцов (DXF 142, {table.columnWidths.length} столбцов):
          </span>
          <div className="flex items-center gap-1 font-mono">
            {table.columnWidths.map((w, idx) => (
              <span
                key={idx}
                className="bg-slate-800/80 px-1.5 py-0.5 rounded text-blue-300 border border-slate-700/60"
              >
                C{idx + 1}: {w.toFixed(2)}
              </span>
            ))}
          </div>
        </div>

        {table.rowHeights && table.rowHeights.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1">
            <span className="font-semibold text-slate-300 shrink-0">
              Высота строк (DXF 141, {table.rowHeights.length} строк):
            </span>
            <div className="flex items-center gap-1 font-mono flex-wrap">
              {table.rowHeights.slice(0, 10).map((h, idx) => (
                <span
                  key={idx}
                  className="bg-slate-800/80 px-1.5 py-0.5 rounded text-amber-300 border border-slate-700/60"
                >
                  R{idx + 1}: {h.toFixed(2)}
                </span>
              ))}
              {table.rowHeights.length > 10 && (
                <span className="text-slate-500 text-[11px] self-center">
                  +{table.rowHeights.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DETAILED INSPECTOR CARD FOR CURRENTLY SELECTED CELL */}
      {currentCell && (
        <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-slate-100">
                Инспектор ячейки [Строка {currentCell.row}, Столбец {currentCell.col}]
              </span>
              {getRowStyleBadge(currentCell.rowStyle)}
              {currentCell.isMerged && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  MERGED
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Ширина: {currentCell.width?.toFixed(2)} × Высота: {currentCell.height?.toFixed(2)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 text-xs">
            {/* 1. Cell Text */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                <Type className="w-3.5 h-3.5 text-amber-400" />
                <span>Текст ячейки (DXF 302/1):</span>
              </div>
              <div className="font-semibold text-slate-100 font-mono text-sm break-words">
                {currentCell.text ? `"${currentCell.text}"` : <span className="text-slate-500 font-normal">(Пустая ячейка)</span>}
              </div>
            </div>

            {/* 2. Cell Style (Стиль ячейки) */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="text-[11px] text-slate-400 mb-1">Стиль ячейки (Cell Style):</div>
              <div>
                <div className="font-semibold text-cyan-200">
                  {currentCell.cellStyle || 'по строке/столбцу'}
                </div>
                <div className="text-slate-500 text-[10px] mt-0.5">
                  (наследуется от строки/столбца)
                </div>
              </div>
            </div>

            {/* 3. Row Style (Стиль строки) */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="text-[11px] text-slate-400 mb-1">Стиль строки (Row Style):</div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-200">
                  {currentCell.rowStyle || 'Data'}
                </span>
                <span className="text-slate-400 text-[11px]">
                  (H = {currentCell.height?.toFixed(3) || '0.360'})
                </span>
              </div>
            </div>

            {/* 4. Column Style (Стиль столбца) */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="text-[11px] text-slate-400 mb-1">Стиль столбца (Col Style):</div>
              <div>
                <span className="font-semibold text-slate-400 italic">
                  {currentCell.colStyle || 'нет'}
                </span>
                <span className="text-slate-500 text-[10px] ml-1">
                  (не задан)
                </span>
              </div>
            </div>

            {/* 5. Cell Alignment */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                <AlignCenter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Выравнивание (DXF 170):</span>
              </div>
              <div className="font-semibold text-cyan-300">
                {currentCell.alignmentName || 'Middle Center'}
              </div>
            </div>

            {/* 6. Cell Type & Font */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400 mb-1">Тип и Шрифт:</div>
              <div className="text-slate-200">
                <span className="font-semibold">{currentCell.cellType || 'Text'}</span>
                <span className="text-slate-400 ml-1">({currentCell.textStyle || 'Standard'})</span>
              </div>
            </div>

            {/* 7. Text Height */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400 mb-1">Высота текста (DXF 140):</div>
              <div className="font-mono font-semibold text-amber-300">
                {currentCell.textHeight !== undefined ? currentCell.textHeight.toFixed(3) : '0.180'}
              </div>
            </div>

            {/* 8. Dimensions (W x H) */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400 mb-1">Размеры (Ширина × Высота):</div>
              <div className="font-mono text-slate-200">
                {currentCell.width?.toFixed(2)} × {currentCell.height?.toFixed(3)}
              </div>
            </div>

            {/* 9. Span & Merging */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400 mb-1">Объединение (Span/Merged):</div>
              <div className="font-mono text-slate-200">
                {currentCell.rowSpan || 1}R × {currentCell.colSpan || 1}C
                {currentCell.isMerged ? ' (Merged Slave)' : ' (Master)'}
              </div>
            </div>

            {/* 10. Overrides & Rotation */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400 mb-1">Флаги (DXF 91) / Поворот:</div>
              <div className="font-mono text-slate-300">
                {currentCell.overrideFlags !== undefined ? `Flags: ${currentCell.overrideFlags}` : 'Default'}{' '}
                / {currentCell.rotation || 0}°
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area with Tabs */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 shadow-inner">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900/90 border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex rounded-md bg-slate-950 p-0.5 border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                Сетка ячеек (Интерактивная)
              </button>
              <button
                onClick={() => setViewMode('all-cells')}
                className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                  viewMode === 'all-cells'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Все ячейки (Табличный реестр)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'all-cells' && (
              <div className="flex items-center gap-1 text-xs">
                <Filter className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">Стиль строки:</span>
                <select
                  value={rowStyleFilter}
                  onChange={(e) => setRowStyleFilter(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs"
                >
                  <option value="ALL">Все стили ({table.cells.length})</option>
                  <option value="Title">Title (Заголовки)</option>
                  <option value="Header">Header (Шапки)</option>
                  <option value="Data">Data (Данные)</option>
                </select>
              </div>
            )}

            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors font-medium border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              Экспорт всех ячеек в CSV
            </button>
          </div>
        </div>

        {/* View Mode 1: Interactive Table Grid */}
        {viewMode === 'grid' && (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
                  <th className="p-2 border-r border-slate-800 w-16 text-center">Строка / Стиль</th>
                  {Array.from({ length: table.cols }).map((_, c) => (
                    <th
                      key={c}
                      className="p-2 border-r border-slate-800 font-semibold text-amber-300 min-w-[120px]"
                    >
                      Столбец {c + 1}
                      <span className="block text-[10px] text-slate-500 font-normal">
                        W = {table.columnWidths[c]?.toFixed(2) || '2.50'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {Array.from({ length: table.rows }).map((_, r) => {
                  const firstCell = table.cells.find((cl) => cl.row === r);
                  const rowStyle = firstCell?.rowStyle || 'Data';
                  const rowHeight = firstCell?.height || table.rowHeights[r] || 0.36;

                  return (
                    <tr
                      key={r}
                      className={`hover:bg-blue-950/20 transition-colors ${
                        rowStyle === 'Title'
                          ? 'bg-amber-950/15'
                          : rowStyle === 'Header'
                          ? 'bg-blue-950/15'
                          : ''
                      }`}
                    >
                      <td className="p-2 border-r border-slate-800 text-center bg-slate-900/40">
                        <div className="font-semibold text-slate-300">R{r}</div>
                        <div className="mt-0.5">{getRowStyleBadge(rowStyle)}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          H: {rowHeight.toFixed(2)}
                        </div>
                      </td>

                      {Array.from({ length: table.cols }).map((_, c) => {
                        const cell = table.cells.find((cl) => cl.row === r && cl.col === c);
                        const isSelected =
                          currentCell && currentCell.row === r && currentCell.col === c;

                        return (
                          <td
                            key={c}
                            onClick={() => cell && setSelectedCell(cell)}
                            className={`p-2.5 border-r border-slate-800/60 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-cyan-500/20 ring-2 ring-cyan-400 ring-inset font-semibold text-cyan-200'
                                : cell?.isMerged
                                ? 'bg-slate-900/20 text-slate-500'
                                : 'hover:bg-slate-800/50 text-slate-200'
                            }`}
                            title={`Кликните для детального просмотра: Строка ${r}, Столбец ${c}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] text-slate-500 font-mono">
                                [{r},{c}]
                              </span>
                              {cell?.alignmentCode && (
                                <span className="text-[9px] text-slate-400 bg-slate-800 px-1 rounded">
                                  {cell.alignmentName?.split(' ')[0] || 'Center'}
                                </span>
                              )}
                            </div>
                            <div className="font-medium text-xs truncate max-w-[200px]">
                              {cell?.text ? (
                                cell.text
                              ) : cell?.isMerged ? (
                                <span className="italic text-slate-500">(merged)</span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* View Mode 2: Full Cells Table Registry */}
        {viewMode === 'all-cells' && (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <th className="p-2 border-r border-slate-800 w-14 text-center">Поз.</th>
                  <th className="p-2 border-r border-slate-800 min-w-[160px]">Текст ячейки</th>
                  <th className="p-2 border-r border-slate-800">Стиль ячейки</th>
                  <th className="p-2 border-r border-slate-800">Стиль строки</th>
                  <th className="p-2 border-r border-slate-800">Стиль столбца</th>
                  <th className="p-2 border-r border-slate-800">Выравнивание</th>
                  <th className="p-2 border-r border-slate-800">Тип ячейки</th>
                  <th className="p-2 border-r border-slate-800">Размеры (W × H)</th>
                  <th className="p-2 border-r border-slate-800">Span / Merged</th>
                  <th className="p-2">Шрифт / H</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCells.map((cl, idx) => {
                  const isSelected =
                    currentCell && currentCell.row === cl.row && currentCell.col === cl.col;

                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedCell(cl)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-200'
                          : 'hover:bg-slate-800/40 text-slate-200'
                      }`}
                    >
                      <td className="p-2 border-r border-slate-800 text-center font-bold text-slate-400">
                        R{cl.row}C{cl.col}
                      </td>
                      <td className="p-2 border-r border-slate-800 font-semibold text-slate-100">
                        {cl.text ? `"${cl.text}"` : <span className="text-slate-500 font-normal">—</span>}
                      </td>
                      <td className="p-2 border-r border-slate-800 text-cyan-200 font-medium">
                        {cl.cellStyle || 'по строке/столбцу'}
                      </td>
                      <td className="p-2 border-r border-slate-800">
                        {getRowStyleBadge(cl.rowStyle)}
                      </td>
                      <td className="p-2 border-r border-slate-800 text-slate-400 italic">
                        {cl.colStyle || 'нет'}
                      </td>
                      <td className="p-2 border-r border-slate-800 text-cyan-300">
                        {cl.alignmentName || 'Middle Center'}
                      </td>
                      <td className="p-2 border-r border-slate-800 text-slate-300">
                        {cl.cellType || 'Text'}
                      </td>
                      <td className="p-2 border-r border-slate-800 text-slate-300">
                        {cl.width?.toFixed(2)} × {cl.height?.toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-slate-800 text-slate-300">
                        {cl.rowSpan || 1}×{cl.colSpan || 1}{' '}
                        {cl.isMerged && <span className="text-rose-400 text-[10px]">(Merged)</span>}
                      </td>
                      <td className="p-2 text-slate-300">
                        {cl.textStyle || 'Standard'} / {cl.textHeight?.toFixed(2) || '0.18'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
