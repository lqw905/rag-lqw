@echo off
chcp 65001 >nul
title RAG-GK Launcher

echo ======================================================
echo    Starting RAG-GK (FastAPI Backend + React Frontend)
echo ======================================================
echo.

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run.py
) else (
    python run.py
)

pause
