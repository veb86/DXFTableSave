import React, { useState, useEffect } from 'react';
import { DXFAnalysisResult, TableFragment } from './types/dxf';
import { analyzeDXF } from './services/dxfParser';
import { Header } from './components/Header';
import { CADViewer } from './components/CADViewer';
import { TableDetails } from './components/TableDetails';
import { TableGenerator } from './components/TableGenerator';
import { AnalysisOverview } from './components/AnalysisOverview';
import { RawTagInspector } from './components/RawTagInspector';
import {
  Eye,
  Table,
  PlusCircle,
  BarChart3,
  Code2,
  FileCode,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentFileName, setCurrentFileName] = useState<string>('acadtable2007.dxf');
  const [currentDxfText, setCurrentDxfText] = useState<string>('');
  const [analysis, setAnalysis] = useState<DXFAnalysisResult | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableFragment | null>(null);
  const [activeTab, setActiveTab] = useState<
    'viewer' | 'tables' | 'generator' | 'overview' | 'tags'
  >('viewer');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasModifications, setHasModifications] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load a preset file from public/samples/
  const loadPreset = async (sampleName: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetch(`/samples/${sampleName}`);
      if (!resp.ok) {
        throw new Error(`Failed to load preset ${sampleName}: ${resp.statusText}`);
      }
      const text = await resp.text();
      setCurrentDxfText(text);
      setCurrentFileName(sampleName);

      const parsed = analyzeDXF(sampleName, text, text.length);
      setAnalysis(parsed);
      setSelectedTable(parsed.tables.length > 0 ? parsed.tables[0] : null);
      setHasModifications(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading sample file');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadPreset('acadtable2007.dxf');
  }, []);

  // Upload user's custom DXF file
  const handleFileUpload = (file: File) => {
    setIsLoading(true);
    setErrorMsg(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        setCurrentDxfText(text);
        setCurrentFileName(file.name);

        const parsed = analyzeDXF(file.name, text, file.size);
        setAnalysis(parsed);
        setSelectedTable(parsed.tables.length > 0 ? parsed.tables[0] : null);
        setHasModifications(false);
      } catch (err: any) {
        setErrorMsg('Failed to parse DXF file: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Failed to read uploaded file');
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  // Called when a new table is injected into current drawing
  const handleTableInjected = (modifiedDxf: string) => {
    setCurrentDxfText(modifiedDxf);
    setHasModifications(true);
    const updated = analyzeDXF(
      currentFileName,
      modifiedDxf,
      modifiedDxf.length
    );
    setAnalysis(updated);
    if (updated.tables.length > 0) {
      setSelectedTable(updated.tables[updated.tables.length - 1]);
    }
    setActiveTab('viewer');
  };

  // Download the currently active DXF
  const handleDownloadCurrentDxf = () => {
    if (!currentDxfText) return;
    const blob = new Blob([currentDxfText], { type: 'application/dxf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = currentFileName.replace(/\.dxf$/i, '');
    link.download = hasModifications ? `${cleanName}_with_table.dxf` : currentFileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Navigation */}
      <Header
        currentFileName={currentFileName}
        analysis={analysis}
        onFileUpload={handleFileUpload}
        onLoadPreset={loadPreset}
        onDownloadCurrentDxf={handleDownloadCurrentDxf}
        hasModifications={hasModifications}
        isLoading={isLoading}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('viewer')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'viewer'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              CAD Drawing & Table Preview
            </button>

            <button
              onClick={() => setActiveTab('tables')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'tables'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Decoded Tables ({analysis?.tables.length || 0})
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'generator'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Table Builder & Injector
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Drawing Metrics & Analysis
            </button>

            <button
              onClick={() => setActiveTab('tags')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'tags'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Raw Tag Inspector
            </button>
          </div>

          {/* Quick Active File Badge */}
          {analysis && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate max-w-[200px]">{currentFileName}</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400">{analysis.version}</span>
            </div>
          )}
        </div>

        {/* Tab Contents */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Parsing DXF structure & tags...</span>
          </div>
        ) : analysis ? (
          <div className="flex-1">
            {activeTab === 'viewer' && (
              <div className="flex flex-col lg:flex-row gap-4 h-[640px]">
                {/* CAD Canvas */}
                <div className="flex-1 h-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                  <CADViewer
                    analysis={analysis}
                    selectedTable={selectedTable}
                    onSelectTable={(tbl) => setSelectedTable(tbl)}
                  />
                </div>

                {/* Right Quick Inspector Panel */}
                <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto max-h-[640px]">
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                      <span>Selected Table Inspector</span>
                      {selectedTable && (
                        <span className="font-mono text-cyan-400">
                          {selectedTable.handle}
                        </span>
                      )}
                    </h2>
                    <TableDetails
                      table={selectedTable}
                      allTables={analysis.tables}
                      onSelectTable={(tbl) => setSelectedTable(tbl)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tables' && (
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-slate-100">
                    Decoded ACAD_TABLE Entities & Cell Grids
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Extracted table cells, handles, coordinates, and multi-fragment break structure
                  </p>
                </div>
                <TableDetails
                  table={selectedTable}
                  allTables={analysis.tables}
                  onSelectTable={(tbl) => setSelectedTable(tbl)}
                />
              </div>
            )}

            {activeTab === 'generator' && (
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-slate-100">
                    AutoCAD & ZCAD Table Generator and Injector
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Design custom engineering schedules, configure multi-fragment splits, and inject directly into your DXF drawings
                  </p>
                </div>
                <TableGenerator
                  currentDxfText={currentDxfText}
                  analysis={analysis}
                  onTableInjected={handleTableInjected}
                />
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-slate-100">
                    Drawing Structure, Headers & Sections
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Comprehensive DXF metadata, section markers, entity breakdowns, and extents
                  </p>
                </div>
                <AnalysisOverview analysis={analysis} />
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-slate-100">
                    Raw DXF Tag Stream Inspector
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Examine low-level group codes, handles, pointers, and tag pairs
                  </p>
                </div>
                <RawTagInspector dxfContent={currentDxfText} />
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3 text-center text-xs text-slate-500">
        DXF Table Save & Analyzer — Full compatibility with AutoCAD 2007+, ZCAD, LibreCAD, and standard DXF formats.
      </footer>
    </div>
  );
};

export default App;
