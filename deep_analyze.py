#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Глубокий анализ acadtable2007.dxf для поиска всех фрагментов таблицы.
Цель: Найти все сущности TABLE и понять логику их разделения.
"""

import sys
import os

# Простой парсер для низкоуровневого анализа без зависимостей
class SimpleDXFAnalyzer:
    def __init__(self, filename):
        self.filename = filename
        self.lines = []
        self.tables_raw = [] # Список сырых данных всех таблиц
        
    def read_file(self):
        encodings = ['utf-8', 'cp1251', 'latin-1']
        for enc in encodings:
            try:
                with open(self.filename, 'r', encoding=enc) as f:
                    self.lines = f.read().splitlines()
                print(f"File read successfully with encoding: {enc}")
                return True
            except UnicodeDecodeError:
                continue
        print("Failed to read file with any known encoding")
        return False

    def analyze(self):
        if not self.lines:
            return

        i = 0
        table_count = 0
        in_entities = False
        in_objects = False
        
        print("\n=== SCANNING ENTITIES AND OBJECTS ===\n")

        while i < len(self.lines):
            line = self.lines[i].strip()
            
            # Определяем секции
            if line == "ENTITIES":
                in_entities = True
                in_objects = False
                print("--- Found ENTITIES section ---")
            elif line == "OBJECTS":
                in_entities = False
                in_objects = True
                print("--- Found OBJECTS section ---")
            elif line == "ENDSEC":
                in_entities = False
                in_objects = False
            
            # Ищем начало сущности TABLE
            if line == "AcDbTable" and (in_entities or in_objects):
                table_count += 1
                print(f"\n>>> FOUND TABLE FRAGMENT #{table_count} at line {i}")
                
                # Считываем блок данных до следующего раздела или сущности
                block_start = i
                block_end = i + 1
                while block_end < len(self.lines):
                    next_line = self.lines[block_end].strip()
                    # Конец сущности: новый AcDb... или ENDSEC или 0 (начало новой сущности)
                    if next_line.startswith("AcDb") and next_line != "AcDbTable":
                        break
                    if next_line == "ENDSEC" or (next_line == "0" and block_end > i + 5):
                        # Проверяем, не является ли 0 частью данных (код группы 0 обычно идет перед именем)
                        # Если это просто "0", то скорее всего это код группы для следующего элемента
                        try:
                            # Смотрим на предыдущую строку, если она была числом, то это значение
                            # Если текущая "0", то это код группы. Следующая должна быть именем сущности
                            if block_end + 1 < len(self.lines):
                                potential_handle = self.lines[block_end+1].strip()
                                if potential_handle == "AcDbTable" or potential_handle.startswith("AcDb"):
                                    break
                        except:
                            pass
                    block_end += 1
                
                # Извлекаем сырые строки для анализа
                raw_block = self.lines[block_start:block_end]
                self.tables_raw.append(raw_block)
                
                # Парсим ключевые коды этого фрагмента
                self._parse_table_fragment(table_count, raw_block)
                
                i = block_end
                continue
            
            i += 1

        print(f"\n=== SUMMARY ===")
        print(f"Total TABLE fragments found: {table_count}")
        
        if table_count == 0:
            print("WARNING: No AcDbTable entities found! Checking for generic TABLE...")
            # Попытка найти по коду 0 TABLE
            self._find_generic_tables()

    def _parse_table_fragment(self, idx, lines):
        """Извлекает важные коды из фрагмента таблицы"""
        data = {}
        i = 0
        while i < len(lines):
            try:
                code_str = lines[i].strip()
                if not code_str.isdigit():
                    i += 1
                    continue
                
                code = int(code_str)
                if i + 1 >= len(lines):
                    break
                value = lines[i+1].strip()
                
                # Сохраняем важные коды
                if code in [5, 330, 8, 10, 20, 30, 90, 91, 92, 93, 94, 95, 96, 97, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 210, 220, 230, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399]:
                    if code not in data:
                        data[code] = []
                    data[code].append(value)
                
                i += 2
            except Exception:
                i += 1

        # Вывод ключевой информации
        handle = data.get(5, ["?"])[0]
        owner = data.get(330, ["?"])[0]
        layer = data.get(8, ["0"])[0]
        
        # Координаты вставки (10, 20, 30)
        x = float(data.get(10, ["0"])[0]) if data.get(10) else 0
        y = float(data.get(20, ["0"])[0]) if data.get(20) else 0
        
        rows = int(data.get(91, ["0"])[0]) if data.get(91) else 0 # Обычно 91 - количество строк
        cols = int(data.get(92, ["0"])[0]) if data.get(92) else 0 # Обычно 92 - количество столбцов
        
        # Коды связи для разделенных таблиц
        # 342 - Handle стиля таблицы
        # 343 - Handle блока записи
        # 344 - Handle предыдущего фрагмента? (нужно проверить спецификацию)
        # 345 - Handle следующего фрагмента?
        
        style_handle = data.get(342, ["None"])[0]
        next_frag = data.get(345, ["None"])[0] # Гипотеза: ссылка на следующий фрагмент
        prev_frag = data.get(344, ["None"])[0] # Гипотеза: ссылка на предыдущий
        
        print(f"  Fragment #{idx}:")
        print(f"    Handle: {handle}")
        print(f"    Owner: {owner}")
        print(f"    Layer: {layer}")
        print(f"    Insert: ({x}, {y})")
        print(f"    Rows (code 91?): {rows}")
        print(f"    Cols (code 92?): {cols}")
        print(f"    Style Handle (342): {style_handle}")
        print(f"    Next Fragment Link (345?): {next_frag}")
        print(f"    Prev Fragment Link (344?): {prev_frag}")
        
        # Вывод всех уникальных кодов, присутствующих в этом фрагменте
        codes_present = sorted([int(k) for k in data.keys()])
        print(f"    Present Group Codes: {codes_present}")
        
        # Особое внимание кодам 300-390 (строковые данные, имена, ссылки)
        str_codes = {k: v for k, v in data.items() if 300 <= int(k) <= 399}
        if str_codes:
            print(f"    String/Handle Codes (300-399):")
            for k, v in sorted(str_codes.items(), key=lambda x: int(x[0])):
                print(f"      Code {k}: {v}")

    def _find_generic_tables(self):
        i = 0
        while i < len(self.lines):
            if self.lines[i].strip() == "TABLE":
                print(f"Found generic TABLE entity at line {i}")
                # Анализ блока
            i += 1

if __name__ == "__main__":
    filename = "acadtable2007.dxf"
    if not os.path.exists(filename):
        print(f"Error: File {filename} not found.")
        sys.exit(1)

    analyzer = SimpleDXFAnalyzer(filename)
    if analyzer.read_file():
        analyzer.analyze()
