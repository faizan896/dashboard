(function () {
  'use strict';

  var SNAPSHOTS_KEY = 'mm_portfolio_snapshots';
  var viewMode = 'networth'; // 'networth' or 'returns'

  function loadSnapshots() {
    try {
      var raw = localStorage.getItem(SNAPSHOTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return [];
  }

  function saveSnapshots(list) {
    try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  var snapshots = loadSnapshots();

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  // --- Read current portfolio value from DOM ---
  function getPortfolioValueFromDOM(listId) {
    var total = 0;
    var list = document.getElementById(listId);
    if (!list) return 0;
    var items = list.querySelectorAll('.holding-item');
    for (var j = 0; j < items.length; j++) {
      var valEl = items[j].querySelector('.asset-value');
      if (valEl) {
        var text = valEl.textContent.replace(/[$,\u2014]/g, '');
        var num = parseFloat(text);
        if (!isNaN(num)) total += num;
      }
    }
    return total;
  }

  function getCurrentNetWorth() {
    var cash = 0;
    try {
      var v = localStorage.getItem('mm_cash');
      if (v !== null) cash = parseFloat(v) || 0;
    } catch (e) { /* ignore */ }

    var crypto = getPortfolioValueFromDOM('crypto-holdings-list');
    var stocks = getPortfolioValueFromDOM('stock-holdings-list');
    var ondo = getPortfolioValueFromDOM('ondo-holdings-list');
    return cash + crypto + stocks + ondo;
  }

  function recordSnapshot() {
    var nw = getCurrentNetWorth();
    if (nw <= 0) return;

    var today = new Date().toISOString().slice(0, 10);
    if (snapshots.length > 0 && snapshots[snapshots.length - 1].date === today) {
      snapshots[snapshots.length - 1].value = nw;
    } else {
      snapshots.push({ date: today, value: nw });
    }
    if (snapshots.length > 365) snapshots = snapshots.slice(-365);
    saveSnapshots(snapshots);
  }

  // --- Chart ---
  var overviewChart = null;

  function renderChart() {
    var ctx = document.getElementById('overview-chart');
    if (!ctx) return;

    var heroVal = document.getElementById('chart-hero-value');

    // Always try to record a snapshot
    recordSnapshot();

    if (snapshots.length < 1) {
      if (heroVal) heroVal.textContent = fmtMoney(getCurrentNetWorth());
      if (overviewChart) { overviewChart.destroy(); overviewChart = null; }
      return;
    }

    var labels = snapshots.map(function (s) {
      var parts = s.date.split('-');
      var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return monthNames[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
    });

    var values;
    var labelText;
    var lineColor;
    var fillColor;

    if (viewMode === 'returns') {
      var baseVal = snapshots[0].value;
      values = snapshots.map(function (s) {
        return baseVal > 0 ? ((s.value - baseVal) / baseVal) * 100 : 0;
      });
      var currentReturn = values[values.length - 1];
      labelText = (currentReturn >= 0 ? '+' : '') + currentReturn.toFixed(2) + '%';
      lineColor = currentReturn >= 0 ? '#10b981' : '#ef4444';
      fillColor = currentReturn >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
    } else {
      values = snapshots.map(function (s) { return s.value; });
      var currentVal = values[values.length - 1];
      labelText = fmtMoney(currentVal);
      var isUp = values.length >= 2 ? values[values.length - 1] >= values[0] : true;
      lineColor = isUp ? '#10b981' : '#ef4444';
      fillColor = isUp ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
    }

    if (heroVal) heroVal.textContent = labelText;

    if (overviewChart) {
      overviewChart.data.labels = labels;
      overviewChart.data.datasets[0].data = values;
      overviewChart.data.datasets[0].borderColor = lineColor;
      overviewChart.data.datasets[0].backgroundColor = fillColor;
      overviewChart.options.scales.y.ticks.callback = viewMode === 'returns'
        ? function (v) { return v.toFixed(1) + '%'; }
        : function (v) { return v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v; };
      overviewChart.options.plugins.tooltip.callbacks.label = viewMode === 'returns'
        ? function (c) { return (c.parsed.y >= 0 ? '+' : '') + c.parsed.y.toFixed(2) + '%'; }
        : function (c) { return fmtMoney(c.parsed.y); };
      overviewChart.update();
      return;
    }

    overviewChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: viewMode === 'returns' ? 'Return' : 'Net Worth',
          data: values,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.4,
          pointRadius: values.length > 30 ? 0 : 4,
          pointHoverRadius: 6,
          pointBackgroundColor: lineColor,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a25',
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 14, weight: '600' },
            padding: 14,
            cornerRadius: 10,
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            callbacks: {
              label: viewMode === 'returns'
                ? function (c) { return (c.parsed.y >= 0 ? '+' : '') + c.parsed.y.toFixed(2) + '%'; }
                : function (c) { return fmtMoney(c.parsed.y); }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#5e5e78', font: { size: 11 }, maxTicksLimit: 8 }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
            ticks: {
              color: '#5e5e78',
              font: { size: 11 },
              callback: viewMode === 'returns'
                ? function (v) { return v.toFixed(1) + '%'; }
                : function (v) { return v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v; }
            }
          }
        }
      }
    });
  }

  // --- Allocation donut ---
  var allocChart = null;

  function renderAllocationChart() {
    var ctx = document.getElementById('allocation-chart');
    if (!ctx) return;

    var cash = 0;
    try {
      var v = localStorage.getItem('mm_cash');
      if (v !== null) cash = parseFloat(v) || 0;
    } catch (e) { /* ignore */ }

    var crypto = getPortfolioValueFromDOM('crypto-holdings-list');
    var stocks = getPortfolioValueFromDOM('stock-holdings-list');
    var ondo = getPortfolioValueFromDOM('ondo-holdings-list');
    var total = cash + crypto + stocks + ondo;

    var data = [cash, crypto, stocks, ondo];
    var labels = ['Cash', 'Crypto', 'Stocks', 'Ondo GM'];
    var colors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#0052FF'];

    if (allocChart) {
      allocChart.data.datasets[0].data = data;
      allocChart.update();
    } else {
      allocChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 3,
            borderColor: '#111119',
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a1a25',
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 13 },
              padding: 12,
              cornerRadius: 10,
              callbacks: {
                label: function (context) {
                  var pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                  return ' $' + Math.round(context.parsed).toLocaleString('en-US') + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      });
    }

    // Legend
    var legendEl = document.getElementById('allocation-legend');
    if (legendEl) {
      var html = '';
      for (var i = 0; i < labels.length; i++) {
        var pct = total > 0 ? ((data[i] / total) * 100).toFixed(0) : 0;
        html += '<div class="alloc-legend-item">'
          + '<span class="alloc-legend-dot" style="background:' + colors[i] + '"></span>'
          + labels[i]
          + '<span class="alloc-legend-value">' + pct + '%</span>'
          + '</div>';
      }
      legendEl.innerHTML = html;
    }
  }

  // --- Toggle ---
  function setupToggle() {
    var btns = document.querySelectorAll('[data-overview]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
        this.classList.add('active');
        viewMode = this.getAttribute('data-overview');
        if (overviewChart) { overviewChart.destroy(); overviewChart = null; }
        renderChart();
      });
    }
  }

  function renderAll() {
    renderChart();
    renderAllocationChart();
  }

  function init() {
    setupToggle();
    // Wait for portfolio prices to load first
    setTimeout(renderAll, 4000);
    // Also retry after 8s in case proxies were slow
    setTimeout(renderAll, 8000);
    // Refresh every 15 seconds
    setInterval(renderAll, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


