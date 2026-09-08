import React from 'react';
import { TableFragment } from '../types/dxf';
import { Table, Download, Layers, Hash, Move, Grid, Split, CheckCircle2, XCircle, Info } from 'lucide-react';

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

  // Export current table to CSV
  const exportToCSV = () => {
    const rows: string[][] = [];
    for (let r = 0; r < table.rows; r++) {
      const rowData: string[] = [];
      for (let c = 0; c < table.cols; c++) {
        const cell = table.cells.find((cl) => cl.row === r && cl.col === c);
        const text = cell ? cell.text.replace(/"/g, '""') : '';
        rowData.push(`"${text}"`);
      }
      rows.push(rowData);
    }
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `table_${table.handle}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Fragment Selector Pills */}
      {allTables.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Fragments ({allTables.length}):
          </span>
          {allTables.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => onSelectTable(t)}
              className={`px-2.5 py-1 text-xs rounded-md font-mono transition-all ${
                t.id === table.id
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Frag #{idx + 1} ({t.handle})
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
            <span>Grid Size</span>
          </div>
          <div className="font-mono text-sm font-semibold text-slate-100">
            {table.rows} rows × {table.cols} cols
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Layer</span>
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
                Value: {table.breakOptionInfo.rawFlags} ({table.breakOptionInfo.hexString}, {table.breakOptionInfo.binaryString})
              </span>
            </div>
            <div>
              {table.breakOptionInfo.breakEnabled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3 h-3" />
                  Table Break: ENABLED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">
                  <XCircle className="w-3 h-3" />
                  Table Break: Disabled
                </span>
              )}
            </div>
          </div>

          {/* Detailed Bit Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 font-mono text-[11px] mb-2.5">
            <div className={`p-2 rounded border ${table.breakOptionInfo.breakNone ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-500'}`}>
              <div className="text-[10px] text-slate-400">Bit 1 (0x01 = 1)</div>
              <div className="font-semibold">kTableBreakNone</div>
              <div className="mt-0.5">{table.breakOptionInfo.breakNone ? 'SET' : '0 (No)'}</div>
            </div>

            <div className={`p-2 rounded border ${table.breakOptionInfo.breakEnabled ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200 font-bold' : 'bg-slate-950/40 border-slate-900 text-slate-500'}`}>
              <div className="text-[10px] text-emerald-400/80">Bit 2 (0x02 = 2)</div>
              <div>kTableBreakEnable</div>
              <div className="mt-0.5 text-emerald-400">{table.breakOptionInfo.breakEnabled ? 'SET (ACTIVE!)' : '0 (No)'}</div>
            </div>

            <div className={`p-2 rounded border ${table.breakOptionInfo.autoHeight ? 'bg-blue-950/40 border-blue-800/60 text-blue-200' : 'bg-slate-950/40 border-slate-900 text-slate-500'}`}>
              <div className="text-[10px] text-blue-400/80">Bit 3 (0x04 = 4)</div>
              <div>kTableBreakAuto</div>
              <div className="mt-0.5 text-blue-300">{table.breakOptionInfo.autoHeight ? 'SET (Auto Height)' : '0 (No)'}</div>
            </div>

            <div className={`p-2 rounded border ${table.breakOptionInfo.manualPositioning ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' : 'bg-slate-950/40 border-slate-900 text-slate-500'}`}>
              <div className="text-[10px] text-slate-400">Bit 4 (0x08 = 8)</div>
              <div>kAllowManualPos</div>
              <div className="mt-0.5">{table.breakOptionInfo.manualPositioning ? 'SET' : '0 (No)'}</div>
            </div>

            <div className={`p-2 rounded border ${table.breakOptionInfo.repeatHeader ? 'bg-purple-950/40 border-purple-800/60 text-purple-200' : 'bg-slate-950/40 border-slate-900 text-slate-500'}`}>
              <div className="text-[10px] text-purple-400/80">Bit 5 (0x10 = 16)</div>
              <div>kRepeatHeader</div>
              <div className="mt-0.5 text-purple-300">{table.breakOptionInfo.repeatHeader ? 'SET (Custom Offsets)' : '0 (No)'}</div>
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
            <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong>ObjectARX AcDbTable specification:</strong> 22 (0x16) = 16 (0x10 RepeatHeader) + 4 (0x04 AutoHeight) + 2 (0x02 BreakEnable). Table break is actively splitting rows across drawing fragments.
            </span>
          </div>
        </div>
      )}

      {/* Column Widths Indicator */}
      <div className="text-xs text-slate-400 flex items-center gap-2 overflow-x-auto py-1">
        <span className="font-medium text-slate-300 shrink-0">Column Widths:</span>
        <div className="flex items-center gap-1 font-mono">
          {table.columnWidths.map((w, idx) => (
            <span
              key={idx}
              className="bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300"
            >
              C{idx + 1}: {w.toFixed(1)}mm
            </span>
          ))}
        </div>
      </div>

      {/* Interactive Table Grid */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 shadow-inner">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-200">
              Decoded Cell Contents
            </span>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto max-h-[340px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
                <th className="p-2 border-r border-slate-800 w-10 text-center">#</th>
                {Array.from({ length: table.cols }).map((_, c) => (
                  <th key={c} className="p-2 border-r border-slate-800 font-semibold text-amber-300">
                    Col {c + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {Array.from({ length: table.rows }).map((_, r) => (
                <tr
                  key={r}
                  className={`hover:bg-blue-950/20 transition-colors ${
                    r === 0 ? 'bg-slate-900/50 font-medium text-amber-200' : 'text-slate-200'
                  }`}
                >
                  <td className="p-2 border-r border-slate-800 text-slate-500 text-center">
                    {r + 1}
                  </td>
                  {Array.from({ length: table.cols }).map((_, c) => {
                    const cell = table.cells.find((cl) => cl.row === r && cl.col === c);
                    return (
                      <td
                        key={c}
                        className="p-2 border-r border-slate-800/60 max-w-[200px] truncate"
                        title={cell?.text}
                      >
                        {cell ? cell.text : <span className="text-slate-600">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
