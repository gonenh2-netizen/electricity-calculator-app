/**
 * Electricity Cost Calculator - Google Apps Script (חשבון חשמל)
 * Built for Google Sheets integration with automatic Column I & Column Q payments.
 */

// Current Israeli Electricity Tariff (Base before VAT: 0.5429 NIS -> 0.6352 NIS incl 17% VAT)
var CURRENT_BASE_TARIFF = 0.5429;

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('חשבון חשמל ⚡')
    .addItem('פתח מחשבון דיירים (סרגל צד)', 'showSidebarCalculator')
    .addItem('פתח מחשבון דיירים (חלון מלא)', 'showDialogCalculator')
    .addSeparator()
    .addItem('עדכן תעריף חשמל מעודכן (0.6352 ₪)', 'updateSpreadsheetTariff')
    .addToUi();
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('מחשבון חשבון חשמל לדיירים')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function showSidebarCalculator() {
  var html = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('מחשבון חשמל לדיירים');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showDialogCalculator() {
  var html = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setWidth(950)
    .setHeight(720)
    .setTitle('מחשבון חשמל לדיירים');
  SpreadsheetApp.getUi().showModalDialog(html, 'מחשבון חשמל לדיירים');
}

function updateSpreadsheetTariff() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.getRange("G2").setValue(CURRENT_BASE_TARIFF);
  sheet.getRange("G1").setFormula("=G2*1.17");
  
  var ui = SpreadsheetApp.getUi();
  ui.alert('עדכון תעריף חשמל', 'תעריף החשמל עודכן בהצלחה בגיליון:\n• תעריף בסיס (תא G2): ' + CURRENT_BASE_TARIFF + ' ₪\n• תעריף כולל מע"מ (תא G1): 0.6352 ₪/קוט"ש', ui.ButtonSet.OK);
}

function getTariffInfo() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var baseRate = sheet.getRange("G2").getValue();
  var rateWithVat = sheet.getRange("G1").getValue();

  if (typeof baseRate !== 'number' || baseRate === 0 || baseRate < 0.45) {
    baseRate = CURRENT_BASE_TARIFF;
    sheet.getRange("G2").setValue(baseRate);
    sheet.getRange("G1").setFormula("=G2*1.17");
    rateWithVat = 0.6352;
  }
  
  if (typeof rateWithVat !== 'number' || rateWithVat === 0) {
    rateWithVat = Math.round(baseRate * 1.17 * 10000) / 10000;
  }

  return {
    base_rate: baseRate,
    rate_with_vat: Math.round(rateWithVat * 10000) / 10000,
    vat_percent: 17.0
  };
}

function getHistoryData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(1, 1, Math.max(lastRow, 30), 18).getValues();

  var bigWatch = [];
  var smallWatch = [];

  for (var r = 3; r < values.length; r++) {
    var rowData = values[r];
    // Big Watch (Tenant 1): Col B=1, Col C=2, Col D=3, Col I=8
    if (rowData[2] || rowData[3]) {
      var dVal = rowData[2];
      var dStr = (dVal instanceof Date) ? Utilities.formatDate(dVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(dVal);
      bigWatch.push({
        row: r + 1,
        no: rowData[1],
        date: dStr,
        reading: rowData[3],
        kwh_month: rowData[4],
        days: rowData[5],
        kwh_day: rowData[6],
        cost_col_i: rowData[8]
      });
    }

    // Small Watch (Tenant 2): Col K=10, Col L=11, Col M=12, Col Q=16
    if (rowData[11] || rowData[12]) {
      var lVal = rowData[11];
      var lStr = (lVal instanceof Date) ? Utilities.formatDate(lVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(lVal);
      smallWatch.push({
        row: r + 1,
        no: rowData[10],
        date: lStr,
        reading: rowData[12],
        kwh_month: rowData[13],
        days: rowData[14],
        kwh_day: rowData[15],
        cost_col_q: rowData[16]
      });
    }
  }

  return {
    tariff: getTariffInfo(),
    big_watch: bigWatch,
    small_watch: smallWatch
  };
}

function calculatePreview(meterType, reading, dateStr) {
  var history = getHistoryData();
  var isBig = (meterType === 'big_watch' || meterType === 'tenant_1');
  var targetList = isBig ? history.big_watch : history.small_watch;
  
  var prevReading = targetList.length > 0 ? targetList[targetList.length - 1].reading : 0;
  var prevDateStr = targetList.length > 0 ? targetList[targetList.length - 1].date : dateStr;

  var kwhConsumed = reading - prevReading;
  var rateWithVat = history.tariff.rate_with_vat;

  var dCurr = new Date(dateStr);
  var dPrev = new Date(prevDateStr);
  var diffTime = Math.abs(dCurr - dPrev);
  var days = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);
  var kwhPerDay = Math.round((kwhConsumed / days) * 10) / 10;

  var calculatedCost = 0;
  var targetColumn = "";

  if (!isBig) {
    calculatedCost = Math.round(kwhConsumed * rateWithVat * 100) / 100;
    targetColumn = "עמודה Q (תשלום דייר משני)";
  } else {
    var latestSmall = history.small_watch.length > 0 ? history.small_watch[history.small_watch.length - 1] : null;
    var smallKwh = (latestSmall && typeof latestSmall.kwh_month === 'number') ? latestSmall.kwh_month : 0;
    var diffKwh = kwhConsumed - smallKwh;
    calculatedCost = Math.round(diffKwh * rateWithVat * 100) / 100;
    targetColumn = "עמודה I (תשלום בית מרכזי)";
  }

  return {
    prev_reading: prevReading,
    kwh_consumed: Math.round(kwhConsumed * 10) / 10,
    days: days,
    kwh_per_day: kwhPerDay,
    calculated_cost_nis: calculatedCost,
    target_column: targetColumn
  };
}

