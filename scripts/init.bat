@echo off
REM Hound Initialization Script for Windows

echo ========================================
echo Hound - Code Search Engine
echo ========================================

REM Change to the project directory
cd /d "%~dp0.."

echo.
echo [1/3] Installing Go dependencies...
call go mod tidy
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)

echo.
echo [2/3] Building Hound...
call go build -o bin/houndd.exe ./cmds/houndd
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)

echo.
echo [3/3] Build completed successfully!
echo.
echo ========================================
echo Hound is ready!
echo ========================================
echo.
echo To start Hound:
echo   .\bin\houndd.exe --conf=config.json --addr=:6080
echo.
echo Then open http://localhost:6080 in your browser.
echo.
echo Note: The first user you register will become the admin.
echo.
