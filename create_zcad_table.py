#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Create ZCAD Table - Main Entry Point

Этот скрипт собирает все компоненты вместе:
1. Загружает определение таблицы.
2. Генерирует DXF-теги.
3. Внедряет их в исходный файл.
"""

import sys
import os

# Импорт локальных модулей
from table_definition import (
    SOURCE_DXF, 
    OUTPUT_DXF, 
    TABLE_FRAGMENTS, 
    COLUMN_WIDTHS, 
    TABLE_DATA,
    TABLE_STYLE_NAME
)
from dxf_table_template import generate_tablestyle_record, generate_acad_table
from dxf_injector import inject_content, save_dxf

def main():
    print("=== DXF Table Injector Started ===")
    
    # Проверка наличия исходного файла
    if not os.path.exists(SOURCE_DXF):
        print(f"ERROR: Source file '{SOURCE_DXF}' not found.")
        sys.exit(1)
        
    # --------------------------------------------------------
    # Шаг 1: Генерация TABLESTYLE (для секции OBJECTS)
    # --------------------------------------------------------
    # Используем фиктивный handle для старта, в реальности нужно брать последний из файла
    # Для упрощения используем случайный большой хекс или инкремент
    start_handle = "1000" 
    owner_handle = "0" # Ссылка на словарь, обычно корень
    
    # Генерируем стиль
    # Примечание: в полной версии нужно прочитать последний handle из файла
    style_content, style_handle, next_handle = generate_tablestyle_record(
        TABLE_STYLE_NAME, 
        start_handle, 
        "0" # Owner dictionary handle placeholder
    )
    
    print(f"Generated TABLESTYLE '{TABLE_STYLE_NAME}' with handle {style_handle}")
    
    # --------------------------------------------------------
    # Шаг 2: Генерация ACAD_TABLE entities (для секции ENTITIES)
    # --------------------------------------------------------
    entities_content = ""
    
    for frag in TABLE_FRAGMENTS:
        print(f"Processing fragment: {frag['name']}")
        
        # Подготовка данных для фрагмента
        frag_data = {
            "name": frag["name"],
            "x": frag["x"],
            "y": frag["y"],
            "z": frag["z"],
            "rows": frag["rows"],
            "column_widths": COLUMN_WIDTHS,
            "data": TABLE_DATA
        }
        
        # Генерация DXF блока для этого фрагмента
        # В реальной функции generate_acad_table должен быть цикл по строкам
        table_content, table_handle, next_handle = generate_acad_table(
            frag_data, 
            style_handle, 
            next_handle, 
            "0" # Owner block handle placeholder
        )
        
        entities_content += table_content + "\n"
        print(f"  -> Generated ACAD_TABLE with handle {table_handle}")
        
    # --------------------------------------------------------
    # Шаг 3: Внедрение в файл
    # --------------------------------------------------------
    print("Injecting data into DXF...")
    
    try:
        modified_lines = inject_content(SOURCE_DXF, style_content, entities_content)
        
        if modified_lines:
            save_dxf(modified_lines, OUTPUT_DXF)
            print("\n=== SUCCESS ===")
            print(f"Result saved to: {OUTPUT_DXF}")
            print("Open this file in AutoCAD to verify the table.")
        else:
            print("\n=== FAILED ===")
            print("Injection failed due to missing sections.")
            
    except Exception as e:
        print(f"\n=== ERROR ===")
        print(f"An exception occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()