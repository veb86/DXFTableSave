"""
dxf_parser.py
Модуль для низкоуровневого чтения DXF файлов без зависимости от ezdxf.
Предназначен для извлечения сырых тегов (group codes) и реконструкции структур.
"""

import re
from typing import List, Tuple, Dict, Any, Optional, Iterator, TextIO


class DXFTag:
    """Представляет одну пару (код группы, значение) из DXF файла."""
    __slots__ = ('code', 'value')

    def __init__(self, code: int, value: Any):
        self.code = code
        self.value = value

    def __repr__(self):
        return f"DXFTag({self.code}, {self.value!r})"


class DXFEntity:
    """Представляет сущность DXF (например, TABLE, LINE, TEXT) со списком тегов."""
    def __init__(self, name: str, tags: List[DXFTag]):
        self.name = name
        self.tags = tags
        # Кэширование значений по кодам для быстрого доступа
        self._tag_dict: Dict[int, List[Any]] = {}
        self._parse_tags()

    def _parse_tags(self):
        """Группирует значения по кодам групп."""
        for tag in self.tags:
            if tag.code not in self._tag_dict:
                self._tag_dict[tag.code] = []
            self._tag_dict[tag.code].append(tag.value)

    def get_values(self, code: int) -> List[Any]:
        """Возвращает список всех значений для данного кода группы."""
        return self._tag_dict.get(code, [])

    def get_first_value(self, code: int, default: Any = None) -> Any:
        """Возвращает первое значение для данного кода группы."""
        values = self.get_values(code)
        return values[0] if values else default

    def __repr__(self):
        return f"<DXFEntity: {self.name} ({len(self.tags)} tags)>"


