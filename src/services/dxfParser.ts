import {
  DXFTag,
  DXFAnalysisResult,
  TableFragment,
  TableCell,
  TableBreakOptionInfo,
  DXFRenderableEntity,
  DXFLineEntity,
  DXFLwPolylineEntity,
  DXFCircleEntity,
  DXFTextEntity,
} from '../types/dxf';

/**
 * AutoCAD AcDbTable::TableBreakOption bit masks (ObjectARX Specification)
 * Bit 1 (0x01, value 1):  kTableBreakNone
 * Bit 2 (0x02, value 2):  kTableBreakEnable (Table Break is ENABLED!)
 * Bit 3 (0x04, value 4):  kTableBreakAuto (Automatic height calculation)
 * Bit 4 (0x08, value 8):  kTableBreakAllowManualPositioning (Manual positioning of break fragments)
 * Bit 5 (0x10, value 16): kTableBreakRepeatHeader / CustomOffsets (Repeat headers / custom offsets)
 */
export const TABLE_BREAK_NONE = 0x01;
export const TABLE_BREAK_ENABLE = 0x02;
export const TABLE_BREAK_AUTO = 0x04;
export const TABLE_BREAK_ALLOW_MANUAL_POSITIONING = 0x08;
export const TABLE_BREAK_REPEAT_HEADER = 0x10;

export function decodeTableBreakFlags(flags: number): TableBreakOptionInfo {
  const isBreakNone = (flags & TABLE_BREAK_NONE) !== 0;
  const isBreakEnabled = (flags & TABLE_BREAK_ENABLE) !== 0;
  const isAutoHeight = (flags & TABLE_BREAK_AUTO) !== 0;
  const isManualPositioning = (flags & TABLE_BREAK_ALLOW_MANUAL_POSITIONING) !== 0;
  const isRepeatHeader = (flags & TABLE_BREAK_REPEAT_HEADER) !== 0;

  const binaryString = '0b' + flags.toString(2);
  const hexString = '0x' + flags.toString(16).toUpperCase();

  let summary = 'Table Break Disabled';
  if (isBreakEnabled) {
    if (isAutoHeight && isRepeatHeader) {
      summary = 'Table Break ENABLED (Auto-Height & Repeat Headers)';
    } else if (isAutoHeight) {
      summary = 'Table Break ENABLED (Auto-Height)';
    } else {
      summary = 'Table Break ENABLED';
    }
  }

  return {
    rawFlags: flags,
    binaryString,
    hexString,
    breakNone: isBreakNone,
    breakEnabled: isBreakEnabled,
    autoHeight: isAutoHeight,
    manualPositioning: isManualPositioning,
    repeatHeader: isRepeatHeader,
    summary,
  };
}

/**
 * Fast and robust low-level DXF tag reader and parser
 * Faithfully ports Python's dxf_parser.py and deep_table_analyzer.py to TypeScript
 */
export function parseDXFTags(rawContent: string): DXFTag[] {
  const lines = rawContent.split(/\r?\n/);
  const tags: DXFTag[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawCodeLine = lines[i].trim();
    if (!rawCodeLine) {
      i++;
      continue;
    }

    const code = parseInt(rawCodeLine, 10);
    if (isNaN(code)) {
      i++;
      continue;
    }

    if (i + 1 >= lines.length) break;
    const valueLine = lines[i + 1].trim();
    i += 2;

    let value: string | number = valueLine;
    // Parse numeric values based on standard DXF Group Codes
    if (code >= 10 && code < 60) {
      const parsedFloat = parseFloat(valueLine);
      if (!isNaN(parsedFloat)) value = parsedFloat;
    } else if (code >= 60 && code < 80) {
      const parsedInt = parseInt(valueLine, 10);
      if (!isNaN(parsedInt)) value = parsedInt;
    } else if (code >= 90 && code < 100) {
      const parsedInt = parseInt(valueLine, 10);
      if (!isNaN(parsedInt)) value = parsedInt;
    } else if (code >= 140 && code < 150) {
      const parsedFloat = parseFloat(valueLine);
      if (!isNaN(parsedFloat)) value = parsedFloat;
    }

    tags.push({ code, value });
  }

  return tags;
}