function submitMeterReading(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var meterType = data.meterType;
  var dateStr = data.dateStr;
  var reading = parseFloat(data.reading);

  // Ensure tariff G2 is up to date
  getTariffInfo();

  var photoUrl = "";
  if (data.photoBase64 && data.photoName) {
    try {
      var ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
      var parents = ssFile.getParents();
      var parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
      
      var photoFolders = parentFolder.getFoldersByName("meter_photos");
      var photoFolder = photoFolders.hasNext() ? photoFolders.next() : parentFolder.createFolder("meter_photos");

      var blob = Utilities.newBlob(Utilities.base64Decode(data.photoBase64.split(',')[1] || data.photoBase64), data.photoType || 'image/jpeg', data.photoName);
      var file = photoFolder.createFile(blob);
      photoUrl = file.getUrl();
    } catch(e) {
      Logger.log("Error saving photo: " + e);
    }
  }

  var isBig = (meterType === 'big_watch' || meterType === 'tenant_1');

  if (isBig) {
    // Column B to I (Big Watch)
    var colDValues = sheet.getRange("D:D").getValues();
    var lastRow = 3;
    for (var i = colDValues.length - 1; i >= 3; i--) {
      if (colDValues[i][0] !== "" && colDValues[i][0] !== null) {
        lastRow = i + 1;
        break;
      }
    }
    var nextRow = lastRow + 1;
    var prevRow = nextRow - 1;

    sheet.getRange(nextRow, 2).setFormula("=B" + prevRow + "+1");
    sheet.getRange(nextRow, 3).setValue(dateStr);
    sheet.getRange(nextRow, 4).setValue(reading);
    sheet.getRange(nextRow, 5).setFormula("=D" + nextRow + "-D" + prevRow);
    sheet.getRange(nextRow, 6).setFormula("=DAYS(C" + nextRow + ",C" + prevRow + ")");
    sheet.getRange(nextRow, 7).setFormula("=E" + nextRow + "/F" + nextRow);
    sheet.getRange(nextRow, 8).setFormula("=E" + nextRow + "-N" + nextRow);
    sheet.getRange(nextRow, 9).setFormula("=H" + nextRow + "*$G$1"); // Column I Payment!

    return {
      success: true,
      message: "הקריאה נרשמה בהצלחה ועודכנה עמודה I (שורה " + nextRow + ")!",
      photo_url: photoUrl
    };
  } else {
    // Column K to Q (Small Watch)
    var colMValues = sheet.getRange("M:M").getValues();
    var lastRow = 3;
    for (var i = colMValues.length - 1; i >= 3; i--) {
      if (colMValues[i][0] !== "" && colMValues[i][0] !== null) {
        lastRow = i + 1;
        break;
      }
    }
    var nextRow = lastRow + 1;
    var prevRow = nextRow - 1;

    sheet.getRange(nextRow, 11).setFormula("=K" + prevRow + "+1");
    sheet.getRange(nextRow, 12).setValue(dateStr);
    sheet.getRange(nextRow, 13).setValue(reading);
    sheet.getRange(nextRow, 14).setFormula("=M" + nextRow + "-M" + prevRow);
    sheet.getRange(nextRow, 15).setFormula("=DAYS(L" + nextRow + ",L" + prevRow + ")");
    sheet.getRange(nextRow, 16).setFormula("=N" + nextRow + "/O" + nextRow);
    sheet.getRange(nextRow, 17).setFormula("=N" + nextRow + "*$G$1"); // Column Q Payment!

    return {
      success: true,
      message: "הקריאה נרשמה בהצלחה ועודכנה עמודה Q (שורה " + nextRow + ")!",
      photo_url: photoUrl
    };
  }
}
