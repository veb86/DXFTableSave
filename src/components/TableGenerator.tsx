import React, { useState } from 'react';
import { NewTableDefinition, DXFAnalysisResult } from '../types/dxf';
import {
  injectTableIntoDxf,
  createStandaloneTableDxf,
  splitTableIntoFragments,
} from '../services/dxfInjector';
import {
  Plus,
  Trash2,
  Download,
  FileCheck,
  Split,
  Settings2,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface TableGeneratorProps {
  currentDxfText: string | null;
  analysis: DXFAnalysisResult | null;
  onTableInjected?: (newDxfText: string) => void;
}

const PRESET_TEMPLATES: Record<
  string,
  {
    title: string;
    headers: string[];
    columnWidths: number[];
    rows: string[][];
  }
> = {
  bom: {
    title: 'Bill of Materials (BOM)',
    headers: ['Item', 'Part Number', 'Description', 'Qty', 'Material'],
    columnWidths: [15, 30, 50, 15, 30],
    rows: [
      ['1', 'BOLT-M8-40', 'Hex Head Flange Bolt', '12', 'Steel 8.8'],
      ['2', 'NUT-M8', 'Hex Nylon Lock Nut', '12', 'Steel 8.8'],
      ['3', 'WSH-M8', 'Flat Plain Washer', '24', 'Stainless 304'],
      ['4', 'BRK-L01', 'Mounting L-Bracket', '4', 'Alloy 6061-T6'],
      ['5', 'PLT-BASE', 'Heavy Base Plate 10mm', '1', 'Steel S235'],
      ['6', 'GSK-NBR', 'NBR Sealing Gasket', '2', 'NBR Rubber'],
      ['7', 'CAP-END', 'Plastic End Cover', '4', 'ABS Black'],
    ],
  },
  cables: {
    title: 'Cable & Wiring Schedule',
    headers: ['Cable ID', 'Source', 'Destination', 'Type', 'Length (m)'],
    columnWidths: [22, 35, 35, 30, 20],
    rows: [
      ['W101', 'Panel-A / Q1', 'Motor-M01', '4x2.5mm² Cu', '14.5'],
      ['W102', 'Panel-A / Q2', 'Pump-P02', '4x4.0mm² Cu', '22.0'],
      ['W103', 'PLC-DI / X1', 'Sensor-S01', '2x0.75mm² Shielded', '8.2'],
      ['W104', 'PLC-AI / X2', 'Pressure-PT01', '2x0.75mm² Twisted', '11.0'],
      ['W105', 'Ethernet-SW1', 'HMI-Screen', 'Cat6A S/FTP', '5.0'],
    ],
  },
  spec: {
    title: 'Component Specification Table',
    headers: ['Mark', 'Name', 'Standard', 'Weight (kg)', 'Notes'],
    columnWidths: [20, 40, 30, 25, 35],
    rows: [
      ['K-1', 'Column Section HEB 200', 'EN 10025-2', '185.0', 'Primer coated'],
      ['B-1', 'Main Beam IPE 300', 'EN 10025-2', '240.5', 'Hot-dip galv'],
      ['B-2', 'Secondary Beam IPE 180', 'EN 10025-2', '112.0', 'Hot-dip galv'],
      ['TR-1', 'Roof Truss Angle L50x5', 'EN 10056-1', '68.4', 'Welded assembly'],
    ],
  },
};

export const TableGenerator: React.FC<TableGeneratorProps> = ({
  currentDxfText,
  analysis,
  onTableInjected,
}) => {
  const [tableDef, setTableDef] = useState<NewTableDefinition>({
    title: 'Custom Table',
    styleName: 'Standard',
    headers: ['No.', 'Item Name', 'Specification', 'Qty', 'Remark'],
    columnWidths: [15, 40, 45, 15, 35],
    rowHeight: 8.0,
    textHeight: 2.5,
    rows: [
      ['1', 'Steel Flange DN100', 'PN16 Carbon Steel', '4', 'Weld neck'],
      ['2', 'Gasket Spiral Wound', 'DN100 Graphite', '4', 'Class 150'],
      ['3', 'Stud Bolt M16x90', 'Grade B7 with Nuts', '16', 'Zinc plated'],
    ],
    insertX: analysis ? analysis.extents.maxX + 20 : 100,
    insertY: analysis ? analysis.extents.maxY : 100,
    insertZ: 0,
    layer: 'TABLES',
    enableSplitting: false,
    rowsPerFragment: 5,
    fragmentOffsetX: 160,
    fragmentOffsetY: 0,
    injectionMode: 'vector_table', // Default to vector table for guaranteed 100% CAD compatibility
  });

  const [notification, setNotification] = useState<string | null>(null);

  // Apply preset template
  const applyPreset = (key: string) => {
    const preset = PRESET_TEMPLATES[key];
    if (!preset) return;
    setTableDef((prev) => ({
      ...prev,
      title: preset.title,
      headers: [...preset.headers],
      columnWidths: [...preset.columnWidths],
      rows: preset.rows.map((r) => [...r]),
    }));
  };

  // Header and Column operations
  const handleHeaderChange = (index: number, val: string) => {
    setTableDef((prev) => {
      const newHeaders = [...prev.headers];
      newHeaders[index] = val;
      return { ...prev, headers: newHeaders };
    });
  };

  const handleColWidthChange = (index: number, val: number) => {
    setTableDef((prev) => {
      const newWidths = [...prev.columnWidths];
      newWidths[index] = Math.max(val, 5);
      return { ...prev, columnWidths: newWidths };
    });
  };

  const addColumn = () => {
    setTableDef((prev) => ({
      ...prev,
      headers: [...prev.headers, `Col ${prev.headers.length + 1}`],
      columnWidths: [...prev.columnWidths, 30],
      rows: prev.rows.map((r) => [...r, '']),
    }));
  };

  const removeColumn = (index: number) => {
    if (tableDef.headers.length <= 1) return;
    setTableDef((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
      columnWidths: prev.columnWidths.filter((_, i) => i !== index),
      rows: prev.rows.map((r) => r.filter((_, i) => i !== index)),
    }));
  };

  // Row operations
  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    setTableDef((prev) => {
      const newRows = prev.rows.map((r, i) =>
        i === rIdx ? r.map((c, j) => (j === cIdx ? val : c)) : r
      );
      return { ...prev, rows: newRows };
    });
  };

  const addRow = () => {
    const nextNum = (tableDef.rows.length + 1).toString();
    const newRow = [nextNum, ...Array(tableDef.headers.length - 1).fill('')];
    setTableDef((prev) => ({
      ...prev,
      rows: [...prev.rows, newRow],
    }));
  };

  const removeRow = (rIdx: number) => {
    if (tableDef.rows.length <= 1) return;
    setTableDef((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== rIdx),
    }));
  };

  // Perform injection into current drawing
  const handleInjectIntoCurrent = () => {
    if (!currentDxfText) {
      alert('Please load a base DXF file first or download as standalone table.');
      return;
    }

    const maxHandle = analysis?.maxHandleHex || '1000';
    const result = injectTableIntoDxf(currentDxfText, tableDef, maxHandle);

    if (result.errors && result.errors.length > 0) {
      alert(`Injection error: ${result.errors.join(', ')}`);
      return;
    }

    if (onTableInjected) {
      onTableInjected(result.modifiedDxf);
      setNotification(
        `Successfully injected ${result.injectedCount} table fragment(s) into current drawing!`
      );
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Download Standalone DXF Table
  const handleDownloadStandalone = () => {
    const dxfString = createStandaloneTableDxf(tableDef);
    const blob = new Blob([dxfString], { type: 'application/dxf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table_${tableDef.styleName.toLowerCase()}_export.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    setNotification('Downloaded standalone DXF table file!');
    setTimeout(() => setNotification(null), 4000);
  };

  // Calculate fragmented preview count
  const fragments = splitTableIntoFragments(tableDef);

  return (
    <div className="flex flex-col gap-6">
      {/* Preset Quick Templates */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Quick Engineering Templates</span>
          </div>
          <span className="text-xs text-slate-400">Click to load preset data</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(PRESET_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className="flex flex-col text-left p-2.5 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/50 rounded-lg transition-all"
            >
              <span className="text-xs font-semibold text-slate-200 truncate">
                {template.title}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                {template.headers.length} columns, {template.rows.length} rows
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table Structure Editor */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between p-3.5 bg-slate-900/90 border-b border-slate-800 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Table Data & Columns</h3>
            <p className="text-xs text-slate-400">
              Edit headers, widths (in mm), and cell contents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addColumn}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              Add Column
            </button>
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
          </div>
        </div>

        {/* Column Widths & Headers Matrix */}
        <div className="overflow-x-auto p-3.5">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              {/* Column Width Controls */}
              <tr className="bg-slate-950/80 border-b border-slate-800">
                <th className="p-2 border-r border-slate-800 w-12 text-center text-slate-500 font-mono">
                  Width
                </th>
                {tableDef.headers.map((_, idx) => (
                  <th key={idx} className="p-2 border-r border-slate-800 min-w-[130px]">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={tableDef.columnWidths[idx] || 30}
                        onChange={(e) =>
                          handleColWidthChange(idx, parseFloat(e.target.value) || 20)
                        }
                        className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-slate-500">mm</span>
                      {tableDef.headers.length > 1 && (
                        <button
                          onClick={() => removeColumn(idx)}
                          className="ml-auto p-0.5 text-slate-500 hover:text-red-400"
                          title="Remove column"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-2 w-10"></th>
              </tr>

              {/* Column Header Titles */}
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="p-2 border-r border-slate-800 text-center text-slate-400 font-mono">
                  Header
                </th>
                {tableDef.headers.map((header, idx) => (
                  <th key={idx} className="p-2 border-r border-slate-800">
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => handleHeaderChange(idx, e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950/80 border border-slate-700 rounded text-amber-300 font-semibold focus:border-amber-400 focus:outline-none"
                    />
                  </th>
                ))}
                <th className="p-2"></th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-slate-800 font-mono">
              {tableDef.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/40">
                  <td className="p-2 border-r border-slate-800 text-center text-slate-500">
                    {rIdx + 1}
                  </td>
                  {tableDef.headers.map((_, cIdx) => (
                    <td key={cIdx} className="p-1 border-r border-slate-800/70">
                      <input
                        type="text"
                        value={row[cIdx] || ''}
                        onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                        className="w-full px-2 py-1 bg-slate-900/60 hover:bg-slate-900 focus:bg-slate-950 border border-transparent focus:border-blue-500 rounded text-slate-200 focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    {tableDef.rows.length > 1 && (
                      <button
                        onClick={() => removeRow(rIdx)}
                        className="p-1 text-slate-500 hover:text-red-400 rounded"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CAD Placement, Splitting, and Styling Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Placement & Dimension settings */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Settings2 className="w-4 h-4 text-blue-400" />
            <span>CAD Placement & Coordinates</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Insert X (mm)</label>
              <input
                type="number"
                value={tableDef.insertX}
                onChange={(e) =>
                  setTableDef((p) => ({ ...p, insertX: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Insert Y (mm)</label>
              <input
                type="number"
                value={tableDef.insertY}
                onChange={(e) =>
                  setTableDef((p) => ({ ...p, insertY: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Row Height</label>
              <input
                type="number"
                value={tableDef.rowHeight}
                onChange={(e) =>
                  setTableDef((p) => ({ ...p, rowHeight: parseFloat(e.target.value) || 8 }))
                }
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">CAD Layer</label>
              <input
                type="text"
                value={tableDef.layer}
                onChange={(e) => setTableDef((p) => ({ ...p, layer: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Table Style Name</label>
              <input
                type="text"
                value={tableDef.styleName}
                onChange={(e) => setTableDef((p) => ({ ...p, styleName: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Table Splitting & Break Engine (Port of create_zcad_table.py) */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Split className="w-4 h-4 text-purple-400" />
              <span>Multi-Fragment Table Breaking</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tableDef.enableSplitting}
                onChange={(e) =>
                  setTableDef((p) => ({ ...p, enableSplitting: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <p className="text-xs text-slate-400">
            Automatically splits large schedules into side-by-side or stacked table fragments
            with preserved headers.
          </p>

          {tableDef.enableSplitting ? (
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Rows / Frag</label>
                <input
                  type="number"
                  min="2"
                  value={tableDef.rowsPerFragment}
                  onChange={(e) =>
                    setTableDef((p) => ({
                      ...p,
                      rowsPerFragment: Math.max(1, parseInt(e.target.value) || 5),
                    }))
                  }
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Offset dX (mm)</label>
                <input
                  type="number"
                  value={tableDef.fragmentOffsetX}
                  onChange={(e) =>
                    setTableDef((p) => ({
                      ...p,
                      fragmentOffsetX: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Offset dY (mm)</label>
                <input
                  type="number"
                  value={tableDef.fragmentOffsetY}
                  onChange={(e) =>
                    setTableDef((p) => ({
                      ...p,
                      fragmentOffsetY: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                />
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded bg-slate-950/40 text-xs text-slate-500 italic">
              Table will be generated as a single contiguous CAD entity at (X={tableDef.insertX}, Y={tableDef.insertY}).
            </div>
          )}

          {/* Fragments Summary */}
          <div className="text-xs text-purple-300 font-mono mt-auto flex items-center gap-1.5">
            <span className="font-semibold">Fragments generated:</span>
            <span className="bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50">
              {fragments.length} table fragment(s)
            </span>
          </div>
        </div>
      </div>

      {/* Target Format & Injection Engine Controls */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            DXF Entity Architecture Mode:
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="injectionMode"
                value="vector_table"
                checked={tableDef.injectionMode === 'vector_table'}
                onChange={() => setTableDef((p) => ({ ...p, injectionMode: 'vector_table' }))}
                className="text-blue-600 focus:ring-0"
              />
              <span className="text-slate-200">Vector Table (Universal CAD: LINE + TEXT)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="injectionMode"
                value="native_acad_table"
                checked={tableDef.injectionMode === 'native_acad_table'}
                onChange={() =>
                  setTableDef((p) => ({ ...p, injectionMode: 'native_acad_table' }))
                }
                className="text-blue-600 focus:ring-0"
              />
              <span className="text-slate-200">Native ACAD_TABLE (AutoCAD 2007+)</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleDownloadStandalone}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-blue-400" />
            Download Standalone DXF
          </button>

          <button
            onClick={handleInjectIntoCurrent}
            disabled={!currentDxfText}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg transition-all shadow-md ${
              currentDxfText
                ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            Inject into Current Drawing
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
          <FileCheck className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
};
