(function () {
  'use strict';

  var REFRESH_INTERVAL = 60000;
  var PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];
  var currentProxy = 0;

  function getProxy() { return PROXIES[currentProxy % PROXIES.length]; }
  function rotateProxy() { currentProxy++; }

  function fmtPrice(n, decimals) {
    if (n == null || isNaN(n)) return '--';
    return '$' + Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtChange(pct) {
    if (pct == null || isNaN(pct)) return '--';
    var sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  function applyWidgetChange(elId, pct) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.textContent = fmtChange(pct);
    if (pct != null && !isNaN(pct)) {
      el.className = 'px-1.5 py-0.5 rounded text-[10px] font-medium ' +
        (pct >= 0 ? 'bg-status-green/20 text-status-green' : 'bg-status-red/20 text-status-red');
    }
  }

  // Sparkline chart instances
  var sparkCharts = {};

  function renderSparkline(canvasId, prices) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !prices || prices.length < 2) return;

    var isUp = prices[prices.length - 1] >= prices[0];
    var color = isUp ? '#8FB87A' : '#C46B6B';

    if (sparkCharts[canvasId]) {
      sparkCharts[canvasId].data.datasets[0].data = prices;
      sparkCharts[canvasId].data.datasets[0].borderColor = color;
      sparkCharts[canvasId].data.labels = prices.map(function (_, i) { return i; });
      sparkCharts[canvasId].update('none');
      return;
    }

    sparkCharts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: prices.map(function (_, i) { return i; }),
        datasets: [{
          data: prices,
          borderColor: color,
          borderWidth: 1.5,
          tension: 0.3,
          pointRadius: 0,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        layout: { padding: 0 },
        animation: false
      }
    });
  }

  function updateTimestamp() {
    var el = document.getElementById('last-sync-text');
    if (el) {
      var now = new Date();
      el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
  }

  async function fetchWithRetry(url, retries) {
    retries = retries || 2;
    for (var i = 0; i <= retries; i++) {
      try {
        var res = await fetch(url);
        if (res.ok) return await res.json();
        throw new Error(res.status);
      } catch (e) {
        if (i === retries) throw e;
        await new Promise(function (r) { setTimeout(r, 1000); });
      }
    }
  }

  // --- CoinGecko: Bitcoin ---
  async function fetchBTC() {
    try {
      var data = await fetchWithRetry(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
      );
      var price = data.bitcoin.usd;
      var change = data.bitcoin.usd_24h_change;
      var el = document.getElementById('widget-price-btc');
      if (el) el.textContent = fmtPrice(price, 0);
      applyWidgetChange('widget-change-btc', change);
    } catch (e) { /* silent */ }
  }

  async function fetchBTCSpark() {
    try {
      var data = await fetchWithRetry(
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7'
      );
      var prices = data.prices.map(function (p) { return p[1]; });
      // Downsample to ~50 points
      var step = Math.max(1, Math.floor(prices.length / 50));
      var sampled = [];
      for (var i = 0; i < prices.length; i += step) sampled.push(prices[i]);
      renderSparkline('sparkline-btc', sampled);
    } catch (e) { /* silent */ }
  }

  // --- Yahoo Finance with proxy fallback ---
  async function fetchYahoo(symbol) {
    var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/'
      + encodeURIComponent(symbol) + '?range=5d&interval=1h';

    for (var attempt = 0; attempt < PROXIES.length; attempt++) {
      try {
        var url = getProxy() + encodeURIComponent(yahooUrl);
        var res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        var data = await res.json();
        var result = data.chart.result[0];
        var meta = result.meta;
        var price = meta.regularMarketPrice;
        var prevClose = meta.chartPreviousClose || meta.previousClose;
        var changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
        var closes = result.indicators.quote[0].close.filter(function (v) { return v != null; });
        return { price: price, changePct: changePct, closes: closes };
      } catch (e) {
        rotateProxy();
        if (attempt === PROXIES.length - 1) throw e;
      }
    }
  }

  async function fetchNVDA() {
    try {
      var d = await fetchYahoo('NVDA');
      var el = document.getElementById('widget-price-nvda');
      if (el) el.textContent = fmtPrice(d.price, 2);
      applyWidgetChange('widget-change-nvda', d.changePct);
      renderSparkline('sparkline-nvda', d.closes);
    } catch (e) { /* silent */ }
  }

  async function fetchSPX() {
    try {
      var d = await fetchYahoo('^GSPC');
      var el = document.getElementById('widget-price-spx');
      if (el) el.textContent = fmtPrice(d.price, 2);
      applyWidgetChange('widget-change-spx', d.changePct);
      renderSparkline('sparkline-spx', d.closes);
    } catch (e) { /* silent */ }
  }

  async function fetchGold() {
    try {
      var d = await fetchYahoo('GC=F');
      var el = document.getElementById('widget-price-gold');
      if (el) el.textContent = fmtPrice(d.price, 2);
      applyWidgetChange('widget-change-gold', d.changePct);
      renderSparkline('sparkline-gold', d.closes);
    } catch (e) { /* silent */ }
  }

  function fetchAll() {
    fetchBTC();
    fetchBTCSpark();
    fetchNVDA();
    fetchSPX();
    fetchGold();
    updateTimestamp();
  }

  fetchAll();
  setInterval(fetchAll, REFRESH_INTERVAL);
})();


