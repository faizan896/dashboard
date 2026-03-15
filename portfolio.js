(function () {
  'use strict';

  var FINNHUB_KEY = 'd6or3l1r01qmqugc2a80d6or3l1r01qmqugc2a8g';
  var REFRESH_INTERVAL = 60000;

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

  function loadHoldings(key, defaults) {
    try {
      var saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return defaults.map(function (h) { return Object.assign({}, h); });
  }

  function saveHoldings(key, holdings) {
    try { localStorage.setItem(key, JSON.stringify(holdings)); } catch (e) { /* ignore */ }
  }

  var cryptoHoldings = loadHoldings('mm_crypto', DEFAULT_CRYPTO);
  var stockHoldings = loadHoldings('mm_stocks', DEFAULT_STOCKS);

  var cryptoPrices = {};
  var stockPrices = {};
  var cryptoImages = {};

  // Hardcoded logo URLs for common coins (CoinGecko rate-limits the images endpoint)
  var COIN_LOGOS = {
    'bitcoin': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    'ethereum': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    'solana': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    'cardano': 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    'ripple': 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    'ondo': 'https://assets.coingecko.com/coins/images/26580/small/ONDO.png',
    'ondo-us-dollar-yield': 'https://assets.coingecko.com/coins/images/31973/small/USDY.png',
    'ousg': 'https://assets.coingecko.com/coins/images/31972/small/OUSG.png',
    'dogecoin': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    'polkadot': 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
    'avalanche-2': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    'chainlink': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    'uniswap': 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg'
  };

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

  function tickerColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var h = Math.abs(hash) % 360;
    return 'hsl(' + h + ', 50%, 45%)';
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Fetch crypto prices via CoinGecko ---
  async function fetchCryptoPrices() {
    if (cryptoHoldings.length === 0) return;
    var ids = cryptoHoldings.map(function (h) { return h.id; }).join(',');

    // Try /simple/price first (more reliable, less rate-limited)
    try {
      var url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd&include_24hr_change=true';
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      for (var id in data) {
        cryptoPrices[id] = { price: data[id].usd, change: data[id].usd_24h_change };
      }
    } catch (e) {
      console.warn('Crypto price fetch failed:', e.message);
    }

    // Try to get images from /coins/markets (secondary)
    try {
      var url2 = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids
        + '&per_page=50&page=1&sparkline=false&price_change_percentage=24h';
      var res2 = await fetch(url2);
      if (res2.ok) {
        var data2 = await res2.json();
        for (var i = 0; i < data2.length; i++) {
          var coin = data2[i];
          if (coin.image) cryptoImages[coin.id] = coin.image;
          // Update prices if we got them
          if (coin.current_price) {
            cryptoPrices[coin.id] = { price: coin.current_price, change: coin.price_change_percentage_24h };
          }
        }
      }
    } catch (e2) { /* silent - images are optional */ }

    renderCrypto();
  }

  function getCryptoImage(holding) {
    return cryptoImages[holding.id] || COIN_LOGOS[holding.id] || holding.image || '';
  }

  // --- Fetch stock prices via Finnhub ---
  async function fetchStockPrices() {
    var promises = stockHoldings.map(function (h) { return fetchOneStock(h.symbol); });
    await Promise.allSettled(promises);
    renderStocks();
  }

  async function fetchOneStock(symbol) {
    try {
      var url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol) + '&token=' + FINNHUB_KEY;
      var res = await fetch(url);
      if (!res.ok) throw new Error('Finnhub ' + res.status);
      var data = await res.json();
      if (!data || data.c === 0 || data.c == null) return;
      stockPrices[symbol] = { price: data.c, change: data.dp };
    } catch (e) { console.warn('Stock fetch failed for ' + symbol + ':', e.message); }
  }

  // --- Render crypto ---
  function renderCrypto() {
    var list = document.getElementById('crypto-list');
    if (!list) return;

    var html = '';
    for (var i = 0; i < cryptoHoldings.length; i++) {
      var h = cryptoHoldings[i];
      var p = cryptoPrices[h.id];
      var price = p ? fmtPrice(p.price, p.price >= 100 ? 2 : 4) : '\u2014';
      var change = p ? fmtChange(p.change) : '\u2014';
      var isUp = p && p.change >= 0;
      var value = (p && h.qty > 0) ? fmtPrice(p.price * h.qty, 2) : price;
      var numValue = (p && h.qty > 0) ? (p.price * h.qty) : 0;
      var qtyLabel = h.qty > 0 ? h.qty + ' ' + h.ticker : '';

      var imgUrl = getCryptoImage(h);
      var fallbackDiv = '<div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:' + tickerColor(h.ticker) + '">' + escHtml(h.ticker.substring(0, 3)) + '</div>';
      var logoHtml;
      if (imgUrl) {
        logoHtml = '<img src="' + escAttr(imgUrl) + '" alt="' + escAttr(h.ticker) + '" class="w-7 h-7 rounded-full" onerror="this.outerHTML=this.getAttribute(\'data-fallback\')" data-fallback="' + escAttr(fallbackDiv) + '">';
      } else {
        logoHtml = fallbackDiv;
      }

      html += '<div class="holding-item flex items-center justify-between p-2 rounded-lg hover:bg-dark-700 transition-colors group" data-value="' + numValue + '">'
        + '<div class="flex items-center gap-3">'
        + '<div class="flex-shrink-0">' + logoHtml + '</div>'
        + '<div>'
        + '<div class="text-[12px] text-light-100 font-medium">' + escHtml(h.name) + '</div>'
        + '<div class="text-[10px] text-gray-darker uppercase tracking-wider">' + escHtml(h.ticker)
        + (qtyLabel ? ' \u00B7 ' + escHtml(qtyLabel) : '') + '</div>'
        + '</div></div>'
        + '<div class="flex items-center gap-4">'
        + '<div class="text-right">'
        + '<div class="text-[13px] text-light-100 font-medium">' + value + '</div>'
        + '<div class="text-[10px] ' + (isUp ? 'text-status-green' : 'text-status-red') + '">' + change + '</div>'
        + '</div>'
        + '<button class="remove-holding-btn text-gray-darker hover:text-status-red opacity-0 group-hover:opacity-100 transition-all" data-type="crypto" data-index="' + i + '">'
        + '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        + '</button></div></div>';
    }
    list.innerHTML = html;

    var removeBtns = list.querySelectorAll('.remove-holding-btn');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', handleRemove);
    }
  }

  // --- Render stocks ---
  function renderStocks() {
    var list = document.getElementById('stock-list');
    if (!list) return;

    var html = '';
    for (var i = 0; i < stockHoldings.length; i++) {
      var h = stockHoldings[i];
      var p = stockPrices[h.symbol];
      var price = p ? fmtPrice(p.price, 2) : '\u2014';
      var change = p ? fmtChange(p.change) : '\u2014';
      var isUp = p && p.change >= 0;
      var value = (p && h.qty > 0) ? fmtPrice(p.price * h.qty, 2) : price;
      var numValue = (p && h.qty > 0) ? (p.price * h.qty) : 0;
      var qtyLabel = h.qty > 0 ? h.qty + ' shares' : '';

      var char = h.symbol.charAt(0);
      html += '<div class="holding-item flex items-center justify-between p-2 rounded-lg hover:bg-dark-700 transition-colors group" data-value="' + numValue + '">'
        + '<div class="flex items-center gap-3">'
        + '<div class="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold">' + escHtml(char) + '</div>'
        + '<div>'
        + '<div class="text-[12px] text-light-100 font-medium">' + escHtml(h.name) + '</div>'
        + '<div class="text-[10px] text-gray-darker uppercase tracking-wider">' + escHtml(h.symbol)
        + (qtyLabel ? ' \u00B7 ' + escHtml(qtyLabel) : '') + '</div>'
        + '</div></div>'
        + '<div class="flex items-center gap-4">'
        + '<div class="text-right">'
        + '<div class="text-[13px] text-light-100 font-medium">' + value + '</div>'
        + '<div class="text-[10px] ' + (isUp ? 'text-status-green' : 'text-status-red') + '">' + change + '</div>'
        + '</div>'
        + '<button class="remove-holding-btn text-gray-darker hover:text-status-red opacity-0 group-hover:opacity-100 transition-all" data-type="stock" data-index="' + i + '">'
        + '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        + '</button></div></div>';
    }
    list.innerHTML = html;

    var removeBtns = list.querySelectorAll('.remove-holding-btn');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', handleRemove);
    }
  }

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
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) form.querySelector('input').focus();
    });

    var cancelBtn = form.querySelector('.cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { form.classList.add('hidden'); });

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

      cryptoHoldings.push({ id: id, name: name || ticker, ticker: ticker, qty: qty });
      saveHoldings('mm_crypto', cryptoHoldings);

      idInput.value = ''; nameInput.value = ''; tickerInput.value = ''; qtyInput.value = '';
      form.classList.add('hidden');
      fetchCryptoPrices();
    });
  }

  // --- Add stock form ---
  function setupAddStock() {
    var btn = document.getElementById('add-stock-btn');
    var form = document.getElementById('add-stock-form');
    if (!btn || !form) return;

    btn.addEventListener('click', function () {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) form.querySelector('input').focus();
    });

    var cancelBtn = form.querySelector('.cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { form.classList.add('hidden'); });

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

      stockHoldings.push({ symbol: symbol, name: name || symbol, qty: qty });
      saveHoldings('mm_stocks', stockHoldings);

      symbolInput.value = ''; nameInput.value = ''; qtyInput.value = '';
      form.classList.add('hidden');
      fetchStockPrices();
    });
  }

  // --- Ondo Global Markets ---
  var ONDO_CONTRACTS = [
    { address: '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c', symbol: 'AAPLON', underlying: 'AAPL', name: 'Apple (Tokenized)', decimals: 18 },
    { address: '0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee', symbol: 'NVDAON', underlying: 'NVDA', name: 'NVIDIA (Tokenized)', decimals: 18 },
    { address: '0xfAbA6f8e4a5E8AB82F62fe7C39859FA577269BE3', symbol: 'ONDO', underlying: null, name: 'Ondo', decimals: 18, coingeckoId: 'ondo' },
    { address: '0x96F6eF951840721AdBF46Ac996b59E0235CB985C', symbol: 'USDY', underlying: null, name: 'Ondo US Dollar Yield', decimals: 18, coingeckoId: 'ondo-us-dollar-yield' },
    { address: '0x1B19C19393e2d034D8Ff31fF34c81252FcBbEE92', symbol: 'OUSG', underlying: null, name: 'Ondo Short-Term US Gov Bond', decimals: 18, coingeckoId: 'ousg' }
  ];

  var ETH_RPC = 'https://eth.llamarpc.com';
  var walletAddress = '';
  var walletBalances = {};

  function loadWalletAddress() {
    try { var saved = localStorage.getItem('mm_ondo_wallet'); if (saved) return saved; } catch (e) { /* ignore */ }
    return '';
  }

  function saveWalletAddress(addr) {
    try { localStorage.setItem('mm_ondo_wallet', addr); } catch (e) { /* ignore */ }
  }

  function isValidEthAddress(addr) { return /^0x[0-9a-fA-F]{40}$/.test(addr); }

  async function getTokenBalance(tokenAddress, walletAddr) {
    var data = '0x70a08231' + walletAddr.slice(2).toLowerCase().padStart(64, '0');
    try {
      var res = await fetch(ETH_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: tokenAddress, data: data }, 'latest'], id: 1 })
      });
      var json = await res.json();
      if (json.result && json.result !== '0x') return BigInt(json.result);
      return BigInt(0);
    } catch (e) { return BigInt(0); }
  }

  function formatTokenBalance(rawBalance, decimals) {
    if (rawBalance === BigInt(0)) return 0;
    var divisor = BigInt(10) ** BigInt(decimals);
    var whole = rawBalance / divisor;
    var remainder = rawBalance % divisor;
    var remainderStr = remainder.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
    if (remainderStr === '') return Number(whole);
    return parseFloat(whole.toString() + '.' + remainderStr);
  }

  async function scanWallet(addr) {
    var statusEl = document.getElementById('ondo-wallet-status');
    var holdingsEl = document.getElementById('ondo-wallet-holdings');

    statusEl.textContent = 'Scanning wallet for Ondo tokens...';
    statusEl.className = 'wallet-status scanning text-[11px] mt-2';
    holdingsEl.innerHTML = '';
    walletBalances = {};

    var foundCount = 0;
    var promises = ONDO_CONTRACTS.map(async function (token) {
      var rawBalance = await getTokenBalance(token.address, addr);
      var balance = formatTokenBalance(rawBalance, token.decimals);
      if (balance > 0) {
        foundCount++;
        walletBalances[token.symbol] = {
          balance: balance, name: token.name, underlying: token.underlying,
          symbol: token.symbol, contract: token.address, coingeckoId: token.coingeckoId || null
        };
      }
    });

    await Promise.allSettled(promises);

    if (foundCount > 0) {
      statusEl.textContent = 'Found ' + foundCount + ' Ondo token' + (foundCount > 1 ? 's' : '') + ' in wallet';
      statusEl.className = 'wallet-status success text-[11px] mt-2';
    } else {
      statusEl.textContent = 'No Ondo tokens found in this wallet';
      statusEl.className = 'wallet-status text-[11px] mt-2 text-gray-darker';
    }

    renderWalletHoldings();
    renderOndo();
  }

  function renderWalletHoldings() {
    var holdingsEl = document.getElementById('ondo-wallet-holdings');
    if (!holdingsEl) return;
    var symbols = Object.keys(walletBalances);
    if (symbols.length === 0) { holdingsEl.innerHTML = ''; return; }

    var html = '';
    for (var i = 0; i < symbols.length; i++) {
      var wb = walletBalances[symbols[i]];
      var priceInfo = ondoPrices[wb.symbol];
      var valueStr = '\u2014';
      if (priceInfo) valueStr = fmtPrice(priceInfo.price * wb.balance, 2);

      html += '<div class="flex items-center justify-between p-2 rounded-lg hover:bg-dark-700 transition-colors">'
        + '<div class="flex items-center gap-3">'
        + '<div class="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[9px] font-bold">' + escHtml(wb.symbol.substring(0, 3)) + '</div>'
        + '<div>'
        + '<div class="text-[12px] text-light-100 font-medium">' + escHtml(wb.name) + ' <span class="text-[9px] bg-accent/20 text-accent px-1 rounded">Wallet</span></div>'
        + '<div class="text-[10px] text-gray-darker">' + wb.balance.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' tokens</div>'
        + '</div></div>'
        + '<div class="text-[13px] text-light-100 font-medium">' + valueStr + '</div>'
        + '</div>';
    }
    holdingsEl.innerHTML = html;
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
      panel.classList.remove('hidden');
      clearBtn.style.display = '';
      scanWallet(walletAddress);
    }

    toggleBtn.addEventListener('click', function () {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden') && !walletAddress) walletInput.focus();
    });

    scanBtn.addEventListener('click', function () {
      var addr = walletInput.value.trim();
      if (!isValidEthAddress(addr)) {
        var statusEl = document.getElementById('ondo-wallet-status');
        statusEl.textContent = 'Invalid Ethereum address. Must be 0x followed by 40 hex characters.';
        statusEl.className = 'wallet-status error text-[11px] mt-2';
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
      document.getElementById('ondo-wallet-holdings').innerHTML = '';
      renderOndo();
    });

    walletInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') scanBtn.click(); });
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

  // Fetch Ondo prices via Finnhub (underlying stock prices)
  async function fetchOndoPrices() {
    var promises = ondoHoldings.map(function (h) { return fetchOneOndoStock(h); });
    await Promise.allSettled(promises);
    renderOndo();
  }

  async function fetchOneOndoStock(holding) {
    if (!holding.underlying) return;
    try {
      var url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(holding.underlying) + '&token=' + FINNHUB_KEY;
      var res = await fetch(url);
      if (!res.ok) throw new Error('Finnhub ' + res.status);
      var data = await res.json();
      if (!data || data.c === 0 || data.c == null) return;
      ondoPrices[holding.symbol] = { price: data.c, change: data.dp };
    } catch (e) { console.warn('Ondo price fetch failed for ' + holding.symbol + ':', e.message); }
  }

  function renderOndo() {
    var list = document.getElementById('ondo-list');
    if (!list) return;

    var html = '';
    for (var i = 0; i < ondoHoldings.length; i++) {
      var h = ondoHoldings[i];
      var p = ondoPrices[h.symbol];
      var price = p ? fmtPrice(p.price, 2) : '\u2014';
      var change = p ? fmtChange(p.change) : '\u2014';
      var isUp = p && p.change >= 0;

      var totalQty = h.qty || 0;
      var wb = walletBalances[h.symbol];
      if (wb) totalQty += wb.balance;

      var value = (p && totalQty > 0) ? fmtPrice(p.price * totalQty, 2) : price;
      var numValue = (p && totalQty > 0) ? (p.price * totalQty) : 0;
      var qtyLabel = '';
      if (totalQty > 0) {
        qtyLabel = totalQty.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' tokens';
        if (wb && h.qty > 0) qtyLabel += ' (manual + wallet)';
        else if (wb && h.qty === 0) qtyLabel += ' (wallet)';
      }

      var char = h.underlying ? h.underlying.charAt(0) : h.symbol.charAt(0);
      html += '<div class="holding-item flex items-center justify-between p-3 rounded-lg hover:bg-dark-700 transition-colors group" data-value="' + numValue + '">'
        + '<div class="flex items-center gap-4">'
        + '<div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent/80 to-accent-dark flex items-center justify-center text-light-100 text-[10px] font-bold shadow-inner">' + escHtml(char) + '</div>'
        + '<div>'
        + '<div class="text-[13px] text-light-100 font-medium">' + escHtml(h.name) + '</div>'
        + '<div class="text-[11px] text-gray-darker flex items-center gap-2 mt-0.5">'
        + '<span class="uppercase tracking-widest">' + escHtml(h.symbol) + '</span>'
        + (qtyLabel ? '<span>\u00B7</span><span>' + escHtml(qtyLabel) + '</span>' : '')
        + '</div></div></div>'
        + '<div class="flex items-center gap-4">'
        + '<div class="text-right">'
        + '<div class="text-[14px] text-light-100 font-medium">' + value + '</div>'
        + '<div class="text-[11px] mt-0.5 ' + (isUp ? 'text-status-green' : 'text-status-red') + '">' + change + '</div>'
        + '</div>'
        + '<button class="remove-holding-btn text-gray-darker hover:text-status-red opacity-0 group-hover:opacity-100 transition-all" data-type="ondo" data-index="' + i + '">'
        + '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        + '</button></div></div>';
    }
    list.innerHTML = html;

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
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) form.querySelector('input').focus();
    });

    var cancelBtn = form.querySelector('.cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { form.classList.add('hidden'); });

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
      ondoHoldings.push({ symbol: symbol, underlying: underlying, name: name || symbol, qty: qty });
      saveHoldings('mm_ondo', ondoHoldings);

      symbolInput.value = ''; nameInput.value = ''; qtyInput.value = '';
      form.classList.add('hidden');
      fetchOndoPrices();
    });
  }

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
      if (walletAddress) scanWallet(walletAddress);
    }, REFRESH_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
