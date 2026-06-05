import { estimateAgePension } from '../engine/pension.js';

export function mountApp(root) {
  // ---------- Fail-loud ----------
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
      pre.textContent =
        `V6 UI ERROR:\n\n${msg}\n\n${err && err.stack ? err.stack : (err ? String(err) : '')}`;
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
    // ---------- Base ----------
    root.innerHTML = '';
    root.style.minHeight = '100vh';
    root.style.background = '#0f1117';
    root.style.color = '#e8eaf0';
    root.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

    // ---------- DOM helper (HTML) ----------
    const el = (tag, attrs = {}, children = []) => {
      const n = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'style') {
          if (v && typeof v === 'object') Object.assign(n.style, v);
          else if (typeof v === 'string') n.setAttribute('style', v);
        } else if (k.startsWith('on') && typeof v === 'function') {
          n.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          n.setAttribute(k, String(v));
        }
      });
      [].concat(children).forEach(c => {
        if (c == null) return;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      });
      return n;
    };

    // ---------- DOM helper (SVG namespace) — FIXES GRAPH RENDER ----------
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs = {}, children = []) => {
      const n = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => {
        // svg styles are best as attributes
        if (k === 'style') {
          if (v && typeof v === 'object') {
            const s = Object.entries(v).map(([a,b]) => `${a}:${b}`).join(';');
            n.setAttribute('style', s);
          } else if (typeof v === 'string') n.setAttribute('style', v);
        } else {
          n.setAttribute(k, String(v));
        }
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

    // ---------- Locked actuals + FY2025 close seeds (v4.2) ----------
    // Ages 48–53 locked; FY2025 close seeds FY2026 forecasts (Rob 829,122.86 / Tina 658,880). 【1-d82045】【1-ed908e】
    const ACTUALS = [
      { age:48, robOpen:462151.00, tinaOpen:335957.00 },
      { age:49, robOpen:570166.00, tinaOpen:416543.00 },
      { age:50, robOpen:567311.00, tinaOpen:419005.00 },
      { age:51, robOpen:652528.00, tinaOpen:484791.00 },
      { age:52, robOpen:730025.00, tinaOpen:559116.00 },
      { age:53, robOpen:829122.86, tinaOpen:658880.00 },
    ];
    const FINAL_ACTUAL_CLOSE = { rob: 829122.86, tina: 658880.00 };

    // ---------- Hard-coded concessional schedule (your instruction) ----------
    // Age 54 (FY2025–26): 30k each. Age 55+ : 32.5k each. 【1-ed908e】【1-d82045】
    const concessionalForAge = (age) => {
      if (age === 54) return 30000;
      if (age > 54) return 32500;
      return 0;
    };

    // ---------- Phased spending (thirds) ----------
    const DRAWDOWN_HORIZON_YEARS = 41;
    const thirdSize = () => Math.ceil(DRAWDOWN_HORIZON_YEARS / 3);
    const stageIndex = (i) => {
      const t = thirdSize();
      if (i < t) return 0;
      if (i < t * 2) return 1;
      return 2;
    };
    const stageName = (s) => (s === 0 ? 'Golden' : s === 1 ? 'Silver' : 'Legacy');

    // ---------- State ----------
    const state = {
      tab: 'super',
      showActuals: true,
      endAge: 90,

      robRetireAge: 60,
      tinaRetireAge: 60,

      robSeed: FINAL_ACTUAL_CLOSE.rob,
      tinaSeed: FINAL_ACTUAL_CLOSE.tina,

      contribTax: 0.15,

      // returns (nuanced)
      robWorkReturn: 0.08,
      tinaWorkReturn: 0.08,
      retireReturn: 0.08,

      // phased spend defaults & slider constraints
      spendMin: 50000,
      spendMax: 500000,
      spendGolden: 150000,
      spendSilver: 150000,
      spendLegacy: 150000,
      spendPhase: 'Golden',

      splitPct: 50,

      // pension
      usePension: true,
      homeowner: true,
      otherAssets: 0,

      // pension params (aligned to v4.2 defaults)
      fullPension: 44855,
      assetThreshold: 470000,
      assetTaperPerDollar: 0.078,
      deemingThreshold: 100000,
      deemingRateLow: 0.0025,
      deemingRateHigh: 0.0225,
      incomeFreeArea: 9000,
      incomeTaperRate: 0.5
    };

    // ---------- Layout ----------
    const header = el('div', { style: { padding:'16px 20px', background:'#161923', borderBottom:'1px solid #252a3a' }}, [
      el('div', { style:{ fontSize:'10px', letterSpacing:'2px', color:'#5a6080', textTransform:'uppercase' }},
        'V6 NEXT · Locked Actuals · Dual-Person · Phased Spend'
      ),
      el('div', { style:{ fontSize:'20px', fontWeight:'900', marginTop:'4px' }}, 'Super Calculator'),
      el('div', { style:{ fontSize:'12px', color:'#7a8099', marginTop:'2px' }},
        'Controls left · Graph/results right · Concessional fixed (30k at age 54, 32.5k after)'
      )
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
        el('input', { type:'range', min:String(min), max:String(max), step:String(step), value:String(value),
          style:{ width:'100%' }, onInput:(e)=>onInput(+e.target.value)
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

    function stagedSpend(yearIndex) {
      const s = stageIndex(yearIndex);
      return s === 0 ? state.spendGolden : s === 1 ? state.spendSilver : state.spendLegacy;
    }

    // ---------- Timeline model ----------
    function buildTimeline() {
      const startAge = state.showActuals ? 48 : 54;
      const rows = [];

      if (state.showActuals) {
        for (let i=0; i<ACTUALS.length; i++) {
          const a = ACTUALS[i];
          const next = ACTUALS[i+1];
          const robClose = next ? next.robOpen : FINAL_ACTUAL_CLOSE.rob;
          const tinaClose = next ? next.tinaOpen : FINAL_ACTUAL_CLOSE.tina;
          rows.push({
            age: a.age, phase: 'ACTUAL', stage: '',
            robClose, tinaClose, combinedClose: robClose + tinaClose,
            robSpend: 0, tinaSpend: 0, pension: 0
          });
        }
      }

      let robBal = state.robSeed;
      let tinaBal = state.tinaSeed;

      const earliestRetire = Math.min(state.robRetireAge, state.tinaRetireAge);

      for (let age=54; age<=state.endAge; age++) {
        const robWorking = age < state.robRetireAge;
        const tinaWorking = age < state.tinaRetireAge;

        // HARD CODED concessional schedule (no slider)
        const robCC = robWorking ? concessionalForAge(age) : 0;
        const tinaCC = tinaWorking ? concessionalForAge(age) : 0;

        // Work accumulation
        if (robWorking) {
          const net = robCC * (1 - state.contribTax);
          const before = robBal + net;
          robBal = before + before * state.robWorkReturn;
        }
        if (tinaWorking) {
          const net = tinaCC * (1 - state.contribTax);
          const before = tinaBal + net;
          tinaBal = before + before * state.tinaWorkReturn;
        }

        const anyRetired = (!robWorking) || (!tinaWorking);
        const bothRetired = (!robWorking) && (!tinaWorking);

        const yearIndex = (anyRetired && age >= earliestRetire) ? (age - earliestRetire) : -1;
        const stage = (yearIndex >= 0) ? stageName(stageIndex(yearIndex)) : '';

        // Pension (from 67, if enabled)
        let pension = 0;
        if (state.usePension && anyRetired && age >= 67) {
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

        const grossSpend = (yearIndex >= 0) ? stagedSpend(yearIndex) : 0;
        const netSuperSpend = Math.max(0, grossSpend - pension);

        // Retirement return BEFORE spend
        if (!robWorking) robBal = robBal + robBal * state.retireReturn;
        if (!tinaWorking) tinaBal = tinaBal + tinaBal * state.retireReturn;

        // Spend allocation
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
            robSpend = Math.min(robBal, netSuperSpend);
          } else if (robWorking && !tinaWorking) {
            tinaSpend = Math.min(tinaBal, netSuperSpend);
          }
        }

        // CLOSE AFTER spend
        robBal = Math.max(0, robBal - robSpend);
        tinaBal = Math.max(0, tinaBal - tinaSpend);

        rows.push({
          age, phase: 'FORECAST', stage,
          robClose: robBal, tinaClose: tinaBal, combinedClose: robBal + tinaBal,
          robSpend, tinaSpend, pension,
          robCC, tinaCC
        });
      }

      return rows.filter(r => r.age >= startAge);
    }

    // ---------- SVG chart (FIXED rendering) ----------
    function balanceChart(rows) {
      const width = 980, height = 320;
      const padL = 62, padR = 18, padT = 18, padB = 36;

      const ages = rows.map(r => r.age);
      const xMin = ages[0], xMax = ages[ages.length - 1];
      const yMax = Math.max(...rows.map(r => r.combinedClose)) * 1.05;

      const xDen = (xMax - xMin) || 1;
      const yDen = (yMax - 0) || 1;

      const x = (age) => padL + ((age - xMin) / xDen) * (width - padL - padR);
      const y = (val) => padT + (1 - (val / yDen)) * (height - padT - padB);

      const mkPath = (key) => rows.map((r, i) => {
        const cmd = i === 0 ? 'M' : 'L';
        return `${cmd} ${x(r.age).toFixed(2)} ${y(r[key]).toFixed(2)}`;
      }).join(' ');

      const svg = svgEl('svg', {
        viewBox: `0 0 ${width} ${height}`,
        style: { width: '100%', height: 'auto', display: 'block' }
      });

      svg.appendChild(svgEl('rect', { x: '0', y: '0', width: String(width), height: String(height), fill: '#0f1117' }));

      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const v = (yMax * i) / ticks;
        const yy = y(v);
        svg.appendChild(svgEl('line', { x1: String(padL), y1: String(yy), x2: String(width - padR), y2: String(yy), stroke: 'rgba(255,255,255,.06)' }));
        svg.appendChild(svgEl('text', {
          x: String(padL - 8),
          y: String(yy + 4),
          fill: '#5a6080',
          'text-anchor': 'end',
          style: 'font-family:monospace;font-size:11px'
        }, fmt(v)));
      }

      svg.appendChild(svgEl('line', { x1: String(padL), y1: String(height - padB), x2: String(width - padR), y2: String(height - padB), stroke: 'rgba(255,255,255,.12)' }));

      svg.appendChild(svgEl('path', { d: mkPath('robClose'), fill: 'none', stroke: '#6c8ef0', 'stroke-width': '2' }));
      svg.appendChild(svgEl('path', { d: mkPath('tinaClose'), fill: 'none', stroke: '#a06cf0', 'stroke-width': '2' }));
      svg.appendChild(svgEl('path', { d: mkPath('combinedClose'), fill: 'none', stroke: '#5dd87a', 'stroke-width': '2.6' }));

      // legend
      const legend = svgEl('g', {});
      const items = [
        { label: 'Rob (Vision)', col: '#6c8ef0' },
        { label: 'Tina (Aware)', col: '#a06cf0' },
        { label: 'Combined', col: '#5dd87a' }
      ];
      items.forEach((it, i) => {
        const lx = padL + i * 150, ly = 16;
        legend.appendChild(svgEl('rect', { x: String(lx), y: String(ly - 9), width: '10', height: '10', fill: it.col }));
        legend.appendChild(svgEl('text', { x: String(lx + 14), y: String(ly), fill: '#c0c5d8', style: 'font-size:12px;font-weight:800' }, it.label));
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

      if (state.tab === 'super') {
        // Spend-phase single slider state
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

        // Controls LEFT (note: concessional sliders removed)
        const controls = el('div', {}, [
          toggle(state.showActuals ? 'Actuals: ON (to FY2025)' : 'Actuals: OFF (from FY2026)', state.showActuals, () => { state.showActuals = !state.showActuals; render(); }),

          slider('Rob work return', 3, 15, 0.05, state.robWorkReturn * 100, fmtPct(state.robWorkReturn), v => { state.robWorkReturn = v / 100; render(); }),
          slider('Tina work return', 3, 15, 0.05, state.tinaWorkReturn * 100, fmtPct(state.tinaWorkReturn), v => { state.tinaWorkReturn = v / 100; render(); }),
          slider('Retirement return', 0, 12, 0.05, state.retireReturn * 100, fmtPct(state.retireReturn), v => { state.retireReturn = v / 100; render(); }),

          slider('Rob retires at age', 55, 67, 1, state.robRetireAge, String(state.robRetireAge), v => { state.robRetireAge = v; render(); }),
          slider('Tina retires at age', 55, 67, 1, state.tinaRetireAge, String(state.tinaRetireAge), v => { state.tinaRetireAge = v; render(); }),

          el('div', { style: { marginTop: '12px' } }, [
            el('div', { style: { fontSize: '12px', color: '#c0c5d8', fontWeight: '900', marginBottom: '8px' } }, 'Gross income (phased)'),
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
          slider('End age', 70, 100, 1, state.endAge, String(state.endAge), v => { state.endAge = v; render(); }),

          el('div', { style: { marginTop:'8px', fontSize:'11px', color:'#5a6080', lineHeight:'1.5' }}, [
            `Concessional locked: Age 54 = $30,000 each; Age 55+ = $32,500 each (no slider).`
          ])
        ]);

        left.appendChild(panel('Controls', controls));

        // Results RIGHT
        const cards = el('div', {
          style: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px' }
        }, [
          card('Earliest retirement combined', fmt(atEarliest.combinedClose), `Age ${earliestRetire}`, '#5dd87a'),
          card('Rob @ earliest retirement', fmt(atEarliest.robClose), 'Vision Super', '#6c8ef0'),
          card('Tina @ earliest retirement', fmt(atEarliest.tinaClose), 'Aware Super', '#a06cf0'),
          card('Pension (that year)', fmt(atEarliest.pension), state.usePension ? 'Applied from age 67' : 'Disabled', atEarliest.pension > 0 ? '#f0b96c' : '#f06c6c'),
          card(exhausted ? 'Exhausted at age' : 'Still running at', exhausted ? String(exhausted.age) : String(state.endAge), exhausted ? 'Household runs out' : 'Horizon intact', exhausted ? '#f06c6c' : '#5dd87a'),
          card('Balance at 90', fmt(at90.combinedClose), `Rob ${fmt(at90.robClose)} · Tina ${fmt(at90.tinaClose)}`, at90.combinedClose > 0 ? '#a06cf0' : '#f06c6c')
        ]);

        right.appendChild(panel('Key Results', cards));
        right.appendChild(panel('Balance Graph (fixed)', balanceChart(rows)));

        const slice = rows.slice(0, 45);
        right.appendChild(panel('Timeline (first 45 rows)', table(
          ['Age','Phase','Stage','Rob Close','Tina Close','Combined','Rob Spend','Tina Spend','Pension','Rob CC','Tina CC'],
          slice.map(r => ([
            String(r.age),
            r.phase,
            r.stage || '—',
            fmt(r.robClose),
            fmt(r.tinaClose),
            fmt(r.combinedClose),
            r.robSpend > 0 ? fmt(r.robSpend) : '—',
            r.tinaSpend > 0 ? fmt(r.tinaSpend) : '—',
            r.pension > 0 ? fmt(r.pension) : '—',
            r.phase === 'FORECAST' ? fmt(r.robCC) : '—',
            r.phase === 'FORECAST' ? fmt(r.tinaCC) : '—',
          ]))
        )));
      } else {
        left.appendChild(panel('Locked assumptions', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          `Seeds from FY2025 close: Rob ${fmt(FINAL_ACTUAL_CLOSE.rob)}, Tina ${fmt(FINAL_ACTUAL_CLOSE.tina)}.`,
        ])));
        right.appendChild(panel('Adviser Summary', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'Concessional is locked per your instruction: age 54 = $30k each, age 55+ = $32.5k each. Spend is staged into Golden/Silver/Legacy thirds and applied from earliest retirement age.',
        ])));
      }
    }

    render();

  } catch (e) {
    showFatal('Fatal error during mountApp()', e);
  }
}
