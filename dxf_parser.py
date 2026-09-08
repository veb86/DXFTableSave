"""
dxf_parser.py
Модуль для низкоуровневого чтения DXF файлов без зависимости от ezdxf.
Предназначен для извлечения сырых тегов (group codes) и реконструкции структур.
"""

from typing import List, Dict, Any, Optional


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

    def get_all_tags(self) -> List[DXFTag]:
        """Возвращает все теги сущности."""
        return self.tags

    def has_code(self, code: int) -> bool:
        """Проверяет наличие кода группы в сущности."""
        return code in self._tag_dict

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
        self.lines: List[str] = []
        self.line_index: int = 0

    def read(self):
        """Читает и парсит DXF файл."""
        print(f"Reading file: {self.filename}")
        
        # Определяем кодировку
        encodings = ['utf-8', 'cp1251', 'cp1252', 'latin-1']
        
        for enc in encodings:
            try:
                with open(self.filename, 'r', encoding=enc) as f:
                    self.lines = f.readlines()
                print(f"File read successfully with encoding: {enc}")
                break
            except UnicodeDecodeError:
                continue
        
        if not self.lines:
            raise ValueError("Could not decode file with any known encoding.")

        self.line_index = 0
        self._parse_content()

    def _get_next_line(self) -> Optional[str]:
        """Получает следующую строку, пропуская пустые."""
        while self.line_index < len(self.lines):
            line = self.lines[self.line_index]
            self.line_index += 1
            stripped = line.strip()
            if stripped:
                return stripped
        return None

    def _read_tag(self) -> Optional[DXFTag]:
        """Считывает одну пару тегов из файла."""
        code_line = self._get_next_line()
        if not code_line:
            return None
        
        value_line = self._get_next_line()
        if not value_line:
            return None
        
        try:
            code = int(code_line)
        except ValueError:
            return self._read_tag()
        
        # Преобразование значения в зависимости от кода
        value: Any
        if code < 10:
            value = value_line
        elif 10 <= code < 60:
            try:
                value = float(value_line)
            except ValueError:
                value = 0.0
        elif 60 <= code < 80:
            try:
                value = int(float(value_line))
            except ValueError:
                value = 0
        elif code == 9:
            value = value_line
        else:
            try:
                if '.' in value_line:
                    value = float(value_line)
                else:
                    value = int(value_line)
            except ValueError:
                value = value_line
        
        return DXFTag(code, value)

    def _read_entity(self, first_tag: DXFTag) -> DXFEntity:
        """Читает сущность начиная с уже прочитанного первого тега."""
        entity_tags = [first_tag]
        
        while True:
            tag = self._read_tag()
            if not tag:
                break
            if tag.code == 0:
                # Начало следующей сущности - откатываем индекс на 2 строки
                self.line_index -= 2
                break
            entity_tags.append(tag)
        
        entity_name = first_tag.value
        return DXFEntity(entity_name, entity_tags)

    def _parse_content(self):
        """Разбирает содержимое файла по секциям."""
        while True:
            tag = self._read_tag()
            if not tag:
                break
            
            if tag.code == 0:
                if tag.value == "SECTION":
                    self._parse_section()
                elif tag.value == "EOF":
                    break

    def _parse_section(self):
        """Парсит секцию SECTION."""
        name_tag = self._read_tag()
        if not name_tag or name_tag.code != 2:
            return
        
        section_name = name_tag.value
        print(f"Parsing section: {section_name}")
        
        if section_name == "HEADER":
            self._parse_header()
        elif section_name == "CLASSES":
            self._skip_section()
        elif section_name == "TABLES":
            self._parse_tables_section()
        elif section_name == "ENTITIES":
            self._parse_entities_section()
        elif section_name == "OBJECTS":
            self._parse_objects_section()
        else:
            self._skip_section()

    def _parse_header(self):
        """Парсит секцию HEADER."""
        while True:
            tag = self._read_tag()
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                break
            
            if tag.code == 9:
                var_name = tag.value
                val_tag = self._read_tag()
                if val_tag:
                    self.header_vars[var_name] = val_tag.value
                    if var_name == "$ACADVER":
                        self.version = val_tag.value

    def _skip_section(self):
        """Пропускает секцию до ENDSEC."""
        while True:
            tag = self._read_tag()
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                break

    def _parse_tables_section(self):
        """Парсит секцию TABLES."""
        while True:
            tag = self._read_tag()
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                break
            
            if tag.code == 0:
                entity = self._read_entity(tag)
                # В секции TABLES обычно хранятся определения таблиц (TABLESTYLE и др.)
                # Имя таблицы определений обычно в коде 2
                table_def_name = entity.get_first_value(2, "UNNAMED")
                if table_def_name not in self.tables:
                    self.tables[table_def_name] = []
                self.tables[table_def_name].append(entity)

    def _parse_entities_section(self):
        """Парсит секцию ENTITIES."""
        count = 0
        while True:
            tag = self._read_tag()
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                print(f"  Parsed {count} entities.")
                break
            
            if tag.code == 0:
                entity = self._read_entity(tag)
                self.entities.append(entity)
                count += 1

    def _parse_objects_section(self):
        """Парсит секцию OBJECTS."""
        count = 0
        while True:
            tag = self._read_tag()
            if not tag:
                break
            if tag.code == 0 and tag.value == "ENDSEC":
                print(f"  Parsed {count} objects.")
                break
            
            if tag.code == 0:
                entity = self._read_entity(tag)
                self.objects.append(entity)
                count += 1

    def find_entities_by_type(self, entity_type: str) -> List[DXFEntity]:
        """Находит все сущности указанного типа."""
        return [e for e in self.entities if e.name == entity_type]

    def find_objects_by_type(self, object_type: str) -> List[DXFEntity]:
        """Находит все объекты указанного типа."""
        return [o for o in self.objects if o.name == object_type]

    def get_table_style(self, style_name: str) -> Optional[DXFEntity]:
        """Получает TABLESTYLE по имени."""
        if 'TABLESTYLE' not in self.tables:
            return None
        
        for table_entity in self.tables['TABLESTYLE']:
            name = table_entity.get_first_value(2)
            if name == style_name:
                return table_entity
        
        return None

    def get_all_table_styles(self) -> List[DXFEntity]:
        """Получает все TABLESTYLE."""
        return self.tables.get('TABLESTYLE', [])
