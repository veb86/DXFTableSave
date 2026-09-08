@echo off
chcp 65001 >nul
title DXF Parser & Table Reader

echo ======================================================================
echo                  DXF Parser & Table Break Analyzer
echo ======================================================================
echo.

:: 1. Проверка наличия Python в системе
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=python
    goto :PYTHON_FOUND
)

where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=py -3
    goto :PYTHON_FOUND
)

echo [ОШИБКА] Python не найден в переменной PATH!
echo Пожалуйста, установите Python с сайта https://python.org и отметьте
echo галочку "Add Python to PATH" при установке.
echo.
pause
exit /b 1

:PYTHON_FOUND

:: 2. Определение целевого DXF-файла
:: Если файл перетащили на .bat мышкой или передали аргументом (%1)
set "DXF_FILE=%~1"

if "%DXF_FILE%"=="" (
    if exist "acadtable2007.dxf" (
        set "DXF_FILE=acadtable2007.dxf"
    ) else (
        echo [!] DXF-файл не указан.
        set /p "DXF_FILE=Введите путь к DXF-файлу (или перетащите его в это окно): "
    )
)

:: Убираем лишние кавычки, если пользователь их ввел
set "DXF_FILE=%DXF_FILE:"=%"

if not exist "%DXF_FILE%" (
    echo.
    echo [ОШИБКА] Файл "%DXF_FILE%" не найден!
    echo.
    pause
    exit /b 1
)

echo Обрабатываемый файл: "%DXF_FILE%"
echo.

:: 3. Запуск базового парсера DXF (dxf_parser.py)
echo ----------------------------------------------------------------------
echo 1. Статистика тегов и блоков (dxf_parser.py):
echo ----------------------------------------------------------------------
%PYTHON_CMD% dxf_parser.py "%DXF_FILE%"
echo.

:: 4. Запуск глубокого анализатора таблиц и Break Flags (table_reader.py)
if exist "table_reader.py" (
    echo ----------------------------------------------------------------------
    echo 2. Детальный анализ таблиц и флагов разбиения DXF 90 (table_reader.py):
    echo ----------------------------------------------------------------------
    %PYTHON_CMD% table_reader.py "%DXF_FILE%"
)

echo ======================================================================
echo Обработка успешно завершена.
echo ======================================================================
echo.
pause
