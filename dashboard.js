(function () {
  'use strict';

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

  function getPortfolioTotal(listId) {
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

  // --- Greeting ---
  function setGreeting() {
    var el = document.getElementById('greeting');
    var dateEl = document.getElementById('page-date');
    if (!el) return;

    var hour = new Date().getHours();
    if (hour < 12) el.textContent = 'Good morning';
    else if (hour < 17) el.textContent = 'Good afternoon';
    else el.textContent = 'Good evening';

    if (dateEl) {
      var now = new Date();
      var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
  }

  // --- Market status ---
  function updateMarketStatus() {
    var dotEl = document.querySelector('.market-dot');
    var labelEl = document.querySelector('.market-label');
    if (!dotEl || !labelEl) return;

    var now = new Date();
    var utcHour = now.getUTCHours();
    var utcMin = now.getUTCMinutes();
    var day = now.getUTCDay();
    var totalMin = utcHour * 60 + utcMin;

    // NYSE: 9:30 AM - 4:00 PM ET = 14:30 - 21:00 UTC (approx, ignoring DST)
    var isWeekday = day >= 1 && day <= 5;
    var isOpen = isWeekday && totalMin >= 870 && totalMin < 1260;

    if (isOpen) {
      dotEl.classList.add('open');
      labelEl.textContent = 'Markets Open';
    } else {
      dotEl.classList.remove('open');
      labelEl.textContent = 'Markets Closed';
    }
  }

  // --- Update stat cards ---
  function updateStats() {
    // Re-read cash from localStorage in case it was updated
    cashOnHand = loadNum('mm_cash', 0);
    monthlyBudget = loadNum('mm_budget', 0);

    var cryptoTotal = getPortfolioTotal('crypto-holdings-list');
    var stockTotal = getPortfolioTotal('stock-holdings-list');
    var ondoTotal = getPortfolioTotal('ondo-holdings-list');
    var investedTotal = cryptoTotal + stockTotal + ondoTotal;
    var netWorth = cashOnHand + investedTotal;

    var nwEl = document.getElementById('stat-networth');
    if (nwEl) nwEl.textContent = fmtMoney(netWorth);

    var nwSub = document.getElementById('stat-networth-sub');
    if (nwSub) nwSub.textContent = 'Cash + Investments';

    var cashEl = document.getElementById('stat-cash');
    if (cashEl) cashEl.textContent = fmtMoney(cashOnHand);

    var invEl = document.getElementById('stat-invested');
    if (invEl) invEl.textContent = fmtMoney(investedTotal);

    var investedSub = document.getElementById('stat-invested-sub');
    if (investedSub) {
      var parts = [];
      if (cryptoTotal > 0) parts.push(fmtMoney(cryptoTotal) + ' crypto');
      if (stockTotal > 0) parts.push(fmtMoney(stockTotal) + ' stocks');
      if (ondoTotal > 0) parts.push(fmtMoney(ondoTotal) + ' Ondo GM');
      investedSub.textContent = parts.length > 0 ? parts.join(', ') : 'Crypto + Stocks + Ondo GM';
    }

    var budgetEl = document.getElementById('stat-budget');
    if (budgetEl) budgetEl.textContent = fmtMoney(monthlyBudget);
  }

  // --- Cash edit ---
  function setupCashEdit() {
    var btn = document.getElementById('edit-cash-btn');
    var form = document.getElementById('cash-edit-form');
    var input = document.getElementById('cash-input');
    var saveBtn = document.getElementById('cash-save');
    var cancelBtn = document.getElementById('cash-cancel');
    if (!btn || !form) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
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

  // --- Budget edit ---
  function setupBudgetEdit() {
    var btn = document.getElementById('edit-budget-btn');
    var form = document.getElementById('budget-edit-form');
    var input = document.getElementById('budget-input');
    var saveBtn = document.getElementById('budget-save');
    var cancelBtn = document.getElementById('budget-cancel');
    if (!btn || !form) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
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

  function init() {
    setGreeting();
    updateMarketStatus();
    setupCashEdit();
    setupBudgetEdit();
    updateStats();

    setInterval(updateStats, 5000);
    setInterval(updateMarketStatus, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();





