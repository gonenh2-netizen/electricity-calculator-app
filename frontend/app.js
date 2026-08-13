document.addEventListener('DOMContentLoaded', () => {
  
  // State
  let currentHistoryData = null;
  let activeHistoryTab = 'small_watch'; // 'small_watch' (Tenant 2) or 'big_watch' (Tenant 1)
  let selectedFile = null;

  // DOM Elements
  const readingDateInput = document.getElementById('readingDate');
  const readingKwhInput = document.getElementById('readingKwh');
  const meterOptions = document.querySelectorAll('.meter-option');
  const photoInput = document.getElementById('photoInput');
  const uploadZone = document.getElementById('uploadZone');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const uploadPreview = document.getElementById('uploadPreview');
  const previewImage = document.getElementById('previewImage');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  
  const calcPreviewCard = document.getElementById('calcPreviewCard');
  const prevReadingVal = document.getElementById('prevReadingVal');
  const kwhConsumedVal = document.getElementById('kwhConsumedVal');
  const daysVal = document.getElementById('daysVal');
  const kwhPerDayVal = document.getElementById('kwhPerDayVal');
  const targetColName = document.getElementById('targetColName');
  const calcCostAmount = document.getElementById('calcCostAmount');

  const readingForm = document.getElementById('readingForm');
  const headerTariffValue = document.getElementById('headerTariffValue');
  const refreshTariffBtn = document.getElementById('refreshTariffBtn');
  const reloadHistoryBtn = document.getElementById('reloadHistoryBtn');

  const tabSmallWatch = document.getElementById('tabSmallWatch');
  const tabBigWatch = document.getElementById('tabBigWatch');
  const tableHeaderRow = document.getElementById('tableHeaderRow');
  const tableBody = document.getElementById('tableBody');

  // Set default date to today YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];
  readingDateInput.value = today;

  // Initialize
  fetchStatus();
  fetchHistory();

  // Meter Option Toggle
  meterOptions.forEach(option => {
    option.addEventListener('click', () => {
      meterOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      const radio = option.querySelector('input[type="radio"]');
      radio.checked = true;
      triggerCalculationPreview();
    });
  });

  // Photo Upload Handlers
  uploadZone.addEventListener('click', (e) => {
    if (e.target !== removePhotoBtn && !removePhotoBtn.contains(e.target)) {
      photoInput.click();
    }
  });

  photoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedPhoto(e.target.files[0]);
    }
  });

  // Drag & Drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--accent-cyan)';
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = 'var(--border-color)';
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--border-color)';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedPhoto(e.dataTransfer.files[0]);
    }
  });

  removePhotoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    photoInput.value = '';
    uploadPreview.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
  });

  function handleSelectedPhoto(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      uploadPlaceholder.classList.add('hidden');
      uploadPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  // Inputs Change -> Preview
  readingDateInput.addEventListener('input', triggerCalculationPreview);
  readingKwhInput.addEventListener('input', triggerCalculationPreview);

  function triggerCalculationPreview() {
    const readingVal = parseFloat(readingKwhInput.value);
    const dateVal = readingDateInput.value;
    const selectedMeter = document.querySelector('input[name="meter_type"]:checked').value;

    if (!readingVal || readingVal <= 0 || !dateVal) {
      calcPreviewCard.classList.add('hidden');
      return;
    }

    fetch('/api/readings/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meter_type: selectedMeter,
        reading: readingVal,
        date_str: dateVal
      })
    })
    .then(res => res.json())
    .then(data => {
      prevReadingVal.textContent = data.prev_reading.toLocaleString();
      kwhConsumedVal.textContent = `${data.kwh_consumed.toLocaleString()} קוט"ש`;
      daysVal.textContent = `${data.days} ימים`;
      kwhPerDayVal.textContent = `${data.kwh_per_day} קוט"ש/יום`;
      targetColName.textContent = data.target_column;
      calcCostAmount.textContent = `${data.calculated_cost_nis.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₪`;
      
      calcPreviewCard.classList.remove('hidden');
    })
    .catch(err => {
      console.error("Preview error:", err);
    });
  }

  // Form Submission
  readingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const readingVal = parseFloat(readingKwhInput.value);
    const dateVal = readingDateInput.value;
    const selectedMeter = document.querySelector('input[name="meter_type"]:checked').value;

    if (!readingVal || !dateVal) {
      showToast("אנא מלא את כל שדות החובה", "error");
      return;
    }

    const formData = new FormData();
    formData.append('meter_type', selectedMeter);
    formData.append('reading', readingVal);
    formData.append('date_str', dateVal);
    if (selectedFile) {
      formData.append('photo', selectedFile);
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> מעדכן בקובץ Excel...`;

    fetch('/api/readings/submit', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-file-excel"></i> <span>חשב ועדכן בקובץ Excel</span>`;

      if (data.success) {
        showToast(data.message, "success");
        // Reset form
        readingKwhInput.value = '';
        removePhotoBtn.click();
        calcPreviewCard.classList.add('hidden');
        // Reload history
        fetchHistory();
      } else {
        showToast(data.detail || "שגיאה ברישום הקריאה", "error");
      }
    })
    .catch(err => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-file-excel"></i> <span>חשב ועדכן בקובץ Excel</span>`;
      showToast(`שגיאת תקשורת: ${err.message}`, "error");
    });
  });

  // History Tab Switchers
  tabSmallWatch.addEventListener('click', () => {
    tabSmallWatch.classList.add('active');
    tabBigWatch.classList.remove('active');
    activeHistoryTab = 'small_watch';
    renderHistoryTable();
  });

  tabBigWatch.addEventListener('click', () => {
    tabBigWatch.classList.add('active');
    tabSmallWatch.classList.remove('active');
    activeHistoryTab = 'big_watch';
    renderHistoryTable();
  });

  reloadHistoryBtn.addEventListener('click', fetchHistory);

  refreshTariffBtn.addEventListener('click', () => {
    refreshTariffBtn.querySelector('i').classList.add('fa-spin');
    fetch('/api/tariff?force_refresh=true')
      .then(res => res.json())
      .then(tariff => {
        refreshTariffBtn.querySelector('i').classList.remove('fa-spin');
        headerTariffValue.textContent = `${tariff.rate_with_vat} ₪/קוט"ש`;
        showToast("תעריף החשמל עודכן מול רשות החשמל!", "success");
        triggerCalculationPreview();
      });
  });

  function fetchStatus() {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.tariff) {
          headerTariffValue.textContent = `${data.tariff.rate_with_vat} ₪/קוט"ש`;
        }
      });
  }

  function fetchHistory() {
    tableBody.innerHTML = `<tr><td colspan="7" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> טוען נתונים מקובץ החשמל...</td></tr>`;
    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        currentHistoryData = data;
        renderHistoryTable();
      })
      .catch(err => {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-cell" style="color: var(--accent-rose)">שגיאה שטעינת נתונים: ${err.message}</td></tr>`;
      });
  }

  function renderHistoryTable() {
    if (!currentHistoryData) return;

    const isSmall = activeHistoryTab === 'small_watch';
    const list = isSmall ? currentHistoryData.small_watch : currentHistoryData.big_watch;

    // Header label
    tableHeaderRow.cells[6].textContent = isSmall ? 'תשלום חודשי (Col Q)' : 'תשלום חודשי (Col I)';

    if (!list || list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="loading-cell">אין קריאות רשומות עדיין.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    // Show newest first
    const reversed = [...list].reverse();

    reversed.forEach(item => {
      const kwhMonth = item.kwh_month !== null ? item.kwh_month : '--';
      const days = item.days !== null ? item.days : '--';
      const kwhDay = item.kwh_day !== null ? (typeof item.kwh_day === 'number' ? item.kwh_day.toFixed(1) : item.kwh_day) : '--';
      
      const costRaw = isSmall ? item.cost_col_q : item.cost_col_i;
      let costDisplay = '--';
      if (costRaw !== null && costRaw !== undefined) {
        if (typeof costRaw === 'number') {
          costDisplay = `${costRaw.toFixed(2)} ₪`;
        } else {
          costDisplay = String(costRaw);
        }
      }

      rowsHtml += `
        <tr>
          <td>${item.no || item.row}</td>
          <td>${item.date}</td>
          <td><strong>${item.reading.toLocaleString()}</strong></td>
          <td>${typeof kwhMonth === 'number' ? kwhMonth.toLocaleString() : kwhMonth}</td>
          <td>${days}</td>
          <td>${kwhDay}</td>
          <td class="td-payment">${costDisplay}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = rowsHtml;
  }

  function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

});
