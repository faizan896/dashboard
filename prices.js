(function () {
  'use strict';

  var REFRESH_INTERVAL = 60000;
  var PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];
  var currentProxy = 0;

  function getProxy() {
    return PROXIES[currentProxy % PROXIES.length];
  }

  function rotateProxy() {
    currentProxy++;
  }

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

  function applyChange(el, pct) {
    if (!el) return;
    el.textContent = fmtChange(pct);
    el.className = 'widget-change ' + (pct >= 0 ? 'positive' : 'negative');
  }

  function renderSparkline(containerId, prices) {
    var el = document.getElementById(containerId);
    if (!el || !prices || prices.length < 2) return;

    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var range = max - min || 1;
    var isUp = prices[prices.length - 1] >= prices[0];

    el.innerHTML = '';
    var step = Math.max(1, Math.floor(prices.length / 20));
    for (var i = 0; i < prices.length; i += step) {
      var pct = ((prices[i] - min) / range) * 100;
      var bar = document.createElement('span');
      bar.className = 'spark-bar';
      bar.style.height = Math.max(10, pct) + '%';
      bar.style.background = isUp
        ? 'rgba(16, 185, 129, 0.5)'
        : 'rgba(239, 68, 68, 0.5)';
      el.appendChild(bar);
    }
  }

  function updateTimestamp() {
    var el = document.getElementById('last-updated-time');
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

  async function fetchBTC() {
    try {
      var data = await fetchWithRetry(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
      );
      var price = data.bitcoin.usd;
      var change = data.bitcoin.usd_24h_change;
      var el = document.getElementById('price-btc');
      if (el) el.textContent = fmtPrice(price, 0);
      applyChange(document.getElementById('change-btc'), change);
    } catch (e) { /* silent */ }
  }

  async function fetchBTCSpark() {
    try {
      var data = await fetchWithRetry(
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7'
      );
      var prices = data.prices.map(function (p) { return p[1]; });
      renderSparkline('spark-btc', prices);
    } catch (e) { /* silent */ }
  }

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
        var closes = result.indicators.quote[0].close.filter(function (v) {
          return v != null;
        });
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
      var el = document.getElementById('price-nvda');
      if (el) el.textContent = fmtPrice(d.price, 2);
      applyChange(document.getElementById('change-nvda'), d.changePct);
      renderSparkline('spark-nvda', d.closes);
    } catch (e) { /* silent */ }
  }

  async function fetchSPX() {
    try {
      var d = await fetchYahoo('^GSPC');
      var el = document.getElementById('price-spx');
      if (el) el.textContent = fmtPrice(d.price, 2);
      applyChange(document.getElementById('change-spx'), d.changePct);
      renderSparkline('spark-spx', d.closes);
    } catch (e) { /* silent */ }
  }

  async function fetchGold() {
    try {
      var d = await fetchYahoo('GC=F');
      var el = document.getElementById('price-gold');
      if (el) el.textContent = fmtPrice(d.price, 2);
      applyChange(document.getElementById('change-gold'), d.changePct);
      renderSparkline('spark-gold', d.closes);
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





