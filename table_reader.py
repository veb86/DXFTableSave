#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
table_reader.py - AutoCAD ACAD_TABLE Entity Inspector and Table Break Flags Decoder.

Corrects the Table Break Flags (DXF Group Code 90) decoding according to
AutoCAD ObjectARX (AcDbTable::TableBreakOption) specifications.
"""

import sys
from typing import List, Dict, Any, Optional
from dxf_parser import read_tags, extract_entities_by_type, DXFTag


# ==============================================================================
# AutoCAD AcDbTable::TableBreakOption Bitmasks (ObjectARX Specification)
# ==============================================================================
# In AutoCAD C++ API (AcDbTable), the break options bitmask is defined as:
#
#   Bit 1 (0x01, value 1):  kTableBreakNone
#       If NOT set (0) when breaking is active, or explicitly indicates no break.
#
#   Bit 2 (0x02, value 2):  kTableBreakEnable
#       CRITICAL FLAG: Enables table breaking across multiple fragments!
#       (The previous bug checked bit 0 (value 1), falsely reporting 'NO' for 22).
#
#   Bit 3 (0x04, value 4):  kTableBreakAuto
#       Automatic height calculation and fragment splitting.
#
#   Bit 4 (0x08, value 8):  kTableBreakAllowManualPositioning
#       Allows manual positioning / offsets for individual table break fragments.
#
#   Bit 5 (0x10, value 16): kTableBreakRepeatHeader / CustomOffsets
#       Repeats header rows across table break fragments.
#
# Example with Break Flags = 22 (0x16, binary 0b10110):
#   22 = 16 (0x10) + 4 (0x04) + 2 (0x02)
#   - Bit 2 (0x02) is SET -> kTableBreakEnable = YES (Break is ENABLED!)
#   - Bit 3 (0x04) is SET -> kTableBreakAuto = YES (Auto-height is ENABLED!)
#   - Bit 5 (0x10) is SET -> kTableBreakRepeatHeader = YES (Repeat header is ENABLED!)
# ==============================================================================

TABLE_BREAK_NONE = 0x01
TABLE_BREAK_ENABLE = 0x02
TABLE_BREAK_AUTO = 0x04
TABLE_BREAK_ALLOW_MANUAL_POSITIONING = 0x08
TABLE_BREAK_REPEAT_HEADER = 0x10


def decode_table_break_flags(flags: int) -> Dict[str, Any]:
    """
    Decodes the DXF group code 90 (Table Break Options) for an AcDbTable entity.

    Returns a dictionary with parsed status and human-readable explanations.
    """
    binary_str = bin(flags)
    hex_str = hex(flags)

    # Correct AutoCAD bit evaluations:
    is_break_none = bool(flags & TABLE_BREAK_NONE)
    is_break_enabled = bool(flags & TABLE_BREAK_ENABLE)
    is_auto_height = bool(flags & TABLE_BREAK_AUTO)
    is_manual_positioning = bool(flags & TABLE_BREAK_ALLOW_MANUAL_POSITIONING)
    is_repeat_header = bool(flags & TABLE_BREAK_REPEAT_HEADER)

    explanation_lines = [
        f"Break Flags (DXF 90): {flags} (binary: {binary_str}, hex: {hex_str})",
        f"  Bit 1 (0x1,  kTableBreakNone):                   {'YES' if is_break_none else 'NO'}",
        f"  Bit 2 (0x2,  kTableBreakEnable):                 {'YES' if is_break_enabled else 'NO'} "
        + ("<-- [BREAK ENABLED!]" if is_break_enabled else ""),
        f"  Bit 3 (0x4,  kTableBreakAuto):                   {'YES' if is_auto_height else 'NO'} "
        + ("(Automatic height)" if is_auto_height else ""),
        f"  Bit 4 (0x8,  kTableBreakAllowManualPositioning): {'YES' if is_manual_positioning else 'NO'} "
        + ("(Manual positioning)" if is_manual_positioning else ""),
        f"  Bit 5 (0x10, kTableBreakRepeatHeader):           {'YES' if is_repeat_header else 'NO'} "
        + ("(Repeat headers / custom offsets)" if is_repeat_header else ""),
    ]

    summary = (
        "Table Break is ENABLED with Auto-Height and Repeating Headers"
        if (is_break_enabled and is_auto_height and is_repeat_header)
        else ("Table Break is ENABLED" if is_break_enabled else "Table Break is DISABLED")
    )

    return {
        "raw_flags": flags,
        "binary": binary_str,
        "hex": hex_str,
        "break_none": is_break_none,
        "break_enabled": is_break_enabled,
        "auto_height": is_auto_height,
        "manual_positioning": is_manual_positioning,
        "repeat_header": is_repeat_header,
        "explanation": "\n".join(explanation_lines),
        "summary": summary,
    }


def parse_acad_table(entity_tags: List[DXFTag], index: int = 1) -> Dict[str, Any]:
    """
    Parses a single ACAD_TABLE entity from its tag stream.
    Extracts handle, owner, insertion point, table break flags (code 90),
    dimensions (rows 91, cols 92), column widths, row heights, and cell text contents.
    """
    handle = ""
    owner = ""
    layer = "0"
    ins_x = 0.0
    ins_y = 0.0
    ins_z = 0.0

    break_flags: Optional[int] = None
    num_rows = 0
    num_cols = 0
    style_handle = ""
    block_record = ""

    col_widths: List[float] = []
    row_heights: List[float] = []
    cell_texts: List[str] = []

    in_acdb_table_subclass = False

    i = 0
    while i < len(entity_tags):
        tag = entity_tags[i]

        if tag.code == 5 and not handle:
            handle = str(tag.value)
        elif tag.code == 330 and not owner:
            owner = str(tag.value)
        elif tag.code == 8 and layer == "0":
            layer = str(tag.value)
        elif tag.code == 10 and ins_x == 0.0:
            ins_x = float(tag.value) if isinstance(tag.value, (int, float)) else 0.0
        elif tag.code == 20 and ins_y == 0.0:
            ins_y = float(tag.value) if isinstance(tag.value, (int, float)) else 0.0
        elif tag.code == 30 and ins_z == 0.0:
            ins_z = float(tag.value) if isinstance(tag.value, (int, float)) else 0.0

        if tag.code == 100 and str(tag.value) == "AcDbTable":
            in_acdb_table_subclass = True
            # Read header parameters immediately following AcDbTable subclass marker:
            j = i + 1
            while j < len(entity_tags):
                sub_tag = entity_tags[j]
                if sub_tag.code == 100:  # Next subclass
                    break

                if sub_tag.code == 342:
                    style_handle = str(sub_tag.value)
                elif sub_tag.code == 343:
                    block_record = str(sub_tag.value)
                elif sub_tag.code == 90 and break_flags is None:
                    # First 90 after AcDbTable is the Table Break Option flags!
                    break_flags = int(sub_tag.value)
                elif sub_tag.code == 91 and num_rows == 0:
                    num_rows = int(sub_tag.value)
                elif sub_tag.code == 92 and num_cols == 0:
                    num_cols = int(sub_tag.value)
                elif sub_tag.code == 141:
                    if isinstance(sub_tag.value, (int, float)):
                        col_widths.append(float(sub_tag.value))
                elif sub_tag.code == 142:
                    if isinstance(sub_tag.value, (int, float)):
                        row_heights.append(float(sub_tag.value))
                elif sub_tag.code in (300, 301, 302, 1, 3):
                    text_val = str(sub_tag.value).strip()
                    if text_val and text_val not in ("Standard", "CELL_VALUE", "ACVALUE_END") and not text_val.startswith("{"):
                        cell_texts.append(text_val)

                j += 1

            i = j
            continue

        i += 1

    # If break flags not found explicitly, default to 0
    if break_flags is None:
        break_flags = 0

    break_info = decode_table_break_flags(break_flags)

    return {
        "index": index,
        "handle": handle,
        "owner": owner,
        "layer": layer,
        "insert_point": (ins_x, ins_y, ins_z),
        "style_handle": style_handle,
        "block_record": block_record,
        "break_flags": break_flags,
        "break_info": break_info,
        "num_rows": num_rows,
        "num_cols": num_cols,
        "col_widths": col_widths,
        "row_heights": row_heights,
        "cell_texts": cell_texts,
        "total_tags": len(entity_tags),
    }


def analyze_tables_in_dxf(file_path: str) -> List[Dict[str, Any]]:
    """
    Loads a DXF file and returns detailed analyses for all ACAD_TABLE entities found.
    """
    all_tags = list(read_tags(file_path))
    table_entities = extract_entities_by_type(all_tags, "ACAD_TABLE")

    results: List[Dict[str, Any]] = []
    for idx, raw_tags in enumerate(table_entities, start=1):
        parsed = parse_acad_table(raw_tags, idx)
        results.append(parsed)

    return results


def print_table_report(table_data: Dict[str, Any]) -> None:
    """
    Prints a formatted report of a single ACAD_TABLE entity.
    """
    print("=" * 70)
    print(f"TABLE FRAGMENT #{table_data['index']} (Handle: 0x{table_data['handle']})")
    print("=" * 70)
    print(f"Owner Handle:    0x{table_data['owner']}")
    print(f"Layer:           {table_data['layer']}")
    print(f"Insert Point:    X={table_data['insert_point'][0]:.4f}, "
          f"Y={table_data['insert_point'][1]:.4f}, "
          f"Z={table_data['insert_point'][2]:.4f}")
    print(f"Table Style:     0x{table_data['style_handle']}")
    print(f"Dimensions:      {table_data['num_rows']} rows x {table_data['num_cols']} columns")
    print(f"Column Widths:   {table_data['col_widths']}")
    print("-" * 70)
    print("TABLE BREAK ANALYSIS (DXF Group Code 90):")
    print(table_data['break_info']['explanation'])
    print(f"=> Decoded State: {table_data['break_info']['summary']}")
    print("-" * 70)
    print(f"Total Decoded Cells Preview (first 10): {table_data['cell_texts'][:10]}")
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python table_reader.py <file.dxf>")
        sys.exit(1)

    dxf_path = sys.argv[1]
    tables = analyze_tables_in_dxf(dxf_path)

    print(f"\nAnalyzing tables in: {dxf_path}")
    print(f"Found {len(tables)} ACAD_TABLE entities.\n")

    for tbl in tables:
        print_table_report(tbl)