export function analyzeDXF(
  fileName: string,
  rawContent: string,
  fileSizeBytes: number
): DXFAnalysisResult {
  const tags = parseDXFTags(rawContent);

  const headerVars: Record<string, string | number> = {};
  const sectionCounts: Record<string, number> = {};
  const entityCounts: Record<string, number> = {};
  const tables: TableFragment[] = [];
  const renderableEntities: DXFRenderableEntity[] = [];
  const layersSet = new Set<string>();
  const tableStyles: { handle: string; name: string; textHeight?: number }[] = [];

  let currentSection = '';
  let inSection = false;
  let maxHandle = 0;

  let i = 0;
  while (i < tags.length) {
    const tag = tags[i];

    // Check Handle (Code 5)
    if (tag.code === 5 && typeof tag.value === 'string') {
      const handleNum = parseInt(tag.value, 16);
      if (!isNaN(handleNum) && handleNum > maxHandle) {
        maxHandle = handleNum;
      }
    }

    // Section markers
    if (tag.code === 0 && tag.value === 'SECTION') {
      inSection = true;
      if (i + 1 < tags.length && tags[i + 1].code === 2) {
        currentSection = String(tags[i + 1].value).toUpperCase();
        sectionCounts[currentSection] = (sectionCounts[currentSection] || 0) + 1;
        i += 2;
        continue;
      }
    } else if (tag.code === 0 && tag.value === 'ENDSEC') {
      inSection = false;
      currentSection = '';
      i++;
      continue;
    }

    // Parse HEADER variables
    if (inSection && currentSection === 'HEADER') {
      if (tag.code === 9) {
        const varName = String(tag.value);
        if (i + 1 < tags.length) {
          headerVars[varName] = tags[i + 1].value;
          i += 2;
          continue;
        }
      }
    }

    // Parse OBJECTS (e.g. TABLESTYLE)
    if (inSection && currentSection === 'OBJECTS') {
      if (tag.code === 0 && tag.value === 'TABLESTYLE') {
        const styleTags: DXFTag[] = [tag];
        let j = i + 1;
        while (j < tags.length && tags[j].code !== 0) {
          styleTags.push(tags[j]);
          j++;
        }
        const handle = String(
          styleTags.find((t) => t.code === 5)?.value || 'UNKNOWN'
        );
        const name = String(
          styleTags.find((t) => t.code === 2)?.value || 'Standard'
        );
        const textHeight = parseFloat(
          String(styleTags.find((t) => t.code === 140)?.value || '2.5')
        );
        tableStyles.push({ handle, name, textHeight });
      }
    }

    // Parse ENTITIES (LINE, LWPOLYLINE, CIRCLE, TEXT, ACAD_TABLE)
    if (inSection && currentSection === 'ENTITIES') {
      if (tag.code === 0 && typeof tag.value === 'string') {
        const entityType = tag.value.toUpperCase();
        entityCounts[entityType] = (entityCounts[entityType] || 0) + 1;

        // Collect all tags for this entity
        const entityTags: DXFTag[] = [tag];
        let j = i + 1;
        while (j < tags.length && tags[j].code !== 0) {
          entityTags.push(tags[j]);
          j++;
        }

        const layer = String(
          entityTags.find((t) => t.code === 8)?.value || '0'
        );
        layersSet.add(layer);

        // Handle ACAD_TABLE entity
        if (entityType === 'ACAD_TABLE' || entityType === 'TABLE') {
          const tableObj = parseTableEntity(entityTags, tables.length + 1);
          tables.push(tableObj);
        } else if (entityType === 'LINE') {
          const line = parseLineEntity(entityTags, layer);
          if (line) renderableEntities.push(line);
        } else if (entityType === 'LWPOLYLINE') {
          const poly = parsePolylineEntity(entityTags, layer);
          if (poly) renderableEntities.push(poly);
        } else if (entityType === 'CIRCLE') {
          const circle = parseCircleEntity(entityTags, layer);
          if (circle) renderableEntities.push(circle);
        } else if (entityType === 'TEXT' || entityType === 'MTEXT') {
          const textEnt = parseTextEntity(entityTags, entityType, layer);
          if (textEnt) renderableEntities.push(textEnt);
        }

        i = j;
        continue;
      }
    }

    i++;
  }

  // Determine bounds from renderables and tables
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  renderableEntities.forEach((ent) => {
    if (ent.type === 'LINE') {
      updateBounds(ent.x1, ent.y1);
      updateBounds(ent.x2, ent.y2);
    } else if (ent.type === 'LWPOLYLINE') {
      ent.points.forEach((pt) => updateBounds(pt.x, pt.y));
    } else if (ent.type === 'CIRCLE') {
      updateBounds(ent.x - ent.radius, ent.y - ent.radius);
      updateBounds(ent.x + ent.radius, ent.y + ent.radius);
    } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
      updateBounds(ent.x, ent.y);
    }
  });

  // Also include table bounds
  tables.forEach((tbl) => {
    const totalW = tbl.columnWidths.reduce((a, b) => a + b, 0) || 100;
    const totalH = tbl.rowHeights.reduce((a, b) => a + b, 0) || 50;
    updateBounds(tbl.x, tbl.y);
    updateBounds(tbl.x + totalW, tbl.y - totalH);
  });

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 200;
    maxY = 150;
  }

  // Mark if fragments are part of a multi-break table
  if (tables.length > 1) {
    tables.forEach((t) => (t.isFragmentOfMultiTable = true));
  }

  return {
    fileName,
    fileSizeBytes,
    version: String(headerVars['$ACADVER'] || 'AC1021 (AutoCAD 2007)'),
    encoding: 'UTF-8 / CP1251',
    headerVars,
    sectionCounts,
    entityCounts,
    tables,
    renderableEntities,
    layers: Array.from(layersSet).sort(),
    maxHandleHex: maxHandle ? maxHandle.toString(16).toUpperCase() : '1000',
    extents: { minX, minY, maxX, maxY },
    hasTableStyle: tableStyles.length > 0,
    tableStyles,
  };
}

