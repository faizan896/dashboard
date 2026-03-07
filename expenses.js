(function () {
  'use strict';

  var STORAGE_KEY = 'mm_expenses';

  var categories = [
    { key: 'housing',       label: 'Housing',       color: '#7c3aed' },
    { key: 'food',          label: 'Food',          color: '#b388ff' },
    { key: 'transport',     label: 'Transport',     color: '#9c5fff' },
    { key: 'utilities',     label: 'Utilities',     color: '#ce93d8' },
    { key: 'entertainment', label: 'Entertainment', color: '#e1bee7' },
    { key: 'health',        label: 'Health',        color: '#22c55e' },
    { key: 'shopping',      label: 'Shopping',      color: '#f59e0b' }
  ];

  // --- Storage ---
  // Each entry: { id, month: "2026-02", category: "food", amount: 580 }
  function loadExpenses() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return [];
  }

  function saveExpenses(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  var expenses = loadExpenses();

  // --- Aggregate individual entries into monthly data for charts ---
  function aggregateByMonth() {
    var map = {};
    for (var i = 0; i < expenses.length; i++) {
      var e = expenses[i];
      if (!map[e.month]) {
        map[e.month] = { month: e.month };
        for (var c = 0; c < categories.length; c++) {
          map[e.month][categories[c].key] = 0;
        }
      }
      if (map[e.month][e.category] !== undefined) {
        map[e.month][e.category] += e.amount;
      }
    }
    // Sort by month
    var keys = Object.keys(map).sort();
    var result = [];
    for (var k = 0; k < keys.length; k++) {
      var entry = map[keys[k]];
      // Build label like "Feb 26"
      var parts = keys[k].split('-');
      var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      entry.label = monthNames[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2);
      result.push(entry);
    }
    return result;
  }

  var barChart = null;
  var donutChart = null;
  var currentRange = 3;

  function getTotal(entry) {
    var sum = 0;
    for (var i = 0; i < categories.length; i++) {
      sum += entry[categories[i].key] || 0;
    }
    return sum;
  }

  function fmtMoney(n) {
    return '$' + n.toLocaleString('en-US');
  }

  function getSlicedData(range) {
    var data = aggregateByMonth();
    if (range === 0 || data.length <= range) return data;
    return data.slice(-range);
  }

  function updateSummary(data) {
    var total = 0;
    var highest = 0;
    var highestLabel = '';
    for (var i = 0; i < data.length; i++) {
      var t = getTotal(data[i]);
      total += t;
      if (t > highest) {
        highest = t;
        highestLabel = data[i].label;
      }
    }
    var avg = data.length > 0 ? Math.round(total / data.length) : 0;

    document.getElementById('exp-total').textContent = fmtMoney(total);
    document.getElementById('exp-avg').textContent = fmtMoney(avg);
    document.getElementById('exp-high').textContent = fmtMoney(highest);
    document.getElementById('exp-high-month').textContent = highestLabel || '—';

    // Compare with previous period
    var allData = aggregateByMonth();
    var dataLen = data.length;
    var prevSlice = allData.slice(0, allData.length - dataLen).slice(-dataLen);
    var changeEl = document.getElementById('exp-total-change');
    if (prevSlice.length > 0) {
      var prevTotal = 0;
      for (var j = 0; j < prevSlice.length; j++) {
        prevTotal += getTotal(prevSlice[j]);
      }
      if (prevTotal > 0) {
        var pctChange = ((total - prevTotal) / prevTotal) * 100;
        var sign = pctChange >= 0 ? '+' : '';
        changeEl.innerHTML = '<span class="' + (pctChange >= 0 ? 'up' : 'down') + '">'
          + sign + pctChange.toFixed(1) + '%</span> vs prev period';
      } else {
        changeEl.textContent = '';
      }
    } else {
      changeEl.textContent = '';
    }

    var avgSubEl = document.getElementById('exp-avg-sub');
    avgSubEl.textContent = data.length + ' month' + (data.length !== 1 ? 's' : '') + ' shown';
  }

  function renderBarChart(data) {
    var ctx = document.getElementById('expenses-bar-chart');
    if (!ctx) return;

    var labels = data.map(function (d) { return d.label; });
    var totals = data.map(function (d) { return getTotal(d); });

    if (barChart) {
      barChart.data.labels = labels;
      barChart.data.datasets[0].data = totals;
      barChart.update();
      return;
    }

    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Expenses',
          data: totals,
          backgroundColor: function (context) {
            var chart = context.chart;
            var ctx2 = chart.ctx;
            var area = chart.chartArea;
            if (!area) return '#b388ff';
            var gradient = ctx2.createLinearGradient(0, area.bottom, 0, area.top);
            gradient.addColorStop(0, '#b388ff');
            gradient.addColorStop(1, '#7c3aed');
            return gradient;
          },
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                return fmtMoney(context.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#8a8a9a', font: { size: 12 } }
          },
          y: {
            grid: { color: '#2a2a2a' },
            border: { display: false },
            ticks: {
              color: '#8a8a9a',
              font: { size: 12 },
              callback: function (value) {
                return '$' + (value / 1000).toFixed(1) + 'k';
              }
            }
          }
        }
      }
    });
  }

  function renderDonutChart(data) {
    var ctx = document.getElementById('expenses-donut-chart');
    if (!ctx) return;

    var catTotals = [];
    var catLabels = [];
    var catColors = [];
    for (var i = 0; i < categories.length; i++) {
      var sum = 0;
      for (var j = 0; j < data.length; j++) {
        sum += data[j][categories[i].key] || 0;
      }
      catTotals.push(sum);
      catLabels.push(categories[i].label);
      catColors.push(categories[i].color);
    }

    if (donutChart) {
      donutChart.data.datasets[0].data = catTotals;
      donutChart.update();
    } else {
      donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{
            data: catTotals,
            backgroundColor: catColors,
            borderWidth: 2,
            borderColor: '#121212',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a1a2e',
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 13 },
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: function (context) {
                  var total = context.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                  var pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                  return ' ' + fmtMoney(context.parsed) + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      });
    }

    // Build legend
    var legendEl = document.getElementById('expenses-legend');
    if (legendEl) {
      var grandTotal = catTotals.reduce(function (a, b) { return a + b; }, 0);
      var html = '';
      for (var k = 0; k < categories.length; k++) {
        var pct = grandTotal > 0 ? ((catTotals[k] / grandTotal) * 100).toFixed(0) : 0;
        html += '<div class="exp-legend-item">'
          + '<span class="exp-legend-dot" style="background:' + catColors[k] + '"></span>'
          + catLabels[k]
          + '<span class="exp-legend-value">' + pct + '%</span>'
          + '</div>';
      }
      legendEl.innerHTML = html;
    }
  }

  // --- Render entry list ---
  function getCategoryLabel(key) {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].key === key) return categories[i].label;
    }
    return key;
  }

  function getCategoryColor(key) {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].key === key) return categories[i].color;
    }
    return '#888';
  }

  function formatMonthLabel(month) {
    var parts = month.split('-');
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return monthNames[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  function renderEntryList() {
    var list = document.getElementById('expense-entries-list');
    if (!list) return;

    if (expenses.length === 0) {
      list.innerHTML = '<p class="text-muted" style="font-size:13px;">No expenses yet. Add one above.</p>';
      return;
    }

    // Sort newest first
    var sorted = expenses.slice().sort(function (a, b) {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      return b.id - a.id;
    });

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      html += '<div class="expense-entry-item" data-id="' + e.id + '">'
        + '<span class="exp-entry-dot" style="background:' + getCategoryColor(e.category) + '"></span>'
        + '<span class="exp-entry-month">' + formatMonthLabel(e.month) + '</span>'
        + '<span class="exp-entry-cat">' + getCategoryLabel(e.category) + '</span>'
        + '<span class="exp-entry-amount">' + fmtMoney(e.amount) + '</span>'
        + '<button class="exp-entry-del" title="Delete">&times;</button>'
        + '</div>';
    }
    list.innerHTML = html;

    // Attach delete handlers
    var delBtns = list.querySelectorAll('.exp-entry-del');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function () {
        var id = parseInt(this.parentElement.getAttribute('data-id'), 10);
        deleteExpense(id);
      });
    }
  }

  function deleteExpense(id) {
    expenses = expenses.filter(function (e) { return e.id !== id; });
    saveExpenses(expenses);
    renderAll();
  }

  function addExpense(month, category, amount) {
    var id = Date.now() + Math.floor(Math.random() * 1000);
    expenses.push({ id: id, month: month, category: category, amount: amount });
    saveExpenses(expenses);
    renderAll();
  }

  // --- Full render ---
  function renderAll() {
    var data = getSlicedData(currentRange);
    updateSummary(data);
    renderBarChart(data);
    renderDonutChart(data);
    renderEntryList();
  }

  function render(range) {
    currentRange = range;
    renderAll();
  }

  // --- Add expense form ---
  function setupAddForm() {
    var btn = document.getElementById('exp-add-btn');
    var monthInput = document.getElementById('exp-input-month');
    var catInput = document.getElementById('exp-input-category');
    var amountInput = document.getElementById('exp-input-amount');

    // Default month to current
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    monthInput.value = y + '-' + m;

    btn.addEventListener('click', function () {
      var month = monthInput.value;
      var category = catInput.value;
      var amount = parseFloat(amountInput.value);

      // Clear previous error highlights
      monthInput.classList.remove('exp-field-error');
      catInput.classList.remove('exp-field-error');
      amountInput.classList.remove('exp-field-error');

      var valid = true;
      if (!month) { monthInput.classList.add('exp-field-error'); valid = false; }
      if (!category) { catInput.classList.add('exp-field-error'); valid = false; }
      if (isNaN(amount) || amount <= 0) { amountInput.classList.add('exp-field-error'); valid = false; }
      if (!valid) return;

      addExpense(month, category, amount);

      // Reset amount but keep month/category for quick repeat entry
      amountInput.value = '';
      amountInput.focus();
    });

    amountInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btn.click();
    });

    // Clear error highlight on interaction
    monthInput.addEventListener('input', function () { this.classList.remove('exp-field-error'); });
    catInput.addEventListener('change', function () { this.classList.remove('exp-field-error'); });
    amountInput.addEventListener('input', function () { this.classList.remove('exp-field-error'); });
  }

  // --- Clear all ---
  function setupClearAll() {
    var btn = document.getElementById('exp-clear-all-btn');
    btn.addEventListener('click', function () {
      if (expenses.length === 0) return;
      expenses = [];
      saveExpenses(expenses);
      renderAll();
    });
  }

  // --- Timeframe selector ---
  function setupTabs() {
    var tabBtns = document.querySelectorAll('[data-exp-range]');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener('click', function () {
        for (var j = 0; j < tabBtns.length; j++) {
          tabBtns[j].classList.remove('active');
        }
        this.classList.add('active');
        render(parseInt(this.getAttribute('data-exp-range'), 10));
      });
    }
  }

  // --- Init ---
  function init() {
    setupAddForm();
    setupClearAll();
    setupTabs();
    render(3);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();







