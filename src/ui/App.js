import { estimateAgePension } from '../engine/pension.js';import other-income (yield + inflation index) */
export function mountApp(root) {
  var BUILD_TAG = 'PHASED_V8';
  var rootSafe = root || document.getElementById('root') || document.body;

  // always paint something immediately
  try {
    rootSafe.innerHTML =
      '<div style="padding:10px 20px;color:#7a8099;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">' +
      'Loading… BUILD_TAG: ' + BUILD_TAG +
      '</div>';
  } catch (e0) {}

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

  window.onerror = function(message, source, lineno, colno, error) {
    showFatal(String(message) + '\n@ ' + String(source) + ':' + lineno + ':' + colno, error);
    return true;
  };
  window.onunhandledrejection = function(event) {
    var reason = event && event.reason ? event.reason : event;
    showFatal('Unhandled promise rejection', reason);
  };

  try {
    // ---------- helpers ----------
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
      for (var i=0;i<arr.length;i++){
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
        var v = attrs[k];
        if (k === 'style') {
          if (v && typeof v === 'object') {
            var s = '';
            for (var a in v) { if (Object.prototype.hasOwnProperty.call(v, a)) s += a + ':' + v[a] + ';'; }
            n.setAttribute('style', s);
          } else if (typeof v === 'string') {
            n.setAttribute('style', v);
          }
        } else {
          n.setAttribute(k, String(v));
        }
      }
      var arr = Array.isArray(children) ? children : [children];
      for (var i=0;i<arr.length;i++){
        var c = arr[i];
        if (c == null) continue;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      }
      return n;
    }

    function fmt(n) { return '$' + Math.round(n).toLocaleString('en-AU'); }
    function pct(x) { return (x * 100).toFixed(2) + '%'; }

    // ---------- locked actuals + seeds (v4.2) ----------
    // Seeds: Rob 829,122.86; Tina 658,880.00 for forecast from age 54. 【1-d07fc2】【1-153fb5】
    var ACTUALS = [
      { age:48, robOpen:462151.00, tinaOpen:335957.00 },
      { age:49, robOpen:570166.00, tinaOpen:416543.00 },
      { age:50, robOpen:567311.00, tinaOpen:419005.00 },
      { age:51, robOpen:652528.00, tinaOpen:484791.00 },
      { age:52, robOpen:730025.00, tinaOpen:559116.00 },
      { age:53, robOpen:829122.86, tinaOpen:658880.00 }
    ];
    var FINAL_ACTUAL_CLOSE = { rob: 829122.86, tina: 658880.00 };

    // Concessional locked schedule: age 54 => 30k each; age 55+ => 32.5k each. 【1-d07fc2】【1-153fb5】
    function concessionalForAge(age) {
      if (age === 54) return 30000;
      if (age > 54) return 32500;
      return 0;
    }

    // Phased spend thirds (41-year horizon)
    var HORIZON = 41;
    function thirdSize() { return Math.ceil(HORIZON / 3); }
    function stageIndex(i) {
      var t = thirdSize();
      if (i < t) return 0;
      if (i < t * 2) return 1;
      return 2;
    }
    function stageName(s) { return s === 0 ? 'Golden' : (s === 1 ? 'Silver' : 'Legacy'); }

    // ---------- state ----------
    var state = {
      tab: 'super',
      showActuals: true,
      endAge: 90,

      robRetireAge: 60,
      tinaRetireAge: 60,

      robSeed: FINAL_ACTUAL_CLOSE.rob,
      tinaSeed: FINAL_ACTUAL_CLOSE.tina,

      contribTax: 0.15,

      robWorkReturn: 0.103,
      tinaWorkReturn: 0.103,
      retireReturn: 0.08,

      spendMin: 50000,
      spendMax: 500000,
      spendGolden: 290000,
      spendSilver: 210000,
      spendLegacy: 285000,
      spendPhase: 'Golden',

      splitPct: 55,

      // other assets income stream
      otherAssets: 0,
      otherIncomeStartAge: 60,
      otherMode: 'yield',      // 'yield' or 'inflation'
      otherYield: 0.05,
      otherInflation: 0.035,   // 3.5%

      // pension toggle + params (aligned to v4.2 values used earlier) 【1-d07fc2】
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

    // ---------- UI layout ----------
    rootSafe.innerHTML = '';
    rootSafe.style.minHeight = '100vh';
    rootSafe.style.background = '#0f1117';
    rootSafe.style.color = '#e8eaf0';
    rootSafe.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

    var header = el('div', { style:{ padding:'16px 20px', background:'#161923', borderBottom:'1px solid #252a3a' }}, [
      el('div', { style:{ fontSize:'10px', letterSpacing:'2px', color:'#5a6080', textTransform:'uppercase' }},
        'V6 NEXT | BUILD_TAG: ' + BUILD_TAG
      ),
      el('div', { style:{ fontSize:'20px', fontWeight:'900', marginTop:'4px' }}, 'Super Calculator')
    ]);

    var tabs = el('div', { style:{ display:'flex', gap:'10px', padding:'10px 20px', background:'#161923', borderBottom:'1px solid #252a3a' }});
    var main = el('div', { style:{ display:'grid', gridTemplateColumns:'360px 1fr', gap:'16px', padding:'16px 20px' }});
    var left = el('div', { style:{ position:'sticky', top:'10px', alignSelf:'start' }});
    var right = el('div', {});

    rootSafe.appendChild(header);
    rootSafe.appendChild(tabs);
    rootSafe.appendChild(main);
    main.appendChild(left);
    main.appendChild(right);

    function panel(title, content) {
      return el('div', { style:{ background:'#161923', border:'1px solid #252a3a', borderRadius:'12px', padding:'14px', marginBottom:'16px' }}, [
        el('div', { style:{ fontSize:'12px', color:'#7a8099', fontWeight:'900', marginBottom:'10px' }}, title),
        content
      ]);
    }

    function slider(label, min, max, step, value, display, onInput) {
      return el('div', { style:{ margin:'10px 0' }}, [
        el('div', { style:{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}, [
          el('div', { style:{ fontSize:'12px', color:'#c0c5d8', fontWeight:'700' }}, label),
          el('div', { style:{ fontSize:'12px', color:'#6c8ef0', fontFamily:'monospace' }}, display)
        ]),
        el('input', { type:'range', min:String(min), max:String(max), step:String(step), value:String(value),
          style:{ width:'100%' }, onInput:function(e){ onInput(+e.target.value); }
        })
      ]);
    }

    function chip(label, active, onClick) {
      return el('button', { style:{
        padding:'6px 10px', borderRadius:'10px', border:'1px solid #252a3a',
        background: active ? 'rgba(108,142,240,.18)' : 'transparent',
        color: active ? '#6c8ef0' : '#7a8099',
        cursor:'pointer', fontWeight:'900', fontSize:'12px'
      }, onClick:onClick }, label);
    }

    function toggle(label, on, onClick) {
      return el('button', { style:{
        padding:'7px 10px', borderRadius:'10px', border:'1px solid #252a3a',
        background:on ? 'rgba(93,216,122,.12)' : 'transparent',
        color:on ? '#5dd87a' : '#7a8099',
        cursor:'pointer', fontWeight:'900', width:'100%'
      }, onClick:onClick }, label);
    }

    function card(title, value, subtitle, color) {
      return el('div', { style:{ background:'#161923', border:'1px solid #252a3a', borderRadius:'12px', padding:'16px' }}, [
        el('div', { style:{ fontSize:'12px', color:'#7a8099', fontWeight:'800' }}, title),
        el('div', { style:{ fontSize:'22px', fontWeight:'900', color:color || '#6c8ef0', marginTop:'6px' }}, value),
        el('div', { style:{ fontSize:'11px', color:'#5a6080', marginTop:'4px' }}, subtitle)
      ]);
    }

    function buildTimeline() {
      var startAge = state.showActuals ? 48 : 54;
      var rows = [];

      if (state.showActuals) {
        for (var i=0;i<ACTUALS.length;i++){
          var a = ACTUALS[i];
          var next = ACTUALS[i+1];
          var robClose = next ? next.robOpen : FINAL_ACTUAL_CLOSE.rob;
          var tinaClose = next ? next.tinaOpen : FINAL_ACTUAL_CLOSE.tina;
          rows.push({ age:a.age, phase:'ACTUAL', stage:'', robClose:robClose, tinaClose:tinaClose, combinedClose:robClose+tinaClose,
            otherIncome:0, pension:0, robSpend:0, tinaSpend:0, grossSpend:0
          });
        }
      }

      var robBal = state.robSeed;
      var tinaBal = state.tinaSeed;
      var earliestRetire = Math.min(state.robRetireAge, state.tinaRetireAge);

      for (var age=54; age<=state.endAge; age++){
        var robWorking = age < state.robRetireAge;
        var tinaWorking = age < state.tinaRetireAge;

        var robCC = robWorking ? concessionalForAge(age) : 0;
        var tinaCC = tinaWorking ? concessionalForAge(age) : 0;

        if (robWorking) {
          var netR = robCC * (1 - state.contribTax);
          var beforeR = robBal + netR;
          robBal = beforeR + beforeR * state.robWorkReturn;
        }
        if (tinaWorking) {
          var netT = tinaCC * (1 - state.contribTax);
          var beforeT = tinaBal + netT;
          tinaBal = beforeT + beforeT * state.tinaWorkReturn;
        }

        var anyRetired = (!robWorking) || (!tinaWorking);
        var bothRetired = (!robWorking) && (!tinaWorking);

        var yearIndex = (anyRetired && age >= earliestRetire) ? (age - earliestRetire) : -1;
        var stage = (yearIndex >= 0) ? stageName(stageIndex(yearIndex)) : '';

        // other income indexed by inflation from age 60 (income only)
        var otherIncome = 0;
        if (anyRetired && age >= state.otherIncomeStartAge) {
          var baseIncome = state.otherAssets * state.otherYield;
          var years = age - state.otherIncomeStartAge;
          otherIncome = baseIncome * Math.pow(1 + state.otherInflation, years);
        }

        // pension
        var pension = 0;
        if (typeof estimateAgePension === 'function' && state.usePension && anyRetired && age >= 67) {
          pension = estimateAgePension({
            financialAssets: robBal + tinaBal + state.otherAssets,
            homeowner: state.homeowner,
            fullPension: state.fullPension,
            assetThreshold: state.assetThreshold,
            assetTaperPerDollar: state.assetTaperPerDollar,
            deemingThreshold: state.deemingThreshold,
            deemingRateLow: state.deemingRateLow,
            deemingRateHigh: state.deemingRateHigh,
            incomeFreeArea: state.incomeFreeArea,
            incomeTaperRate: state.incomeTaperRate
          });
        }

        var grossSpend = (yearIndex >= 0) ? stagedSpend(yearIndex) : 0;
        var netSuperSpend = Math.max(0, grossSpend - pension - otherIncome);

        if (!robWorking) robBal = robBal + robBal * state.retireReturn;
        if (!tinaWorking) tinaBal = tinaBal + tinaBal * state.retireReturn;

        var robSpend = 0, tinaSpend = 0;
        if (netSuperSpend > 0) {
          if (bothRetired) {
            var targetRob = netSuperSpend * (state.splitPct / 100);
            var targetTina = netSuperSpend - targetRob;

            robSpend = Math.min(robBal, targetRob);
            tinaSpend = Math.min(tinaBal, targetTina);

            var rem = netSuperSpend - (robSpend + tinaSpend);
            if (rem > 0) {
              var robAvail = Math.max(0, robBal - robSpend);
              var tinaAvail = Math.max(0, tinaBal - tinaSpend);
              var robExtra = Math.min(robAvail, rem);
              robSpend += robExtra; rem -= robExtra;
              var tinaExtra = Math.min(tinaAvail, rem);
              tinaSpend += tinaExtra; rem -= tinaExtra;
            }
          } else if (!robWorking && tinaWorking) {
            robSpend = Math.min(robBal, netSuperSpend);
          } else if (robWorking && !tinaWorking) {
            tinaSpend = Math.min(tinaBal, netSuperSpend);
          }
        }

        robBal = Math.max(0, robBal - robSpend);
        tinaBal = Math.max(0, tinaBal - tinaSpend);

        rows.push({ age:age, phase:'FORECAST', stage:stage, robClose:robBal, tinaClose:tinaBal, combinedClose:robBal+tinaBal,
          otherIncome:otherIncome, pension:pension, robSpend:robSpend, tinaSpend:tinaSpend, grossSpend:grossSpend
        });
      }

      return rows.filter(function(r){ return r.age >= startAge; });
    }

    function balanceChart(rows) {
      var width = 980, height = 320;
      var padL = 62, padR = 18, padT = 18, padB = 36;

      var ages = rows.map(function(r){ return r.age; });
      var xMin = ages[0], xMax = ages[ages.length-1];
      var yMax = Math.max.apply(null, rows.map(function(r){ return r.combinedClose; })) * 1.05;

      var xDen = (xMax - xMin) || 1;
      var yDen = (yMax - 0) || 1;

      function x(age){ return padL + ((age - xMin) / xDen) * (width - padL - padR); }
      function y(val){ return padT + (1 - (val / yDen)) * (height - padT - padB); }

      function mkPath(key){
        var d = '';
        for (var i=0;i<rows.length;i++){
          var r = rows[i];
          d += (i===0 ? 'M ' : 'L ') + x(r.age).toFixed(2) + ' ' + y(r[key]).toFixed(2) + ' ';
        }
        return d.trim();
      }

      var svg = svgEl('svg', { viewBox:'0 0 ' + width + ' ' + height, style:'width:100%;height:auto;display:block' });
      svg.appendChild(svgEl('rect', { x:'0', y:'0', width:String(width), height:String(height), fill:'#0f1117' }));
      svg.appendChild(svgEl('path', { d:mkPath('robClose'), fill:'none', stroke:'#6c8ef0', 'stroke-width':'2' }));
      svg.appendChild(svgEl('path', { d:mkPath('tinaClose'), fill:'none', stroke:'#a06cf0', 'stroke-width':'2' }));
      svg.appendChild(svgEl('path', { d:mkPath('combinedClose'), fill:'none', stroke:'#5dd87a', 'stroke-width':'2.6' }));
      return svg;
    }

    function render() {
      tabs.innerHTML = '';
      tabs.appendChild(el('button', { style:{
        padding:'7px 12px', borderRadius:'8px', cursor:'pointer',
        border:'1px solid #252a3a', background: state.tab==='super' ? '#6c8ef0' : 'transparent',
        color: state.tab==='super' ? '#fff' : '#7a8099', fontWeight:'800', fontSize:'12px'
      }, onClick:function(){ state.tab='super'; render(); }}, 'Super'));

      tabs.appendChild(el('button', { style:{
        padding:'7px 12px', borderRadius:'8px', cursor:'pointer',
        border:'1px solid #252a3a', background: state.tab==='adviser' ? '#6c8ef0' : 'transparent',
        color: state.tab==='adviser' ? '#fff' : '#7a8099', fontWeight:'800', fontSize:'12px'
      }, onClick:function(){ state.tab='adviser'; render(); }}, 'Adviser Summary'));

      left.innerHTML = '';
      right.innerHTML = '';

      var rows = buildTimeline();
      var at60 = rows.filter(function(r){ return r.age === 60; })[0] || rows[0];
      var at90 = rows.filter(function(r){ return r.age === 90; })[0] || rows[rows.length-1];

      if (state.tab === 'super') {
        var currentSpend = state.spendPhase==='Golden' ? state.spendGolden : (state.spendPhase==='Silver' ? state.spendSilver : state.spendLegacy);

        function setSpend(v){
          if (state.spendPhase==='Golden') state.spendGolden = v;
          else if (state.spendPhase==='Silver') state.spendSilver = v;
          else state.spendLegacy = v;
          render();
        }

        function setOtherSlider(v){
          if (state.otherMode==='yield') state.otherYield = v/100;
          else state.otherInflation = v/100;
          render();
        }

        var otherPct = (state.otherMode==='yield' ? state.otherYield : state.otherInflation) * 100;

        left.appendChild(panel('Controls', el('div', {}, [
          slider('Rob work return', 3, 15, 0.05, state.robWorkReturn*100, pct(state.robWorkReturn), function(v){ state.robWorkReturn=v/100; render(); }),
          slider('Tina work return', 3, 15, 0.05, state.tinaWorkReturn*100, pct(state.tinaWorkReturn), function(v){ state.tinaWorkReturn=v/100; render(); }),

          slider('Rob retires at age', 55, 67, 1, state.robRetireAge, String(state.robRetireAge), function(v){ state.robRetireAge=v; render(); }),
          slider('Tina retires at age', 55, 67, 1, state.tinaRetireAge, String(state.tinaRetireAge), function(v){ state.tinaRetireAge=v; render(); }),

          el('div', { style:{ marginTop:'12px' }}, [
            el('div', { style:{ fontSize:'12px', color:'#c0c5d8', fontWeight:'900', marginBottom:'8px' }}, 'Gross income (phased)'),
            el('div', { style:{ display:'flex', gap:'8px', marginBottom:'8px' }}, [
              chip('Golden', state.spendPhase==='Golden', function(){ state.spendPhase='Golden'; render(); }),
              chip('Silver', state.spendPhase==='Silver', function(){ state.spendPhase='Silver'; render(); }),
              chip('Legacy', state.spendPhase==='Legacy', function(){ state.spendPhase='Legacy'; render(); })
            ]),
            slider(state.spendPhase + ' spend', state.spendMin, state.spendMax, 5000, currentSpend, fmt(currentSpend), setSpend)
          ]),

          slider('Split when both retired (Rob %)', 0, 100, 5, state.splitPct, String(state.splitPct) + '%', function(v){ state.splitPct=v; render(); }),

          slider('Other assets principal', 0, 2000000, 25000, state.otherAssets, fmt(state.otherAssets), function(v){ state.otherAssets=v; render(); }),

          el('div', { style:{ marginTop:'12px' }}, [
            el('div', { style:{ fontSize:'12px', color:'#c0c5d8', fontWeight:'900', marginBottom:'8px' }}, 'Other-assets income'),
            el('div', { style:{ display:'flex', gap:'8px', marginBottom:'8px' }}, [
              chip('yield', state.otherMode==='yield', function(){ state.otherMode='yield'; render(); }),
              chip('inflation', state.otherMode==='inflation', function(){ state.otherMode='inflation'; render(); })
            ]),
            slider(state.otherMode==='yield' ? 'Yield %' : 'Inflation %', 0, 12, 0.05, otherPct, otherPct.toFixed(2) + '%', setOtherSlider),
            el('div', { style:{ fontSize:'11px', color:'#5a6080', marginTop:'6px' }}, 'Income indexes by inflation from age 60 (income only).')
          ]),

          toggle(state.usePension ? 'Age Pension: ON' : 'Age Pension: OFF', state.usePension, function(){ state.usePension=!state.usePension; render(); })
        ]))));

        right.appendChild(panel('Key Results', el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px' }}, [
          card('Other-income @ 60', fmt(at60.otherIncome || 0), 'Indexed income stream', '#6c8ef0'),
          card('Inflation', (state.otherInflation*100).toFixed(2) + '%', 'Indexes income only', '#a06cf0'),
          card('Balance at 90', fmt(at90.combinedClose), 'Rob ' + fmt(at90.robClose) + ' | Tina ' + fmt(at90.tinaClose), '#5dd87a')
        ])));

        right.appendChild(panel('Balance Graph', balanceChart(rows)));
      } else {
        left.appendChild(panel('Assumptions', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'This model restores the full control set and applies inflation only to other-assets income from age 60.'
        ])));
      }
    }

    render();

  } catch (e) {
    showFatal('Fatal error during mountApp()', e);
  }
}