function parseTableEntity(tags: DXFTag[], index: number): TableFragment {
  const handle = String(tags.find((t) => t.code === 5)?.value || `TBL_${index}`);
  const owner = String(tags.find((t) => t.code === 330)?.value || '');
  const layer = String(tags.find((t) => t.code === 8)?.value || '0');

  // Insertion coordinates (Group 10, 20, 30)
  let x = 0;
  let y = 0;
  let z = 0;
  const insX = tags.find((t) => t.code === 10);
  const insY = tags.find((t) => t.code === 20);
  const insZ = tags.find((t) => t.code === 30);
  if (insX && typeof insX.value === 'number') x = insX.value;
  if (insY && typeof insY.value === 'number') y = insY.value;
  if (insZ && typeof insZ.value === 'number') z = insZ.value;

  // In AutoCAD ACAD_TABLE (subclass AcDbTable):
  // Group 342: TableStyle hard pointer ID
  // Group 343: BlockRecord hard pointer ID
  // Group 11, 21, 31: Horizontal direction vector
  // Group 90: Table Break Option flags (e.g. 22 = kTableBreakEnable | kTableBreakAuto | kTableBreakRepeatHeader)
  // Group 91: Number of rows (e.g. 10, 6, 5)
  // Group 92: Number of columns (e.g. 5)
  let breakFlags = 0;
  let rows = 0;
  let cols = 0;
  let styleHandle = '';
  let blockRecord = '';

  const columnWidths: number[] = [];
  const rowHeights: number[] = [];

  // Find AcDbTable subclass marker
  const acDbTableIdx = tags.findIndex(
    (t) => t.code === 100 && String(t.value).trim() === 'AcDbTable'
  );

  if (acDbTableIdx !== -1) {
    let found90 = false;
    let found91 = false;
    let found92 = false;

    for (let j = acDbTableIdx + 1; j < tags.length; j++) {
      const t = tags[j];
      if (t.code === 100) break; // Reached next subclass

      if (t.code === 342 && !styleHandle) {
        styleHandle = String(t.value);
      } else if (t.code === 343 && !blockRecord) {
        blockRecord = String(t.value);
      } else if (t.code === 90 && !found90 && typeof t.value === 'number') {
        breakFlags = t.value;
        found90 = true;
      } else if (t.code === 91 && !found91 && typeof t.value === 'number') {
        rows = t.value;
        found91 = true;
      } else if (t.code === 92 && !found92 && typeof t.value === 'number') {
        cols = t.value;
        found92 = true;
      } else if (t.code === 141 && typeof t.value === 'number' && t.value > 0) {
        columnWidths.push(t.value);
      } else if (t.code === 142 && typeof t.value === 'number' && t.value > 0) {
        rowHeights.push(t.value);
      }
    }
  }

  // Fallback if not found inside subclass
  if (!styleHandle) {
    styleHandle = String(tags.find((t) => t.code === 342 || t.code === 331)?.value || '');
  }

  const breakOptionInfo = decodeTableBreakFlags(breakFlags);

  // Extract cell texts from groups 300, 301, 302, 1, 3, etc.
  const cellTexts: string[] = [];
  tags.forEach((t) => {
    if ((t.code === 300 || t.code === 301 || t.code === 302 || t.code === 1 || t.code === 3) && typeof t.value === 'string') {
      const cleanVal = t.value.trim();
      if (
        cleanVal &&
        cleanVal !== 'Standard' &&
        cleanVal !== 'CELL_VALUE' &&
        cleanVal !== 'ACVALUE_END' &&
        cleanVal !== 'FlowingText' &&
        !cleanVal.startsWith('{')
      ) {
        cellTexts.push(cleanVal);
      }
    }
  });

  // If cols/rows not explicitly provided, estimate from cellTexts or defaults
  if (cols <= 0) cols = columnWidths.length > 0 ? columnWidths.length : 4;
  if (rows <= 0) rows = Math.max(3, Math.ceil(cellTexts.length / cols) || 4);

  if (columnWidths.length < cols) {
    const defaultColW = 35;
    while (columnWidths.length < cols) {
      columnWidths.push(defaultColW);
    }
  }

  if (rowHeights.length < rows) {
    while (rowHeights.length < rows) {
      rowHeights.push(8.0);
    }
  }

  // Construct structured cells
  const cells: TableCell[] = [];
  let textIndex = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellText =
        textIndex < cellTexts.length
          ? cellTexts[textIndex++]
          : r === 0
          ? `Column ${c + 1}`
          : `Item ${r}-${c + 1}`;

      cells.push({
        row: r,
        col: c,
        text: cellText,
        type: r === 0 ? 'header' : 'text',
        width: columnWidths[c] || 35,
        height: rowHeights[r] || 8,
      });
    }
  }

  return {
    id: `table-frag-${index}-${handle}`,
    handle,
    owner,
    layer,
    x,
    y,
    z,
    rows,
    cols,
    columnWidths,
    rowHeights,
    styleHandle,
    blockRecord,
    breakFlags,
    breakOptionInfo,
    cells,
    rawTagCount: tags.length,
  };
}

