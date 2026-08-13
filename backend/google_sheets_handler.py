import os
import json
import logging
import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger("google_sheets_handler")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

class GoogleSheetsHandler:
    def __init__(self):
        self.client = None
        self.sheet = None
        self._init_connection()

    def _init_connection(self):
        try:
            creds_json_str = os.environ.get("GOOGLE_CREDENTIALS_JSON")
            creds_file_path = os.environ.get("GOOGLE_CREDENTIALS_PATH", "service_account.json")
            
            creds = None
            if creds_json_str:
                creds_dict = json.loads(creds_json_str)
                creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            elif os.path.exists(creds_file_path):
                creds = Credentials.from_service_account_file(creds_file_path, scopes=SCOPES)

            if creds:
                self.client = gspread.authorize(creds)
                sheet_id = os.environ.get("GOOGLE_SHEET_ID")
                sheet_name = os.environ.get("GOOGLE_SHEET_NAME", "חשבון חשמל")
                
                if sheet_id:
                    self.sheet = self.client.open_by_key(sheet_id).sheet1
                else:
                    self.sheet = self.client.open(sheet_name).sheet1
                logger.info("Successfully connected to Google Sheets!")
        except Exception as e:
            logger.warning(f"Could not connect to Google Sheets: {e}")

    def is_connected(self):
        return self.sheet is not None

    def add_meter_reading(self, meter_type, date_str, new_reading, base_rate=None):
        """Appends row to Google Sheet and updates Column I or Column Q payment formula."""
        if not self.sheet:
            raise RuntimeError("Google Sheets is not connected. Configure GOOGLE_CREDENTIALS_JSON.")

        if base_rate is not None:
            self.sheet.update_acell("G2", float(base_rate))
            self.sheet.update_acell("G1", "=G2*1.17")

        if meter_type in ["big_watch", "tenant_1", "main"]:
            # Main Meter / Tenant 1
            col_d_values = self.sheet.col_values(4)  # Column D (Big Watch Reading)
            next_row = len(col_d_values) + 1
            prev_row = next_row - 1

            self.sheet.update_cell(next_row, 2, f"=B{prev_row}+1")      # Col B: No
            self.sheet.update_cell(next_row, 3, date_str)               # Col C: Date
            self.sheet.update_cell(next_row, 4, float(new_reading))     # Col D: Reading
            self.sheet.update_cell(next_row, 5, f"=D{next_row}-D{prev_row}") # Col E: kwh
            self.sheet.update_cell(next_row, 6, f"=DAYS(C{next_row},C{prev_row})") # Col F: Days
            self.sheet.update_cell(next_row, 7, f"=E{next_row}/F{next_row}") # Col G: avg
            self.sheet.update_cell(next_row, 8, f"=E{next_row}-N{next_row}") # Col H: Diff B-S
            self.sheet.update_cell(next_row, 9, f"=H{next_row}*$G$1")   # Col I: Payment!

            return {"target": f"Google Sheet Column I (Row {next_row})", "row": next_row}

        else:
            # Sub-Meter / Tenant 2
            col_m_values = self.sheet.col_values(13)  # Column M (Small Watch Reading)
            next_row = len(col_m_values) + 1
            prev_row = next_row - 1

            self.sheet.update_cell(next_row, 11, f"=K{prev_row}+1")     # Col K: No
            self.sheet.update_cell(next_row, 12, date_str)              # Col L: Date
            self.sheet.update_cell(next_row, 13, float(new_reading))    # Col M: Reading
            self.sheet.update_cell(next_row, 14, f"=M{next_row}-M{prev_row}") # Col N: kwh
            self.sheet.update_cell(next_row, 15, f"=DAYS(L{next_row},L{prev_row})") # Col O: Days
            self.sheet.update_cell(next_row, 16, f"=N{next_row}/O{next_row}") # Col P: avg
            self.sheet.update_cell(next_row, 17, f"=N{next_row}*$G$1")  # Col Q: Payment!

            return {"target": f"Google Sheet Column Q (Row {next_row})", "row": next_row}

google_sheets_handler = GoogleSheetsHandler()
