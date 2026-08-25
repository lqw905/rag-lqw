# RAG-GK PowerShell One-Click Launcher
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Starting RAG-GK (FastAPI Backend + React Frontend)" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$venvPython = ".\.venv\Scripts\python.exe"

if (Test-Path $venvPython) {
    & $venvPython run.py
} else {
    python run.py
}
