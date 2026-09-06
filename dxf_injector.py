"""
DXF Injector Module

Отвечает за:
1. Чтение исходного DXF файла побайтово/построчно.
2. Поиск секций OBJECTS и ENTITIES.
3. Внедрение новых записей (TABLESTYLE в OBJECTS, ACAD_TABLE в ENTITIES).
4. Корректировку счетчиков (если требуется) и сохранение.

Стратегия:
Мы не парсим весь файл в память как дерево объектов (чтобы избежать зависимостей).
Мы работаем с файлом как с потоком текста, находя маркеры секций.
"""

import os

def find_section_lines(content_lines, section_name):
    """
    Находит начальный и конечный индекс секции в списке строк.
    Возвращает (start_index, end_index) или None.
    Секция начинается с '  0\nSECTION' и имени, заканчивается '  0\nENDSEC'.
    """
    in_section = False
    start_idx = -1
    end_idx = -1
    
    i = 0
    while i < len(content_lines):
        line = content_lines[i].strip()
        
        # Проверка на начало секции
        if line == 'SECTION':
            # Проверяем имя секции в следующей паре тегов (обычно 2)
            if i + 2 < len(content_lines):
                name_line = content_lines[i+2].strip()
                if name_line == section_name:
                    in_section = True
                    start_idx = i
                    continue
        
        # Проверка на конец секции
        if in_section and line == 'ENDSEC':
            end_idx = i
            break
            
        i += 1
        
    if in_section and end_idx != -1:
        return start_idx, end_idx
    return None

def inject_content(filepath, objects_content, entities_content):
    """
    Внедряет сгенерированный контент в файл.
    
    Алгоритм:
    1. Читает файл в список строк.
    2. Находит секцию OBJECTS. Вставляет objects_content перед ENDSEC.
    3. Находит секцию ENTITIES. Вставляет entities_content перед ENDSEC.
    4. Сохраняет файл.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Source file {filepath} not found.")
        
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        
    # 1. Инъекция в OBJECTS
    obj_range = find_section_lines(lines, 'OBJECTS')
    if obj_range:
        start, end = obj_range
        # Вставляем перед ENDSEC (индекс end)
        # Разбиваем контент на строки, сохраняя переносы
        new_lines = objects_content.split('\n')
        # Добавляем перенос строки к каждой, если его нет, чтобы сохранить формат
        final_insert = [l + '\n' for l in new_lines if l] 
        lines[end:end] = final_insert
        print(f"[OK] Injected TABLESTYLE into OBJECTS section.")
    else:
        print("[ERROR] OBJECTS section not found!")
        return False
        
    # 2. Инъекция в ENTITIES
    # Важно: искать нужно в обновленном списке lines, но так как мы вставляли в OBJECTS,
    # индексы ENTITIES могли сместиться. Лучше найти заново или учесть смещение.
    # Для простоты найдем заново.
    
    ent_range = find_section_lines(lines, 'ENTITIES')
    if ent_range:
        start, end = ent_range
        new_lines = entities_content.split('\n')
        final_insert = [l + '\n' for l in new_lines if l]
        lines[end:end] = final_insert
        print(f"[OK] Injected ACAD_TABLE into ENTITIES section.")
    else:
        print("[ERROR] ENTITIES section not found!")
        return False
        
    # 3. Сохранение
    output_path = filepath.replace('.dxf', '_new.dxf') # Временное имя, потом переименуем
    # Но в ТЗ要求 OUTPUT_DXF. Передадим имя файла снаружи.
    return lines

def save_dxf(lines, output_path):
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"[SUCCESS] File saved as {output_path}")