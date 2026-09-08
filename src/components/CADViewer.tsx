import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DXFAnalysisResult, TableFragment } from '../types/dxf';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Eye, Layers } from 'lucide-react';

interface CADViewerProps {
  analysis: DXFAnalysisResult;
  selectedTable: TableFragment | null;
  onSelectTable?: (table: TableFragment) => void;
}

export const CADViewer: React.FC<CADViewerProps> = ({
  analysis,
  selectedTable,
  onSelectTable,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport transform (world -> screen)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cursorCoord, setCursorCoord] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showText, setShowText] = useState<boolean>(true);

  // Auto-fit to drawing bounds on load
  const fitToBounds = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    const { minX, minY, maxX, maxY } = analysis.extents;
    const dx = Math.max(maxX - minX, 10);
    const dy = Math.max(maxY - minY, 10);

    const padding = 60;
    const scaleX = (width - padding * 2) / dx;
    const scaleY = (height - padding * 2) / dy;
    const newZoom = Math.min(scaleX, scaleY, 20);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(Math.max(newZoom, 0.05));
    setPan({
      x: width / 2 - centerX * newZoom,
      y: height / 2 + centerY * newZoom, // In CAD, Y points upwards
    });
  }, [analysis.extents]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
      fitToBounds();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitToBounds]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background (Dark CAD workspace)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // World to Screen transformation helper:
    // ScreenX = pan.x + worldX * zoom
    // ScreenY = pan.y - worldY * zoom  (CAD Y is inverted)
    const toScreenX = (wx: number) => pan.x + wx * zoom;
    const toScreenY = (wy: number) => pan.y - wy * zoom;

    // Draw Subtle CAD Grid
    if (showGrid && zoom > 0.1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;

      // Determine grid step based on zoom
      const stepCandidates = [0.1, 1, 5, 10, 20, 50, 100, 500, 1000];
      let step = 10;
      for (const s of stepCandidates) {
        if (s * zoom >= 30) {
          step = s;
          break;
        }
      }

      const leftWorld = (0 - pan.x) / zoom;
      const rightWorld = (width - pan.x) / zoom;
      const topWorld = (pan.y - 0) / zoom;
      const bottomWorld = (pan.y - height) / zoom;

      const startX = Math.floor(leftWorld / step) * step;
      const endX = Math.ceil(rightWorld / step) * step;
      const startY = Math.floor(bottomWorld / step) * step;
      const endY = Math.ceil(topWorld / step) * step;

      ctx.beginPath();
      for (let gx = startX; gx <= endX; gx += step) {
        const sx = toScreenX(gx);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
      for (let gy = startY; gy <= endY; gy += step) {
        const sy = toScreenY(gy);
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
      ctx.stroke();

      // Draw Origin Axis Cross
      const ox = toScreenX(0);
      const oy = toScreenY(0);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // X axis red
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 40, oy);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)'; // Y axis green
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, oy - 40);
      ctx.stroke();
    }

    // Render general CAD Entities (Lines, Polylines, Circles, Texts)
    analysis.renderableEntities.forEach((ent) => {
      ctx.strokeStyle = '#38bdf8'; // CAD cyan
      ctx.lineWidth = 1.2;

      if (ent.type === 'LINE') {
        ctx.beginPath();
        ctx.moveTo(toScreenX(ent.x1), toScreenY(ent.y1));
        ctx.lineTo(toScreenX(ent.x2), toScreenY(ent.y2));
        ctx.stroke();
      } else if (ent.type === 'LWPOLYLINE') {
        if (ent.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(toScreenX(ent.points[0].x), toScreenY(ent.points[0].y));
          for (let p = 1; p < ent.points.length; p++) {
            ctx.lineTo(toScreenX(ent.points[p].x), toScreenY(ent.points[p].y));
          }
          if (ent.closed) ctx.closePath();
          ctx.stroke();
        }
      } else if (ent.type === 'CIRCLE') {
        ctx.beginPath();
        ctx.arc(
          toScreenX(ent.x),
          toScreenY(ent.y),
          ent.radius * zoom,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      } else if ((ent.type === 'TEXT' || ent.type === 'MTEXT') && showText) {
        const fontSize = Math.max(ent.height * zoom, 8);
        if (fontSize >= 6) {
          ctx.font = `${fontSize}px 'JetBrains Mono', sans-serif`;
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(ent.text, toScreenX(ent.x), toScreenY(ent.y));
        }
      }
    });

    // Render ACAD_TABLE entities
    analysis.tables.forEach((tbl) => {
      const isSelected = selectedTable?.id === tbl.id;
      const totalW = tbl.columnWidths.reduce((a, b) => a + b, 0);
      const totalH = tbl.rowHeights.reduce((a, b) => a + b, 0);

      const sx0 = toScreenX(tbl.x);
      const sy0 = toScreenY(tbl.y);
      const screenW = totalW * zoom;
      const screenH = totalH * zoom;

      // Table background highlight if selected
      if (isSelected) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
        ctx.fillRect(sx0, sy0, screenW, screenH);
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fillRect(sx0, sy0, screenW, screenH);
      }

      // Outer Table Border
      ctx.strokeStyle = isSelected ? '#60a5fa' : '#38bdf8';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeRect(sx0, sy0, screenW, screenH);

      // Table Header row highlight
      if (tbl.rowHeights.length > 0) {
        const headerH = tbl.rowHeights[0] * zoom;
        ctx.fillStyle = isSelected
          ? 'rgba(59, 130, 246, 0.25)'
          : 'rgba(30, 41, 59, 0.7)';
        ctx.fillRect(sx0, sy0, screenW, headerH);
      }

      // Horizontal Row Divider Lines
      ctx.strokeStyle = isSelected ? 'rgba(96, 165, 250, 0.7)' : 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      let accumH = 0;
      for (let r = 0; r < tbl.rowHeights.length; r++) {
        accumH += tbl.rowHeights[r];
        const lineY = toScreenY(tbl.y - accumH);
        ctx.beginPath();
        ctx.moveTo(sx0, lineY);
        ctx.lineTo(sx0 + screenW, lineY);
        ctx.stroke();
      }

      // Vertical Column Divider Lines
      let accumW = 0;
      for (let c = 0; c < tbl.columnWidths.length; c++) {
        accumW += tbl.columnWidths[c];
        const lineX = toScreenX(tbl.x + accumW);
        ctx.beginPath();
        ctx.moveTo(lineX, sy0);
        ctx.lineTo(lineX, sy0 + screenH);
        ctx.stroke();
      }

      // Render Table Cell Texts
      if (showText && zoom > 0.2) {
        const baseFontSize = Math.min(Math.max(2.5 * zoom, 7), 16);
        ctx.font = `${baseFontSize}px 'JetBrains Mono', monospace`;

        tbl.cells.forEach((cell) => {
          // Calculate cell position
          let colOffsetX = 0;
          for (let c = 0; c < cell.col; c++) {
            colOffsetX += tbl.columnWidths[c] || 30;
          }
          let rowOffsetY = 0;
          for (let r = 0; r < cell.row; r++) {
            rowOffsetY += tbl.rowHeights[r] || 8;
          }

          const cellH = tbl.rowHeights[cell.row] || 8;
          const cx = toScreenX(tbl.x + colOffsetX) + 3;
          const cy = toScreenY(tbl.y - rowOffsetY) + (cellH * zoom) / 2 + baseFontSize / 3;

          ctx.fillStyle = cell.row === 0 ? '#fbbf24' : '#f8fafc';
          const maxCellW = ((tbl.columnWidths[cell.col] || 30) - 2) * zoom;
          ctx.fillText(cell.text, cx, cy, Math.max(maxCellW, 10));
        });
      }

      // Fragment Label Badge Above Table
      const badgeY = sy0 - 8;
      ctx.fillStyle = isSelected ? '#2563eb' : '#334155';
      const badgeText = `ACAD_TABLE: ${tbl.handle} (${tbl.rows}x${tbl.cols})`;
      ctx.font = "10px 'Plus Jakarta Sans', sans-serif";
      const textWidth = ctx.measureText(badgeText).width;
      ctx.fillRect(sx0 - 2, badgeY - 12, textWidth + 8, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(badgeText, sx0 + 2, badgeY);
    });
  }, [analysis, selectedTable, zoom, pan, showGrid, showText]);

  // Mouse Interaction: Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate world CAD coordinate
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (pan.y - mouseY) / zoom;
    setCursorCoord({ x: worldX, y: worldY });

    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Mouse Wheel: Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.02, Math.min(zoom * zoomFactor, 150));

    // Zoom towards cursor
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Click on Canvas to Select Table
  const handleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || !onSelectTable) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - pan.x) / zoom;
    const clickY = (pan.y - (e.clientY - rect.top)) / zoom;

    // Check if clicked inside any table bounding box
    for (const tbl of analysis.tables) {
      const totalW = tbl.columnWidths.reduce((a, b) => a + b, 0);
      const totalH = tbl.rowHeights.reduce((a, b) => a + b, 0);

      if (
        clickX >= tbl.x &&
        clickX <= tbl.x + totalW &&
        clickY <= tbl.y &&
        clickY >= tbl.y - totalH
      ) {
        onSelectTable(tbl);
        return;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] bg-slate-950 overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'crosshair'}`}
      />

      {/* Floating CAD Viewport Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/60 p-1.5 rounded-lg shadow-xl text-slate-300">
        <button
          onClick={() => {
            setZoom((z) => Math.min(z * 1.25, 150));
          }}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom((z) => Math.max(z * 0.8, 0.02));
          }}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          onClick={fitToBounds}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors"
          title="Fit Drawing to Window"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 100, y: 300 });
          }}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          onClick={() => setShowGrid((g) => !g)}
          className={`p-1.5 rounded transition-colors ${showGrid ? 'bg-blue-600/30 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          title="Toggle Grid"
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowText((t) => !t)}
          className={`p-1.5 rounded transition-colors ${showText ? 'bg-blue-600/30 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          title="Toggle Cell Text"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Coordinate Status Bar */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-700/60 px-3 py-1.5 rounded text-xs font-mono text-slate-300 shadow-lg">
        <span className="text-slate-400">X:</span>
        <span className="text-cyan-400 font-semibold">{cursorCoord.x.toFixed(2)}</span>
        <span className="text-slate-400">Y:</span>
        <span className="text-emerald-400 font-semibold">{cursorCoord.y.toFixed(2)}</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">Zoom:</span>
        <span className="text-slate-200">{(zoom * 100).toFixed(0)}%</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">Tables:</span>
        <span className="text-blue-400 font-semibold">{analysis.tables.length}</span>
      </div>
    </div>
  );
};