function parseLineEntity(tags: DXFTag[], layer: string): DXFLineEntity | null {
  let x1 = 0,
    y1 = 0,
    z1 = 0;
  let x2 = 0,
    y2 = 0,
    z2 = 0;

  tags.forEach((t) => {
    if (typeof t.value === 'number') {
      if (t.code === 10) x1 = t.value;
      if (t.code === 20) y1 = t.value;
      if (t.code === 30) z1 = t.value;
      if (t.code === 11) x2 = t.value;
      if (t.code === 21) y2 = t.value;
      if (t.code === 31) z2 = t.value;
    }
  });

  return { type: 'LINE', layer, x1, y1, z1, x2, y2, z2 };
}

function parsePolylineEntity(
  tags: DXFTag[],
  layer: string
): DXFLwPolylineEntity | null {
  const points: { x: number; y: number }[] = [];
  let currentX: number | null = null;
  let closed = false;

  tags.forEach((t) => {
    if (t.code === 70 && typeof t.value === 'number') {
      closed = (t.value & 1) === 1;
    }
    if (t.code === 10 && typeof t.value === 'number') {
      currentX = t.value;
    }
    if (t.code === 20 && typeof t.value === 'number' && currentX !== null) {
      points.push({ x: currentX, y: t.value });
      currentX = null;
    }
  });

  if (points.length < 2) return null;
  return { type: 'LWPOLYLINE', layer, points, closed };
}

function parseCircleEntity(
  tags: DXFTag[],
  layer: string
): DXFCircleEntity | null {
  let x = 0,
    y = 0,
    z = 0,
    radius = 0;

  tags.forEach((t) => {
    if (typeof t.value === 'number') {
      if (t.code === 10) x = t.value;
      if (t.code === 20) y = t.value;
      if (t.code === 30) z = t.value;
      if (t.code === 40) radius = t.value;
    }
  });

  if (radius <= 0) return null;
  return { type: 'CIRCLE', layer, x, y, z, radius };
}

function parseTextEntity(
  tags: DXFTag[],
  type: 'TEXT' | 'MTEXT',
  layer: string
): DXFTextEntity | null {
  let x = 0,
    y = 0,
    z = 0;
  let text = '';
  let height = 2.5;

  tags.forEach((t) => {
    if (t.code === 1 || t.code === 3) text = String(t.value);
    if (typeof t.value === 'number') {
      if (t.code === 10) x = t.value;
      if (t.code === 20) y = t.value;
      if (t.code === 30) z = t.value;
      if (t.code === 40) height = t.value;
    }
  });

  return { type, layer, x, y, z, text, height };
}
