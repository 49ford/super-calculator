import { estimateAgePension } from '../engine/pension.js';

/**
 * V6 NEXT — Presentable dual-person offline model (no React/Babel)
 * - Locked actuals ages 48–53 (FY2020–FY2025) from v4.2
 * - Forecast seeded from FY2025 closes (Rob 829,122.86 / Tina 658,880.00)
 * - Left controls / right graph + cards + timeline
 * - Phased spend: Golden / Silver / Legacy (toggle which stage the slider edits)
 * - Close balances include spend in that year
 * - Fully functional SVG balance graph (updates on any change)
 * - Fail-loud global error capture (no silent black screens)
 */

export function mountApp(root) {
  // ---------- Fail-loud guardrails ----------
  const showFatal = (msg, err) => {
    try {
      root.innerHTML = '';
      root.style.minHeight = '100vh';
      root.style.background = '#0f1117';
      root.style.color = '#e8eaf0';
      root.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.color = '#f06c6c';
      pre.style.background = '#161923';
      pre.style.border = '1px solid rgba(240,108,108,.35)';
      pre.style.borderRadius = '12px';
      pre.style.padding = '16px';
      pre.textContent = `V6 UI ERROR:\n\n${msg}\n\n${err && err.stack ? err.stack : (err ? String(err) : '')}`;
      root.appendChild(pre);
    } catch (_) {}
  };

  window.onerror = (message, source, lineno, colno, error) => {
    showFatal(`${message}\n@ ${source}:${lineno}:${colno}`, error);
    return true;
  };
  window.onunhandledrejection = (event) => {
    showFatal('Unhandled promise rejection', event && event.reason ? event.reason : event);
  };

  try {
    // ---------- Base page ----------
    root.innerHTML = '';
    root.style.minHeight = '100vh';
    root.style.background = '#0f1117';
    root.style.color = '#e8eaf0';
    root.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

    // ---------- DOM helper ----------
    const el = (tag, attrs = {}, children = []) => {
      const n = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'style') Object.assign(n.style, v);
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else n.setAttribute(k, String(v));
      });
      [].concat(children).forEach(c => {
        if (c == null) return;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      });
      return n;
    };

    // ---------- Formatting ----------
    const fmt = (n) => '$' + Math.round(n).toLocaleString('en-AU');
    const fmtPct = (dec) => (dec * 100).toFixed(2) + '%';
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

    // ---------- Locked actuals (v4.2) ----------
    // Ages 48–53 are locked. Closing = next row’s opening; age 53 closes to FINAL_ACTUAL_CLOSE.
    // Source: v4.2 ACTUALS + FINAL_ACTUAL_CLOSE. 【1-d9526d】
    const ACTUALS = [
      { age:48, robOpen:462151.00, tinaOpen:335957.00, robContrib:22479.00, tinaContrib:23249.00, robReturnPct:19.24, tinaReturnPct:18.10 },
      { age:49, robOpen:570166.00, tinaOpen:416543.00, robContrib:22876.00, tinaContrib:26669.00, robReturnPct:18.07, tinaReturnPct:16.50 },
      { age:50, robOpen:567311.00, tinaOpen:419005.00, robContrib:24993.00, tinaContrib:26669.00, robReturnPct:-4.42, tinaReturnPct:-5.63 },
      { age:51, robOpen:652528.00, tinaOpen:484791.00, robContrib:27208.00, tinaContrib:26669.00, robReturnPct:10.39, tinaReturnPct:9.05  },
      { age:52, robOpen:730025.00, tinaOpen:559116.00, robContrib:26551.00, tinaContrib:26669.00, robReturnPct:7.55,  tinaReturnPct:9.57  },
      { age:53, robOpen:829122.86, tinaOpen:658880.00, robContrib:29608.32, tinaContrib:30000.00, robReturnPct:9.76,  tinaReturnPct:12.77 },
    ];
    const FINAL_ACTUAL_CLOSE = { rob: 829122.86, tina: 658880.00 }; // FY2025 close seeds FY2026 【1-d9526d】【1-3edd45】

    // ---------- Phased spending helper (aligned to V4.2 concept) ----------
    // V4.2 uses a 41-year horizon split into thirds (gold/silver/legacy). 【1-d9526d】
    const DRAWDOWN_HORIZON_YEARS = 41;
    const thirdSize = () => Math.ceil(DRAWDOWN_HORIZON_YEARS / 3);
    const stageIndex = (i) => {
      const t = thirdSize();
      if (i < t) return 0;
      if (i < t * 2) return 1;
      return 2;
    };
    const stageName = (i) => (i === 0 ? 'Golden' : i === 1 ? 'Silver' : 'Legacy');

    // ---------- State ----------
    const state = {
      tab: 'super',
      showActuals: true,

      endAge: 90,

      robRetireAge: 60,
      tinaRetireAge: 60,

      // Seeds (Vision vs Aware, different levels)
      robSeed: FINAL_ACTUAL_CLOSE.rob,
      tinaSeed: FINAL_ACTUAL_CLOSE.tina,

      // Concessional contributions (default $30k each, per briefing) 【1-3edd45】
      robConcessional: 30000,
      tinaConcessional: 30000,
      contribTax: 0.15,

      // Returns (nuanced)
      robWorkReturn: 0.08,
      tinaWorkReturn: 0.08,
      retireReturn: 0.08,

      // Spend slider spec
      spendMin: 50000,
      spendMax: 500000,

      // Phased spend values (default 150k per your request)
      spendGolden: 150000,
      spendSilver: 150000,
      spendLegacy: 150000,

      // Which phase the single slider edits
      spendPhase: 'Golden', // 'Golden' | 'Silver' | 'Legacy'

      // Split when both retired (Rob share)
      splitPct: 50,

      // Pension
      usePension: true,
      homeowner: true,
      otherAssets: 0,

      // Pension params (defaults aligned to v4.2)
      fullPension: 44855,            // FY2025 couple full pension p.a. 【1-d9526d】
      assetThreshold: 470000,        // couple homeowner threshold 【1-d9526d】
      assetTaperPerDollar: 0.078,    // $78 per $1000 【1-d9526d】
      deemingThreshold: 100000,
      deemingRateLow: 0.0025,
      deemingRateHigh: 0.0225,
      incomeFreeArea: 9000,
      incomeTaperRate: 0.5
    };

    // ---------- Layout (left controls, right results) ----------
    const header = el('div', { style: { padding:'16px 20px', background:'#161923', borderBottom:'1px solid #252a3a' }}, [
      el('div', { style:{ fontSize:'10px', letterSpacing:'2px', color:'#5a6080', textTransform:'uppercase' }}, 'V6 NEXT · Locked Actuals · Dual-Person · Phased Spend'),
      el('div', { style:{ fontSize:'20px', fontWeight:'900', marginTop:'4px' }}, 'Super Calculator'),
      el('div', { style:{ fontSize:'12px', color:'#7a8099', marginTop:'2px' }}, 'Controls left · Graph/results right · Golden/Silver/Legacy spend')
    ]);

    const tabs = el('div', { style: { display:'flex', gap:'10px', padding:'10px 20px', background:'#161923', borderBottom:'1px solid #252a3a' }});
    const main = el('div', { style: { display:'grid', gridTemplateColumns:'360px 1fr', gap:'16px', padding:'16px 20px' }});
    const left = el('div', { style: { position:'sticky', top:'10px', alignSelf:'start' }});
    const right = el('div', {});

    root.appendChild(header);
    root.appendChild(tabs);
    root.appendChild(main);
    main.appendChild(left);
    main.appendChild(right);

    const tabButton = (id, label) =>
      el('button', {
        style: {
          padding:'7px 12px', borderRadius:'8px', cursor:'pointer',
          border:'1px solid #252a3a',
          background: state.tab === id ? '#6c8ef0' : 'transparent',
          color: state.tab === id ? '#fff' : '#7a8099',
          fontWeight:'800', fontSize:'12px'
        },
        onClick: () => { state.tab = id; render(); }
      }, label);

    const panel = (title, content) =>
      el('div', { style:{ background:'#161923', border:'1px solid #252a3a', borderRadius:'12px', padding:'14px', marginBottom:'16px' }}, [
        el('div', { style:{ fontSize:'12px', color:'#7a8099', fontWeight:'900', marginBottom:'10px' }}, title),
        content
      ]);

    const toggle = (label, on, onClick) =>
      el('button', {
        style:{
          padding:'7px 10px', borderRadius:'10px', border:'1px solid #252a3a',
          background: on ? 'rgba(93,216,122,.12)' : 'transparent',
          color: on ? '#5dd87a' : '#7a8099',
          cursor:'pointer', fontWeight:'900', width:'100%'
        },
        onClick
      }, label);

    const slider = (label, min, max, step, value, display, onInput) =>
      el('div', { style:{ margin:'10px 0' }}, [
        el('div', { style:{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}, [
          el('div', { style:{ fontSize:'12px', color:'#c0c5d8', fontWeight:'700' }}, label),
          el('div', { style:{ fontSize:'12px', color:'#6c8ef0', fontFamily:'monospace' }}, display)
        ]),
        el('input', {
          type:'range', min:String(min), max:String(max), step:String(step), value:String(value),
          style:{ width:'100%' },
          onInput: (e)=>onInput(+e.target.value)
        })
      ]);

    const phaseButton = (label) =>
      el('button', {
        style: {
          padding:'6px 10px',
          borderRadius:'10px',
          border:'1px solid #252a3a',
          background: state.spendPhase === label ? 'rgba(108,142,240,.18)' : 'transparent',
          color: state.spendPhase === label ? '#6c8ef0' : '#7a8099',
          cursor:'pointer',
          fontWeight:'900',
          fontSize:'12px'
        },
        onClick: () => { state.spendPhase = label; render(); }
      }, label);

    const card = (title, value, subtitle, color) =>
      el('div', { style:{ background:'#161923', border:'1px solid #252a3a', borderRadius:'12px', padding:'16px' }}, [
        el('div', { style:{ fontSize:'12px', color:'#7a8099', fontWeight:'800' }}, title),
        el('div', { style:{ fontSize:'22px', fontWeight:'900', color:color || '#6c8ef0', marginTop:'6px' }}, value),
        el('div', { style:{ fontSize:'11px', color:'#5a6080', marginTop:'4px' }}, subtitle)
      ]);

    const table = (headers, rows) => {
      const tbl = el('table', { style:{ width:'100%', borderCollapse:'collapse', background:'#0f1117', border:'1px solid #252a3a', borderRadius:'12px', overflow:'hidden' }});
      tbl.appendChild(el('thead', {}, [
        el('tr', {}, headers.map(h =>
          el('th', { style:{ textAlign:'right', padding:'8px 10px', color:'#7a8099', fontSize:'11px', borderBottom:'1px solid #252a3a' }}, h)
        ))
      ]));
      const tbody = el('tbody');
      rows.forEach((r,i)=> {
        tbody.appendChild(el('tr', { style:{ background: i%2===0 ? 'rgba(255,255,255,.02)' : 'transparent' } },
          r.map(cell => el('td', { style:{ textAlign:'right', padding:'8px 10px', fontFamily:'monospace', fontSize:'12px', color:'#c0c5d8', borderBottom:'1px solid rgba(37,42,58,.35)' }}, cell))
        ));
      });
      tbl.appendChild(tbody);
      return tbl;
    };

    // ---------- Spend for a retirement yearIndex ----------
    function stagedSpend(yearIndex) {
      const s = stageIndex(yearIndex);
      return s === 0 ? state.spendGolden : s === 1 ? state.spendSilver : state.spendLegacy;
    }

    // ---------- Core simulation ----------
    // IMPORTANT: Retired close balances INCLUDE the spend (close = after return & after draw).
    function buildTimeline() {
      const startAge = state.showActuals ? 48 : 54;
      const rows = [];

      // Actuals
      if (state.showActuals) {
        for (let i=0; i<ACTUALS.length; i++) {
          const a = ACTUALS[i];
          const next = ACTUALS[i+1];
          const robClose = next ? next.robOpen : FINAL_ACTUAL_CLOSE.rob;
          const tinaClose = next ? next.tinaOpen : FINAL_ACTUAL_CLOSE.tina;
          rows.push({
            age: a.age,
            phase: 'ACTUAL',
            robOpen: a.robOpen,
            tinaOpen: a.tinaOpen,
            robSpend: 0,
            tinaSpend: 0,
            pension: 0,
            robClose,
            tinaClose,
            combinedClose: robClose + tinaClose,
            spendStage: ''
          });
        }
      }

      // Forecast seed at age 54
      let robBal = state.robSeed;
      let tinaBal = state.tinaSeed;

      const earliestRetire = Math.min(state.robRetireAge, state.tinaRetireAge);

      for (let age=54; age<=state.endAge; age++) {
        const robWorking = age < state.robRetireAge;
        const tinaWorking = age < state.tinaRetireAge;

        const robOpen = robBal;
        const tinaOpen = tinaBal;

        // Accumulation while working: (open + net contrib) * (1 + return)
        if (robWorking) {
          const net = state.robConcessional * (1 - state.contribTax);
          const before = robBal + net;
          robBal = before + before * state.robWorkReturn;
        }
        if (tinaWorking) {
          const net = state.tinaConcessional * (1 - state.contribTax);
          const before = tinaBal + net;
          tinaBal = before + before * state.tinaWorkReturn;
        }

        const anyRetired = (!robWorking) || (!tinaWorking);
        const bothRetired = (!robWorking) && (!tinaWorking);

        // Retirement year index for phased spend
        const yearIndex = age >= earliestRetire ? (age - earliestRetire) : -1;

        // Pension from 67 (simple gate)
        let pension = 0;
        if (state.usePension && age >= 67 && anyRetired) {
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

        // Determine gross spend for this retirement year (staged)
        const grossSpend = (anyRetired && yearIndex >= 0) ? stagedSpend(yearIndex) : 0;
        const netSuperSpend = Math.max(0, grossSpend - pension);

        // Apply retirement return to retired balances BEFORE draw (like V4.2 drawdown assumption)
        if (!robWorking) robBal = robBal + robBal * state.retireReturn;
        if (!tinaWorking) tinaBal = tinaBal + tinaBal * state.retireReturn;

        // Allocate spend
        let robSpend = 0, tinaSpend = 0;

        if (netSuperSpend > 0) {
          if (bothRetired) {
            const targetRob = netSuperSpend * (state.splitPct / 100);
            const targetTina = netSuperSpend - targetRob;

            robSpend = Math.min(robBal, targetRob);
            tinaSpend = Math.min(tinaBal, targetTina);

            let rem = netSuperSpend - (robSpend + tinaSpend);
            if (rem > 0) {
              const robAvail = Math.max(0, robBal - robSpend);
              const tinaAvail = Math.max(0, tinaBal - tinaSpend);
              const robExtra = Math.min(robAvail, rem);
              robSpend += robExtra; rem -= robExtra;
              const tinaExtra = Math.min(tinaAvail, rem);
              tinaSpend += tinaExtra; rem -= tinaExtra;
            }
          } else if (!robWorking && tinaWorking) {
            // Gap years: retired spouse funds 100%
            robSpend = Math.min(robBal, netSuperSpend);
          } else if (robWorking && !tinaWorking) {
            tinaSpend = Math.min(tinaBal, netSuperSpend);
          }
        }

        // Close balances AFTER spend (this is the correction you requested)
        robBal = Math.max(0, robBal - robSpend);
        tinaBal = Math.max(0, tinaBal - tinaSpend);

        rows.push({
          age,
          phase: 'FORECAST',
          robOpen,
          tinaOpen,
          robSpend,
          tinaSpend,
          pension,
          robClose: robBal,
          tinaClose: tinaBal,
          combinedClose: robBal + tinaBal,
          spendStage: (anyRetired && yearIndex >= 0) ? stageName(stageIndex(yearIndex)) : ''
        });
      }

      return rows.filter(r => r.age >= startAge);
    }

    // ---------- SVG chart (visible + responsive) ----------
    function balanceChart(rows) {
      const width = 980, height = 320;
      const padL = 62, padR = 18, padT = 18, padB = 36;

      const ages = rows.map(r => r.age);
      const xMin = ages[0], xMax = ages[ages.length - 1];
      const yMax = Math.max(...rows.map(r => r.combinedClose)) * 1.05;
      const yMin = 0;

      // Guard against division by zero
      const xDen = (xMax - xMin) || 1;
      const yDen = (yMax - yMin) || 1;

      const x = (age) => padL + ((age - xMin) / xDen) * (width - padL - padR);
      const y = (val) => padT + (1 - ((val - yMin) / yDen)) * (height - padT - padB);

      const mkPath = (key) => rows.map((r, i) => {
        const cmd = i === 0 ? 'M' : 'L';
        return `${cmd} ${x(r.age).toFixed(2)} ${y(r[key]).toFixed(2)}`;
      }).join(' ');

      const svg = el('svg', {
        viewBox: `0 0 ${width} ${height}`,
        style: { width: '100%', height: 'auto', display: 'block' }
      });

      svg.appendChild(el('rect', { x: '0', y: '0', width: String(width), height: String(height), fill: '#0f1117' }));

      // grid + y labels
      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const v = (yMax * i) / ticks;
        const yy = y(v);
        svg.appendChild(el('line', { x1: String(padL), y1: String(yy), x2: String(width - padR), y2: String(yy), stroke: 'rgba(255,255,255,.06)' }));
        svg.appendChild(el('text', {
          x: String(padL - 8),
          y: String(yy + 4),
          fill: '#5a6080',
          'text-anchor': 'end',
          style: 'font-family:monospace;font-size:11px'
        }, fmt(v)));
      }

      // x axis
      svg.appendChild(el('line', { x1: String(padL), y1: String(height - padB), x2: String(width - padR), y2: String(height - padB), stroke: 'rgba(255,255,255,.12)' }));

      // series
      svg.appendChild(el('path', { d: mkPath('robClose'), fill: 'none', stroke: '#6c8ef0', 'stroke-width': '2' }));
      svg.appendChild(el('path', { d: mkPath('tinaClose'), fill: 'none', stroke: '#a06cf0', 'stroke-width': '2' }));
      svg.appendChild(el('path', { d: mkPath('combinedClose'), fill: 'none', stroke: '#5dd87a', 'stroke-width': '2.6' }));

      // legend
      const legend = el('g');
      const items = [
        { label: 'Rob (Vision)', col: '#6c8ef0' },
        { label: 'Tina (Aware)', col: '#a06cf0' },
        { label: 'Combined', col: '#5dd87a' }
      ];
      items.forEach((it, i) => {
        const lx = padL + i * 150, ly = 16;
        legend.appendChild(el('rect', { x: String(lx), y: String(ly - 9), width: '10', height: '10', fill: it.col }));
        legend.appendChild(el('text', { x: String(lx + 14), y: String(ly), fill: '#c0c5d8', style: 'font-size:12px;font-weight:800' }, it.label));
      });
      svg.appendChild(legend);

      return svg;
    }

    // ---------- Render ----------
    function render() {
      tabs.innerHTML = '';
      tabs.appendChild(tabButton('super', 'Super'));
      tabs.appendChild(tabButton('adviser', 'Adviser Summary'));

      left.innerHTML = '';
      right.innerHTML = '';

      const rows = buildTimeline();

      const earliestRetire = Math.min(state.robRetireAge, state.tinaRetireAge);
      const atEarliest = rows.find(r => r.age === earliestRetire) || rows[0];
      const at90 = rows.find(r => r.age === 90) || rows[rows.length - 1];
      const exhausted = rows.find(r => r.combinedClose <= 0);

      // LEFT: controls
      if (state.tab === 'super') {
        // Spend phase slider reads/writes the selected phase
        const currentSpend =
          state.spendPhase === 'Golden' ? state.spendGolden :
          state.spendPhase === 'Silver' ? state.spendSilver :
          state.spendLegacy;

        const setSpend = (v) => {
          if (state.spendPhase === 'Golden') state.spendGolden = v;
          else if (state.spendPhase === 'Silver') state.spendSilver = v;
          else state.spendLegacy = v;
          render();
        };

        const controls = el('div', {}, [
          toggle(state.showActuals ? 'Actuals: ON (to FY2025)' : 'Actuals: OFF (from FY2026)', state.showActuals, () => { state.showActuals = !state.showActuals; render(); }),

          slider('Rob work return', 3, 15, 0.05, state.robWorkReturn * 100, fmtPct(state.robWorkReturn), v => { state.robWorkReturn = v / 100; render(); }),
          slider('Tina work return', 3, 15, 0.05, state.tinaWorkReturn * 100, fmtPct(state.tinaWorkReturn), v => { state.tinaWorkReturn = v / 100; render(); }),
          slider('Retirement return', 0, 12, 0.05, state.retireReturn * 100, fmtPct(state.retireReturn), v => { state.retireReturn = v / 100; render(); }),

          slider('Rob retires at age', 55, 67, 1, state.robRetireAge, String(state.robRetireAge), v => { state.robRetireAge = v; render(); }),
          slider('Tina retires at age', 55, 67, 1, state.tinaRetireAge, String(state.tinaRetireAge), v => { state.tinaRetireAge = v; render(); }),

          slider('Rob concessional p.a.', 0, 35000, 500, state.robConcessional, fmt(state.robConcessional), v => { state.robConcessional = v; render(); }),
          slider('Tina concessional p.a.', 0, 35000, 500, state.tinaConcessional, fmt(state.tinaConcessional), v => { state.tinaConcessional = v; render(); }),

          // Phased spend selector + one slider
          el('div', { style: { marginTop: '12px' } }, [
            el('div', { style: { fontSize: '12px', color: '#c0c5d8', fontWeight: '800', marginBottom: '8px' } }, 'Gross income (phased)'),
            el('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } }, [
              phaseButton('Golden'),
              phaseButton('Silver'),
              phaseButton('Legacy'),
            ]),
            slider(`${state.spendPhase} Years spend`, state.spendMin, state.spendMax, 5000, currentSpend, fmt(currentSpend), setSpend),
            el('div', { style: { fontSize: '11px', color: '#5a6080', marginTop: '6px' } },
              `Golden=${fmt(state.spendGolden)} · Silver=${fmt(state.spendSilver)} · Legacy=${fmt(state.spendLegacy)}`
            )
          ]),

          slider('Split when both retired (Rob %)', 0, 100, 5, state.splitPct, state.splitPct + '%', v => { state.splitPct = v; render(); }),

          slider('Other assets (non-super)', 0, 1000000, 10000, state.otherAssets, fmt(state.otherAssets), v => { state.otherAssets = v; render(); }),

          toggle(state.usePension ? 'Age Pension: ON' : 'Age Pension: OFF', state.usePension, () => { state.usePension = !state.usePension; render(); }),

          slider('End age', 70, 100, 1, state.endAge, String(state.endAge), v => { state.endAge = v; render(); })
        ]);

        left.appendChild(panel('Controls', controls));
      } else {
        left.appendChild(panel('Locked assumptions', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'Locked through FY2024–25 using v4.2 actuals (ages 48–53). Forecast begins age 54 seeded from FY2025 closes:',
          el('ul', {}, [
            el('li', {}, `Rob (Vision) FY2025 close seed: ${fmt(FINAL_ACTUAL_CLOSE.rob)}`),
            el('li', {}, `Tina (Aware) FY2025 close seed: ${fmt(FINAL_ACTUAL_CLOSE.tina)}`),
          ])
        ])));
      }

      // RIGHT: results
      if (state.tab === 'super') {
        const cards = el('div', {
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }
        }, [
          card('Earliest retirement combined', fmt(atEarliest.combinedClose), `Age ${earliestRetire}`, '#5dd87a'),
          card('Rob @ earliest retirement', fmt(atEarliest.robClose), 'Vision Super', '#6c8ef0'),
          card('Tina @ earliest retirement', fmt(atEarliest.tinaClose), 'Aware Super', '#a06cf0'),
          card('Pension (that year)', fmt(atEarliest.pension), state.usePension ? 'Applied from age 67' : 'Disabled', atEarliest.pension > 0 ? '#f0b96c' : '#f06c6c'),
          card(exhausted ? 'Exhausted at age' : 'Still running at', exhausted ? String(exhausted.age) : String(state.endAge), exhausted ? 'Household runs out' : 'Horizon intact', exhausted ? '#f06c6c' : '#5dd87a'),
          card('Balance at 90', fmt(at90.combinedClose), `Rob ${fmt(at90.robClose)} · Tina ${fmt(at90.tinaClose)}`, at90.combinedClose > 0 ? '#a06cf0' : '#f06c6c')
        ]);

        right.appendChild(panel('Key Results', cards));
        right.appendChild(panel('Balance Graph (updates live)', balanceChart(rows)));

        // Timeline table (first 45 rows)
        const slice = rows.slice(0, 45);
        right.appendChild(panel('Timeline (first 45 rows)', table(
          ['Age','Phase','Stage','Rob Close','Tina Close','Combined','Rob Spend','Tina Spend','Pension'],
          slice.map(r => ([
            String(r.age),
            r.phase,
            r.spendStage || '—',
            fmt(r.robClose),
            fmt(r.tinaClose),
            fmt(r.combinedClose),
            r.robSpend > 0 ? fmt(r.robSpend) : '—',
            r.tinaSpend > 0 ? fmt(r.tinaSpend) : '—',
            r.pension > 0 ? fmt(r.pension) : '—'
          ]))
        )));
      }

      if (state.tab === 'adviser') {
        right.appendChild(panel('Adviser Summary', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'Phased spend is applied from earliest retirement age:',
          el('ul', {}, [
            el('li', {}, 'Golden years = first third of retirement horizon'),
            el('li', {}, 'Silver years = second third'),
            el('li', {}, 'Legacy years = final third'),
          ]),
          'Close balances shown in the graph/table are AFTER returns and AFTER spend each year (retirement years).',
        ])));
      }
    }

    render();

  } catch (e) {
    showFatal('Fatal error during mountApp()', e);
  }
}
