# Electricity Cost Calculator for House Tenants (חשבון חשמל)

A modern full-stack web application designed to calculate monthly electricity costs for house tenants, upload meter photos, fetch live Israeli residential electricity tariffs (רשות החשמל), and automatically update calculated payments into **Columns I and Q** of the master Excel file (`חשבון חשמל.xlsx`).

---

## Features

- **Meter Selection**:
  - **Sub-Meter / Tenant 2 (Small Watch / מונה קטן)**: Calculates payment for Tenant 2 and writes to **Column Q**.
  - **Main Meter / Tenant 1 (Big Watch / מונה ראשי)**: Calculates net payment for Tenant 1 (`Big kWh - Small kWh`) and writes to **Column I**.
- **Real-Time Preview**: Displays consumption (kWh), period days, daily average kWh, target Excel column, and total cost with 17% Israeli VAT before submitting.
- **Meter Photo Upload**: Captures and saves meter photos with timestamps in the `meter_photos/` folder.
- **Live Tariff Tracking**: Checks the current electricity tariff in Israel for private users (~0.6352 NIS/kWh including VAT) with automatic updates to Excel cell `G2`.
- **Automatic Backups**: Creates a safety copy (`חשבון חשמל_backup.xlsx`) prior to modifying the spreadsheet.
- **Modern UI**: Full Hebrew (RTL) & English support with glassmorphism dark theme.

---

## Setup & Running

### Requirements
- Python 3.10+
- Installed packages: `fastapi`, `uvicorn`, `openpyxl`, `requests`, `python-multipart`, `pillow`

```bash
pip install fastapi uvicorn openpyxl requests python-multipart pillow
```

### Starting the Server
Simply double-click `run_app.bat` or run:

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

Then open `http://localhost:8000` in your web browser.

---

## Directory Structure

```
electricity_calculator_app/
├── backend/
│   ├── main.py             # FastAPI REST Server
│   ├── excel_handler.py    # OpenPyXL Excel Reader/Writer
│   └── tariff_service.py   # Electricity Tariff Service
├── frontend/
│   ├── index.html          # Web UI Structure (Hebrew/RTL)
│   ├── styles.css          # Glassmorphism Styling
│   └── app.js              # Client Interactivity & API Sync
└── run_app.bat             # 1-Click Launcher Script
```
