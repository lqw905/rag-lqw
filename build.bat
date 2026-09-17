@echo off
chcp 65001 >nul
title RAG-GK Build Pipeline

echo ======================================================
echo       RAG-GK One-Click Packaging Pipeline (NSIS)
echo ======================================================
echo.

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" build_package.py
) else (
    python build_package.py
)

pause
