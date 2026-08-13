import os
import shutil
import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from tariff_service import tariff_service
from excel_handler import excel_handler, EXCEL_PATH
from google_sheets_handler import google_sheets_handler, PHOTOS_DIR as GS_PHOTOS_DIR

PHOTOS_DIR = r"G:\My Drive\Gonen\משק הראל\חשבון חשמל\meter_photos" if os.path.exists(r"G:\My Drive\Gonen\משק הראל\חשבון חשמל") else os.path.abspath("meter_photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)

app = FastAPI(title="Electricity Cost Calculator - חשבון חשמל")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves uploaded meter photos
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")

# Model definitions
class PreviewRequest(BaseModel):
    meter_type: str  # 'big_watch' or 'small_watch'
    reading: float
    date_str: str

@app.get("/api/status")
def get_status():
    tariff = tariff_service.get_current_tariff()
    excel_exists = os.path.exists(EXCEL_PATH)
    return {
        "excel_path": EXCEL_PATH,
        "excel_exists": excel_exists,
        "photos_dir": PHOTOS_DIR,
        "tariff": tariff
    }

@app.get("/api/tariff")
def get_tariff(force_refresh: bool = False):
    return tariff_service.get_current_tariff(force_refresh=force_refresh)

@app.get("/api/history")
def get_history():
    try:
        data = excel_handler.get_history()
        tariff = tariff_service.get_current_tariff()
        data["current_online_tariff"] = tariff
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/readings/preview")
def preview_reading(req: PreviewRequest):
    try:
        history = excel_handler.get_history()
        tariff = tariff_service.get_current_tariff()
        rate_with_vat = tariff["rate_with_vat"]

        is_big = req.meter_type in ["big_watch", "tenant_1", "main"]
        target_list = history["big_watch"] if is_big else history["small_watch"]

        prev_reading = target_list[-1]["reading"] if target_list else 0.0
        prev_date_str = target_list[-1]["date"] if target_list else req.date_str

        kwh_consumed = req.reading - prev_reading

        # Calculate days
        d_curr = datetime.datetime.strptime(req.date_str, "%Y-%m-%d")
        d_prev = datetime.datetime.strptime(prev_date_str, "%Y-%m-%d") if prev_date_str else d_curr
        days = max((d_curr - d_prev).days, 1)

        kwh_per_day = round(kwh_consumed / days, 2)

        if not is_big:
            # Sub-Meter (Small Watch / Tenant 2) -> Column Q
            calculated_cost = round(kwh_consumed * rate_with_vat, 2)
            target_column = "Column Q (Tenant 2 payment)"
            diff_kwh = None
        else:
            # Main Meter (Big Watch / Tenant 1) -> Column I
            # Compare with latest small watch consumption
            latest_small = history["small_watch"][-1] if history["small_watch"] else None
            small_kwh = latest_small["kwh_month"] if (latest_small and isinstance(latest_small["kwh_month"], (int, float))) else 0.0
            diff_kwh = round(kwh_consumed - small_kwh, 2)
            calculated_cost = round(diff_kwh * rate_with_vat, 2)
            target_column = "Column I (Tenant 1 payment)"

        return {
            "meter_type": req.meter_type,
            "prev_reading": prev_reading,
            "new_reading": req.reading,
            "kwh_consumed": round(kwh_consumed, 2),
            "days": days,
            "kwh_per_day": kwh_per_day,
            "rate_with_vat": rate_with_vat,
            "target_column": target_column,
            "diff_kwh": diff_kwh,
            "calculated_cost_nis": calculated_cost
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/readings/submit")
async def submit_reading(
    meter_type: str = Form(...),
    reading: float = Form(...),
    date_str: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    base_rate: Optional[float] = Form(None)
):
    try:
        photo_filename = None
        photo_saved_path = None

        if photo and photo.filename:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            ext = os.path.splitext(photo.filename)[1] or ".jpg"
            photo_filename = f"meter_{meter_type}_{timestamp}_{int(reading)}{ext}"
            photo_saved_path = os.path.join(PHOTOS_DIR, photo_filename)
            with open(photo_saved_path, "wb") as buffer:
                shutil.copyfileobj(photo.file, buffer)

        # Update Local Excel file if accessible
        result = None
        if os.path.exists(EXCEL_PATH):
            result = excel_handler.add_meter_reading(
                meter_type=meter_type,
                date_str=date_str,
                new_reading=reading,
                photo_path=photo_filename,
                base_rate=base_rate
            )

        # Update Google Sheets online if connected
        gs_result = None
        if google_sheets_handler.is_connected():
            gs_result = google_sheets_handler.add_meter_reading(
                meter_type=meter_type,
                date_str=date_str,
                new_reading=reading,
                base_rate=base_rate
            )

        target_desc = gs_result['target'] if gs_result else (result['target'] if result else "Spreadsheet")

        return {
            "success": True,
            "message": f"Successfully recorded reading and updated {target_desc}!",
            "excel_result": result or gs_result,
            "google_sheets_result": gs_result,
            "photo_url": f"/photos/{photo_filename}" if photo_filename else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve static frontend files
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
