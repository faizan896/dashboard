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
    var items = list.querySelectorAll('[data-value]');
    for (var j = 0; j < items.length; j++) {
      var num = parseFloat(items[j].getAttribute('data-value'));
      if (!isNaN(num)) total += num;
    }
    return total;
  }

  // --- Greeting ---
  function setGreeting() {
    var el = document.getElementById('greeting-text');
    var dateEl = document.getElementById('current-date');
    if (!el) return;

    var now = new Date();
    var hour = now.getHours();
    if (hour < 12) el.textContent = 'Good morning, Investor';
    else if (hour < 17) el.textContent = 'Good afternoon, Investor';
    else el.textContent = 'Good evening, Investor';

    if (dateEl) {
      var options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
  }

  // --- Market status ---
  function updateMarketStatus() {
    var dotEl = document.getElementById('market-status-dot');
    var labelEl = document.getElementById('market-status-text');
    if (!dotEl || !labelEl) return;

    var now = new Date();
    var utcHour = now.getUTCHours();
    var utcMin = now.getUTCMinutes();
    var day = now.getUTCDay();
    var totalMin = utcHour * 60 + utcMin;
    var isWeekday = day >= 1 && day <= 5;
    var isOpen = isWeekday && totalMin >= 870 && totalMin < 1260;

    if (isOpen) {
      dotEl.className = 'w-2 h-2 rounded-full bg-status-green animate-pulse';
      labelEl.textContent = 'Markets Open';
    } else {
      dotEl.className = 'w-2 h-2 rounded-full bg-status-red';
      labelEl.textContent = 'Markets Closed';
    }
  }

  // --- Update stat cards ---
  function updateStats() {
    cashOnHand = loadNum('mm_cash', 0);
    monthlyBudget = loadNum('mm_budget', 0);

    var cryptoTotal = getPortfolioTotal('crypto-list');
    var stockTotal = getPortfolioTotal('stock-list');
    var ondoTotal = getPortfolioTotal('ondo-list');
    var investedTotal = cryptoTotal + stockTotal + ondoTotal;
    var netWorth = cashOnHand + investedTotal;

    var nwEl = document.getElementById('nw-display');
    if (nwEl) nwEl.textContent = fmtMoney(netWorth);

    var cashEl = document.getElementById('coh-display');
    if (cashEl) cashEl.textContent = fmtMoney(cashOnHand);

    var invEl = document.getElementById('ti-display');
    if (invEl) invEl.textContent = fmtMoney(investedTotal);

    var investedSub = document.getElementById('ti-sub');
    if (investedSub) {
      var parts = [];
      if (cryptoTotal > 0) parts.push(fmtMoney(cryptoTotal) + ' crypto');
      if (stockTotal > 0) parts.push(fmtMoney(stockTotal) + ' stocks');
      if (ondoTotal > 0) parts.push(fmtMoney(ondoTotal) + ' Ondo GM');
      investedSub.textContent = parts.length > 0 ? parts.join(' · ') : 'Stocks · Crypto · RWA';
    }

    var budgetEl = document.getElementById('mb-display');
    if (budgetEl) budgetEl.textContent = fmtMoney(monthlyBudget);
  }

  // --- Cash edit ---
  function setupCashEdit() {
    var btn = document.getElementById('coh-edit-btn');
    var displayContainer = document.getElementById('coh-display-container');
    var editContainer = document.getElementById('coh-edit-container');
    var input = document.getElementById('coh-input');
    var saveBtn = document.getElementById('coh-save');
    var cancelBtn = document.getElementById('coh-cancel');
    if (!btn || !editContainer) return;

    function openEdit() {
      displayContainer.classList.add('hidden');
      editContainer.classList.remove('hidden');
      input.value = cashOnHand || '';
      input.focus();
    }

    function closeEdit() {
      displayContainer.classList.remove('hidden');
      editContainer.classList.add('hidden');
    }

    btn.addEventListener('click', function (e) { e.stopPropagation(); openEdit(); });

    saveBtn.addEventListener('click', function () {
      cashOnHand = parseFloat(input.value) || 0;
      saveNum('mm_cash', cashOnHand);
      closeEdit();
      updateStats();
    });

    cancelBtn.addEventListener('click', closeEdit);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });
  }

  // --- Budget edit ---
  function setupBudgetEdit() {
    var btn = document.getElementById('mb-edit-btn');
    var displayContainer = document.getElementById('mb-display-container');
    var editContainer = document.getElementById('mb-edit-container');
    var input = document.getElementById('mb-input');
    var saveBtn = document.getElementById('mb-save');
    var cancelBtn = document.getElementById('mb-cancel');
    if (!btn || !editContainer) return;

    function openEdit() {
      displayContainer.classList.add('hidden');
      editContainer.classList.remove('hidden');
      input.value = monthlyBudget || '';
      input.focus();
    }

    function closeEdit() {
      displayContainer.classList.remove('hidden');
      editContainer.classList.add('hidden');
    }

    btn.addEventListener('click', function (e) { e.stopPropagation(); openEdit(); });

    saveBtn.addEventListener('click', function () {
      monthlyBudget = parseFloat(input.value) || 0;
      saveNum('mm_budget', monthlyBudget);
      closeEdit();
      updateStats();
    });

    cancelBtn.addEventListener('click', closeEdit);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });
  }

  // --- Page Navigation ---
  function setupPageNav() {
    var navBtns = document.querySelectorAll('.nav-btn[data-target]');
    var sections = document.querySelectorAll('.page-section');

    function switchPage(pageName) {
      navBtns.forEach(function (b) {
        var isActive = b.getAttribute('data-target') === pageName;
        b.classList.remove('bg-ivory-200/5', 'text-ivory-200');
        b.classList.add('text-gray-dim');
        var indicator = b.querySelector('.active-indicator');
        if (indicator) {
          indicator.classList.remove('opacity-100');
          indicator.classList.add('opacity-0');
        }
        var svg = b.querySelector('svg');
        if (svg) {
          svg.classList.remove('opacity-100');
          svg.classList.add('opacity-70');
        }

        if (isActive) {
          b.classList.remove('text-gray-dim');
          b.classList.add('bg-ivory-200/5', 'text-ivory-200');
          if (indicator) {
            indicator.classList.remove('opacity-0');
            indicator.classList.add('opacity-100');
          }
          if (svg) {
            svg.classList.remove('opacity-70');
            svg.classList.add('opacity-100');
          }
        }
      });

      sections.forEach(function (sec) {
        var secName = sec.id.replace('page-', '');
        if (secName === pageName) {
          sec.classList.remove('hidden');
          sec.classList.remove('fade-in');
          void sec.offsetWidth;
          sec.classList.add('fade-in');
        } else {
          sec.classList.add('hidden');
          sec.classList.remove('fade-in');
        }
      });

      try { localStorage.setItem('mm_current_page', pageName); } catch (e) { /* ignore */ }
    }

    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchPage(this.getAttribute('data-target'));
      });
    });

    // Restore last page
    var savedPage = null;
    try { savedPage = localStorage.getItem('mm_current_page'); } catch (e) { /* ignore */ }
    if (savedPage) switchPage(savedPage);
  }

  // --- Sync prices to Markets page ---
  function syncMarketPrices() {
    var pairs = [
      { widget: 'widget-price-btc', market: 'mk-btc', widgetChange: 'widget-change-btc' },
      { widget: 'widget-price-nvda', market: 'mk-nvda', widgetChange: 'widget-change-nvda' },
      { widget: 'widget-price-spx', market: 'mk-spx', widgetChange: 'widget-change-spx' },
      { widget: 'widget-price-gold', market: 'mk-gold', widgetChange: 'widget-change-gold' }
    ];

    for (var i = 0; i < pairs.length; i++) {
      var widgetEl = document.getElementById(pairs[i].widget);
      var marketEl = document.getElementById(pairs[i].market);
      var changeEl = document.getElementById(pairs[i].widgetChange);

      if (widgetEl && marketEl) {
        var priceVal = marketEl.querySelector('.price-val');
        if (priceVal && widgetEl.textContent !== '--') {
          priceVal.textContent = widgetEl.textContent;
        }
      }
      if (changeEl && marketEl) {
        var changeVal = marketEl.querySelector('.change-val');
        if (changeVal && changeEl.textContent !== '--') {
          changeVal.textContent = changeEl.textContent;
          // Copy color classes
          var isUp = changeEl.textContent.indexOf('-') !== 0;
          changeVal.className = 'text-[16px] mt-2 font-medium change-val ' + (isUp ? 'text-status-green' : 'text-status-red');
        }
      }
    }
  }

  function init() {
    setGreeting();
    updateMarketStatus();
    setupCashEdit();
    setupBudgetEdit();
    setupPageNav();
    updateStats();

    setInterval(updateStats, 5000);
    setInterval(updateMarketStatus, 60000);
    setInterval(syncMarketPrices, 3000);
    setTimeout(syncMarketPrices, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
