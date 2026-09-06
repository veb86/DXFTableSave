@echo off
chcp 65001 >nul
setlocal

echo ==========================================
echo   DXF Table Injector Launcher
echo ==========================================

REM Переход в директорию скрипта
cd /d "%~dp0"

REM Проверка наличия Portable Python
if exist "python\python.exe" (
    set PYTHON_CMD=python\python.exe
    echo [INFO] Using Portable Python from local folder.
) else (
    set PYTHON_CMD=python
    echo [INFO] Using system Python.
)

REM Проверка наличия основного скрипта
if not exist "create_zcad_table.py" (
    echo [ERROR] create_zcad_table.py not found!
    pause
    exit /b 1
)

REM Запуск скрипта
echo [RUN] Starting generation...
echo.

REM Используем exec для запуска кода напрямую, обходя проблемы с путями в portable mode
%PYTHON_CMD% -c "import site; exec(open('create_zcad_table.py').read())"

echo.
echo ==========================================
if %ERRORLEVEL% EQU 0 (
    echo   Done! Check ZCADTable.dxf
) else (
    echo   Failed with error code %ERRORLEVEL%
)
echo ==========================================
pause