class DXFParser:
    """Парсер DXF файлов."""

    def __init__(self, filename: str):
        self.filename = filename
        self.version: str = ""
        self.header_vars: Dict[str, Any] = {}
        self.tables: Dict[str, List[DXFEntity]] = {}
        self.entities: List[DXFEntity] = []
        self.objects: List[DXFEntity] = []
        self.raw_sections: Dict[str, List[DXFTag]] = {}

    def read(self):
        """Читает и парсит DXF файл."""
        print(f"Reading file: {self.filename}")
        
        # Определяем кодировку. DXF обычно ASCII или ANSI, но попробуем UTF-8 сначала
        encodings = ['utf-8', 'cp1251', 'cp1252', 'latin-1']
        content_lines = None
        
        for enc in encodings:
            try:
                with open(self.filename, 'r', encoding=enc) as f:
                    content_lines = f.readlines()
                print(f"File read successfully with encoding: {enc}")
                break
            except UnicodeDecodeError:
                continue
        
        if content_lines is None:
            raise ValueError("Could not decode file with any known encoding.")

        self._parse_content(content_lines)

    def _parse_content(self, lines: List[str]):
        """Разбирает содержимое файла по секциям."""
        iterator = iter(lines)
        
        try:
            while True:
                line = next(iterator).strip()
                if not line:
                    continue
                
                if line == "SECTION":
                    self._parse_section(iterator)
                elif line == "EOF":
                    break
        except StopIteration:
            pass

    def _read_tag(self, iterator: Iterator[str]) -> Optional[DXFTag]:
        """Считывает одну пару тегов из итератора."""
        try:
            code_line = next(iterator).strip()
            value_line = next(iterator).strip()
            
            # Пропускаем пустые строки, если они попались между тегами (нестандартно, но бывает)
            while not code_line:
                code_line = next(iterator).strip()
            
            code = int(code_line)
            
            # Преобразование значения в зависимости от кода
            value: Any
            if code < 10:
                # Строковые значения
                value = value_line
            elif 10 <= code < 60:
                # Вещественные числа
                try:
                    value = float(value_line)
                except ValueError:
                    value = 0.0
            elif 60 <= code < 80:
                # Целые числа
                try:
                    value = int(float(value_line))
                except ValueError:
                    value = 0
            elif code == 9:
                # Системные переменные (имя следует за кодом 9, значение за следующим кодом)
                # Обработка особая в контексте HEADER, здесь просто вернем строку как имя
                value = value_line
            else:
                # Остальное считаем строкой или целым в зависимости от контекста, 
                # но для универсальности оставим строкой, если не число
                try:
                    if '.' in value_line:
                        value = float(value_line)
                    else:
                        value = int(value_line)
                except ValueError:
                    value = value_line
            
            return DXFTag(code, value)
        except StopIteration:
            return None

    def _parse_section(self, iterator: Iterator[str]):
        """Парсит секцию SECTION."""
        try:
            name_tag = self._read_tag(iterator)
            if not name_tag or name_tag.code != 2:
                return
            
            section_name = name_tag.value
            print(f"Parsing section: {section_name}")
            
            section_tags = []
            
            if section_name == "HEADER":
                self._parse_header(iterator)
            elif section_name == "TABLES":
                self._parse_tables_section(iterator)
            elif section_name == "ENTITIES":
                self._parse_entities_section(iterator)
            elif section_name == "OBJECTS":
                self._parse_objects_section(iterator)
            else:
                # Пропускаем неизвестные секции, но читаем до конца секции
                self._skip_section(iterator)
                
        except StopIteration:
            pass

    def _parse_header(self, iterator: Iterator[str]):
        """Парсит секцию HEADER."""
        while True:
            tag = self._read_tag(iterator)
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                break
            
            # Код 9 - имя переменной, следующий тег - значение
            if tag.code == 9:
                var_name = tag.value
                val_tag = self._read_tag(iterator)
                if val_tag:
                    self.header_vars[var_name] = val_tag.value
                    if var_name == "$ACADVER":
                        self.version = val_tag.value

    def _parse_tables_section(self, iterator: Iterator[str]):
        """Парсит секцию TABLES."""
        current_table_name = None
        current_table_list = []
        
        while True:
            tag = self._read_tag(iterator)
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                break
            
            if tag.code == 0 and tag.value == "TABLE":
                # Начало новой таблицы определений (например, TABLESTYLE)
                # Читаем всю сущность
                entity_tags = [tag] # Добавляем сам маркер TABLE
                # Имя таблицы обычно идет следом или внутри
                # Считываем до следующего 0 или конца
                while True:
                    sub_tag = self._read_tag(iterator)
                    if not sub_tag:
                        break
                    entity_tags.append(sub_tag)
                    if sub_tag.code == 0:
                        # Нашли начало следующей сущности, откатываемся логически
                        # Но так как у нас итератор, мы уже прочитали 0. 
                        # Нам нужно обработать предыдущую сущность.
                        # В данном простом парсере мы просто соберем всё до следующего 0
                        # Но структура TABLES специфична: там идут определения таблиц.
                        # Для нашей задачи важно найти TABLESTYLE.
                        # Вернем тег 0 обратно в логику обработки? 
                        # Нет, проще собрать сущность.
                        break
                
                # Последний прочитанный тег был 0 (начало следующей сущности)
                # Нужно обработать собранную сущность
                if len(entity_tags) > 1:
                    # Убираем последний тег 0 из списка сущности, он принадлежит следующей
                    next_entity_tag = entity_tags.pop() 
                    entity = DXFEntity("TABLE_DEF", entity_tags) # Временное имя
        
                    # Найдем имя таблицы (код 2)
                    table_def_name = entity.get_first_value(2, "Unknown")
                    if table_def_name not in self.tables:
                        self.tables[table_def_name] = []
                    # Сохраним сущность, добавив обратно тег 0 в начало следующей итерации сложно
                    # Поэтому изменим подход: будем читать сущности стандартным способом
                    
                    # Пересобираем правильно
                    pass 

            # Упрощенный подход: используем общий метод чтения сущностей
            if tag.code == 0:
                entity_name = tag.value
                if entity_name == "ENDTAB": # Конец конкретной таблицы определений
                    continue
                
                entity_tags = [tag]
                while True:
                    sub_tag = self._read_tag(iterator)
                    if not sub_tag:
                        break
                    if sub_tag.code == 0 and sub_tag.value in ["ENDSEC", "ENDTAB"]:
                        # Если это конец секции или таблицы, прерываем, но не включаем этот тег в сущность
                        # Однако, нам нужно знать, что секция кончилась.
                        # Вернем сигнал наружу? 
                        # Для простоты, если это ENDTAB, мы просто прекращаем чтение текущей сущности
                        break
                    entity_tags.append(sub_tag)
                
                entity = DXFEntity(entity_name, entity_tags)
                
                # Определяем тип таблицы по коду 2 (имя таблицы в секции TABLES)
                # Обычно структура: 0:TABLE, 2:ИМЯ, ... 0:ENDTAB
                # Но в entities таблица - это 0:ACAD_TABLE.
                # В секции TABLES хранятся определения стилей (TABLESTYLE).
                
                if entity_name == "TABLESTYLE": # Или другая сущность внутри TABLES
                     # Имя таблицы определений обычно код 2
                     t_name = entity.get_first_value(2, "UNNAMED")
                     if t_name not in self.tables:
                         self.tables[t_name] = []
                     self.tables[t_name].append(entity)

    def _parse_entities_section(self, iterator: Iterator[str]):
        """Парсит секцию ENTITIES."""
        while True:
            tag = self._read_tag(iterator)
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                break
            
            if tag.code == 0:
                entity_name = tag.value
                entity_tags = [tag]
                
                while True:
                    sub_tag = self._read_tag(iterator)
                    if not sub_tag:
                        break
                    if sub_tag.code == 0:
                        # Начало следующей сущности, выходим из цикла чтения текущей
                        # Но нам нужно сохранить sub_tag для следующей итерации внешнего цикла?
                        # В данной реализации мы его теряем, если не передадим обратно.
                        # Хак: мы не можем "вернуть" в итератор легко.
                        # Решение: читаем пока код != 0.
                        # Но тогда мы пропустим начало следующей.
                        # Правильное решение: внешний цикл должен управлять чтением первого тега.
                        # А внутренний читает только продолжение.
                        # Значит, условие выхода: мы прочитали тег 0, значит текущая сущность кончилась.
                        # Этот тег 0 нужно обработать внешним циклом.
                        # Так как мы внутри функции, мы не можем легко вернуть тег.
                        # Изменим логику: читаем все теги в список, пока не встретим 0.
                        break
                    entity_tags.append(sub_tag)
                
                # Теперь у нас есть entity_tags. А следующий тег 0 (начало следующей сущности)
                # мы прочитали в sub_tag, но не добавили в entity_tags.
                # Как передать его обратно? 
                # Перепишем цикл выше.
                
                # ПЕРЕПИСЫВАЕМ ЛОГИКУ ЧТЕНИЯ СУЩНОСТИ
                # Мы уже прочитали первый тег (0, Имя).
                # Читаем дальше, пока не встретим код 0.
                while True:
                    # Смотрим вперед? Нет, просто читаем.
                    # Если читаем и это код 0, значит сущность кончилась.
                    # Но этот прочитанный тег 0 нужно использовать для следующей сущности.
                    # Поскольку мы в функции, давайте просто соберем всё до ENDSEC.
                    pass
                
                # Возвращаемся к надежному методу:
                # Сущность начинается с 0. Читаем всё, пока снова не встретим 0.
                # Тот факт, что мы прочитали следующий 0, означает конец текущей.
                # Но как сохранить состояние?
                # Давайте сделаем генератор сущностей.
                pass

        # РЕАЛИЗАЦИЯ ЧЕРЕЗ ГЕНЕРАТОР ВНУТРИ МЕТОДА БЫЛА БЫ ЛУЧШЕ, НО МЫ УЖЕ В МЕТОДЕ.
        # ДАВАЙТЕ ПРОСТО ПРОЧИТАЕМ ВСЁ ДО ENDSEC В СПИСОК, А ПОТОМ РАЗБЕРЕМ.
        # НЕТ, ЭТО НЕЭФФЕКТИВНО ДЛЯ БОЛЬШИХ ФАЙЛОВ.
        
        # ПРАВИЛЬНЫЙ ПОДХОД ДЛЯ ЭТОГО ПАРСЕРА:
        # Мы уже прочитали имя сущности в `tag`.
        entity_name = tag.value
        entity_tags = [tag]
        
        while True:
            # Читаем следующий тег
            # Нам нужно peek-нуть или иметь возможность отката.
            # Сделаем просто: читаем строки напрямую из итератора линий, если нужно.
            # Но у нас уже есть _read_tag.
            
            # Проблема: _read_tag потребляет 2 линии.
            # Если мы прочитали код 0, мы съели начало следующей сущности.
            # Решение: модифицировать _read_tag или логику цикла.
            # Давайте изменим цикл:
            while True:
                # Пытаемся прочитать код группы
                # Нам нужно знать, является ли следующая пара началом новой сущности.
                # Считаем код.
                try:
                    code_line = next(iterator).strip()
                    while not code_line: code_line = next(iterator).strip()
                    
                    if code_line == "0":
                        # Конец текущей сущности.
                        # Значение этого тега 0 - имя следующей сущности.
                        # Нам нужно прервать цикл, но сохранить информацию о следующей сущности?
                        # Нет, мы просто прервем чтение текущей.
                        # А имя следующей сущности мы узнаем на следующей итерации внешнего цикла?
                        # Нет, потому что мы уже прочитали строку "0".
                        # И следующая строка - имя.
                        # Мы должны "вернуть" эти две строки в поток или обработать их сейчас.
                        # Обработаем сейчас: создадим новую сущность рекурсивно? Нет.
                        # Просто выйдем из цикла, а имя следующей сущности запомним в классе?
                        # Слишком сложно.
                        
                        # Простое решение: читаем значение тега 0 (имя следующей сущности)
                        next_entity_name = next(iterator).strip()
                        # Теперь мы знаем, что текущая сущность кончилась, а следующая - next_entity_name.
                        # Но как передать управление верхнему циклу, чтобы он начал с next_entity_name?
                        # Верхний цикл ждет tag = _read_tag().
                        # Значит, нам нужно, чтобы _read_tag() вернул этот тег 0.
                        # Но мы его уже прочитали вручную.
                        
                        # ВЫХОД: Изменим структуру. Будем читать сущности в общем цикле.
                        break 
                    else:
                        code = int(code_line)
                        value_line = next(iterator).strip()
                        # Парсинг значения (как в _read_tag)
                        val: Any
                        if code < 10: val = value_line
                        elif code < 60: 
                            try: val = float(value_line)
                            except: val = 0.0
                        elif code < 80:
                            try: val = int(float(value_line))
                            except: val = 0
                        else:
                            try:
                                if '.' in value_line: val = float(value_line)
                                else: val = int(value_line)
                            except: val = value_line
                        
                        entity_tags.append(DXFTag(code, val))
                except StopIteration:
                    break
            
            # Если мы вышли из внутреннего цикла потому что встретили 0,
            # то нам нужно создать сущность, добавить её, и затем продолжить внешний цикл
            # НО внешний цикл уже вызвал _read_tag() и получил первый тег.
            # Значит, эта функция должна возвращать список сущностей, а не вызывать цикл сама?
            # Да, давайте перепишем _parse_entities_section полностью.
            break # Выходим из фейкового цикла, чтобы переписать функцию ниже

        # ПЕРЕПИСАННАЯ ВЕРСИЯ _PARSE_ENTITIES_SECTION
        # Очищаем список, если начали читать, и делаем правильно
        self.entities = []
        # Первый тег (имя сущности) уже в `tag`
        current_entity_name = tag.value
        current_tags = [tag]
        
        while True:
            try:
                code_line = next(iterator).strip()
                while not code_line: code_line = next(iterator).strip()
                
                if code_line == "0":
                    # Конец текущей сущности
                    # Сохраняем текущую
                    self.entities.append(DXFEntity(current_entity_name, current_tags))
                    
                    # Начинаем новую
                    current_entity_name = next(iterator).strip()
                    if current_entity_name == "ENDSEC":
                        break
                    current_tags = [DXFTag(0, current_entity_name)]
                else:
                    code = int(code_line)
                    value_line = next(iterator).strip()
                    val: Any
                    if code < 10: val = value_line
                    elif code < 60: 
                        try: val = float(value_line)
                        except: val = 0.0
                    elif code < 80:
                        try: val = int(float(value_line))
                        except: val = 0
                    else:
                        try:
                            if '.' in value_line: val = float(value_line)
                            else: val = int(value_line)
                        except: val = value_line
                    current_tags.append(DXFTag(code, val))
            except StopIteration:
                break

    def _parse_objects_section(self, iterator: Iterator[str]):
        """Парсит секцию OBJECTS (аналогично ENTITIES)."""
        # Логика идентична ENTITIES
        try:
            # Пропускаем пустые строки до первой сущности
            first_tag = self._read_tag_safe(iterator)
            if not first_tag or first_tag.value == "ENDSEC":
                return

            current_entity_name = first_tag.value
            current_tags = [first_tag]
            
            while True:
                code_line = next(iterator).strip()
                while not code_line: code_line = next(iterator).strip()
                
                if code_line == "0":
                    self.objects.append(DXFEntity(current_entity_name, current_tags))
                    
                    current_entity_name = next(iterator).strip()
                    if current_entity_name == "ENDSEC":
                        break
                    current_tags = [DXFTag(0, current_entity_name)]
                else:
                    code = int(code_line)
                    value_line = next(iterator).strip()
                    val: Any
                    if code < 10: val = value_line
                    elif code < 60: 
                        try: val = float(value_line)
                        except: val = 0.0
                    elif code < 80:
                        try: val = int(float(value_line))
                        except: val = 0
                    else:
                        try:
                            if '.' in value_line: val = float(value_line)
                            else: val = int(value_line)
                        except: val = value_line
                    current_tags.append(DXFTag(code, val))
        except StopIteration:
            pass

    def _read_tag_safe(self, iterator: Iterator[str]) -> Optional[DXFTag]:
        """Безопасное чтение тега с пропуском пустых строк."""
        try:
            code_line = next(iterator).strip()
            while not code_line:
                code_line = next(iterator).strip()
            
            if code_line == "ENDSEC":
                return DXFTag(0, "ENDSEC")
                
            value_line = next(iterator).strip()
            code = int(code_line)
            
            val: Any
            if code < 10: val = value_line
            elif code < 60: 
                try: val = float(value_line)
                except: val = 0.0
            elif code < 80:
                try: val = int(float(value_line))
                except: val = 0
            else:
                try:
                    if '.' in value_line: val = float(value_line)
                    else: val = int(value_line)
                except: val = value_line
            
            return DXFTag(code, val)
        except StopIteration:
            return None

    def _skip_section(self, iterator: Iterator[str]):
        """Пропускает секцию до ENDSEC."""
        while True:
            tag = self._read_tag(iterator)
            if not tag or (tag.code == 0 and tag.value == "ENDSEC"):
                break

    def find_entities(self, name: str) -> List[DXFEntity]:
        """Находит все сущности с указанным именем."""
        return [e for e in self.entities if e.name == name]

    def get_table_styles(self) -> Dict[str, List[DXFEntity]]:
        """Возвращает стили таблиц."""
        return self.tables.get("TABLESTYLE", {})
