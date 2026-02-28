(function () {
  'use strict';

  var PROXY = 'https://api.allorigins.win/raw?url=';
  var REFRESH_INTERVAL = 60000;

  // --- Default holdings ---
  var DEFAULT_CRYPTO = [
    { id: 'bitcoin',  name: 'Bitcoin',  ticker: 'BTC', qty: 0 },
    { id: 'ethereum', name: 'Ethereum', ticker: 'ETH', qty: 0 },
    { id: 'solana',   name: 'Solana',   ticker: 'SOL', qty: 0 },
    { id: 'cardano',  name: 'Cardano',  ticker: 'ADA', qty: 0 },
    { id: 'ripple',   name: 'XRP',      ticker: 'XRP', qty: 0 }
  ];

  var DEFAULT_STOCKS = [
    { symbol: 'AAPL',  name: 'Apple Inc.',      qty: 0 },
    { symbol: 'NVDA',  name: 'NVIDIA Corp.',     qty: 0 },
    { symbol: 'TSLA',  name: 'Tesla Inc.',       qty: 0 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.',    qty: 0 },
    { symbol: 'AMZN',  name: 'Amazon.com',       qty: 0 }
  ];

  // --- localStorage persistence ---
  function loadHoldings(key, defaults) {
    try {
      var saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return defaults.map(function (h) { return Object.assign({}, h); });
  }

  function saveHoldings(key, holdings) {
    try {
      localStorage.setItem(key, JSON.stringify(holdings));
    } catch (e) { /* ignore */ }
  }

  var cryptoHoldings = loadHoldings('mm_crypto', DEFAULT_CRYPTO);
  var stockHoldings = loadHoldings('mm_stocks', DEFAULT_STOCKS);

  // --- Price caches ---
  var cryptoPrices = {};  // id -> { price, change }
  var stockPrices = {};   // symbol -> { price, change }

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
    var sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  // --- Fetch crypto prices from CoinGecko ---
  async function fetchCryptoPrices() {
    if (cryptoHoldings.length === 0) return;
    var ids = cryptoHoldings.map(function (h) { return h.id; }).join(',');
    try {
      var url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids
        + '&vs_currencies=usd&include_24hr_change=true';
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      for (var id in data) {
        cryptoPrices[id] = {
          price: data[id].usd,
          change: data[id].usd_24h_change
        };
      }
    } catch (e) { /* silent */ }
    renderCrypto();
  }

  // --- Fetch stock prices from Yahoo Finance ---
  async function fetchStockPrices() {
    var promises = stockHoldings.map(function (h) {
      return fetchOneStock(h.symbol);
    });
    await Promise.allSettled(promises);
    renderStocks();
  }

  async function fetchOneStock(symbol) {
    try {
      var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/'
        + encodeURIComponent(symbol) + '?range=1d&interval=1d';
      var url = PROXY + encodeURIComponent(yahooUrl);
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      var result = data.chart.result[0];
      var meta = result.meta;
      var price = meta.regularMarketPrice;
      var prevClose = meta.chartPreviousClose || meta.previousClose;
      var changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
      stockPrices[symbol] = { price: price, change: changePct };
    } catch (e) { /* silent */ }
  }

  // --- Generate color for ticker ---
  function tickerColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var h = Math.abs(hash) % 360;
    return 'hsl(' + h + ', 55%, 45%)';
  }

  // --- Render functions ---
  function renderCrypto() {
    var list = document.getElementById('crypto-holdings-list');
    if (!list) return;

    // Keep add form if open
    var html = '';
    for (var i = 0; i < cryptoHoldings.length; i++) {
      var h = cryptoHoldings[i];
      var p = cryptoPrices[h.id];
      var price = p ? fmtPrice(p.price, p.price >= 100 ? 2 : 4) : '—';
      var change = p ? fmtChange(p.change) : '—';
      var changeClass = (p && p.change >= 0) ? 'positive' : 'negative';
      var value = (p && h.qty > 0) ? fmtPrice(p.price * h.qty, 2) : price;
      var qtyLabel = h.qty > 0 ? h.qty + ' ' + h.ticker : '';

      html += '<div class="holding-item">'
        + '<div class="holding-left">'
        + '<div class="asset-logo-gen" style="background:' + tickerColor(h.ticker) + '">'
        + h.ticker.substring(0, 3)
        + '</div>'
        + '<div class="asset-info">'
        + '<span class="asset-name">' + escHtml(h.name) + '</span>'
        + '<span class="asset-ticker">' + escHtml(h.ticker)
        + (qtyLabel ? ' &middot; ' + escHtml(qtyLabel) : '') + '</span>'
        + '</div>'
        + '</div>'
        + '<div class="holding-right">'
        + '<span class="asset-value">' + value + '</span>'
        + '<span class="asset-change ' + changeClass + '">' + change + '</span>'
        + '</div>'
        + '<button class="remove-holding-btn" data-type="crypto" data-index="' + i + '" title="Remove">&times;</button>'
        + '</div>';
    }
    list.innerHTML = html;

    // Attach remove handlers
    var removeBtns = list.querySelectorAll('.remove-holding-btn');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', handleRemove);
    }
  }

  function renderStocks() {
    var list = document.getElementById('stock-holdings-list');
    if (!list) return;

    var html = '';
    for (var i = 0; i < stockHoldings.length; i++) {
      var h = stockHoldings[i];
      var p = stockPrices[h.symbol];
      var price = p ? fmtPrice(p.price, 2) : '—';
      var change = p ? fmtChange(p.change) : '—';
      var changeClass = (p && p.change >= 0) ? 'positive' : 'negative';
      var value = (p && h.qty > 0) ? fmtPrice(p.price * h.qty, 2) : price;
      var qtyLabel = h.qty > 0 ? h.qty + ' shares' : '';

      html += '<div class="holding-item">'
        + '<div class="holding-left">'
        + '<div class="asset-logo-gen" style="background:' + tickerColor(h.symbol) + '">'
        + h.symbol.substring(0, 3)
        + '</div>'
        + '<div class="asset-info">'
        + '<span class="asset-name">' + escHtml(h.name) + '</span>'
        + '<span class="asset-ticker">' + escHtml(h.symbol)
        + (qtyLabel ? ' &middot; ' + escHtml(qtyLabel) : '') + '</span>'
        + '</div>'
        + '</div>'
        + '<div class="holding-right">'
        + '<span class="asset-value">' + value + '</span>'
        + '<span class="asset-change ' + changeClass + '">' + change + '</span>'
        + '</div>'
        + '<button class="remove-holding-btn" data-type="stock" data-index="' + i + '" title="Remove">&times;</button>'
        + '</div>';
    }
    list.innerHTML = html;

    var removeBtns = list.querySelectorAll('.remove-holding-btn');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', handleRemove);
    }
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Add / Remove handlers ---
  function handleRemove(e) {
    var btn = e.currentTarget;
    var type = btn.getAttribute('data-type');
    var idx = parseInt(btn.getAttribute('data-index'), 10);
    if (type === 'crypto') {
      cryptoHoldings.splice(idx, 1);
      saveHoldings('mm_crypto', cryptoHoldings);
      renderCrypto();
    } else {
      stockHoldings.splice(idx, 1);
      saveHoldings('mm_stocks', stockHoldings);
      renderStocks();
    }
  }

  // --- Add crypto form ---
  function setupAddCrypto() {
    var btn = document.getElementById('add-crypto-btn');
    var form = document.getElementById('add-crypto-form');
    if (!btn || !form) return;

    btn.addEventListener('click', function () {
      form.classList.toggle('show');
      if (form.classList.contains('show')) {
        form.querySelector('input').focus();
      }
    });

    form.querySelector('.add-form-submit').addEventListener('click', function () {
      var idInput = form.querySelector('[name="coin-id"]');
      var nameInput = form.querySelector('[name="coin-name"]');
      var tickerInput = form.querySelector('[name="coin-ticker"]');
      var qtyInput = form.querySelector('[name="coin-qty"]');

      var id = idInput.value.trim().toLowerCase();
      var name = nameInput.value.trim();
      var ticker = tickerInput.value.trim().toUpperCase();
      var qty = parseFloat(qtyInput.value) || 0;

      if (!id || !ticker) return;

      cryptoHoldings.push({
        id: id,
        name: name || ticker,
        ticker: ticker,
        qty: qty
      });
      saveHoldings('mm_crypto', cryptoHoldings);

      // Clear form
      idInput.value = '';
      nameInput.value = '';
      tickerInput.value = '';
      qtyInput.value = '';
      form.classList.remove('show');

      // Fetch & render
      fetchCryptoPrices();
    });
  }

  // --- Add stock form ---
  function setupAddStock() {
    var btn = document.getElementById('add-stock-btn');
    var form = document.getElementById('add-stock-form');
    if (!btn || !form) return;

    btn.addEventListener('click', function () {
      form.classList.toggle('show');
      if (form.classList.contains('show')) {
        form.querySelector('input').focus();
      }
    });

    form.querySelector('.add-form-submit').addEventListener('click', function () {
      var symbolInput = form.querySelector('[name="stock-symbol"]');
      var nameInput = form.querySelector('[name="stock-name"]');
      var qtyInput = form.querySelector('[name="stock-qty"]');

      var symbol = symbolInput.value.trim().toUpperCase();
      var name = nameInput.value.trim();
      var qty = parseFloat(qtyInput.value) || 0;

      if (!symbol) return;

      stockHoldings.push({
        symbol: symbol,
        name: name || symbol,
        qty: qty
      });
      saveHoldings('mm_stocks', stockHoldings);

      symbolInput.value = '';
      nameInput.value = '';
      qtyInput.value = '';
      form.classList.remove('show');

      fetchStockPrices();
    });
  }

  // --- Init ---
  function init() {
    renderCrypto();
    renderStocks();
    setupAddCrypto();
    setupAddStock();
    fetchCryptoPrices();
    fetchStockPrices();
    setInterval(function () {
      fetchCryptoPrices();
      fetchStockPrices();
    }, REFRESH_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
