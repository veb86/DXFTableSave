$ cat /workspace/run_create_table.bat
cat /workspace/run_create_table.bat
@echo off
REM ============================================================
BAT-файл для запуска create_zcad_table.py
с использованием portable Python из соседней папки
============================================================
REM Переход в директорию скрипта

cd /d "%~dp0"
REM Проверка наличия python.exe

if not exist "python\python.exe" (
    echo ОШИБКА: Не найден python.exe в папке python\
    echo Убедитесь, что portable Python расположен рядом со скриптом.
    pause
    exit /b 1
)
REM Проверка наличия скрипта
if not exist "create_zcad_table.py" (
    echo ОШИБКА: Не найден файл create_zcad_table.py
    pause
    exit /b 1
)
REM Запуск скрипта
echo Запуск create_zcad_table.py...
echo ============================================================

python\python.exe create_zcad_table.py
echo ============================================================
echo Выполнение завершено.
pause