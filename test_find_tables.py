#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Исправленный парсер для поиска всех фрагментов таблицы AcDbTable.
"""

from dxf_parser import DXFParser

def find_all_acdb_tables(parser):
    """Найти все сущности содержащие AcDbTable класс."""
    all_tables = []
    
    # Ищем в entities
    for entity in parser.entities:
        # Проверяем все теги на наличие AcDbTable
        has_acdb_table = False
        for tag in entity.tags:
            if tag.code == 100 and tag.value == 'AcDbTable':
                has_acdb_table = True
                break
        
        if has_acdb_table:
            all_tables.append(entity)
            print(f"Found AcDbTable in entity: {entity.name}, Handle: {entity.get_first_value(5, '???')}")
    
    # Также проверяем objects
    for obj in parser.objects:
        has_acdb_table = False
        for tag in obj.tags:
            if tag.code == 100 and tag.value == 'AcDbTable':
                has_acdb_table = True
                break
        
        if has_acdb_table:
            all_tables.append(obj)
            print(f"Found AcDbTable in object: {obj.name}, Handle: {obj.get_first_value(5, '???')}")
    
    return all_tables

if __name__ == "__main__":
    parser = DXFParser("acadtable2007.dxf")
    parser.read()
    
    print(f"\nTotal entities: {len(parser.entities)}")
    print(f"Total objects: {len(parser.objects)}")
    
    tables = find_all_acdb_tables(parser)
    
    print(f"\n=== FOUND {len(tables)} AcDbTable INSTANCES ===\n")
    
    for i, table in enumerate(tables, 1):
        handle = table.get_first_value(5, '???')
        owner = table.get_first_value(330, '???')
        style = table.get_first_value(342, 'None')
        block_rec = table.get_first_value(343, 'None')
        rows = table.get_first_value(90, 0)
        cols = table.get_first_value(91, 0)
        
        print(f"Table #{i}:")
        print(f"  Handle: {handle}")
        print(f"  Owner: {owner}")
        print(f"  Entity Type: {table.name}")
        print(f"  Style Handle (342): {style}")
        print(f"  Block Record (343): {block_rec}")
        print(f"  Rows (90): {rows}")
        print(f"  Cols (91): {cols}")
        
        # Показать все коды группы присутствующие в этой таблице
        codes = sorted(set(tag.code for tag in table.tags))
        print(f"  Present codes: {codes}")
        print()
