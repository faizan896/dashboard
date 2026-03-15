(function () {
  'use strict';

  var SNAPSHOTS_KEY = 'mm_portfolio_snapshots';
  var viewMode = 'networth';

  function loadSnapshots() {
    try { var raw = localStorage.getItem(SNAPSHOTS_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
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

  function getPortfolioValueFromDOM(listId) {
    var total = 0;
    var list = document.getElementById(listId);
    if (!list) return 0;
    var items = list.querySelectorAll('[data-value]');
    for (var j = 0; j < items.length; j++) {
      var num = parseFloat(items[j].getAttribute('data-value'));
      if (!isNaN(num)) total += num;
    }
    return total;
  }

  function getCurrentNetWorth() {
    var cash = 0;
    try { var v = localStorage.getItem('mm_cash'); if (v !== null) cash = parseFloat(v) || 0; } catch (e) { /* ignore */ }
    var crypto = getPortfolioValueFromDOM('crypto-list');
    var stocks = getPortfolioValueFromDOM('stock-list');
    var ondo = getPortfolioValueFromDOM('ondo-list');
    return cash + crypto + stocks + ondo;
  }

  function recordSnapshot() {
    var nw = getCurrentNetWorth();
    var today = new Date().toISOString().slice(0, 10);
    if (snapshots.length > 0 && snapshots[snapshots.length - 1].date === today) {
      snapshots[snapshots.length - 1].value = nw;
    } else {
      snapshots.push({ date: today, value: nw });
    }
    if (snapshots.length > 365) snapshots = snapshots.slice(-365);
    saveSnapshots(snapshots);
  }

  var overviewChart = null;

  function renderChart() {
    var ctx = document.getElementById('overview-chart');
    if (!ctx) return;

    var heroVal = document.getElementById('chart-total-display');
    recordSnapshot();

    var currentNW = getCurrentNetWorth();
    if (snapshots.length < 1) {
      if (heroVal) heroVal.textContent = fmtMoney(currentNW);
      if (overviewChart) { overviewChart.destroy(); overviewChart = null; }
      return;
    }
    if (snapshots.length === 1) {
      var s = snapshots[0];
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      snapshots.unshift({ date: yesterday.toISOString().slice(0, 10), value: s.value });
    }

    var labels = snapshots.map(function (s) {
      var parts = s.date.split('-');
      var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return monthNames[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
    });

    var values, labelText, lineColor, fillColor;

    if (viewMode === 'returns') {
      var baseVal = snapshots[0].value;
      values = snapshots.map(function (s) {
        return baseVal > 0 ? ((s.value - baseVal) / baseVal) * 100 : 0;
      });
      var currentReturn = values[values.length - 1];
      labelText = (currentReturn >= 0 ? '+' : '') + currentReturn.toFixed(2) + '%';
      lineColor = currentReturn >= 0 ? '#22c55e' : '#ef4444';
      fillColor = currentReturn >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';
    } else {
      values = snapshots.map(function (s) { return s.value; });
      labelText = fmtMoney(values[values.length - 1]);
      lineColor = '#3b82f6';
      fillColor = 'rgba(59,130,246,0.08)';
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
          pointHoverBackgroundColor: '#fafafa',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111113',
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 14, weight: '600' },
            titleColor: '#a1a1aa',
            bodyColor: '#fafafa',
            padding: 14,
            cornerRadius: 8,
            borderColor: '#1e1e22',
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
            border: { display: false },
            ticks: { color: '#71717a', font: { size: 11 }, maxTicksLimit: 8 }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
            ticks: {
              color: '#71717a',
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

  var allocChart = null;

  function renderAllocationChart() {
    var ctx = document.getElementById('allocation-chart');
    if (!ctx) return;

    var cash = 0;
    try { var v = localStorage.getItem('mm_cash'); if (v !== null) cash = parseFloat(v) || 0; } catch (e) { /* ignore */ }

    var crypto = getPortfolioValueFromDOM('crypto-list');
    var stocks = getPortfolioValueFromDOM('stock-list');
    var ondo = getPortfolioValueFromDOM('ondo-list');
    var total = cash + crypto + stocks + ondo;

    var data = [stocks, crypto, ondo, cash];
    var labels = ['Stocks', 'Crypto', 'Ondo GM', 'Cash'];
    var colors = ['#3b82f6', '#22c55e', '#a78bfa', '#eab308'];

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
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '80%',
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
                  var pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                  return ' $' + Math.round(context.parsed).toLocaleString('en-US') + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      });
    }

    var legendEl = document.getElementById('allocation-legend');
    if (legendEl) {
      var html = '';
      for (var i = 0; i < labels.length; i++) {
        var pct = total > 0 ? ((data[i] / total) * 100).toFixed(0) : 0;
        html += '<div class="flex items-center justify-between">'
          + '<div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style="background:' + colors[i] + '"></div>'
          + '<span class="text-[11px] text-gray-muted">' + labels[i] + '</span></div>'
          + '<span class="text-[11px] text-light-100 font-medium">' + pct + '%</span>'
          + '</div>';
      }
      legendEl.innerHTML = html;
    }
  }

  function setupToggle() {
    var btns = document.querySelectorAll('[data-overview]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        for (var j = 0; j < btns.length; j++) {
          btns[j].classList.remove('bg-accent/15', 'text-accent-light', 'font-medium');
          btns[j].classList.add('text-gray-dim');
        }
        this.classList.remove('text-gray-dim');
        this.classList.add('bg-accent/15', 'text-accent-light', 'font-medium');
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
    renderAll();
    setTimeout(renderAll, 1000);
    setTimeout(renderAll, 3000);
    setTimeout(renderAll, 6000);
    setTimeout(renderAll, 10000);
    setInterval(renderAll, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();





