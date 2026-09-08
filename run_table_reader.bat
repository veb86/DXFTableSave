@echo off
REM ============================================
REM Запуск программы чтения таблиц AutoCAD
REM из файла acadtable2007.dxf
REM ============================================

chcp 65001 >nul
setlocal

REM Переход в директорию скрипта
cd /d "%~dp0"

REM Проверка наличия входного файла
if not exist "acadtable2007.dxf" (
    echo ОШИБКА: Файл acadtable2007.dxf не найден!
    echo Убедитесь, что файл находится в той же директории, что и этот скрипт.
    pause
    exit /b 1
)

REM Проверка наличия скрипта Python
if not exist "table_reader.py" (
    echo ОШИБКА: Файл table_reader.py не найден!
    pause
    exit /b 1
)

echo ============================================
echo Чтение таблицы из acadtable2007.dxf
echo ============================================
echo.

REM Запуск Python скрипта
python table_reader.py

REM Сохранение кода выхода
set EXIT_CODE=%ERRORLEVEL%

echo.
echo ============================================
if %EXIT_CODE% EQU 0 (
    echo Выполнение завершено успешно
) else (
    echo Выполнение завершено с ошибкой (код: %EXIT_CODE%)
)
echo ============================================

pause
exit /b %EXIT_CODE%
