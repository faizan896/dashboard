(function () {
  'use strict';

  // --- Load saved values from localStorage ---
  function loadNum(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (v !== null) return parseFloat(v);
    } catch (e) { /* ignore */ }
    return fallback;
  }

  function saveNum(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) { /* ignore */ }
  }

  var cashOnHand = loadNum('mm_cash', 0);
  var monthlyBudget = loadNum('mm_budget', 0);

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  // --- Read portfolio values from the global price caches ---
  function getCryptoTotal() {
    var total = 0;
    try {
      var holdings = JSON.parse(localStorage.getItem('mm_crypto') || '[]');
      for (var i = 0; i < holdings.length; i++) {
        if (holdings[i].qty > 0) {
          // Try to read price from the DOM (portfolio.js updates these)
          // We'll parse from the rendered holding items
        }
      }
    } catch (e) { /* ignore */ }

    // Read from rendered DOM — portfolio.js puts values in .asset-value spans
    var cryptoList = document.getElementById('crypto-holdings-list');
    if (cryptoList) {
      var items = cryptoList.querySelectorAll('.holding-item');
      for (var j = 0; j < items.length; j++) {
        var valEl = items[j].querySelector('.asset-value');
        if (valEl) {
          var text = valEl.textContent.replace(/[$,]/g, '');
          var num = parseFloat(text);
          if (!isNaN(num)) total += num;
        }
      }
    }
    return total;
  }

  function getStockTotal() {
    var total = 0;
    var stockList = document.getElementById('stock-holdings-list');
    if (stockList) {
      var items = stockList.querySelectorAll('.holding-item');
      for (var j = 0; j < items.length; j++) {
        var valEl = items[j].querySelector('.asset-value');
        if (valEl) {
          var text = valEl.textContent.replace(/[$,]/g, '');
          var num = parseFloat(text);
          if (!isNaN(num)) total += num;
        }
      }
    }
    return total;
  }

  // --- Update stat cards ---
  function updateStats() {
    var cryptoTotal = getCryptoTotal();
    var stockTotal = getStockTotal();
    var investedTotal = cryptoTotal + stockTotal;
    var netWorth = cashOnHand + investedTotal;

    document.getElementById('stat-networth').textContent = fmtMoney(netWorth);
    document.getElementById('stat-networth-sub').textContent =
      'Cash + Investments';
    document.getElementById('stat-networth-sub').className = 'stat-change';

    document.getElementById('stat-cash').textContent = fmtMoney(cashOnHand);
    document.getElementById('stat-invested').textContent = fmtMoney(investedTotal);

    var investedSub = document.getElementById('stat-invested-sub');
    if (cryptoTotal > 0 || stockTotal > 0) {
      investedSub.textContent = fmtMoney(cryptoTotal) + ' crypto, ' + fmtMoney(stockTotal) + ' stocks';
    } else {
      investedSub.textContent = 'Crypto + Stocks';
    }

    document.getElementById('stat-budget').textContent = fmtMoney(monthlyBudget);
  }

  // --- Cash edit form ---
  function setupCashEdit() {
    var btn = document.getElementById('edit-cash-btn');
    var form = document.getElementById('cash-edit-form');
    var input = document.getElementById('cash-input');
    var saveBtn = document.getElementById('cash-save');
    var cancelBtn = document.getElementById('cash-cancel');

    btn.addEventListener('click', function () {
      form.classList.toggle('show');
      if (form.classList.contains('show')) {
        input.value = cashOnHand || '';
        input.focus();
      }
    });

    saveBtn.addEventListener('click', function () {
      cashOnHand = parseFloat(input.value) || 0;
      saveNum('mm_cash', cashOnHand);
      form.classList.remove('show');
      updateStats();
    });

    cancelBtn.addEventListener('click', function () {
      form.classList.remove('show');
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });
  }

  // --- Budget edit form ---
  function setupBudgetEdit() {
    var btn = document.getElementById('edit-budget-btn');
    var form = document.getElementById('budget-edit-form');
    var input = document.getElementById('budget-input');
    var saveBtn = document.getElementById('budget-save');
    var cancelBtn = document.getElementById('budget-cancel');

    btn.addEventListener('click', function () {
      form.classList.toggle('show');
      if (form.classList.contains('show')) {
        input.value = monthlyBudget || '';
        input.focus();
      }
    });

    saveBtn.addEventListener('click', function () {
      monthlyBudget = parseFloat(input.value) || 0;
      saveNum('mm_budget', monthlyBudget);
      form.classList.remove('show');
      updateStats();
    });

    cancelBtn.addEventListener('click', function () {
      form.classList.remove('show');
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });
  }

  // --- Init ---
  function init() {
    setupCashEdit();
    setupBudgetEdit();
    updateStats();

    // Re-calculate every 5 seconds (picks up portfolio price updates)
    setInterval(updateStats, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

