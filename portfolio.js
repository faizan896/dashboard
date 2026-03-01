(function () {
  'use strict';

  var PROXY = 'https://api.allorigins.win/raw?url=';
  var REFRESH_INTERVAL = 60000;

  // --- Default holdings with logo URLs ---
  var DEFAULT_CRYPTO = [
    { id: 'bitcoin',  name: 'Bitcoin',  ticker: 'BTC', qty: 0, image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
    { id: 'ethereum', name: 'Ethereum', ticker: 'ETH', qty: 0, image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
    { id: 'solana',   name: 'Solana',   ticker: 'SOL', qty: 0, image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
    { id: 'cardano',  name: 'Cardano',  ticker: 'ADA', qty: 0, image: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
    { id: 'ripple',   name: 'XRP',      ticker: 'XRP', qty: 0, image: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' }
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
  var cryptoImages = {};  // id -> image URL (fetched from API)

  // --- Formatters ---
  function fmtPrice(n, decimals) {
    if (n == null || isNaN(n)) return '\u2014';
    return '$' + Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtChange(pct) {
    if (pct == null || isNaN(pct)) return '\u2014';
    var sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  // --- Generate color for ticker (fallback) ---
  function tickerColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var h = Math.abs(hash) % 360;
    return 'hsl(' + h + ', 55%, 45%)';
  }

  // --- Stock logo URL ---
  function stockLogoUrl(symbol) {
    return 'https://logo.clearbit.com/' + stockDomain(symbol);
  }

  function stockDomain(symbol) {
    var domains = {
      'AAPL': 'apple.com',
      'NVDA': 'nvidia.com',
      'TSLA': 'tesla.com',
      'GOOGL': 'google.com',
      'GOOG': 'google.com',
      'AMZN': 'amazon.com',
      'MSFT': 'microsoft.com',
      'META': 'meta.com',
      'NFLX': 'netflix.com',
      'AMD': 'amd.com',
      'INTC': 'intel.com',
      'DIS': 'disney.com',
      'PYPL': 'paypal.com',
      'UBER': 'uber.com',
      'SHOP': 'shopify.com',
      'SQ': 'squareup.com',
      'SPOT': 'spotify.com',
      'COIN': 'coinbase.com',
      'BA': 'boeing.com',
      'JPM': 'jpmorganchase.com',
      'V': 'visa.com',
      'MA': 'mastercard.com',
      'WMT': 'walmart.com',
      'KO': 'coca-cola.com',
      'PEP': 'pepsico.com',
      'JNJ': 'jnj.com',
      'PG': 'pg.com',
      'XOM': 'exxonmobil.com',
      'CVX': 'chevron.com',
      'UNH': 'unitedhealthgroup.com',
      'HD': 'homedepot.com',
      'CRM': 'salesforce.com',
      'ORCL': 'oracle.com',
      'ADBE': 'adobe.com',
      'CSCO': 'cisco.com',
      'IBM': 'ibm.com'
    };
    return domains[symbol.toUpperCase()] || (symbol.toLowerCase() + '.com');
  }

  // --- Fetch crypto prices + images from CoinGecko ---
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

    // Fetch images for any coins we don't have images for yet
    await fetchCryptoImages();
    renderCrypto();
  }

  async function fetchCryptoImages() {
    var missing = cryptoHoldings.filter(function (h) {
      return !h.image && !cryptoImages[h.id];
    });
    if (missing.length === 0) return;

    var ids = missing.map(function (h) { return h.id; }).join(',');
    try {
      var url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids
        + '&per_page=50&page=1';
      var res = await fetch(url);
      if (!res.ok) return;
      var data = await res.json();
      for (var i = 0; i < data.length; i++) {
        cryptoImages[data[i].id] = data[i].image;
      }
    } catch (e) { /* silent */ }
  }

  function getCryptoImage(holding) {
    return holding.image || cryptoImages[holding.id] || '';
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

  // --- Build logo HTML ---
  function cryptoLogoHtml(holding) {
    var imgUrl = getCryptoImage(holding);
    if (imgUrl) {
      return '<div class="asset-logo">'
        + '<img src="' + escAttr(imgUrl) + '" alt="' + escAttr(holding.ticker) + '" width="40" height="40" style="border-radius:50%;display:block;" onerror="this.parentNode.outerHTML=\'' + fallbackLogoHtml(holding.ticker) + '\'">'
        + '</div>';
    }
    return fallbackLogoHtml(holding.ticker);
  }

  function stockLogoHtml(holding) {
    var imgUrl = stockLogoUrl(holding.symbol);
    return '<div class="asset-logo">'
      + '<img src="' + escAttr(imgUrl) + '" alt="' + escAttr(holding.symbol) + '" width="40" height="40" style="border-radius:50%;display:block;object-fit:contain;background:#2a2a2a;" onerror="this.parentNode.outerHTML=\'' + fallbackLogoHtml(holding.symbol) + '\'">'
      + '</div>';
  }

  function fallbackLogoHtml(ticker) {
    return '<div class=\\"asset-logo-gen\\" style=\\"background:' + tickerColor(ticker) + '\\">'
      + ticker.substring(0, 3)
      + '</div>';
  }

  // For inline use (not inside onerror)
  function fallbackLogoDirect(ticker) {
    return '<div class="asset-logo-gen" style="background:' + tickerColor(ticker) + '">'
      + escHtml(ticker.substring(0, 3))
      + '</div>';
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Render functions ---
  function renderCrypto() {
    var list = document.getElementById('crypto-holdings-list');
    if (!list) return;

    var html = '';
    for (var i = 0; i < cryptoHoldings.length; i++) {
      var h = cryptoHoldings[i];
      var p = cryptoPrices[h.id];
      var price = p ? fmtPrice(p.price, p.price >= 100 ? 2 : 4) : '\u2014';
      var change = p ? fmtChange(p.change) : '\u2014';
      var changeClass = (p && p.change >= 0) ? 'positive' : 'negative';
      var value = (p && h.qty > 0) ? fmtPrice(p.price * h.qty, 2) : price;
      var qtyLabel = h.qty > 0 ? h.qty + ' ' + h.ticker : '';

      var imgUrl = getCryptoImage(h);
      var logoHtml;
      if (imgUrl) {
        logoHtml = '<div class="asset-logo">'
          + '<img src="' + escAttr(imgUrl) + '" alt="' + escAttr(h.ticker) + '" width="40" height="40">'
          + '</div>';
      } else {
        logoHtml = fallbackLogoDirect(h.ticker);
      }

      html += '<div class="holding-item">'
        + '<div class="holding-left">'
        + logoHtml
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

    // Handle broken images — swap to fallback
    var imgs = list.querySelectorAll('.asset-logo img');
    for (var k = 0; k < imgs.length; k++) {
      imgs[k].addEventListener('error', handleImgError);
    }

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
      var price = p ? fmtPrice(p.price, 2) : '\u2014';
      var change = p ? fmtChange(p.change) : '\u2014';
      var changeClass = (p && p.change >= 0) ? 'positive' : 'negative';
      var value = (p && h.qty > 0) ? fmtPrice(p.price * h.qty, 2) : price;
      var qtyLabel = h.qty > 0 ? h.qty + ' shares' : '';

      var logoUrl = stockLogoUrl(h.symbol);
      var logoHtml = '<div class="asset-logo">'
        + '<img src="' + escAttr(logoUrl) + '" alt="' + escAttr(h.symbol) + '" width="40" height="40">'
        + '</div>';

      html += '<div class="holding-item">'
        + '<div class="holding-left">'
        + logoHtml
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

    // Handle broken images — swap to fallback
    var imgs = list.querySelectorAll('.asset-logo img');
    for (var k = 0; k < imgs.length; k++) {
      imgs[k].addEventListener('error', handleImgError);
    }

    var removeBtns = list.querySelectorAll('.remove-holding-btn');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', handleRemove);
    }
  }

  function handleImgError(e) {
    var img = e.target;
    var ticker = img.alt || '???';
    var wrapper = img.parentNode;
    var fallback = document.createElement('div');
    fallback.className = 'asset-logo-gen';
    fallback.style.background = tickerColor(ticker);
    fallback.textContent = ticker.substring(0, 3);
    wrapper.parentNode.replaceChild(fallback, wrapper);
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

      idInput.value = '';
      nameInput.value = '';
      tickerInput.value = '';
      qtyInput.value = '';
      form.classList.remove('show');

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




