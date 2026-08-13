@echo off
title Electricity Cost Calculator - חשבון חשמל
echo ========================================================
echo   Starting Electricity Calculator Server (חשבון חשמל)...
echo   Excel Target: G:\My Drive\Gonen\משק הראל\חשבון חשמל\חשבון חשמל.xlsx
echo ========================================================

start "" "http://localhost:8000"

cd /d "%~dp0backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
