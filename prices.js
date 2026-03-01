(function () {
  'use strict';

  const REFRESH_INTERVAL = 60000; // 60 seconds
  const PROXY = 'https://api.allorigins.win/raw?url=';

  // --- Formatters ---
  function fmtPrice(n, decimals) {
    if (n == null || isNaN(n)) return '—';
    return '$' + Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtChange(pct) {
    if (pct == null || isNaN(pct)) return '—';
    const sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  function applyChange(el, pct) {
    el.textContent = fmtChange(pct);
    el.className = 'widget-change ' + (pct >= 0 ? 'positive' : 'negative');
  }

  // --- Sparkline renderer (pure CSS bars) ---
  function renderSparkline(containerId, prices) {
    const el = document.getElementById(containerId);
    if (!el || !prices || prices.length < 2) return;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const isUp = prices[prices.length - 1] >= prices[0];

    el.innerHTML = '';
    // Sample down to ~20 bars max
    const step = Math.max(1, Math.floor(prices.length / 20));
    for (let i = 0; i < prices.length; i += step) {
      const pct = ((prices[i] - min) / range) * 100;
      const bar = document.createElement('span');
      bar.className = 'spark-bar';
      bar.style.height = Math.max(8, pct) + '%';
      bar.style.background = isUp
        ? 'rgba(34,197,94,0.5)'
        : 'rgba(239,68,68,0.5)';
      el.appendChild(bar);
    }
  }

  // --- CoinGecko: Bitcoin ---
  async function fetchBTC() {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const price = data.bitcoin.usd;
      const change = data.bitcoin.usd_24h_change;
      document.getElementById('price-btc').textContent = fmtPrice(price, 0);
      applyChange(document.getElementById('change-btc'), change);
    } catch {
      document.getElementById('price-btc').textContent = '—';
    }
  }

  // Sparkline for BTC (7-day hourly from CoinGecko)
  async function fetchBTCSpark() {
    try {
      const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7';
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const prices = data.prices.map(function (p) { return p[1]; });
      renderSparkline('spark-btc', prices);
    } catch {
      // silent
    }
  }

  // --- Yahoo Finance via allorigins proxy ---
  async function fetchYahoo(symbol) {
    const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/'
      + encodeURIComponent(symbol) + '?range=5d&interval=1h';
    const url = PROXY + encodeURIComponent(yahooUrl);
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    const closes = result.indicators.quote[0].close.filter(function (v) {
      return v != null;
    });
    return { price: price, changePct: changePct, closes: closes };
  }

  async function fetchNVDA() {
    try {
      const d = await fetchYahoo('NVDA');
      document.getElementById('price-nvda').textContent = fmtPrice(d.price, 2);
      applyChange(document.getElementById('change-nvda'), d.changePct);
      renderSparkline('spark-nvda', d.closes);
    } catch {
      document.getElementById('price-nvda').textContent = '—';
    }
  }

  async function fetchSPX() {
    try {
      const d = await fetchYahoo('^GSPC');
      document.getElementById('price-spx').textContent = fmtPrice(d.price, 2);
      applyChange(document.getElementById('change-spx'), d.changePct);
      renderSparkline('spark-spx', d.closes);
    } catch {
      document.getElementById('price-spx').textContent = '—';
    }
  }

  async function fetchGold() {
    try {
      const d = await fetchYahoo('GC=F');
      document.getElementById('price-gold').textContent = fmtPrice(d.price, 2);
      applyChange(document.getElementById('change-gold'), d.changePct);
      renderSparkline('spark-gold', d.closes);
    } catch {
      document.getElementById('price-gold').textContent = '—';
    }
  }

  // --- Init ---
  function fetchAll() {
    fetchBTC();
    fetchBTCSpark();
    fetchNVDA();
    fetchSPX();
    fetchGold();
  }

  fetchAll();
  setInterval(fetchAll, REFRESH_INTERVAL);
})();


