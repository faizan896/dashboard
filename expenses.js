(function () {
  'use strict';

  var STORAGE_KEY = 'mm_expenses';

  var categories = [
    { key: 'housing',       label: 'Housing',       color: '#ef4444' },
    { key: 'food',          label: 'Food',          color: '#eab308' },
    { key: 'transport',     label: 'Transport',     color: '#3b82f6' },
    { key: 'utilities',     label: 'Utilities',     color: '#a78bfa' },
    { key: 'entertainment', label: 'Entertainment', color: '#22c55e' },
    { key: 'health',        label: 'Health',        color: '#06b6d4' },
    { key: 'shopping',      label: 'Shopping',      color: '#f97316' }
  ];

  function loadExpenses() {
    try { var raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
    return [];
  }

  function saveExpenses(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  var expenses = loadExpenses();

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
    var keys = Object.keys(map).sort();
    var result = [];
    for (var k = 0; k < keys.length; k++) {
      var entry = map[keys[k]];
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
      if (t > highest) { highest = t; highestLabel = data[i].label; }
    }
    var avg = data.length > 0 ? Math.round(total / data.length) : 0;

    var el;
    el = document.getElementById('exp-total');
    if (el) el.textContent = fmtMoney(total);
    el = document.getElementById('exp-avg');
    if (el) el.textContent = fmtMoney(avg);
    el = document.getElementById('exp-high');
    if (el) el.textContent = fmtMoney(highest);
    el = document.getElementById('exp-high-month');
    if (el) el.textContent = highestLabel || '--';

    var allData = aggregateByMonth();
    var dataLen = data.length;
    var prevSlice = allData.slice(0, allData.length - dataLen).slice(-dataLen);
    var changeEl = document.getElementById('exp-total-change');
    if (changeEl) {
      if (prevSlice.length > 0) {
        var prevTotal = 0;
        for (var j = 0; j < prevSlice.length; j++) prevTotal += getTotal(prevSlice[j]);
        if (prevTotal > 0) {
          var pctChange = ((total - prevTotal) / prevTotal) * 100;
          var sign = pctChange >= 0 ? '+' : '';
          changeEl.innerHTML = '<span class="' + (pctChange >= 0 ? 'text-status-red' : 'text-status-green') + '">'
            + sign + pctChange.toFixed(1) + '%</span> vs prev period';
        } else { changeEl.textContent = ''; }
      } else { changeEl.textContent = ''; }
    }

    var avgSubEl = document.getElementById('exp-avg-sub');
    if (avgSubEl) avgSubEl.textContent = data.length + ' month' + (data.length !== 1 ? 's' : '') + ' shown';
  }

  function renderBarChart(data) {
    var ctx = document.getElementById('expenses-bar-chart');
    if (!ctx) return;

    var labels = data.map(function (d) { return d.label; });
    var totals = data.map(function (d) { return getTotal(d); });

    var bgColors = totals.map(function (_, i) {
      return i === totals.length - 1 ? '#3b82f6' : '#27272a';
    });

    if (barChart) {
      barChart.data.labels = labels;
      barChart.data.datasets[0].data = totals;
      barChart.data.datasets[0].backgroundColor = bgColors;
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
          backgroundColor: bgColors,
          borderRadius: 6,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111113',
            titleColor: '#a1a1aa',
            bodyColor: '#fafafa',
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            borderColor: '#1e1e22',
            borderWidth: 1,
            callbacks: { label: function (context) { return fmtMoney(context.parsed.y); } }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#71717a', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
            display: false
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
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#111113',
              titleColor: '#a1a1aa',
              bodyColor: '#fafafa',
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 13 },
              padding: 12,
              cornerRadius: 8,
              borderColor: '#1e1e22',
              borderWidth: 1,
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

    var legendEl = document.getElementById('expenses-legend');
    if (legendEl) {
      var grandTotal = catTotals.reduce(function (a, b) { return a + b; }, 0);
      var html = '';
      for (var k = 0; k < categories.length; k++) {
        if (catTotals[k] <= 0) continue;
        var pct = grandTotal > 0 ? ((catTotals[k] / grandTotal) * 100).toFixed(0) : 0;
        html += '<div class="flex items-center justify-between">'
          + '<div class="flex items-center gap-2">'
          + '<div class="w-2 h-2 rounded-full" style="background:' + catColors[k] + '"></div>'
          + '<span class="text-[11px] text-gray-muted">' + catLabels[k] + '</span></div>'
          + '<span class="text-[11px] text-light-100 font-medium">' + pct + '%</span>'
          + '</div>';
      }
      legendEl.innerHTML = html;
    }
  }

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
      list.innerHTML = '<p class="text-[11px] text-gray-darker">No expenses yet. Add one above.</p>';
      return;
    }

    var sorted = expenses.slice().sort(function (a, b) {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      return b.id - a.id;
    });

    var html = '<div class="space-y-1">';
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      html += '<div class="flex items-center justify-between p-2.5 rounded-lg hover:bg-dark-700 transition-colors group" data-id="' + e.id + '">'
        + '<div class="flex items-center gap-3">'
        + '<div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:' + getCategoryColor(e.category) + '"></div>'
        + '<span class="text-[12px] text-light-100">' + getCategoryLabel(e.category) + '</span>'
        + '</div>'
        + '<div class="flex items-center gap-4">'
        + '<span class="text-[10px] text-gray-darker">' + formatMonthLabel(e.month) + '</span>'
        + '<span class="text-[12px] text-light-100 font-medium w-16 text-right">' + fmtMoney(e.amount) + '</span>'
        + '<button class="exp-entry-del text-gray-darker hover:text-status-red opacity-0 group-hover:opacity-100 transition-all">'
        + '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        + '</button></div></div>';
    }
    html += '</div>';
    list.innerHTML = html;

    var delBtns = list.querySelectorAll('.exp-entry-del');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function () {
        var id = parseInt(this.closest('[data-id]').getAttribute('data-id'), 10);
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

  function setupAddForm() {
    var btn = document.getElementById('exp-add-btn');
    var monthInput = document.getElementById('exp-input-month');
    var catInput = document.getElementById('exp-input-category');
    var amountInput = document.getElementById('exp-input-amount');
    if (!btn || !monthInput) return;

    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    monthInput.value = y + '-' + m;

    btn.addEventListener('click', function () {
      var month = monthInput.value;
      var category = catInput.value;
      var amount = parseFloat(amountInput.value);

      monthInput.classList.remove('form-field-error');
      catInput.classList.remove('form-field-error');
      amountInput.classList.remove('form-field-error');

      var valid = true;
      if (!month) { monthInput.classList.add('form-field-error'); valid = false; }
      if (!category) { catInput.classList.add('form-field-error'); valid = false; }
      if (isNaN(amount) || amount <= 0) { amountInput.classList.add('form-field-error'); valid = false; }
      if (!valid) return;

      addExpense(month, category, amount);
      amountInput.value = '';
      amountInput.focus();
    });

    amountInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
    monthInput.addEventListener('input', function () { this.classList.remove('form-field-error'); });
    catInput.addEventListener('change', function () { this.classList.remove('form-field-error'); });
    amountInput.addEventListener('input', function () { this.classList.remove('form-field-error'); });
  }

  function setupClearAll() {
    var btn = document.getElementById('exp-clear-all-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (expenses.length === 0) return;
      expenses = [];
      saveExpenses(expenses);
      renderAll();
    });
  }

  function setupTabs() {
    var tabBtns = document.querySelectorAll('[data-exp-range]');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener('click', function () {
        for (var j = 0; j < tabBtns.length; j++) {
          tabBtns[j].classList.remove('text-accent', 'border-b', 'border-accent', 'font-medium');
          tabBtns[j].classList.add('text-gray-dim');
        }
        this.classList.remove('text-gray-dim');
        this.classList.add('text-accent', 'border-b', 'border-accent', 'font-medium');
        render(parseInt(this.getAttribute('data-exp-range'), 10));
      });
    }
  }

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



