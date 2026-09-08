# -*- coding: utf-8 -*-
"""
Глубокий анализ DXF файла для поиска всех фрагментов таблицы
и расшифровки содержимого ячеек
"""

import sys
import struct
from typing import List, Dict, Tuple, Any, Optional

class DXFParser:
    """Низкоуровневый парсер DXF без зависимостей"""
    
    def __init__(self, filename: str):
        self.filename = filename
        self.content = ""
        self.tags = []  # Список кортежей (group_code, value)
        self.sections = {}
        
    def read_file(self):
        """Чтение файла с автоопределением кодировки"""
        encodings = ['utf-8', 'cp1252', 'cp1251', 'latin-1']
        for enc in encodings:
            try:
                with open(self.filename, 'r', encoding=enc) as f:
                    self.content = f.read()
                print(f"File read successfully with encoding: {enc}")
                return True
            except UnicodeDecodeError:
                continue
        print("Failed to read file with any known encoding")
        return False
    
    def parse_tags(self):
        """Парсинг всех тегов DXF"""
        lines = self.content.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line.isdigit() or (line.startswith('-') and line[1:].isdigit()):
                try:
                    group_code = int(line)
                    if i + 1 < len(lines):
                        value = lines[i + 1].strip()
                        self.tags.append((group_code, value))
                        i += 2
                    else:
                        i += 1
                except ValueError:
                    i += 1
            else:
                i += 1
        print(f"Parsed {len(self.tags)} DXF tags")
    
    def find_sections(self):
        """Поиск секций в файле"""
        current_section = None
        section_start = 0
        
        for idx, (code, value) in enumerate(self.tags):
            if code == 0:
                if value == 'SECTION':
                    current_section = 'SECTION'
                    section_start = idx
                elif value == 'ENDSEC':
                    if current_section == 'SECTION':
                        # Найдем имя секции
                        for j in range(section_start, idx):
                            if self.tags[j][0] == 2:
                                sec_name = self.tags[j][1]
                                self.sections[sec_name] = (section_start, idx)
                                break
                    current_section = None
    
    def find_all_tables(self) -> List[Dict]:
        """Поиск всех сущностей TABLE во всем файле"""
        tables = []
        current_entity = None
        current_tags = []
        
        for code, value in self.tags:
            if code == 0:
                if current_entity and current_entity == 'TABLE':
                    tables.append({
                        'type': 'TABLE',
                        'tags': current_tags.copy()
                    })
                elif current_entity and current_entity == 'ACAD_TABLE':
                    tables.append({
                        'type': 'ACAD_TABLE',
                        'tags': current_tags.copy()
                    })
                
                current_entity = value
                current_tags = [(code, value)]
            elif current_entity:
                current_tags.append((code, value))
        
        # Добавим последнюю сущность
        if current_entity and current_entity in ['TABLE', 'ACAD_TABLE']:
            tables.append({
                'type': current_entity,
                'tags': current_tags
            })
        
        return tables
    
    def extract_table_data(self, tags: List[Tuple[int, str]]) -> Dict:
        """Извлечение данных из тегов таблицы"""
        data = {
            'handle': None,
            'owner': None,
            'layer': None,
            'insert_point': None,
            'rows': 0,
            'cols': 0,
            'style_handle': None,
            'block_record': None,
            'title_suppressed': None,
            'direction': None,
            'horiz_dir': None,
            'flow_dir': None,
            'cell_data': [],
            'raw_tags': tags
        }
        
        i = 0
        while i < len(tags):
            code, value = tags[i]
            
            if code == 5:  # Handle
                data['handle'] = value
            elif code == 330:  # Owner
                data['owner'] = value
            elif code == 8:  # Layer
                data['layer'] = value
            elif code == 10:  # Insert X
                try:
                    if i + 6 < len(tags) and tags[i+1][0] == 10 and tags[i+3][0] == 20 and tags[i+5][0] == 30:
                        x = float(tags[i+1][1])
                        y = float(tags[i+3][1])
                        z = float(tags[i+5][1])
                        data['insert_point'] = (x, y, z)
                except (ValueError, IndexError):
                    pass
            elif code == 91:  # Rows
                try:
                    data['rows'] = int(value)
                except ValueError:
                    pass
            elif code == 92:  # Columns
                try:
                    data['cols'] = int(value)
                except ValueError:
                    pass
            elif code == 331:  # Style handle
                data['style_handle'] = value
            elif code == 342:  # Block record
                data['block_record'] = value
            elif code == 280:  # Title suppressed
                try:
                    data['title_suppressed'] = int(value)
                except ValueError:
                    pass
            elif code == 7:  # Direction
                data['direction'] = value
            elif code == 290:  # Horiz dir
                try:
                    data['horiz_dir'] = int(value)
                except ValueError:
                    pass
            elif code == 291:  # Flow dir
                try:
                    data['flow_dir'] = int(value)
                except ValueError:
                    pass
            elif code == 302:  # Cell data start (binary data follows)
                # Пропускаем бинарные данные до следующего тега
                cell_data_block = []
                j = i + 1
                while j < len(tags):
                    next_code = tags[j][0]
                    if next_code >= 0 and next_code < 300:
                        break
                    cell_data_block.append(tags[j])
                    j += 1
                if cell_data_block:
                    data['cell_data'].append(('302_block', cell_data_block))
                i = j - 1
            elif code == 300:  # String data (может содержать информацию о ячейках)
                data['cell_data'].append(('300_string', value))
            elif code == 301:  # Long string data
                data['cell_data'].append(('301_longstring', value))
            elif code == 304:  # Binary data
                data['cell_data'].append(('304_binary', value))
            
            i += 1
        
        return data
    
    def decode_cell_data(self, cell_data_list: List) -> List[Dict]:
        """Декодирование данных ячеек из бинарных блоков"""
        cells = []
        
        for item_type, data in cell_data_list:
            if item_type == '302_block':
                # Попытка декодировать структуру ячеек
                # Формат данных ячеек в ACAD_TABLE сложный бинарный формат
                # Попробуем извлечь текстовые значения
                
                raw_bytes = b''
                for code, val in data:
                    if code == 304:  # Binary data encoded as hex string
                        try:
                            raw_bytes += bytes.fromhex(val.replace(' ', ''))
                        except:
                            pass
                    elif code == 300 or code == 301:
                        # Текстовые данные
                        cells.append({
                            'type': 'text',
                            'content': val
                        })
                
                # Если есть бинарные данные, пробуем их распарсить
                if raw_bytes:
                    parsed_cells = self._parse_binary_cell_data(raw_bytes)
                    cells.extend(parsed_cells)
            
            elif item_type in ['300_string', '301_longstring']:
                # Прямой текст
                if data.strip():
                    cells.append({
                        'type': 'text',
                        'content': data
                    })
        
        return cells
    
    def _parse_binary_cell_data(self, raw_bytes: bytes) -> List[Dict]:
        """Парсинг бинарных данных ячеек AutoCAD"""
        cells = []
        
        # Структура данных ячеек в AutoCAD Table:
        # Это сложный бинарный формат, содержащий:
        # - количество строк/столбцов
        # - информацию о каждой ячейке (тип, текст, стиль, границы и т.д.)
        
        # Попытка найти текстовые строки в бинарных данных
        try:
            # Ищем ASCII строки
            text_parts = []
            current_text = ""
            for byte in raw_bytes:
                if 32 <= byte <= 126:  # Printable ASCII
                    current_text += chr(byte)
                else:
                    if len(current_text) > 2:  # Минимальная длина строки
                        text_parts.append(current_text)
                    current_text = ""
            
            if current_text:
                text_parts.append(current_text)
            
            for part in text_parts:
                # Фильтруем служебные строки
                if len(part) > 1 and not part.startswith('{'):
                    cells.append({
                        'type': 'extracted_text',
                        'content': part
                    })
        except Exception as e:
            print(f"Error parsing binary cell data: {e}")
        
        return cells
    
    def find_acad_table_objects(self) -> List[Dict]:
        """Поиск объектов ACAD_TABLE в секции OBJECTS"""
        objects = []
        in_objects_section = False
        current_object = None
        current_tags = []
        
        section_range = self.sections.get('OBJECTS')
        if not section_range:
            # Попробуем найти во всем файле
            search_tags = self.tags
        else:
            start, end = section_range
            search_tags = self.tags[start:end]
        
        for code, value in search_tags:
            if code == 0:
                if current_object:
                    if 'AcDbTable' in str(current_object) or current_object == 'ACAD_TABLE':
                        objects.append({
                            'type': current_object,
                            'tags': current_tags.copy()
                        })
                
                current_object = value
                current_tags = [(code, value)]
            elif current_object:
                current_tags.append((code, value))
        
        # Добавим последний объект
        if current_object and ('AcDbTable' in str(current_object) or current_object == 'ACAD_TABLE'):
            objects.append({
                'type': current_object,
                'tags': current_tags
            })
        
        return objects


