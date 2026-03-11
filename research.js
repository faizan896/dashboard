(function () {
  'use strict';

  var PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];
  var proxyIdx = 0;

  function getProxy() { return PROXIES[proxyIdx % PROXIES.length]; }
  function rotateProxy() { proxyIdx++; }

  async function yahooFetch(url) {
    for (var attempt = 0; attempt < PROXIES.length; attempt++) {
      try {
        var proxyUrl = getProxy() + encodeURIComponent(url);
        var res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(res.status);
        return await res.json();
      } catch (e) {
        rotateProxy();
        if (attempt === PROXIES.length - 1) throw e;
      }
    }
  }

  function fmt(n, decimals) {
    if (n == null || isNaN(n)) return 'N/A';
    decimals = decimals != null ? decimals : 2;
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtBig(n) {
    if (n == null || isNaN(n)) return 'N/A';
    if (Math.abs(n) >= 1e12) return '$' + fmt(n / 1e12) + 'T';
    if (Math.abs(n) >= 1e9) return '$' + fmt(n / 1e9) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + fmt(n / 1e6) + 'M';
    return '$' + fmt(n);
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return 'N/A';
    return (n * 100).toFixed(2) + '%';
  }

  function fmtDollar(n) {
    if (n == null || isNaN(n)) return 'N/A';
    return '$' + fmt(n);
  }

  function raw(obj) {
    if (!obj) return null;
    if (obj.raw !== undefined) return obj.raw;
    if (obj.fmt !== undefined) return obj.fmt;
    return obj;
  }

  function rawFmt(obj) {
    if (!obj) return 'N/A';
    if (obj.fmt) return obj.fmt;
    if (obj.raw !== undefined) return String(obj.raw);
    return String(obj);
  }

  async function fetchStockData(ticker) {
    ticker = ticker.toUpperCase().trim();
    var modules = 'price,summaryDetail,defaultKeyStatistics,financialData,earningsHistory,earnings,calendarEvents,assetProfile';
    var url = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/'
      + encodeURIComponent(ticker)
      + '?modules=' + modules;

    var data = await yahooFetch(url);
    if (!data || !data.quoteSummary || !data.quoteSummary.result || !data.quoteSummary.result[0]) {
      throw new Error('No data found for ' + ticker);
    }
    return data.quoteSummary.result[0];
  }

  function buildSection(title, rows) {
    var html = '<div class="research-section glass-card">';
    html += '<h3 class="research-section-title">' + title + '</h3>';
    html += '<table class="research-table"><tbody>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.value === undefined || r.value === null) r.value = 'N/A';
      var colorClass = '';
      if (r.color === 'green') colorClass = ' class="val-positive"';
      else if (r.color === 'red') colorClass = ' class="val-negative"';
      html += '<tr><td class="research-label">' + r.label + '</td><td class="research-value"' + colorClass + '>' + r.value + '</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderResults(ticker, d) {
    var price = d.price || {};
    var summary = d.summaryDetail || {};
    var keyStats = d.defaultKeyStatistics || {};
    var fin = d.financialData || {};
    var profile = d.assetProfile || {};
    var earnings = d.earnings || {};
    var earningsHist = d.earningsHistory || {};
    var calendar = d.calendarEvents || {};

    var mktPrice = raw(price.regularMarketPrice);
    var prevClose = raw(price.regularMarketPreviousClose);
    var changePct = raw(price.regularMarketChangePercent);
    var isUp = changePct != null && changePct >= 0;

    var html = '';

    // Header card
    html += '<div class="research-header glass-card">';
    html += '<div class="research-header-left">';
    html += '<h2 class="research-ticker">' + ticker + '</h2>';
    html += '<span class="research-name">' + (price.shortName || price.longName || ticker) + '</span>';
    if (profile.sector) {
      html += '<span class="research-sector">' + profile.sector + (profile.industry ? ' &bull; ' + profile.industry : '') + '</span>';
    }
    html += '</div>';
    html += '<div class="research-header-right">';
    html += '<span class="research-price">' + fmtDollar(mktPrice) + '</span>';
    html += '<span class="research-change ' + (isUp ? 'positive' : 'negative') + '">'
      + (isUp ? '+' : '') + (changePct != null ? (changePct * 100).toFixed(2) : '--') + '%</span>';
    html += '</div>';
    html += '</div>';

    // Market Overview
    html += buildSection('Market Overview', [
      { label: 'Market Cap', value: fmtBig(raw(price.marketCap)) },
      { label: 'Enterprise Value', value: fmtBig(raw(keyStats.enterpriseValue)) },
      { label: 'Share Price', value: fmtDollar(mktPrice) },
      { label: 'Previous Close', value: fmtDollar(prevClose) },
      { label: 'Open', value: fmtDollar(raw(price.regularMarketOpen)) },
      { label: 'Day High', value: fmtDollar(raw(price.regularMarketDayHigh)) },
      { label: 'Day Low', value: fmtDollar(raw(price.regularMarketDayLow)) },
      { label: 'Volume', value: raw(price.regularMarketVolume) != null ? fmt(raw(price.regularMarketVolume), 0) : 'N/A' },
      { label: 'Avg Volume', value: raw(price.averageDailyVolume3Month) != null ? fmt(raw(price.averageDailyVolume3Month), 0) : 'N/A' },
      { label: '52W High', value: fmtDollar(raw(summary.fiftyTwoWeekHigh)) },
      { label: '52W Low', value: fmtDollar(raw(summary.fiftyTwoWeekLow)) },
      { label: '50 Day Avg', value: fmtDollar(raw(summary.fiftyDayAverage)) },
      { label: '200 Day Avg', value: fmtDollar(raw(summary.twoHundredDayAverage)) },
    ]);

    // Valuation
    html += buildSection('Valuation', [
      { label: 'Trailing P/E', value: rawFmt(summary.trailingPE) },
      { label: 'Forward P/E', value: rawFmt(summary.forwardPE) },
      { label: 'PEG Ratio', value: rawFmt(keyStats.pegRatio) },
      { label: 'Price/Sales (TTM)', value: rawFmt(keyStats.priceToSalesTrailing12Months) },
      { label: 'Price/Book', value: rawFmt(keyStats.priceToBook) },
      { label: 'EV/Revenue', value: rawFmt(keyStats.enterpriseToRevenue) },
      { label: 'EV/EBITDA', value: rawFmt(keyStats.enterpriseToEbitda) },
    ]);

    // Financial Health
    html += buildSection('Financial Health', [
      { label: 'Total Revenue', value: fmtBig(raw(fin.totalRevenue)) },
      { label: 'Revenue Per Share', value: fmtDollar(raw(fin.revenuePerShare)) },
      { label: 'Gross Profit', value: fmtBig(raw(fin.grossProfits)) },
      { label: 'EBITDA', value: fmtBig(raw(fin.ebitda)) },
      { label: 'Net Income to Common', value: fmtBig(raw(keyStats.netIncomeToCommon)) },
      { label: 'Total Cash', value: fmtBig(raw(fin.totalCash)) },
      { label: 'Cash Per Share', value: fmtDollar(raw(fin.totalCashPerShare)) },
      { label: 'Total Debt', value: fmtBig(raw(fin.totalDebt)) },
      { label: 'Debt/Equity', value: rawFmt(fin.debtToEquity) },
      { label: 'Current Ratio', value: rawFmt(fin.currentRatio) },
      { label: 'Quick Ratio', value: rawFmt(fin.quickRatio) },
    ]);

    // Profitability & Growth
    html += buildSection('Profitability & Growth', [
      { label: 'Profit Margin', value: fmtPct(raw(fin.profitMargins)) },
      { label: 'Operating Margin', value: fmtPct(raw(fin.operatingMargins)) },
      { label: 'Gross Margin', value: fmtPct(raw(fin.grossMargins)) },
      { label: 'EBITDA Margin', value: fmtPct(raw(fin.ebitdaMargins)) },
      { label: 'Return on Assets', value: fmtPct(raw(fin.returnOnAssets)) },
      { label: 'Return on Equity', value: fmtPct(raw(fin.returnOnEquity)) },
      { label: 'Revenue Growth (YoY)', value: fmtPct(raw(fin.revenueGrowth)) },
      { label: 'Earnings Growth', value: fmtPct(raw(fin.earningsGrowth)) },
    ]);

    // EPS & Earnings
    html += buildSection('Earnings Per Share', [
      { label: 'Trailing EPS', value: rawFmt(keyStats.trailingEps) },
      { label: 'Forward EPS', value: rawFmt(keyStats.forwardEps) },
      { label: 'Book Value', value: fmtDollar(raw(keyStats.bookValue)) },
    ]);

    // Quarterly Earnings History
    if (earningsHist.history && earningsHist.history.length > 0) {
      var qRows = [];
      for (var i = 0; i < earningsHist.history.length; i++) {
        var q = earningsHist.history[i];
        var qPeriod = rawFmt(q.quarter) || ('Q' + (i + 1));
        var period = q.period || '';
        var epsActual = rawFmt(q.epsActual);
        var epsEst = rawFmt(q.epsEstimate);
        var surprise = rawFmt(q.surprisePercent);
        var surpVal = raw(q.surprisePercent);
        qRows.push({
          label: period + ' (EPS Actual / Est)',
          value: epsActual + ' / ' + epsEst + '  (' + (surpVal != null && surpVal >= 0 ? '+' : '') + surprise + ' surprise)',
          color: surpVal != null ? (surpVal >= 0 ? 'green' : 'red') : null
        });
      }
      html += buildSection('Quarterly Earnings History', qRows);
    }

    // Dividends & Yield
    html += buildSection('Dividends & Yield', [
      { label: 'Dividend Rate', value: rawFmt(summary.dividendRate) },
      { label: 'Dividend Yield', value: raw(summary.dividendYield) != null ? fmtPct(raw(summary.dividendYield)) : 'N/A' },
      { label: 'Ex-Dividend Date', value: rawFmt(summary.exDividendDate) },
      { label: 'Payout Ratio', value: raw(summary.payoutRatio) != null ? fmtPct(raw(summary.payoutRatio)) : 'N/A' },
      { label: '5Y Avg Dividend Yield', value: rawFmt(summary.fiveYearAvgDividendYield) },
    ]);

    // Shares & Short Interest
    html += buildSection('Shares & Short Interest', [
      { label: 'Shares Outstanding', value: raw(keyStats.sharesOutstanding) != null ? fmt(raw(keyStats.sharesOutstanding), 0) : 'N/A' },
      { label: 'Float', value: raw(keyStats.floatShares) != null ? fmt(raw(keyStats.floatShares), 0) : 'N/A' },
      { label: 'Short Ratio', value: rawFmt(keyStats.shortRatio) },
      { label: 'Short % of Float', value: raw(keyStats.shortPercentOfFloat) != null ? fmtPct(raw(keyStats.shortPercentOfFloat)) : 'N/A' },
      { label: '% Held by Insiders', value: raw(keyStats.heldPercentInsiders) != null ? fmtPct(raw(keyStats.heldPercentInsiders)) : 'N/A' },
      { label: '% Held by Institutions', value: raw(keyStats.heldPercentInstitutions) != null ? fmtPct(raw(keyStats.heldPercentInstitutions)) : 'N/A' },
      { label: 'Beta', value: rawFmt(keyStats.beta) },
    ]);

    // Target & Analyst
    html += buildSection('Analyst Targets', [
      { label: 'Target Mean Price', value: fmtDollar(raw(fin.targetMeanPrice)) },
      { label: 'Target High', value: fmtDollar(raw(fin.targetHighPrice)) },
      { label: 'Target Low', value: fmtDollar(raw(fin.targetLowPrice)) },
      { label: 'Target Median', value: fmtDollar(raw(fin.targetMedianPrice)) },
      { label: 'Recommendation', value: (fin.recommendationKey || 'N/A').toUpperCase() },
      { label: 'Number of Analysts', value: raw(fin.numberOfAnalystOpinions) != null ? String(raw(fin.numberOfAnalystOpinions)) : 'N/A' },
    ]);

    // Company Info
    if (profile.longBusinessSummary || profile.fullTimeEmployees) {
      var infoRows = [];
      if (profile.fullTimeEmployees) infoRows.push({ label: 'Employees', value: fmt(profile.fullTimeEmployees, 0) });
      if (profile.country) infoRows.push({ label: 'Country', value: profile.country });
      if (profile.city) infoRows.push({ label: 'HQ', value: profile.city + (profile.state ? ', ' + profile.state : '') });
      if (profile.website) infoRows.push({ label: 'Website', value: '<a href="' + profile.website + '" target="_blank" style="color:var(--accent)">' + profile.website + '</a>' });
      html += buildSection('Company Info', infoRows);

      if (profile.longBusinessSummary) {
        html += '<div class="research-section glass-card">';
        html += '<h3 class="research-section-title">About</h3>';
        html += '<p class="research-about">' + profile.longBusinessSummary + '</p>';
        html += '</div>';
      }
    }

    return html;
  }

  // --- Init ---
  var searchInput = document.getElementById('research-search-input');
  var searchBtn = document.getElementById('research-search-btn');
  var resultsContainer = document.getElementById('research-results');
  var loadingEl = document.getElementById('research-loading');
  var errorEl = document.getElementById('research-error');

  if (!searchInput || !searchBtn) return;

  async function doSearch() {
    var ticker = searchInput.value.trim();
    if (!ticker) return;

    resultsContainer.innerHTML = '';
    errorEl.style.display = 'none';
    loadingEl.style.display = 'flex';

    try {
      var data = await fetchStockData(ticker);
      resultsContainer.innerHTML = renderResults(ticker.toUpperCase(), data);
    } catch (e) {
      errorEl.textContent = 'Could not fetch data for "' + ticker.toUpperCase() + '". Check the ticker and try again.';
      errorEl.style.display = 'block';
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSearch();
  });
})();


