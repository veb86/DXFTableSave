#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализ структуры DXF файла для понимания разделенных таблиц.
"""

import sys
from dxf_parser import DXFParser

def analyze_file(filename):
    parser = DXFParser(filename)
    try:
        parser.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return
    
    print("\n" + "="*80)
    print("DETAILED DXF ANALYSIS")
    print("="*80)
    
    # HEADER
    print("\n=== HEADER ===")
    for key, value in parser.header_vars.items():
        print(f"  {key}: {value}")
    
    # Поиск всех сущностей ACAD_TABLE в ENTITIES и OBJECTS
    print("\n=== SEARCHING FOR ALL TABLE FRAGMENTS ===")
    
    all_tables = []
    
    # Ищем в ENTITIES
    for ent in parser.entities:
        if ent.name == "ACAD_TABLE":
            all_tables.append(("ENTITIES", ent))
        elif ent.name == "TABLEGEOMETRY":
            print(f"\nFound TABLEGEOMETRY in ENTITIES:")
            print(f"  Handle: {ent.handle}")
            print(f"  Codes present: {sorted(ent._dict_cache.keys())}")
        elif ent.name == "TABLECONTENT":
            print(f"\nFound TABLECONTENT in ENTITIES:")
            print(f"  Handle: {ent.handle}")
            print(f"  Codes present: {sorted(ent._dict_cache.keys())}")
    
    # Ищем в OBJECTS
    for obj in parser.objects:
        if obj.name == "ACAD_TABLE":
            all_tables.append(("OBJECTS", obj))
        elif obj.name == "TABLEGEOMETRY":
            print(f"\nFound TABLEGEOMETRY in OBJECTS:")
            print(f"  Handle: {obj.handle}")
            print(f"  Codes present: {sorted(obj._dict_cache.keys())}")
        elif obj.name == "TABLECONTENT":
            print(f"\nFound TABLECONTENT in OBJECTS:")
            print(f"  Handle: {obj.handle}")
            print(f"  Codes present: {sorted(obj._dict_cache.keys())}")
        elif obj.name == "TABLESTYLE":
            print(f"\nFound TABLESTYLE in OBJECTS:")
            print(f"  Handle: {obj.handle}")
            print(f"  Name (code 2): {obj.get_value(2)}")
            print(f"  Codes present: {sorted(obj._dict_cache.keys())}")
    
    print(f"\nTotal ACAD_TABLE entities found: {len(all_tables)}")
    
    # Детальный анализ каждой таблицы
    for idx, (section, table) in enumerate(all_tables):
        print(f"\n{'='*80}")
        print(f"TABLE FRAGMENT #{idx+1} (in {section})")
        print(f"{'='*80}")
        print(f"  Handle: {table.get_first_value(5)}")
        print(f"  Owner: {table.get_first_value(330)}")
        print(f"  Layer: {table.get_first_value(8)}")
        print(f"  Insert X (10): {table.get_first_value(10)}")
        print(f"  Insert Y (20): {table.get_first_value(20)}")
        print(f"  Insert Z (30): {table.get_first_value(30)}")
        print(f"  Rows (91): {table.get_first_value(91)}")
        print(f"  Cols (92): {table.get_first_value(92)}")
        print(f"  Style handle (342): {table.get_first_value(342)}")
        print(f"  Block name (2): {table.get_first_value(2)}")
        
        # Критически важные коды для разбиения
        print(f"\n  --- BREAK OPTIONS ---")
        print(f"  Flags (90): {table.get_first_value(90)}")
        print(f"  Break type (93): {table.get_first_value(93)}")
        print(f"  Break height (140): {table.get_first_value(140)}")
        print(f"  Break spacing (141): {table.get_first_value(141)}")
        print(f"  Flow direction (170): {table.get_first_value(170)}")
        print(f"  Max table width (142): {table.get_first_value(142)}")
        print(f"  Max table height (143): {table.get_first_value(143)}")
        
        # Показываем ВСЕ присутствующие коды
        print(f"\n  --- ALL PRESENT CODES ---")
        codes = sorted(table._tag_dict.keys())
        for code in codes:
            values = table.get_values(code)
            if len(values) == 1:
                print(f"    {code}: {values[0]}")
            else:
                print(f"    {code}: {values}")
        
        # Проверяем наличие бинарных данных (310)
        if table.get_values(310):
            binary_data = table.get_values(310)
            print(f"\n  --- BINARY DATA (310) ---")
            print(f"  Count of 310 tags: {len(binary_data)}")
            for i, data in enumerate(binary_data[:3]):  # Первые 3 для примера
                if isinstance(data, str):
                    print(f"    [{i}] Length: {len(data)} chars, Start: {data[:40]}...")
    
    # Анализ BLOCKS
    print(f"\n{'='*80}")
    print("BLOCKS SECTION ANALYSIS")
    print(f"{'='*80}")
    table_blocks = []
    for block in parser.blocks:
        block_name = block.get_value(2)
        if block_name and (block_name.startswith("*T") or "table" in block_name.lower()):
            table_blocks.append(block)
            print(f"\n  Table-related block: {block_name}")
            print(f"    Handle: {block.handle}")
            print(f"    Base X (10): {block.get_value(10)}")
            print(f"    Base Y (20): {block.get_value(20)}")
    
    if not table_blocks:
        # Ищем все блоки
        print(f"\n  All blocks ({len(parser.blocks)}):")
        for block in parser.blocks[:10]:  # Первые 10
            print(f"    - {block.get_value(2)} (Handle: {block.handle})")
        if len(parser.blocks) > 10:
            print(f"    ... and {len(parser.blocks) - 10} more")
    
    # Анализируем содержимое блоков (если есть)
    print(f"\n{'='*80}")
    print("SEARCHING MTEXT/TEXT IN ENTITIES (for cell content)")
    print(f"{'='*80}")
    
    text_entities = []
    for ent in parser.entities:
        if ent.name in ["MTEXT", "TEXT"]:
            text_entities.append(ent)
    
    print(f"Found {len(text_entities)} text entities")
    if text_entities:
        print("\nFirst 10 text entities:")
        for i, ent in enumerate(text_entities[:10]):
            layer = ent.get_value(8)
            insert_x = ent.get_value(10)
            insert_y = ent.get_value(20)
            text = ent.get_value(1)
            style = ent.get_value(7)
            print(f"  [{i}] Layer:{layer} Pos:({insert_x}, {insert_y}) Text:'{text[:50] if text else 'N/A'}...' Style:{style}")

if __name__ == "__main__":
    filename = "acadtable2007.dxf"
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    
    print(f"Analyzing: {filename}")
    analyze_file(filename)
