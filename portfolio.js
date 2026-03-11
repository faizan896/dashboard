(function () {
  'use strict';

  var PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];
  var proxyIdx = 0;
  var REFRESH_INTERVAL = 60000;

  function getProxy() { return PROXIES[proxyIdx % PROXIES.length]; }
  function rotateProxy() { proxyIdx++; }

  async function fetchViaProxy(yahooUrl) {
    for (var attempt = 0; attempt < PROXIES.length; attempt++) {
      try {
        var url = getProxy() + encodeURIComponent(yahooUrl);
        var res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        return await res.json();
      } catch (e) {
        rotateProxy();
        if (attempt === PROXIES.length - 1) throw e;
      }
    }
  }

  // --- Default holdings ---
  var DEFAULT_CRYPTO = [
    { id: 'bitcoin',  name: 'Bitcoin',  ticker: 'BTC', qty: 0 },
    { id: 'ethereum', name: 'Ethereum', ticker: 'ETH', qty: 0 },
    { id: 'solana',   name: 'Solana',   ticker: 'SOL', qty: 0 },
    { id: 'cardano',  name: 'Cardano',  ticker: 'ADA', qty: 0 },
    { id: 'ripple',   name: 'XRP',      ticker: 'XRP', qty: 0 },
    { id: 'ondo',     name: 'Ondo',     ticker: 'ONDO', qty: 0 },
    { id: 'ondo-us-dollar-yield', name: 'Ondo US Dollar Yield', ticker: 'USDY', qty: 0 },
    { id: 'ousg',     name: 'Ondo Short-Term US Gov Bond', ticker: 'OUSG', qty: 0 }
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
      'IBM': 'ibm.com',
      'SPY': 'ssga.com',
      'QQQ': 'invesco.com'
    };
    return domains[symbol.toUpperCase()] || (symbol.toLowerCase() + '.com');
  }

  // --- Fetch crypto prices + images from CoinGecko ---
  async function fetchCryptoPrices() {
    if (cryptoHoldings.length === 0) return;
    var ids = cryptoHoldings.map(function (h) { return h.id; }).join(',');

    // Fetch prices AND images in one call using /coins/markets
    try {
      var url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids
        + '&per_page=50&page=1&sparkline=false&price_change_percentage=24h';
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      for (var i = 0; i < data.length; i++) {
        var coin = data[i];
        cryptoPrices[coin.id] = {
          price: coin.current_price,
          change: coin.price_change_percentage_24h
        };
        // Store image URL from API (always up-to-date)
        if (coin.image) {
          cryptoImages[coin.id] = coin.image;
        }
      }
    } catch (e) {
      // Fallback: try simple price endpoint
      try {
        var url2 = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids
          + '&vs_currencies=usd&include_24hr_change=true';
        var res2 = await fetch(url2);
        if (res2.ok) {
          var data2 = await res2.json();
          for (var id in data2) {
            cryptoPrices[id] = {
              price: data2[id].usd,
              change: data2[id].usd_24h_change
            };
          }
        }
      } catch (e2) { /* silent */ }
    }

    renderCrypto();
  }

  function getCryptoImage(holding) {
    // Prefer API-fetched image (always current), then saved image on holding
    return cryptoImages[holding.id] || holding.image || '';
  }

  // --- Fetch stock prices from Yahoo Finance via proxy ---
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
      var data = await fetchViaProxy(yahooUrl);
      var result = data.chart.result[0];
      var meta = result.meta;
      var price = meta.regularMarketPrice;
      var prevClose = meta.chartPreviousClose || meta.previousClose;
      var changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
      stockPrices[symbol] = { price: price, change: changePct };
    } catch (e) { /* silent */ }
  }

  // --- Helpers ---
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
    if (wrapper.parentNode) {
      wrapper.parentNode.replaceChild(fallback, wrapper);
    }
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
    } else if (type === 'ondo') {
      ondoHoldings.splice(idx, 1);
      saveHoldings('mm_ondo', ondoHoldings);
      renderOndo();
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

    var submitBtn = form.querySelector('.btn-primary');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', function () {
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

    var submitBtn = form.querySelector('.btn-primary');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', function () {
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

  // --- Ondo Global Markets (Tokenized Stocks) ---

  // Known Ondo token contracts on Ethereum mainnet
  var ONDO_CONTRACTS = [
    { address: '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c', symbol: 'AAPLON', underlying: 'AAPL', name: 'Apple (Tokenized)', decimals: 18 },
    { address: '0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee', symbol: 'NVDAON', underlying: 'NVDA', name: 'NVIDIA (Tokenized)', decimals: 18 },
    { address: '0xfAbA6f8e4a5E8AB82F62fe7C39859FA577269BE3', symbol: 'ONDO', underlying: null, name: 'Ondo', decimals: 18, coingeckoId: 'ondo' },
    { address: '0x96F6eF951840721AdBF46Ac996b59E0235CB985C', symbol: 'USDY', underlying: null, name: 'Ondo US Dollar Yield', decimals: 18, coingeckoId: 'ondo-us-dollar-yield' },
    { address: '0x1B19C19393e2d034D8Ff31fF34c81252FcBbEE92', symbol: 'OUSG', underlying: null, name: 'Ondo Short-Term US Gov Bond', decimals: 18, coingeckoId: 'ousg' }
  ];

  var ETH_RPC = 'https://eth.llamarpc.com';
  var walletAddress = '';
  var walletBalances = {}; // symbol -> { balance, name, underlying, contract }

  function loadWalletAddress() {
    try {
      var saved = localStorage.getItem('mm_ondo_wallet');
      if (saved) return saved;
    } catch (e) { /* ignore */ }
    return '';
  }

  function saveWalletAddress(addr) {
    try {
      localStorage.setItem('mm_ondo_wallet', addr);
    } catch (e) { /* ignore */ }
  }

  function isValidEthAddress(addr) {
    return /^0x[0-9a-fA-F]{40}$/.test(addr);
  }

  // Call balanceOf(address) on an ERC-20 contract via eth_call
  async function getTokenBalance(tokenAddress, walletAddr) {
    var data = '0x70a08231' + walletAddr.slice(2).toLowerCase().padStart(64, '0');
    try {
      var res = await fetch(ETH_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: tokenAddress, data: data }, 'latest'],
          id: 1
        })
      });
      var json = await res.json();
      if (json.result && json.result !== '0x') {
        return BigInt(json.result);
      }
      return BigInt(0);
    } catch (e) {
      return BigInt(0);
    }
  }

  function formatTokenBalance(rawBalance, decimals) {
    if (rawBalance === BigInt(0)) return 0;
    var divisor = BigInt(10) ** BigInt(decimals);
    var whole = rawBalance / divisor;
    var remainder = rawBalance % divisor;
    var remainderStr = remainder.toString().padStart(decimals, '0').slice(0, 6);
    remainderStr = remainderStr.replace(/0+$/, '');
    if (remainderStr === '') return Number(whole);
    return parseFloat(whole.toString() + '.' + remainderStr);
  }

  async function scanWallet(addr) {
    var statusEl = document.getElementById('ondo-wallet-status');
    var holdingsEl = document.getElementById('ondo-wallet-holdings');

    statusEl.textContent = 'Scanning wallet for Ondo tokens...';
    statusEl.className = 'wallet-status scanning';
    holdingsEl.innerHTML = '';
    walletBalances = {};

    var foundCount = 0;
    var promises = ONDO_CONTRACTS.map(async function (token) {
      var rawBalance = await getTokenBalance(token.address, addr);
      var balance = formatTokenBalance(rawBalance, token.decimals);
      if (balance > 0) {
        foundCount++;
        walletBalances[token.symbol] = {
          balance: balance,
          name: token.name,
          underlying: token.underlying,
          symbol: token.symbol,
          contract: token.address,
          coingeckoId: token.coingeckoId || null
        };
      }
    });

    await Promise.allSettled(promises);

    if (foundCount > 0) {
      statusEl.textContent = 'Found ' + foundCount + ' Ondo token' + (foundCount > 1 ? 's' : '') + ' in wallet';
      statusEl.className = 'wallet-status success';
    } else {
      statusEl.textContent = 'No Ondo tokens found in this wallet';
      statusEl.className = 'wallet-status';
    }

    renderWalletHoldings();
    renderOndo();
  }

  function renderWalletHoldings() {
    var holdingsEl = document.getElementById('ondo-wallet-holdings');
    if (!holdingsEl) return;

    var symbols = Object.keys(walletBalances);
    if (symbols.length === 0) {
      holdingsEl.innerHTML = '';
      return;
    }

    var html = '';
    for (var i = 0; i < symbols.length; i++) {
      var wb = walletBalances[symbols[i]];
      var priceInfo = ondoPrices[wb.symbol];
      var valueStr = '\u2014';

      if (priceInfo) {
        valueStr = fmtPrice(priceInfo.price * wb.balance, 2);
      }

      var logoHtml;
      if (wb.underlying) {
        var logoUrl = stockLogoUrl(wb.underlying);
        logoHtml = '<div class="asset-logo ondo-asset-logo" style="width:32px;height:32px;">'
          + '<img src="' + escAttr(logoUrl) + '" alt="' + escAttr(wb.symbol) + '" width="32" height="32">'
          + '<span class="ondo-token-badge" style="width:14px;height:14px;font-size:7px;">ON</span>'
          + '</div>';
      } else {
        logoHtml = '<div class="asset-logo-gen" style="background:#0052FF;width:32px;height:32px;font-size:10px;">'
          + escHtml(wb.symbol.substring(0, 4))
          + '</div>';
      }

      html += '<div class="wallet-holding-item">'
        + '<div class="wallet-holding-left">'
        + logoHtml
        + '<div class="wallet-holding-info">'
        + '<span class="wallet-holding-name">' + escHtml(wb.name) + '<span class="wallet-source-badge">Wallet</span></span>'
        + '<span class="wallet-holding-balance">' + wb.balance.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' tokens</span>'
        + '</div>'
        + '</div>'
        + '<span class="wallet-holding-value">' + valueStr + '</span>'
        + '</div>';
    }
    holdingsEl.innerHTML = html;

    var imgs = holdingsEl.querySelectorAll('.asset-logo img');
    for (var k = 0; k < imgs.length; k++) {
      imgs[k].addEventListener('error', handleImgError);
    }
  }

  function setupWalletPanel() {
    var toggleBtn = document.getElementById('ondo-wallet-toggle-btn');
    var panel = document.getElementById('ondo-wallet-panel');
    var walletInput = document.getElementById('ondo-wallet-input');
    var scanBtn = document.getElementById('ondo-wallet-scan-btn');
    var clearBtn = document.getElementById('ondo-wallet-clear-btn');

    if (!toggleBtn || !panel) return;

    walletAddress = loadWalletAddress();
    if (walletAddress) {
      walletInput.value = walletAddress;
      toggleBtn.classList.add('active');
      panel.classList.add('show');
      clearBtn.style.display = '';
      scanWallet(walletAddress);
    }

    toggleBtn.addEventListener('click', function () {
      panel.classList.toggle('show');
      toggleBtn.classList.toggle('active');
      if (panel.classList.contains('show') && !walletAddress) {
        walletInput.focus();
      }
    });

    scanBtn.addEventListener('click', function () {
      var addr = walletInput.value.trim();
      if (!isValidEthAddress(addr)) {
        var statusEl = document.getElementById('ondo-wallet-status');
        statusEl.textContent = 'Invalid Ethereum address. Must be 0x followed by 40 hex characters.';
        statusEl.className = 'wallet-status error';
        return;
      }
      walletAddress = addr;
      saveWalletAddress(addr);
      clearBtn.style.display = '';
      scanWallet(addr);
    });

    clearBtn.addEventListener('click', function () {
      walletAddress = '';
      walletBalances = {};
      saveWalletAddress('');
      walletInput.value = '';
      clearBtn.style.display = 'none';
      document.getElementById('ondo-wallet-status').textContent = '';
      document.getElementById('ondo-wallet-status').className = 'wallet-status';
      document.getElementById('ondo-wallet-holdings').innerHTML = '';
      renderOndo();
    });

    walletInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') scanBtn.click();
    });
  }

  var DEFAULT_ONDO = [
    { symbol: 'AAPLON',  underlying: 'AAPL',  name: 'Apple (Tokenized)',   qty: 0 },
    { symbol: 'NVDAON',  underlying: 'NVDA',  name: 'NVIDIA (Tokenized)',  qty: 0 },
    { symbol: 'TSLAON',  underlying: 'TSLA',  name: 'Tesla (Tokenized)',   qty: 0 },
    { symbol: 'GOOGLON', underlying: 'GOOGL', name: 'Alphabet (Tokenized)', qty: 0 },
    { symbol: 'AMZNON',  underlying: 'AMZN',  name: 'Amazon (Tokenized)',  qty: 0 },
    { symbol: 'SPYON',   underlying: 'SPY',   name: 'S&P 500 ETF (Tokenized)', qty: 0 },
    { symbol: 'QQQON',   underlying: 'QQQ',   name: 'Nasdaq 100 ETF (Tokenized)', qty: 0 }
  ];

  var ondoHoldings = loadHoldings('mm_ondo', DEFAULT_ONDO);
  var ondoPrices = {};

  async function fetchOndoPrices() {
    var promises = ondoHoldings.map(function (h) {
      return fetchOneOndoStock(h);
    });
    await Promise.allSettled(promises);
    renderOndo();
  }

  async function fetchOneOndoStock(holding) {
    try {
      var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/'
        + encodeURIComponent(holding.underlying) + '?range=1d&interval=1d';
      var data = await fetchViaProxy(yahooUrl);
      var result = data.chart.result[0];
      var meta = result.meta;
      var price = meta.regularMarketPrice;
      var prevClose = meta.chartPreviousClose || meta.previousClose;
      var changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
      ondoPrices[holding.symbol] = { price: price, change: changePct };
    } catch (e) { /* silent */ }
  }

  function renderOndo() {
    var list = document.getElementById('ondo-holdings-list');
    if (!list) return;

    var html = '';
    for (var i = 0; i < ondoHoldings.length; i++) {
      var h = ondoHoldings[i];
      var p = ondoPrices[h.symbol];
      var price = p ? fmtPrice(p.price, 2) : '\u2014';
      var change = p ? fmtChange(p.change) : '\u2014';
      var changeClass = (p && p.change >= 0) ? 'positive' : 'negative';

      var totalQty = h.qty || 0;
      var wb = walletBalances[h.symbol];
      if (wb) totalQty += wb.balance;

      var value = (p && totalQty > 0) ? fmtPrice(p.price * totalQty, 2) : price;
      var qtyLabel = '';
      if (totalQty > 0) {
        qtyLabel = totalQty.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' tokens';
        if (wb && h.qty > 0) {
          qtyLabel += ' (manual + wallet)';
        } else if (wb && h.qty === 0) {
          qtyLabel += ' (wallet)';
        }
      }

      var logoUrl = stockLogoUrl(h.underlying);
      var logoHtml = '<div class="asset-logo ondo-asset-logo">'
        + '<img src="' + escAttr(logoUrl) + '" alt="' + escAttr(h.symbol) + '" width="40" height="40">'
        + '<span class="ondo-token-badge">ON</span>'
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
        + '<button class="remove-holding-btn" data-type="ondo" data-index="' + i + '" title="Remove">&times;</button>'
        + '</div>';
    }
    list.innerHTML = html;

    var imgs = list.querySelectorAll('.asset-logo img');
    for (var k = 0; k < imgs.length; k++) {
      imgs[k].addEventListener('error', handleImgError);
    }

    var removeBtns = list.querySelectorAll('.remove-holding-btn');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', handleRemove);
    }
  }

  function setupAddOndo() {
    var btn = document.getElementById('add-ondo-btn');
    var form = document.getElementById('add-ondo-form');
    if (!btn || !form) return;

    btn.addEventListener('click', function () {
      form.classList.toggle('show');
      if (form.classList.contains('show')) {
        form.querySelector('input').focus();
      }
    });

    var submitBtn = form.querySelector('.btn-primary');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', function () {
      var symbolInput = form.querySelector('[name="ondo-symbol"]');
      var nameInput = form.querySelector('[name="ondo-name"]');
      var qtyInput = form.querySelector('[name="ondo-qty"]');

      var symbol = symbolInput.value.trim().toUpperCase();
      var name = nameInput.value.trim();
      var qty = parseFloat(qtyInput.value) || 0;

      if (!symbol) return;

      var underlying = symbol.replace(/ON$/, '');

      ondoHoldings.push({
        symbol: symbol,
        underlying: underlying,
        name: name || symbol,
        qty: qty
      });
      saveHoldings('mm_ondo', ondoHoldings);

      symbolInput.value = '';
      nameInput.value = '';
      qtyInput.value = '';
      form.classList.remove('show');

      fetchOndoPrices();
    });
  }

  // --- Init ---
  function init() {
    renderCrypto();
    renderStocks();
    renderOndo();
    setupAddCrypto();
    setupAddStock();
    setupAddOndo();
    setupWalletPanel();
    fetchCryptoPrices();
    fetchStockPrices();
    fetchOndoPrices();
    setInterval(function () {
      fetchCryptoPrices();
      fetchStockPrices();
      fetchOndoPrices();
      if (walletAddress) {
        scanWallet(walletAddress);
      }
    }, REFRESH_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();







