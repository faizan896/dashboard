// ============================================================
//  ★ MANUAL DATA — EDIT THIS SECTION DAILY ★
//  For stocks, indices, commodities (anything not crypto)
//  Change the numbers, save file, refresh browser
// ============================================================
const MANUAL_DATA = {
  // Top widget cards
  nvda:  { price: 135.50,  change: 2.34  },   // NVIDIA widget
  spx:   { price: 5234.18, change: 0.45  },   // S&P 500 widget
  gold:  { price: 2345.60, change: 0.32  },   // Gold widget

  // Stock holdings section
  aapl:  { price: 189.84,  change: 0.52  },   // Apple
  tsla:  { price: 248.50,  change: -1.23 },   // Tesla (negative = red)
  googl: { price: 141.80,  change: 0.87  },   // Alphabet
  amzn:  { price: 185.60,  change: 1.15  },   // Amazon
};

// ============================================================
//  CRYPTO CONFIG — Auto-fetched from CoinGecko every 60 sec
//  No need to touch this. Prices update automatically.
// ============================================================
const CRYPTO_MAP = {
  bitcoin:   'btc',
  ethereum:  'eth',
  solana:    'sol',
  cardano:   'ada',
  ripple:    'xrp',
};

const REFRESH_SECONDS = 60;

// ============================================================
//  ENGINE — Do not edit below unless you know JavaScript
// ============================================================
let cryptoData = {};

function fmtPrice(p) {
  if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + p.toFixed(4);
}

function fmtChange(c) {
  return (c >= 0 ? '+' : '') + c.toFixed(2) + '%';
}

function updateWidget(key, price, change) {
  var pe = document.getElementById('price-' + key);
  var ce = document.getElementById('change-' + key);
  if (pe) pe.textContent = fmtPrice(price);
  if (ce) {
    ce.textContent = fmtChange(change);
    ce.className = 'widget-change ' + (change >= 0 ? 'positive' : 'negative');
  }
}

function updateHolding(ticker, price, change) {
  document.querySelectorAll('.asset-ticker').forEach(function(el) {
    if (el.textContent.trim().toUpperCase() === ticker.toUpperCase()) {
      var item = el.closest('.holding-item');
      if (!item) return;
      var ve = item.querySelector('.asset-value');
      var ce = item.querySelector('.asset-change');
      if (ve) ve.textContent = fmtPrice(price);
      if (ce) {
        ce.textContent = fmtChange(change);
        ce.className = 'asset-change ' + (change >= 0 ? 'positive' : 'negative');
      }
    }
  });
}

function showStatus(msg) {
  var el = document.getElementById('api-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'api-status';
    el.style.cssText = 'position:fixed;bottom:12px;right:16px;font-size:11px;color:#888;background:rgba(255,255,255,0.9);padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;z-index:999;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

async function fetchCrypto() {
  var ids = Object.keys(CRYPTO_MAP).join(',');
  var url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd&include_24hr_change=true';
  try {
    var res = await fetch(url);
    if (!res.ok) throw new Error('Status ' + res.status);
    var data = await res.json();
    for (var cgId in CRYPTO_MAP) {
      if (data[cgId]) {
        var ticker = CRYPTO_MAP[cgId];
        cryptoData[ticker] = {
          price: data[cgId].usd,
          change: data[cgId].usd_24h_change || 0
        };
      }
    }
    var t = new Date();
    showStatus('Live \u2022 Updated ' + t.toLocaleTimeString());
    console.log('[CoinGecko] Prices updated at ' + t.toLocaleTimeString());
  } catch (e) {
    showStatus('API error \u2022 Retrying...');
    console.warn('[CoinGecko] Fetch failed:', e.message);
  }
}

function applyAll() {
  // Crypto top widget (BTC)
  if (cryptoData.btc) updateWidget('btc', cryptoData.btc.price, cryptoData.btc.change);

  // Manual top widgets
  if (MANUAL_DATA.nvda) updateWidget('nvda', MANUAL_DATA.nvda.price, MANUAL_DATA.nvda.change);
  if (MANUAL_DATA.spx)  updateWidget('spx',  MANUAL_DATA.spx.price,  MANUAL_DATA.spx.change);
  if (MANUAL_DATA.gold) updateWidget('gold', MANUAL_DATA.gold.price, MANUAL_DATA.gold.change);

  // Crypto holdings
  for (var cgId in CRYPTO_MAP) {
    var ticker = CRYPTO_MAP[cgId];
    if (cryptoData[ticker]) {
      updateHolding(ticker, cryptoData[ticker].price, cryptoData[ticker].change);
    }
  }

  // Stock holdings
  var stocks = { aapl:'AAPL', nvda:'NVDA', tsla:'TSLA', googl:'GOOGL', amzn:'AMZN' };
  for (var key in stocks) {
    if (MANUAL_DATA[key]) {
      updateHolding(stocks[key], MANUAL_DATA[key].price, MANUAL_DATA[key].change);
    }
  }
}

async function init() {
  showStatus('Loading prices...');
  applyAll();                    // Show manual data immediately
  await fetchCrypto();           // Fetch live crypto
  applyAll();                    // Update with live crypto

  setInterval(async function() {
    await fetchCrypto();
    applyAll();
  }, REFRESH_SECONDS * 1000);
}

init();
