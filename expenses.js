(function () {
  'use strict';
  var expenseData = [
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
  var categories = [
    { key: 'housing', label: 'Housing', color: '#0f2040' },
    { key: 'food', label: 'Food', color: '#2563eb' },
    { key: 'transport', label: 'Transport', color: '#3b82f6' },
    { key: 'utilities', label: 'Utilities', color: '#60a5fa' },
    { key: 'entertainment', label: 'Entertainment', color: '#93c5fd' },
    { key: 'health', label: 'Health', color: '#22c55e' },
    { key: 'shopping', label: 'Shopping', color: '#f59e0b' }
  ];
  var barChart = null, donutChart = null, currentRange = 3;
  function getTotal(entry) { var sum = 0; for (var i = 0; i < categories.length; i++) sum += entry[categories[i].key] || 0; return sum; }
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
  var tabBtns = document.querySelectorAll('[data-exp-range]');
  for (var i = 0; i < tabBtns.length; i++) { tabBtns[i].addEventListener('click', function () { for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active'); this.classList.add('active'); render(parseInt(this.getAttribute('data-exp-range'), 10)); }); }
  render(3);
})();