def main():
    print("=" * 60)
    print("ГЛУБОКИЙ АНАЛИЗ DXF ФАЙЛА ДЛЯ ПОИСКА ТАБЛИЦ")
    print("=" * 60)
    
    parser = DXFParser('acadtable2007.dxf')
    
    if not parser.read_file():
        return
    
    parser.parse_tags()
    parser.find_sections()
    
    print(f"\nНайдены секции: {list(parser.sections.keys())}")
    
    # Поиск всех TABLE сущностей
    print("\n" + "=" * 60)
    print("ПОИСК ВСЕХ TABLE СУЩНОСТЕЙ В ENTITIES")
    print("=" * 60)
    
    all_tables = parser.find_all_tables()
    print(f"Всего найдено таблиц: {len(all_tables)}")
    
    for idx, table in enumerate(all_tables, 1):
        print(f"\n{'='*60}")
        print(f"ТАБЛИЦА #{idx} (тип: {table['type']})")
        print(f"{'='*60}")
        
        data = parser.extract_table_data(table['tags'])
        
        print(f"Handle: {data['handle']}")
        print(f"Owner: {data['owner']}")
        print(f"Layer: {data['layer']}")
        print(f"Insert Point: {data['insert_point']}")
        print(f"Rows: {data['rows']}")
        print(f"Columns: {data['cols']}")
        print(f"Style Handle: {data['style_handle']}")
        print(f"Block Record: {data['block_record']}")
        print(f"Title Suppressed: {data['title_suppressed']}")
        print(f"Direction: {data['direction']}")
        print(f"Horiz Dir: {data['horiz_dir']}")
        print(f"Flow Dir: {data['flow_dir']}")
        print(f"Raw Tags Count: {len(data['raw_tags'])}")
        
        # Декодирование ячеек
        if data['cell_data']:
            print(f"\nCell Data Blocks Found: {len(data['cell_data'])}")
            cells = parser.decode_cell_data(data['cell_data'])
            print(f"Decoded Cells: {len(cells)}")
            
            if cells:
                print("\n--- СОДЕРЖИМОЕ ЯЧЕЕК ---")
                for cell_idx, cell in enumerate(cells):
                    content = cell.get('content', '')[:100]  # Первые 100 символов
                    print(f"  Cell {cell_idx}: [{cell['type']}] {repr(content)}")
        
        # Вывод всех уникальных кодов групп
        codes = set(code for code, _ in data['raw_tags'])
        print(f"\nGroup Codes Present: {sorted(codes)}")
    
    # Поиск ACAD_TABLE объектов в OBJECTS
    print("\n" + "=" * 60)
    print("ПОИСК ACAD_TABLE ОБЪЕКТОВ В СЕКЦИИ OBJECTS")
    print("=" * 60)
    
    acad_objects = parser.find_acad_table_objects()
    print(f"Найдено ACAD_TABLE объектов: {len(acad_objects)}")
    
    for idx, obj in enumerate(acad_objects, 1):
        print(f"\n{'='*60}")
        print(f"ACAD_TABLE OBJECT #{idx}")
        print(f"{'='*60}")
        
        data = parser.extract_table_data(obj['tags'])
        
        print(f"Type: {obj['type']}")
        print(f"Handle: {data['handle']}")
        print(f"Rows: {data['rows']}")
        print(f"Columns: {data['cols']}")
        
        if data['cell_data']:
            cells = parser.decode_cell_data(data['cell_data'])
            print(f"Decoded Cells: {len(cells)}")
            if cells:
                print("\n--- CELL CONTENT ---")
                for cell_idx, cell in enumerate(cells):
                    content = cell.get('content', '')[:100]
                    print(f"  Cell {cell_idx}: [{cell['type']}] {repr(content)}")
    
    # Поиск по специфическим кодам для разделенных таблиц
    print("\n" + "=" * 60)
    print("ПОИСК РАЗДЕЛЕННЫХ ФРАГМЕНТОВ ТАБЛИЦЫ")
    print("=" * 60)
    
    # Ищем все упоминания кодов, связанных с таблицами
    table_related_codes = [91, 92, 93, 94, 95, 96, 97, 98, 99, 
                          300, 301, 302, 303, 304, 305, 306, 307,
                          330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342]
    
    fragments = []
    current_fragment = []
    in_table_context = False
    
    for code, value in parser.tags:
        if code == 0 and value in ['TABLE', 'ACAD_TABLE', 'AcDbTable']:
            if current_fragment:
                fragments.append(current_fragment)
            current_fragment = [(code, value)]
            in_table_context = True
        elif in_table_context:
            current_fragment.append((code, value))
            if code == 0 and value not in ['TABLE', 'ACAD_TABLE', 'AcDbTable']:
                # Конец сущности таблицы
                if any(c in table_related_codes for c, _ in current_fragment):
                    fragments.append(current_fragment)
                current_fragment = []
                in_table_context = False
    
    if current_fragment and in_table_context:
        fragments.append(current_fragment)
    
    print(f"Найдено потенциальных фрагментов: {len(fragments)}")
    
    for idx, frag in enumerate(fragments, 1):
        # Проверяем, содержит ли фрагмент данные таблицы
        has_rows = any(code == 91 for code, _ in frag)
        has_cols = any(code == 92 for code, _ in frag)
        
        if has_rows or has_cols:
            print(f"\n--- ФРАГМЕНТ #{idx} ---")
            data = parser.extract_table_data(frag)
            print(f"  Handle: {data['handle']}")
            print(f"  Rows: {data['rows']}")
            print(f"  Cols: {data['cols']}")
            print(f"  Tags: {len(data['raw_tags'])}")
            
            if data['cell_data']:
                cells = parser.decode_cell_data(data['cell_data'])
                print(f"  Cells decoded: {len(cells)}")
                for c_idx, cell in enumerate(cells[:5]):  # Первые 5 ячеек
                    content = cell.get('content', '')[:50]
                    print(f"    Cell {c_idx}: {repr(content)}")
                if len(cells) > 5:
                    print(f"    ... и еще {len(cells) - 5} ячеек")


if __name__ == '__main__':
    main()
