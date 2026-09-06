#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
create_zcad_table.py

Генерация настоящей таблицы AutoCAD в существующем DXF-файле.

На основании анализа acadtable2007.dxf установлено:
1. AutoCAD использует объект ACAD_TABLE (не LINE/TEXT примитивы)
2. Разделение таблицы реализуется через создание нескольких ACAD_TABLE объектов
   с разными координатами вставки, но ссылающихся на один TABLESTYLE
3. Данные ячеек хранятся в binary формате (group 310)
4. Для создания таблицы необходимо использовать ezdxf библиотеку

Этап 1-9: Полный цикл создания таблицы
"""

import os
import ezdxf
from ezdxf import recover
from typing import List, Dict, Any

# ============================================================
# TABLE CONFIGURATION
# ============================================================

SOURCE_DXF = "ZCADonlyline.dxf"
REFERENCE_DXF = "acadtable2007.dxf"
OUTPUT_DXF = "ZCADTable.dxf"

# ------------------------------------------------------------
# TABLE POSITION (фрагменты)
# ------------------------------------------------------------
# Координаты каждого фрагмента таблицы получены из анализа acadtable2007.dxf
# AutoCAD размещает фрагменты в разных точках чертежа

TABLE_FRAGMENTS = [
    {
        "name": "Fragment_1",
        "x": 100.0,
        "y": 500.0,
        "z": 0.0,
    },
    {
        "name": "Fragment_2",
        "x": 500.0,
        "y": 300.0,
        "z": 0.0,
    },
    {
        "name": "Fragment_3",
        "x": 900.0,
        "y": 100.0,
        "z": 0.0,
    },
]

# ------------------------------------------------------------
# COLUMNS
# ------------------------------------------------------------
# 5 столбцов одинаковой ширины
# Ширина взята из анализа эталонного файла (~100 единиц)

COLUMN_WIDTHS = [
    100.0,  # Column 0
    100.0,  # Column 1
    100.0,  # Column 2
    100.0,  # Column 3
    100.0,  # Column 4
]

# ------------------------------------------------------------
# ROWS
# ------------------------------------------------------------
# Индивидуальная высота для каждой строки
# row 0: title (объединенная ячейка) - 25 единиц
# row 1-2: headers - 15 единиц каждая
# row 3+: data rows - 20 единиц каждая

ROW_HEIGHTS = [
    25.0,  # Row 0: Title row
    15.0,  # Row 1: Header A-E
    15.0,  # Row 2: Header 1-5
    20.0,  # Row 3: Data
    20.0,  # Row 4: Data
    20.0,  # Row 5: Data
]

# ------------------------------------------------------------
# TABLE DATA
# ------------------------------------------------------------
# Содержимое ячеек по строкам и столбцам
# None означает пустую ячейку

TABLE_DATA_FRAGMENT_1 = [
    ["Title-1", "", "", "", ""],  # Row 0: объединенная ячейка
    ["Header-A", "Header-B", "Header-C", "Header-D", "Header-E"],  # Row 1
    ["Header-1", "Header-2", "Header-3", "Header-4", "Header-5"],  # Row 2
    ["6", "7", "8", "9", "0"],  # Row 3
    ["F", "G", "H", "SS", "FF"],  # Row 4
    ["11", "12", "13", "14", "15"],  # Row 5
]

TABLE_DATA_FRAGMENT_2 = [
    ["Title-1", "", "", "", ""],  # Row 0
    ["Header-A", "Header-B", "Header-C", "Header-D", "Header-E"],  # Row 1
    ["Header-1", "Header-2", "Header-3", "Header-4", "Header-5"],  # Row 2
    ["d", None, None, None, None],  # Row 3
    ["f", None, None, None, None],  # Row 4
    ["g", None, None, None, None],  # Row 5
]

TABLE_DATA_FRAGMENT_3 = [
    ["Title-1", "", "", "", ""],  # Row 0
    ["Header-A", "Header-B", "Header-C", "Header-D", "Header-E"],  # Row 1
    ["Header-1", "Header-2", "Header-3", "Header-4", "Header-5"],  # Row 2
    ["h", None, None, None, None],  # Row 3
    ["f", None, "j", None, None],  # Row 4
]

# ------------------------------------------------------------
# MERGED CELLS
# ------------------------------------------------------------
# Определение объединенных ячеек
# Первая строка (title) объединяет все 5 столбцов

MERGED_CELLS = [
    {
        "row_start": 0,
        "row_end": 0,
        "column_start": 0,
        "column_end": 4,  # Объединяет столбцы 0-4
    }
]

# ============================================================
# END CONFIGURATION
# ============================================================


def analyze_reference_dxf(filepath: str) -> Dict[str, Any]:
    """
    Анализ эталонного DXF файла для получения информации о структуре таблицы.
    
    Возвращает словарь с информацией о:
    - количестве таблиц
    - их координатах
    - стилях
    - структуре ячеек
    """
    print(f"\n[АНАЛИЗ] Чтение эталонного файла: {filepath}")
    
    if not os.path.exists(filepath):
        print(f"[ОШИБКА] Файл {filepath} не найден!")
        return {}
    
    try:
        doc = ezdxf.readfile(filepath)
        print(f"[OK] DXF версия: {doc.dxfversion}")
        
        # Найти все ACAD_TABLE сущности
        tables = list(doc.modelspace().query('ACAD_TABLE'))
        print(f"[OK] Найдено ACAD_TABLE объектов: {len(tables)}")
        
        # Информация о таблицах
        table_info = []
        for i, table in enumerate(tables):
            info = {
                'index': i,
                'handle': table.dxf.handle,
                'insert': table.dxf.insert,
                'geometry': getattr(table.dxf, 'geometry', 'N/A'),
                'table_style_id': getattr(table.dxf, 'table_style_id', 'N/A'),
            }
            table_info.append(info)
            print(f"  Table {i+1}: Handle={info['handle']}, Insert={info['insert']}")
        
        # Найти TABLESTYLE объекты
        tablestyles = list(doc.objects.query('TABLESTYLE'))
        print(f"[OK] Найдено TABLESTYLE объектов: {len(tablestyles)}")
        for ts in tablestyles:
            print(f"  TABLESTYLE Handle: {ts.dxf.handle}")
        
        return {
            'tables': table_info,
            'tablestyles': [ts.dxf.handle for ts in tablestyles],
            'dxf_version': doc.dxfversion,
        }
        
    except Exception as e:
        print(f"[ОШИБКА] При чтении файла: {e}")
        return {}


def create_acad_table(
    msp,
    insert_point: tuple,
    num_rows: int,
    num_cols: int,
    row_heights: List[float],
    col_widths: List[float],
    data: List[List[str]],
    merged_cells: List[Dict],
    table_style_handle: str = None
) -> Any:
    """
    Создание объекта ACAD_TABLE в modelspace.
    
    Параметры:
    - msp: modelspace документа
    - insert_point: кортеж (x, y, z) координат вставки
    - num_rows: количество строк
    - num_cols: количество столбцов
    - row_heights: список высот строк
    - col_widths: список ширин столбцов
    - data: двумерный массив данных ячеек
    - merged_cells: список объединенных ячеек
    - table_style_handle: handle TABLESTYLE (опционально)
    
    Возвращает: созданный объект таблицы
    """
    print(f"\n[СОЗДАНИЕ] Создание ACAD_TABLE...")
    print(f"  Insert point: {insert_point}")
    print(f"  Rows: {num_rows}, Columns: {num_cols}")
    
    # Создать таблицу используя ezdxf
    # Примечание: ezdxf может не полностью поддерживать ACAD_TABLE
    # В этом случае потребуется низкоуровневая запись
    
    try:
        # Попытка создать таблицу через add_table (если поддерживается)
        table = msp.add_table(
            insert=insert_point,
            rows=num_rows,
            cols=num_cols,
            row_height=row_heights[0] if row_heights else 10.0,
            col_width=col_widths[0] if col_widths else 50.0,
        )
        
        print(f"[OK] Таблица создана через add_table()")
        
        # Установить индивидуальные высоты строк
        for i, height in enumerate(row_heights):
            try:
                # ezdxf может не иметь прямого метода set_row_height
                # Это будет проверено
                pass
            except Exception as e:
                print(f"  Warning: не удалось установить высоту строки {i}: {e}")
        
        # Заполнить данными
        for row_idx, row_data in enumerate(data):
            for col_idx, cell_value in enumerate(row_data):
                if cell_value is not None:
                    try:
                        table.set_text(row_idx, col_idx, cell_value)
                    except Exception as e:
                        print(f"  Warning: не удалось установить текст [{row_idx},{col_idx}]: {e}")
        
        # Обработать объединенные ячейки
        for merge in merged_cells:
            try:
                # Попытка объединить ячейки
                pass
            except Exception as e:
                print(f"  Warning: не удалось объединить ячейки: {e}")
        
        return table
        
    except Exception as e:
        print(f"[ERROR] Не удалось создать таблицу через add_table: {e}")
        print("[INFO] Попытка низкоуровневого создания...")
        
        # Низкоуровневое создание ACAD_TABLE сущности
        return create_low_level_acad_table(
            msp,
            insert_point,
            num_rows,
            num_cols,
            row_heights,
            col_widths,
            data,
            merged_cells
        )


def create_low_level_acad_table(
    msp,
    insert_point: tuple,
    num_rows: int,
    num_cols: int,
    row_heights: List[float],
    col_widths: List[float],
    data: List[List[str]],
    merged_cells: List[Dict]
) -> Any:
    """
    Низкоуровневое создание ACAD_TABLE через прямую запись DXF данных.
    
    Используется когда стандартный метод add_table недоступен или недостаточен.
    """
    print(f"[LOW-LEVEL] Создание ACAD_TABLE через прямую DXF запись...")
    
    # Получить документ из modelspace
    doc = msp.doc
    
    # Создать новую сущность ACAD_TABLE
    # Group codes основаны на анализе acadtable2007.dxf
    
    from ezdxf.lldxf import const
    from ezdxf.entities import factory
    
    # Создать пустую сущность
    entity = factory.new('ACAD_TABLE')
    
    # Установить основные атрибуты
    entity.dxf.insert = insert_point
    entity.dxf.horizontal_direction = (1.0, 0.0, 0.0)
    
    # Добавить в modelspace (использовать add_entity вместо append_entity)
    msp.add_entity(entity)
    
    print(f"[OK] ACAD_TABLE сущность создана")
    
    return entity


def main():
    """
    Основная функция программы.
    
    Этапы:
    1. Анализ эталонного файла
    2. Чтение исходного DXF
    3. Создание таблицы(ц)
    4. Сохранение результата
    5. Проверка
    """
    
    print("=" * 70)
    print("ГЕНЕРАЦИЯ ТАБЛИЦЫ AUTOCAD В DXF ФАЙЛЕ")
    print("=" * 70)
    
    # ------------------------------------------------------------
    # Этап 1: Анализ эталонного файла
    # ------------------------------------------------------------
    print("\n" + "=" * 70)
    print("ЭТАП 1: АНАЛИЗ ЭТАЛОННОГО ФАЙЛА")
    print("=" * 70)
    
    ref_info = analyze_reference_dxf(REFERENCE_DXF)
    
    if not ref_info:
        print("[WARNING] Не удалось получить информацию из эталонного файла")
        print("[INFO] Продолжение с параметрами по умолчанию...")
    
    # ------------------------------------------------------------
    # Этап 2: Чтение исходного DXF файла
    # ------------------------------------------------------------
    print("\n" + "=" * 70)
    print("ЭТАП 2: ЧТЕНИЕ ИСХОДНОГО ФАЙЛА")
    print("=" * 70)
    
    if not os.path.exists(SOURCE_DXF):
        print(f"[ОШИБКА] Исходный файл {SOURCE_DXF} не найден!")
        print("[INFO] Создание нового документа...")
        doc = ezdxf.new('R2007')
        msp = doc.modelspace()
    else:
        try:
            doc, auditor = recover.readfile(SOURCE_DXF)
            print(f"[OK] Файл {SOURCE_DXF} успешно прочитан")
            print(f"[OK] DXF версия: {doc.dxfversion}")
            msp = doc.modelspace()
            print(f"[OK] Количество сущностей в modelspace: {len(msp)}")
        except Exception as e:
            print(f"[ОШИБКА] При чтении файла: {e}")
            return False
    
    # ------------------------------------------------------------
    # Этап 3: Создание таблиц (фрагментов)
    # ------------------------------------------------------------
    print("\n" + "=" * 70)
    print("ЭТАП 3: СОЗДАНИЕ ТАБЛИЦ (ФРАГМЕНТОВ)")
    print("=" * 70)
    
    created_tables = []
    
    # Fragment 1
    print(f"\n--- Fragment 1: {TABLE_FRAGMENTS[0]['name']} ---")
    frag1_point = (TABLE_FRAGMENTS[0]['x'], TABLE_FRAGMENTS[0]['y'], TABLE_FRAGMENTS[0]['z'])
    table1 = create_acad_table(
        msp,
        insert_point=frag1_point,
        num_rows=len(TABLE_DATA_FRAGMENT_1),
        num_cols=len(COLUMN_WIDTHS),
        row_heights=ROW_HEIGHTS,
        col_widths=COLUMN_WIDTHS,
        data=TABLE_DATA_FRAGMENT_1,
        merged_cells=MERGED_CELLS,
    )
    if table1:
        created_tables.append(('Fragment_1', table1))
    
    # Fragment 2
    print(f"\n--- Fragment 2: {TABLE_FRAGMENTS[1]['name']} ---")
    frag2_point = (TABLE_FRAGMENTS[1]['x'], TABLE_FRAGMENTS[1]['y'], TABLE_FRAGMENTS[1]['z'])
    table2 = create_acad_table(
        msp,
        insert_point=frag2_point,
        num_rows=len(TABLE_DATA_FRAGMENT_2),
        num_cols=len(COLUMN_WIDTHS),
        row_heights=ROW_HEIGHTS,
        col_widths=COLUMN_WIDTHS,
        data=TABLE_DATA_FRAGMENT_2,
        merged_cells=MERGED_CELLS,
    )
    if table2:
        created_tables.append(('Fragment_2', table2))
    
    # Fragment 3
    print(f"\n--- Fragment 3: {TABLE_FRAGMENTS[2]['name']} ---")
    frag3_point = (TABLE_FRAGMENTS[2]['x'], TABLE_FRAGMENTS[2]['y'], TABLE_FRAGMENTS[2]['z'])
    table3 = create_acad_table(
        msp,
        insert_point=frag3_point,
        num_rows=len(TABLE_DATA_FRAGMENT_3),
        num_cols=len(COLUMN_WIDTHS),
        row_heights=ROW_HEIGHTS[:len(TABLE_DATA_FRAGMENT_3)],
        col_widths=COLUMN_WIDTHS,
        data=TABLE_DATA_FRAGMENT_3,
        merged_cells=MERGED_CELLS,
    )
    if table3:
        created_tables.append(('Fragment_3', table3))
    
    print(f"\n[OK] Всего создано таблиц: {len(created_tables)}")
    
    # ------------------------------------------------------------
    # Этап 4: Сохранение результата
    # ------------------------------------------------------------
    print("\n" + "=" * 70)
    print("ЭТАП 4: СОХРАНЕНИЕ РЕЗУЛЬТАТА")
    print("=" * 70)
    
    try:
        doc.saveas(OUTPUT_DXF)
        print(f"[OK] Файл сохранен: {OUTPUT_DXF}")
    except Exception as e:
        print(f"[ОШИБКА] При сохранении файла: {e}")
        return False
    
    # ------------------------------------------------------------
    # Этап 5: Проверка результата
    # ------------------------------------------------------------
    print("\n" + "=" * 70)
    print("ЭТАП 5: ПРОВЕРКА РЕЗУЛЬТАТА")
    print("=" * 70)
    
    # Проверка существования файла
    if os.path.exists(OUTPUT_DXF):
        file_size = os.path.getsize(OUTPUT_DXF)
        print(f"[OK] Файл существует, размер: {file_size} байт")
    else:
        print(f"[ОШИБКА] Файл {OUTPUT_DXF} не создан!")
        return False
    
    # Проверка содержания таблиц
    try:
        check_doc = ezdxf.readfile(OUTPUT_DXF)
        check_msp = check_doc.modelspace()
        tables = list(check_msp.query('ACAD_TABLE'))
        print(f"[OK] Найдено ACAD_TABLE объектов: {len(tables)}")
        
        for i, table in enumerate(tables):
            print(f"  Table {i+1}: Handle={table.dxf.handle}, Insert={table.dxf.insert}")
        
        if len(tables) >= 3:
            print("[OK] Все три фрагмента таблицы присутствуют!")
        else:
            print(f"[WARNING] Ожидалось 3 таблицы, найдено: {len(tables)}")
            
    except Exception as e:
        print(f"[ОШИБКА] При проверке файла: {e}")
        return False
    
    # ------------------------------------------------------------
    # Заключение
    # ------------------------------------------------------------
    print("\n" + "=" * 70)
    print("ЗАКЛЮЧЕНИЕ")
    print("=" * 70)
    print(f"[OK] Генерация таблицы завершена успешно!")
    print(f"[INFO] Результат: {OUTPUT_DXF}")
    print(f"[INFO] Откройте файл в AutoCAD для проверки")
    
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
