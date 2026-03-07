(function () {
  'use strict';

  var STORAGE_KEY = 'mm_transactions';
  // Portfolio snapshots for performance chart (daily granularity)
  var SNAPSHOTS_KEY = 'mm_portfolio_snapshots';

  // Transaction types: buy, sell
  // Each: { id, date: "2026-03-01", type: "buy"|"sell", asset: "BTC", assetType: "crypto"|"stock"|"ondo", qty, price, total }

  function loadTransactions() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return [];
  }

  function saveTransactions(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

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

  var transactions = loadTransactions();
  var snapshots = loadSnapshots();

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtMoneyShort(n) {
    if (n == null || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  // --- Cost basis calculations ---
  // Uses FIFO (First In, First Out) method
  function calculateCostBasis(assetKey) {
    var buys = []; // queue of { qty, price }
    var totalCost = 0;
    var totalQty = 0;
    var realizedPnl = 0;
    var totalInvested = 0; // total $ spent buying (for ROI calc)

    var assetTxns = transactions.filter(function (t) { return t.asset === assetKey; });
    // Sort by date, then by id for same-date ordering
    assetTxns.sort(function (a, b) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.id - b.id;
    });

    for (var i = 0; i < assetTxns.length; i++) {
      var t = assetTxns[i];
      if (t.type === 'buy') {
        buys.push({ qty: t.qty, price: t.price });
        totalCost += t.qty * t.price;
        totalQty += t.qty;
        totalInvested += t.qty * t.price;
      } else if (t.type === 'sell') {
        var sellQty = t.qty;
        var sellPrice = t.price;
        while (sellQty > 0 && buys.length > 0) {
          var lot = buys[0];
          var usedQty = Math.min(sellQty, lot.qty);
          realizedPnl += usedQty * (sellPrice - lot.price);
          totalCost -= usedQty * lot.price;
          totalQty -= usedQty;
          lot.qty -= usedQty;
          sellQty -= usedQty;
          if (lot.qty <= 0) buys.shift();
        }
      }
    }

    var avgCost = totalQty > 0 ? totalCost / totalQty : 0;

    return {
      totalQty: totalQty,
      totalCost: totalCost,       // current cost basis of remaining holdings
      avgCost: avgCost,           // average cost per unit
      realizedPnl: realizedPnl,   // realized profit/loss from sells
      totalInvested: totalInvested // total $ ever spent buying
    };
  }

  // Calculate unrealized P&L given current price
  function getUnrealizedPnl(assetKey, currentPrice) {
    var basis = calculateCostBasis(assetKey);
    if (basis.totalQty <= 0 || currentPrice == null) return { unrealizedPnl: 0, unrealizedPct: 0, basis: basis };
    var marketValue = basis.totalQty * currentPrice;
    var unrealizedPnl = marketValue - basis.totalCost;
    var unrealizedPct = basis.totalCost > 0 ? (unrealizedPnl / basis.totalCost) * 100 : 0;
    return {
      unrealizedPnl: unrealizedPnl,
      unrealizedPct: unrealizedPct,
      marketValue: marketValue,
      basis: basis
    };
  }

  // Get all unique assets with transactions
  function getTrackedAssets() {
    var map = {};
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      if (!map[t.asset]) {
        map[t.asset] = { asset: t.asset, assetType: t.assetType };
      }
    }
    return Object.values(map);
  }

  // --- Add/delete transactions ---
  function addTransaction(date, type, asset, assetType, qty, price) {
    var id = Date.now() + Math.floor(Math.random() * 1000);
    var total = qty * price;
    transactions.push({ id: id, date: date, type: type, asset: asset, assetType: assetType, qty: qty, price: price, total: total });
    saveTransactions(transactions);
    renderAll();
  }

  function deleteTransaction(id) {
    transactions = transactions.filter(function (t) { return t.id !== id; });
    saveTransactions(transactions);
    renderAll();
  }

  // --- Portfolio snapshot (call periodically to build history) ---
  function recordSnapshot(totalValue) {
    var today = new Date().toISOString().slice(0, 10);
    // Only one snapshot per day
    if (snapshots.length > 0 && snapshots[snapshots.length - 1].date === today) {
      snapshots[snapshots.length - 1].value = totalValue;
    } else {
      snapshots.push({ date: today, value: totalValue });
    }
    // Keep max 365 days
    if (snapshots.length > 365) snapshots = snapshots.slice(-365);
    saveSnapshots(snapshots);
  }

  // --- Summary stats ---
  function getPortfolioSummary() {
    var totalInvested = 0;
    var totalRealized = 0;
    var buyCount = 0;
    var sellCount = 0;

    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      if (t.type === 'buy') {
        buyCount++;
      } else {
        sellCount++;
      }
    }

    var assets = getTrackedAssets();
    for (var j = 0; j < assets.length; j++) {
      var basis = calculateCostBasis(assets[j].asset);
      totalInvested += basis.totalCost;
      totalRealized += basis.realizedPnl;
    }

    return {
      totalInvested: totalInvested,
      totalRealized: totalRealized,
      txnCount: transactions.length,
      buyCount: buyCount,
      sellCount: sellCount,
      assetCount: assets.length
    };
  }

  // --- Performance chart (Ondo portfolio line chart) ---
  var perfChart = null;

  function renderPerformanceChart() {
    var ctx = document.getElementById('ondo-perf-chart');
    if (!ctx) return;

    // Build data from snapshots
    if (snapshots.length < 1) {
      // No data yet
      if (perfChart) {
        perfChart.destroy();
        perfChart = null;
      }
      return;
    }

    var labels = snapshots.map(function (s) {
      var parts = s.date.split('-');
      var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return monthNames[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
    });
    var values = snapshots.map(function (s) { return s.value; });

    if (perfChart) {
      perfChart.data.labels = labels;
      perfChart.data.datasets[0].data = values;
      perfChart.update();
      return;
    }

    perfChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio Value',
          data: values,
          borderColor: '#0052FF',
          backgroundColor: 'rgba(0, 82, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: values.length > 30 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2
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
            ticks: { color: '#8a8a9a', font: { size: 11 }, maxTicksLimit: 8 }
          },
          y: {
            grid: { color: '#2a2a2a' },
            border: { display: false },
            ticks: {
              color: '#8a8a9a',
              font: { size: 11 },
              callback: function (value) {
                if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'k';
                return '$' + value;
              }
            }
          }
        }
      }
    });
  }

  // --- Render transaction list ---
  function renderTransactionList() {
    var list = document.getElementById('txn-entries-list');
    if (!list) return;

    if (transactions.length === 0) {
      list.innerHTML = '<p class="text-muted" style="font-size:13px;">No transactions yet. Log a buy or sell above.</p>';
      return;
    }

    // Sort newest first
    var sorted = transactions.slice().sort(function (a, b) {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.id - a.id;
    });

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var t = sorted[i];
      var typeClass = t.type === 'buy' ? 'txn-buy' : 'txn-sell';
      var typeLabel = t.type === 'buy' ? 'BUY' : 'SELL';
      var dateLabel = formatDateShort(t.date);

      html += '<div class="txn-entry-item" data-id="' + t.id + '">'
        + '<span class="txn-type-badge ' + typeClass + '">' + typeLabel + '</span>'
        + '<span class="txn-entry-date">' + dateLabel + '</span>'
        + '<span class="txn-entry-asset">' + escHtml(t.asset) + '</span>'
        + '<span class="txn-entry-detail">' + t.qty + ' @ ' + fmtMoney(t.price) + '</span>'
        + '<span class="txn-entry-total">' + fmtMoney(t.total) + '</span>'
        + '<button class="exp-entry-del txn-del" title="Delete">&times;</button>'
        + '</div>';
    }
    list.innerHTML = html;

    var delBtns = list.querySelectorAll('.txn-del');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function () {
        var id = parseInt(this.parentElement.getAttribute('data-id'), 10);
        deleteTransaction(id);
      });
    }
  }

  // --- Render P&L summary per asset ---
  function renderPnlSummary() {
    var container = document.getElementById('pnl-summary-list');
    if (!container) return;

    var assets = getTrackedAssets();
    if (assets.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:13px;">Add transactions to see P&L breakdown.</p>';
      return;
    }

    // Try to get current prices from rendered DOM
    var html = '';
    for (var i = 0; i < assets.length; i++) {
      var a = assets[i];
      var basis = calculateCostBasis(a.asset);
      if (basis.totalQty <= 0 && basis.realizedPnl === 0) continue;

      var currentPrice = getCurrentPriceFromDOM(a.asset, a.assetType);
      var unrealized = getUnrealizedPnl(a.asset, currentPrice);

      var unrealizedClass = unrealized.unrealizedPnl >= 0 ? 'positive' : 'negative';
      var realizedClass = basis.realizedPnl >= 0 ? 'positive' : 'negative';

      html += '<div class="pnl-row">'
        + '<div class="pnl-asset">'
        + '<span class="pnl-asset-name">' + escHtml(a.asset) + '</span>'
        + '<span class="pnl-asset-type">' + escHtml(a.assetType) + '</span>'
        + '</div>'
        + '<div class="pnl-details">'
        + '<div class="pnl-col">'
        + '<span class="pnl-label">Qty</span>'
        + '<span class="pnl-val">' + basis.totalQty.toLocaleString('en-US', { maximumFractionDigits: 6 }) + '</span>'
        + '</div>'
        + '<div class="pnl-col">'
        + '<span class="pnl-label">Avg Cost</span>'
        + '<span class="pnl-val">' + fmtMoney(basis.avgCost) + '</span>'
        + '</div>'
        + '<div class="pnl-col">'
        + '<span class="pnl-label">Cost Basis</span>'
        + '<span class="pnl-val">' + fmtMoneyShort(basis.totalCost) + '</span>'
        + '</div>'
        + '<div class="pnl-col">'
        + '<span class="pnl-label">Unrealized</span>'
        + '<span class="pnl-val ' + unrealizedClass + '">' + (unrealized.unrealizedPnl >= 0 ? '+' : '') + fmtMoney(unrealized.unrealizedPnl)
        + (unrealized.unrealizedPct !== 0 ? ' (' + (unrealized.unrealizedPct >= 0 ? '+' : '') + unrealized.unrealizedPct.toFixed(1) + '%)' : '')
        + '</span>'
        + '</div>'
        + '<div class="pnl-col">'
        + '<span class="pnl-label">Realized</span>'
        + '<span class="pnl-val ' + realizedClass + '">' + (basis.realizedPnl >= 0 ? '+' : '') + fmtMoney(basis.realizedPnl) + '</span>'
        + '</div>'
        + '</div>'
        + '</div>';
    }

    if (html === '') {
      container.innerHTML = '<p class="text-muted" style="font-size:13px;">No open positions or realized P&L yet.</p>';
    } else {
      container.innerHTML = html;
    }
  }

  // --- Render top-level P&L stats ---
  function renderPnlStats() {
    var assets = getTrackedAssets();
    var totalUnrealized = 0;
    var totalRealized = 0;
    var totalCostBasis = 0;
    var totalMarketValue = 0;

    for (var i = 0; i < assets.length; i++) {
      var a = assets[i];
      var basis = calculateCostBasis(a.asset);
      totalRealized += basis.realizedPnl;
      totalCostBasis += basis.totalCost;

      var currentPrice = getCurrentPriceFromDOM(a.asset, a.assetType);
      if (currentPrice != null && basis.totalQty > 0) {
        var mv = basis.totalQty * currentPrice;
        totalMarketValue += mv;
        totalUnrealized += mv - basis.totalCost;
      }
    }

    var totalPnl = totalRealized + totalUnrealized;

    var el;
    el = document.getElementById('pnl-stat-total');
    if (el) {
      el.textContent = (totalPnl >= 0 ? '+' : '') + fmtMoneyShort(totalPnl);
      el.className = 'pnl-stat-value ' + (totalPnl >= 0 ? 'positive' : 'negative');
    }

    el = document.getElementById('pnl-stat-unrealized');
    if (el) {
      el.textContent = (totalUnrealized >= 0 ? '+' : '') + fmtMoneyShort(totalUnrealized);
      el.className = 'pnl-stat-value ' + (totalUnrealized >= 0 ? 'positive' : 'negative');
    }

    el = document.getElementById('pnl-stat-realized');
    if (el) {
      el.textContent = (totalRealized >= 0 ? '+' : '') + fmtMoneyShort(totalRealized);
      el.className = 'pnl-stat-value ' + (totalRealized >= 0 ? 'positive' : 'negative');
    }

    el = document.getElementById('pnl-stat-invested');
    if (el) {
      el.textContent = fmtMoneyShort(totalCostBasis);
    }

    // Record snapshot for performance chart
    if (totalMarketValue > 0 || totalCostBasis > 0) {
      recordSnapshot(totalMarketValue > 0 ? totalMarketValue : totalCostBasis);
    }

    renderPerformanceChart();
  }

  // --- Try to get current price from DOM ---
  function getCurrentPriceFromDOM(asset, assetType) {
    // For crypto: look in crypto-holdings-list for matching ticker
    // For stock: look in stock-holdings-list
    // For ondo: look in ondo-holdings-list
    var listId;
    if (assetType === 'crypto') listId = 'crypto-holdings-list';
    else if (assetType === 'stock') listId = 'stock-holdings-list';
    else if (assetType === 'ondo') listId = 'ondo-holdings-list';
    else return null;

    var list = document.getElementById(listId);
    if (!list) return null;

    var items = list.querySelectorAll('.holding-item');
    for (var i = 0; i < items.length; i++) {
      var tickerEl = items[i].querySelector('.asset-ticker');
      var valueEl = items[i].querySelector('.asset-value');
      if (tickerEl && valueEl) {
        var tickerText = tickerEl.textContent.split('\u00B7')[0].trim(); // text before middot
        if (tickerText === asset) {
          var priceText = valueEl.textContent.replace(/[$,]/g, '');
          var price = parseFloat(priceText);
          if (!isNaN(price)) return price;
        }
      }
    }
    return null;
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDateShort(dateStr) {
    var parts = dateStr.split('-');
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return monthNames[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }

  // --- Build asset dropdown from current holdings ---
  function populateAssetDropdown() {
    var select = document.getElementById('txn-input-asset');
    if (!select) return;

    var options = '<option value="">Select asset...</option>';
    var added = {};

    // Crypto
    try {
      var crypto = JSON.parse(localStorage.getItem('mm_crypto') || '[]');
      if (crypto.length > 0) {
        options += '<optgroup label="Crypto">';
        for (var i = 0; i < crypto.length; i++) {
          var key = crypto[i].ticker;
          if (!added[key]) {
            options += '<option value="' + key + '" data-type="crypto">' + key + ' - ' + (crypto[i].name || key) + '</option>';
            added[key] = true;
          }
        }
        options += '</optgroup>';
      }
    } catch (e) { /* ignore */ }

    // Stocks
    try {
      var stocks = JSON.parse(localStorage.getItem('mm_stocks') || '[]');
      if (stocks.length > 0) {
        options += '<optgroup label="Stocks">';
        for (var j = 0; j < stocks.length; j++) {
          var skey = stocks[j].symbol;
          if (!added[skey]) {
            options += '<option value="' + skey + '" data-type="stock">' + skey + ' - ' + (stocks[j].name || skey) + '</option>';
            added[skey] = true;
          }
        }
        options += '</optgroup>';
      }
    } catch (e) { /* ignore */ }

    // Ondo
    try {
      var ondo = JSON.parse(localStorage.getItem('mm_ondo') || '[]');
      if (ondo.length > 0) {
        options += '<optgroup label="Ondo GM (Tokenized)">';
        for (var k = 0; k < ondo.length; k++) {
          var okey = ondo[k].symbol;
          if (!added[okey]) {
            options += '<option value="' + okey + '" data-type="ondo">' + okey + ' - ' + (ondo[k].name || okey) + '</option>';
            added[okey] = true;
          }
        }
        options += '</optgroup>';
      }
    } catch (e) { /* ignore */ }

    // Also allow typing custom asset in the text field
    select.innerHTML = options;
  }

  // --- Form setup ---
  function setupAddForm() {
    var btn = document.getElementById('txn-add-btn');
    var dateInput = document.getElementById('txn-input-date');
    var typeSelect = document.getElementById('txn-input-type');
    var assetSelect = document.getElementById('txn-input-asset');
    var customInput = document.getElementById('txn-input-custom-asset');
    var customTypeSelect = document.getElementById('txn-input-custom-type');
    var qtyInput = document.getElementById('txn-input-qty');
    var priceInput = document.getElementById('txn-input-price');
    var totalDisplay = document.getElementById('txn-total-display');
    var toggleCustom = document.getElementById('txn-toggle-custom');

    if (!btn || !dateInput) return;

    // Default date to today
    dateInput.value = new Date().toISOString().slice(0, 10);

    // Show/hide custom asset input
    var useCustom = false;
    if (toggleCustom) {
      toggleCustom.addEventListener('click


