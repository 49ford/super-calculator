/* PHASED_V11_COMPLETE_NO_IMPORTS — single-file, file:// safe UI (no ES-module imports) *//* {
  var BUILD_TAG = 'PHASED_V11_COMPLETE_NO_IMPORTS';

  // Safe root
  var rootSafe = root || document.getElementById('root') || document.body;

  // Paint immediately
  try {
    rootSafe.innerHTML =
      '<div style="padding:10px 20px;color:#7a8099;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">' +
      'Loading… BUILD_TAG: ' + BUILD_TAG +
      '</div>';
  } catch (e0) {}

  // Fail loud
  function showFatal(msg, err) {
    try {
      rootSafe.innerHTML = '';
      rootSafe.style.minHeight = '100vh';
      rootSafe.style.background = '#0f1117';
      rootSafe.style.color = '#e8eaf0';
      rootSafe.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      var pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.color = '#f06c6c';
      pre.style.background = '#161923';
      pre.style.border = '1px solid rgba(240,108,108,.35)';
      pre.style.borderRadius = '12px';
      pre.style.padding = '16px';
      pre.textContent =
        'V6 UI ERROR:\n\n' + msg + '\n\n' + (err && err.stack ? err.stack : (err ? String(err) : ''));
      rootSafe.appendChild(pre);
    } catch (e) {}
  }

  window.onerror = function (message, source, lineno, colno, error) {
    showFatal(String(message) + '\n@ ' + String(source) + ':' + lineno + ':' + colno, error);
    return true;
  };
  window.onunhandledrejection = function (event) {
    var reason = event && event.reason ? event.reason : event;
    showFatal('Unhandled promise rejection', reason);
  };

  try {
    // ---------------- helpers ----------------
    function el(tag, attrs, children) {
      if (!attrs) attrs = {};
      if (!children) children = [];
      var n = document.createElement(tag);

      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];

        if (k === 'style') {
          if (v && typeof v === 'object') Object.assign(n.style, v);
          else if (typeof v === 'string') n.setAttribute('style', v);
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          n.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          n.setAttribute(k, String(v));
        }
      }

      var arr = Array.isArray(children) ? children : [children];
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (c == null) continue;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      }
      return n;
    }

    var SVG_NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs, children) {
      if (!attrs) attrs = {};
      if (!children) children = [];
      var n = document.createElementNS(SVG_NS, tag);

      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        n.setAttribute(k, String(attrs[k]));
      }

      var arr = Array.isArray(children) ? children : [children];
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (c == null) continue;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      }
      return n;
    }

    function fmt(n) { return '$' + Math.round(n).toLocaleString('en-AU'); }
    function pct(x) { return (x * 100).toFixed(2) + '%'; }

    // ---------------- locked actuals + seeds ----------------
    // Locked actuals ages 48–53 and FY2025 close seeds from v4.2 and briefing. 【1-10f935】【1-44c8f1】
    var ACTUALS = [
      { age:48, robOpen:462151.00, tinaOpen:335957.00 },
      { age:49, robOpen:570166.00, tinaOpen:416543.00 },
      { age:50, robOpen:567311.00, tinaOpen:419005.00 },
      { age:51, robOpen:652528.00, tinaOpen:484791.00 },
      { age:52, robOpen:730025.00, tinaOpen:559116.00 },
      { age:53, robOpen:829122.86, tinaOpen:658880.00 }
    ];
    var FINAL_ACTUAL_CLOSE = { rob: 829122.86, tina: 658880.00 };

    // Hard-coded concessional schedule: age 54 = 30k, age 55+ = 32.5k. 【1-10f935】【1-44c8f1】
    function concessionalForAge(age) {
      if (age === 54) return 30000;
      if (age > 54) return 32500;
      return 0;
    }

    // Phased spend thirds (41-year horizon split into thirds)
    var HORIZON = 41;
    function thirdSize() { return Math.ceil(HORIZON / 3); }
    function stageIndex(i) {
      var t = thirdSize();
      if (i < t) return 0;
      if (i < t * 2) return 1;
      return 2;
    }
    function stageName(s) { return s === 0 ? 'Golden' : (s === 1 ? 'Silver' : 'Legacy'); }

    // Pension function: only call if bundled globally (safe for file://)
    var pensionFn = (typeof estimateAgePension === 'function') ? estimateAgePension : null;

    // ---------------- state ----------------
    var state = {
      tab: 'super',
      showActuals: true,
      endAge: 90,

      robRetireAge: 60,
      tinaRetireAge: 60,

      robSeed: FINAL_ACTUAL_CLOSE.rob,
      tinaSeed: FINAL_ACTUAL_CLOSE.tina,

      contribTax: 0.15,

      // defaults requested
      robWorkReturn: 0.103,
      tinaWorkReturn: 0.103,
      retireReturn: 0.08,

      // phased spend defaults requested
      spendMin: 50000,
      spendMax: 500000,
      spendGolden: 290000,
      spendSilver: 210000,
      spendLegacy: 285000,
      spendPhase: 'Golden',

      // split default requested
      splitPct: 55,

      // other assets income stream (yield + inflation index)
      otherAssets: 0,
      otherIncomeStartAge: 60,
      otherMode: 'yield',      // 'yield' or 'inflation'
      otherYield: 0.05,
      otherInflation: 0.035,   // default 3.5%

      // pension toggle (optional)
      usePension: true,
      homeowner: true,

      fullPension: 44855,
      assetThreshold: 470000,
      assetTaperPerDollar: 0.078,
      deemingThreshold: 100000,
      deemingRateLow: 0.0025,
      deemingRateHigh: 0.0225,
      incomeFreeArea: 9000,
      incomeTaperRate: 0.5
    };

    function stagedSpend(yearIndex) {
      var s = stageIndex(yearIndex);
      if (s === 0) return state.spendGolden;
      if (s === 1) return state.spendSilver;
      return state.spendLegacy;
    }

    // ---------------- UI layout ----------------
    rootSafe.innerHTML = '';
    rootSafe.style.minHeight =
