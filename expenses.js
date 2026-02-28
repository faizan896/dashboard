(function () {
  'use strict';

  // Default data (used only the very first time)
  var DEFAULT_DATA = [
    { month: '2024-09', label: 'Sep 24', housing: 1800, food: 620, transport: 340, utilities: 210, entertainment: 180, health: 95, shopping: 310 },
    { month: '2024-10', label: 'Oct 24', housing: 1800, food: 580, transport: 290, utilities: 230, entertainment: 220, health: 60, shopping: 270 },
    { month: '2024-11', label: 'Nov 24', housing: 1800, food: 640, transport: 310, utilities: 250, entertainment: 350, health: 120, shopping: 480 },
    { month: '2024-12', label: 'Dec 24', housing: 1800, food: 710, transport: 280, utilities: 270, entertainment: 420, health: 80, shopping: 620 },
    { month: '2025-01', label: 'Jan 25', housing: 1850, food: 590, transport: 320, utilities: 290, entertainment: 150, health: 200, shopping: 190 },
    { month: '2025-02', label: 'Feb 25', housing: 1850, food: 560, transport: 300, utilities: 260, entertainment: 170, health: 75, shopping: 230 },
    { month: '2025-03', label: 'Mar 25', housing: 1850, food: 610, transport: 350, utilities: 220, entertainment: 200, health: 90, shopping: 280 },
    { month: '2025-04', label: 'Apr 25', housing: 1850, food: 630, transport: 310, utilities: 200, entertainment: 250, health: 110, shopping: 340 },
    { month: '2025-05', label: 'May 25', housing: 1850, food: 600, transport: 330, utilities: 190, entertainment: 280, health: 65, shopping: 260 },
    { month: '2025-06', label: 'Jun 25', housing: 1900, food: 650, transport: 370, utilities: 180, entertainment: 310, health: 85, shopping: 300 },
    { month: '2025-07', label: 'Jul 25', housing: 1900, food: 680, transport: 390, utilities: 175, entertainment: 350, health: 70, shopping: 350 },
    { month: '2025-08', label: 'Aug 25', housing: 1900, food: 660, transport: 360, utilities: 185, entertainment: 320, health: 130, shopping: 290 },
    { month: '2025-09', label: 'Sep 25', housing: 1900, food: 620, transport: 340, utilities: 210, entertainment: 230, health: 95, shopping: 270 },
    { month: '2025-10', label: 'Oct 25', housing: 1950, food: 640, transport: 310, utilities: 240, entertainment: 260, health: 55, shopping: 310 },
    { month: '2025-11', label: 'Nov 25', housing: 1950, food: 670, transport: 300, utilities: 260, entertainment: 380, health: 100, shopping: 450 },
    { month: '2025-12', label: 'Dec 25', housing: 1950, food: 730, transport: 290, utilities: 280, entertainment: 450, health: 75, shopping: 580 },
    { month: '2026-01', label: 'Jan 26', housing: 2000, food: 610, transport: 330, utilities: 300, entertainment: 160, health: 180, shopping: 220 },
    { month: '2026-02', label: 'Feb 26', housing: 2000, food: 580, transport: 310, utilities: 270, entertainment: 190, health: 90, shopping: 250 }
  ];

  var STORAGE_KEY = 'dashboard_expenses';
  var categories = [
    { key: 'housing', label: 'Housing', color: '#0f2040' },
    { key: 'food', label: 'Food', color: '#2563eb' },
    { key: 'transport', label: 'Transport', color: '#3b82f6' },
    { key: 'utilities', label: 'Utilities', color: '#60a5fa' },
    { key: 'entertainment', label: 'Entertainment', color: '#93c5fd' },
    { key: 'health', label: 'Health', color: '#22c55e' },
    { key: 'shopping', label: 'Shopping', color: '#f59e0b' }
  ];

  // ── Load / Save ──
  function loadData() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_DATA.slice();
  }
  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  var expenseData = loadData();
  var barChart = null, donutChart = null, currentRange = 3;

  function getTotal(entry) { var s = 0; for (var i = 0; i < categories.length; i++) s += entry[categories[i].key] || 0; return s; }
  function fmtMoney(n) { return '$' + n.toLocaleString('en-US'); }
  function getSlicedData(range) { return range === 0 ? expenseData : expenseData.slice(-range); }

  function updateSummary(data) {
    var total = 0, highest = 0, highestLabel = '';
    for (var i = 0; i < data.length; i++) { var t = getTotal(data[i]); total += t; if (t > highest) { highest = t; highestLabel = data[i].label; } }
    var avg = data.length > 0 ? Math.round(total / data.length) : 0;
    document.getElementById('exp-total').textContent = fmtMoney(total);
    document.getElementById('exp-avg').textContent = fmtMoney(avg);
    document.getElementById('exp-high').textContent = fmtMoney(highest);
    document.getElementById('exp-high-month').textContent = highestLabel;
    var prevData = expenseData.slice(0, expenseData.length - data.length);
    if (prevData.length > 0) { var prevSlice = prevData.slice(-data.length); if (prevSlice.length > 0) { var prevTotal = 0; for (var j = 0; j < prevSlice.length; j++) prevTotal += getTotal(prevSlice[j]); var pctChange = ((total - prevTotal) / prevTotal) * 100; var changeEl = document.getElementById('exp-total-change'); var sign = pctChange >= 0 ? '+' : ''; changeEl.innerHTML = '<span class="' + (pctChange >= 0 ? 'up' : 'down') + '">' + sign + pctChange.toFixed(1) + '%</span> vs prev period'; } }
    document.getElementById('exp-avg-sub').textContent = data.length + ' month' + (data.length !== 1 ? 's' : '') + ' shown';
  }

  function renderBarChart(data) {
    var ctx = document.getElementById('expenses-bar-chart'); if (!ctx) return;
    var labels = data.map(function (d) { return d.label; });
    var totals = data.map(function (d) { return getTotal(d); });
    if (barChart) { barChart.data.labels = labels; barChart.data.datasets[0].data = totals; barChart.update(); return; }
    barChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Total Expenses', data: totals, backgroundColor: function (context) { var chart = context.chart; var ctx2 = chart.ctx; var area = chart.chartArea; if (!area) return '#2563eb'; var gradient = ctx2.createLinearGradient(0, area.bottom, 0, area.top); gradient.addColorStop(0, '#2563eb'); gradient.addColorStop(1, '#0f2040'); return gradient; }, borderRadius: 6, borderSkipped: false, maxBarThickness: 40 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0a1628', titleFont: { size: 13, weight: '600' }, bodyFont: { size: 13 }, padding: 12, cornerRadius: 8, callbacks: { label: function (context) { return fmtMoney(context.parsed.y); } } } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 12 } } }, y: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 12 }, callback: function (value) { return '$' + (value / 1000).toFixed(1) + 'k'; } } } } } });
  }

  function renderDonutChart(data) {
    var ctx = document.getElementById('expenses-donut-chart'); if (!ctx) return;
    var catTotals = [], catLabels = [], catColors = [];
    for (var i = 0; i < categories.length; i++) { var sum = 0; for (var j = 0; j < data.length; j++) sum += data[j][categories[i].key] || 0; catTotals.push(sum); catLabels.push(categories[i].label); catColors.push(categories[i].color); }
    if (donutChart) { donutChart.data.datasets[0].data = catTotals; donutChart.update(); } else { donutChart = new Chart(ctx, { type: 'doughnut', data: { labels: catLabels, datasets: [{ data: catTotals, backgroundColor: catColors, borderWidth: 2, borderColor: '#ffffff', hoverOffset: 6 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0a1628', titleFont: { size: 13, weight: '600' }, bodyFont: { size: 13 }, padding: 12, cornerRadius: 8, callbacks: { label: function (context) { var total = context.dataset.data.reduce(function (a, b) { return a + b; }, 0); var pct = ((context.parsed / total) * 100).toFixed(1); return ' ' + fmtMoney(context.parsed) + ' (' + pct + '%)'; } } } } } }); }
    var legendEl = document.getElementById('expenses-legend');
    if (legendEl) { var grandTotal = catTotals.reduce(function (a, b) { return a + b; }, 0); var html = ''; for (var k = 0; k < categories.length; k++) { var pct = grandTotal > 0 ? ((catTotals[k] / grandTotal) * 100).toFixed(0) : 0; html += '<div class="exp-legend-item"><span class="exp-legend-dot" style="background:' + catColors[k] + '"></span>' + catLabels[k] + '<span class="exp-legend-value">' + pct + '%</span></div>'; } legendEl.innerHTML = html; }
  }

  function render(range) { currentRange = range; var data = getSlicedData(range); updateSummary(data); renderBarChart(data); renderDonutChart(data); }

  // ── Tab buttons ──
  var tabBtns = document.querySelectorAll('[data-exp-range]');
  for (var i = 0; i < tabBtns.length; i++) { tabBtns[i].addEventListener('click', function () { for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active'); this.classList.add('active'); render(parseInt(this.getAttribute('data-exp-range'), 10)); }); }

  // ══════════════════════════════════════════════
  //  EDIT MODAL — edit expenses directly on site
  // ══════════════════════════════════════════════
  function createModal() {
    var overlay = document.createElement('div');
    overlay.id = 'exp-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    return modal;
  }

  function closeModal() {
    var el = document.getElementById('exp-modal-overlay');
    if (el) el.remove();
  }

  function monthLabel(monthStr) {
    var parts = monthStr.split('-');
    var names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return names[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2);
  }

  // ── List all months ──
  function openListModal() {
    var modal = createModal();
    var html = '<h2 style="margin:0 0 16px;font-size:18px;">Manage Expenses</h2>';
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;">';
    html += '<button id="exp-add-btn" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">+ Add Month</button>';
    html += '<button id="exp-reset-btn" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Reset to Defaults</button>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    for (var i = expenseData.length - 1; i >= 0; i--) {
      var d = expenseData[i];
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-radius:8px;">';
      html += '<span style="font-weight:600;">' + d.label + '</span>';
      html += '<span style="color:#64748b;">' + fmtMoney(getTotal(d)) + '</span>';
      html += '<div><button class="exp-edit-row" data-idx="' + i + '" style="padding:4px 12px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-right:4px;font-size:13px;">Edit</button>';
      html += '<button class="exp-del-row" data-idx="' + i + '" style="padding:4px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Del</button></div>';
      html += '</div>';
    }
    html += '</div>';
    modal.innerHTML = html;

    document.getElementById('exp-add-btn').addEventListener('click', function () { closeModal(); openEditModal(-1); });
    document.getElementById('exp-reset-btn').addEventListener('click', function () {
      if (confirm('Reset all expense data to defaults?')) {
        expenseData = DEFAULT_DATA.slice();
        saveData(expenseData);
        closeModal();
        render(currentRange);
      }
    });
    modal.querySelectorAll('.exp-edit-row').forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(); openEditModal(parseInt(this.dataset.idx, 10)); });
    });
    modal.querySelectorAll('.exp-del-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.idx, 10);
        if (confirm('Delete ' + expenseData[idx].label + '?')) {
          expenseData.splice(idx, 1);
          saveData(expenseData);
          closeModal();
          openListModal();
          render(currentRange);
        }
      });
    });
  }

  // ── Edit / Add single month ──
  function openEditModal(idx) {
    var isNew = idx === -1;
    var entry = isNew ? {} : expenseData[idx];
    var modal = createModal();

    var today = new Date();
    var defaultMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

    var html = '<h2 style="margin:0 0 16px;font-size:18px;">' + (isNew ? 'Add New Month' : 'Edit ' + entry.label) + '</h2>';
    html += '<div style="margin-bottom:12px;"><label style="font-size:13px;color:#64748b;display:block;margin-bottom:4px;">Month (YYYY-MM)</label>';
    html += '<input id="exp-month-input" type="month" value="' + (entry.month || defaultMonth) + '" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;" ' + (isNew ? '' : 'disabled') + '></div>';

    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var val = entry[cat.key] || 0;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">';
      html += '<label style="font-size:14px;font-weight:500;">' + cat.label + '</label>';
      html += '<div style="display:flex;align-items:center;gap:4px;"><span style="color:#94a3b8;">$</span><input class="exp-cat-input" data-key="' + cat.key + '" type="number" value="' + val + '" min="0" style="width:100px;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:right;"></div>';
      html += '</div>';
    }

    html += '<div style="display:flex;gap:8px;margin-top:16px;">';
    html += '<button id="exp-save-btn" style="flex:1;padding:10px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Save</button>';
    html += '<button id="exp-cancel-btn" style="flex:1;padding:10px;background:#e2e8f0;color:#334155;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Cancel</button>';
    html += '</div>';
    modal.innerHTML = html;

    document.getElementById('exp-cancel-btn').addEventListener('click', function () { closeModal(); openListModal(); });
    document.getElementById('exp-save-btn').addEventListener('click', function () {
      var monthVal = document.getElementById('exp-month-input').value;
      if (!monthVal) { alert('Please select a month'); return; }

      var newEntry = { month: monthVal, label: monthLabel(monthVal) };
      modal.querySelectorAll('.exp-cat-input').forEach(function (inp) {
        newEntry[inp.dataset.key] = parseInt(inp.value, 10) || 0;
      });

      if (isNew) {
        // Insert in sorted order
        var inserted = false;
        for (var j = 0; j < expenseData.length; j++) {
          if (expenseData[j].month === monthVal) { expenseData[j] = newEntry; inserted = true; break; }
          if (expenseData[j].month > monthVal) { expenseData.splice(j, 0, newEntry); inserted = true; break; }
        }
        if (!inserted) expenseData.push(newEntry);
      } else {
        expenseData[idx] = newEntry;
      }

      saveData(expenseData);
      closeModal();
      openListModal();
      render(currentRange);
    });
  }

  // ── Add "Edit Expenses" button to the UI ──
  var headerEl = document.querySelector('.expenses-summary');
  if (headerEl) {
    var editBtn = document.createElement('button');
    editBtn.textContent = 'Edit Expenses';
    editBtn.style.cssText = 'padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:12px;';
    editBtn.addEventListener('click', openListModal);
    headerEl.parentNode.insertBefore(editBtn, headerEl);
  }

  render(3);
})();

