import { estimateAgePension } from '../engine/pension.js';

/**
 * V6 NEXT (Stable + Presentable)
 * - Locked actuals (ages 48–53 / FY2020–FY2025) from V4.2 reference
 * - Forecast seeded from FY2025 close (Rob 829,122.86 / Tina 658,880.00)
 * - Left controls, right graph + cards + tables
 * - Gross income slider: default 150k, range 50k–500k
 * - Nuanced sliders, instant SVG graph redraw
 * - Fail-loud UI errors (no silent blank screens)
 */

export function mountApp(root) {
  // ---------------- Base shell ----------------
  root.innerHTML = '';
  root.style.minHeight = '100vh';
  root.style.background = '#0f1117';
  root.style.color = '#e8eaf0';
  root.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

  // ---------------- DOM helper ----------------
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

  // ---------------- Formatting ----------------
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-AU');
  const fmtPct = (dec) => (dec * 100).toFixed(2) + '%';
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // ---------------- CSV export ----------------
  function exportCSV(filename, headers, rows) {
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------- Locked actuals (V4.2) ----------------
  // Ages 48–53 are locked. Closing is next row’s opening; age 53 closes to FINAL_ACTUAL_CLOSE.
  // Source: V4.2 ACTUALS + FINAL_ACTUAL_CLOSE. 【1-3f78ed】
  const ACTUALS = [
    { age:48, robOpen:462151.00, tinaOpen:335957.00, robContrib:22479.00, tinaContrib:23249.00, robReturnPct:19.24, tinaReturnPct:18.10 },
    { age:49, robOpen:570166.00, tinaOpen:416543.00, robContrib:22876.00, tinaContrib:26669.00, robReturnPct:18.07, tinaReturnPct:16.50 },
    { age:50, robOpen:567311.00, tinaOpen:419005.00, robContrib:24993.00, tinaContrib:26669.00, robReturnPct:-4.42, tinaReturnPct:-5.63 },
    { age:51, robOpen:652528.00, tinaOpen:484791.00, robContrib:27208.00, tinaContrib:26669.00, robReturnPct:10.39, tinaReturnPct:9.05  },
    { age:52, robOpen:730025.00, tinaOpen:559116.00, robContrib:26551.00, tinaContrib:26669.00, robReturnPct:7.55,  tinaReturnPct:9.57  },
    { age:53, robOpen:829122.86, tinaOpen:658880.00, robContrib:29608.32, tinaContrib:30000.00, robReturnPct:9.76,  tinaReturnPct:12.77 },
  ];

  // Confirmed FY2025 close (seeds FY2026 / age 54 forecast)
  // Source: V4.2 FINAL_ACTUAL_CLOSE; also echoed in the briefing. 【1-3f78ed】【1-99d79b】
  const FINAL_ACTUAL_CLOSE = { rob: 829122.86, tina: 658880.00 };

  // ---------------- State (defaults per your spec) ----------------
  const state = {
    tab: 'super',
    showActuals: true,

    startAge: 48,
    endAge: 90,

    // retire ages
    robRetireAge: 60,
    tinaRetireAge: 60,

    // default forecast seeds (different fund levels)
    robSeed: FINAL_ACTUAL_CLOSE.rob,
    tinaSeed: FINAL_ACTUAL_CLOSE.tina,

    // contributions: default $30k each per year (briefing) 【1-99d79b】
    concessionalEach: 30000,
    contribTax: 0.15,

    // returns (nuanced sliders)
    robWorkReturn: 0.08,
    tinaWorkReturn: 0.08,
    retireReturn: 0.08,

    // gross spend (your requirement)
    grossSpend: 150000,
    spendMin: 50000,
    spendMax: 500000,

    // split when both retired
    splitPct: 50,

    // pension
    usePension: true,
    homeowner: true,
    otherAssets: 0,

    // pension params (defaults aligned to V4.2)
    fullPension: 44855,            // FY2025 couple full pension pa 【1-3f78ed】
    assetThreshold: 470000,        // couple homeowner threshold 【1-3f78ed】
    assetTaperPerDollar: 0.078,    // $78 per $1000 assets 【1-3f78ed】
    deemingThreshold: 100000,
    deemingRateLow: 0.0025,
    deemingRateHigh: 0.0225,
    incomeFreeArea: 9000,
    incomeTaperRate: 0.5
  };

  // ---------------- Layout ----------------
  const header = el('div', { style: { padding:'16px 20px', background:'#161923', borderBottom:'1px solid #252a3a' }}, [
    el('div', { style:{ fontSize:'10px', letterSpacing:'2px', color:'#5a6080', textTransform:'uppercase' }}, 'V6 NEXT · Presentable · Offline'),
    el('div', { style:{ fontSize:'20px', fontWeight:'900', marginTop:'4px' }}, 'Super Calculator'),
    el('div', { style:{ fontSize:'12px', color:'#7a8099', marginTop:'2px' }}, 'Controls left · Graph & results right · Locked actuals to FY2024–25')
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
        padding:'7px 12px',
        borderRadius:'8px',
        cursor:'pointer',
        border:'1px solid #252a3a',
        background: state.tab === id ? '#6c8ef0' : 'transparent',
        color: state.tab === id ? '#fff' : '#7a8099',
        fontWeight:'800',
        fontSize:'12px'
      },
      onClick: () => { state.tab = id; render(); }
    }, label);

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
      el('input', {
        type:'range', min:String(min), max:String(max), step:String(step), value:String(value),
        style:{ width:'100%' },
        onInput: (e)=>onInput(+e.target.value)
      })
    ]);
  }

  function toggle(label, on, onClick) {
    return el('button', {
      style:{
        padding:'7px 10px',
        borderRadius:'10px',
        border:'1px solid #252a3a',
        background: on ? 'rgba(93,216,122,.12)' : 'transparent',
        color: on ? '#5dd87a' : '#7a8099',
        cursor:'pointer',
        fontWeight:'900',
        width:'100%'
      },
      onClick
    }, label);
  }

  function card(title, value, subtitle, color) {
    return el('div', { style:{ background:'#161923', border:'1px solid #252a3a', borderRadius:'12px', padding:'16px' }}, [
      el('div', { style:{ fontSize:'12px', color:'#7a8099', fontWeight:'800' }}, title),
      el('div', { style:{ fontSize:'22px', fontWeight:'900', color:color || '#6c8ef0', marginTop:'6px' }}, value),
      el('div', { style:{ fontSize:'11px', color:'#5a6080', marginTop:'4px' }}, subtitle)
    ]);
  }

  function table(headers, rows) {
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
  }

  // ---------------- Model ----------------
  function buildTimeline() {
    const startAge = state.showActuals ? 48 : 54;
    const endAge = state.endAge;

    // seed forecast from FY2025 close
    let robBal = state.robSeed;
    let tinaBal = state.tinaSeed;

    const netEach = state.concessionalEach * (1 - state.contribTax);

    const rows = [];

    if (state.showActuals) {
      for (let i=0;i<ACTUALS.length;i++){
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
          combined: robClose + tinaClose
        });
      }
      robBal = FINAL_ACTUAL_CLOSE.rob;
      tinaBal = FINAL_ACTUAL_CLOSE.tina;
    }

    for (let age=54; age<=endAge; age++){
      const robWorking = age < state.robRetireAge;
      const tinaWorking = age < state.tinaRetireAge;

      const robOpen = robBal;
      const tinaOpen = tinaBal;

      // Accumulation during work years: (open + net contrib) * (1 + return)
      if (robWorking) {
        const before = robBal + netEach;
        robBal = before + before * state.robWorkReturn;
      }
      if (tinaWorking) {
        const before = tinaBal + netEach;
        tinaBal = before + before * state.tinaWorkReturn;
      }

      const anyRetired = (!robWorking) || (!tinaWorking);
      const bothRetired = (!robWorking) && (!tinaWorking);

      // Pension (simple gate from age 67; uses combined super + otherAssets)
      let pension = 0;
      if (state.usePension && age >= 67) {
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

      const grossSpend = anyRetired ? state.grossSpend : 0;
      const netSuperSpend = Math.max(0, grossSpend - pension);

      // Retirement return is applied BEFORE spend (consistent with V4.2 drawdown note)
      if (!robWorking) robBal = robBal + robBal * state.retireReturn;
      if (!tinaWorking) tinaBal = tinaBal + tinaBal * state.retireReturn;

      let robSpend = 0;
      let tinaSpend = 0;

      if (netSuperSpend > 0) {
        if (bothRetired) {
          const targetRob = netSuperSpend * (state.splitPct/100);
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

      robBal = Math.max(0, robBal - robSpend);
      tinaBal = Math.max(0, tinaBal - tinaSpend);

      rows.push({
        age,
        phase:'FORECAST',
        robOpen,
        tinaOpen,
        robSpend,
        tinaSpend,
        pension,
        robClose: robBal,
        tinaClose: tinaBal,
        combined: robBal + tinaBal
      });
    }

    return rows.filter(r => r.age >= startAge);
  }

  // ---------------- SVG chart ----------------
  function balanceChart(rows) {
    const width = 980, height = 320;
    const padL = 58, padR = 18, padT = 18, padB = 34;

    const ages = rows.map(r => r.age);
    const xMin = ages[0], xMax = ages[ages.length-1];

    const yMax = Math.max(...rows.map(r => r.combined)) * 1.05;
    const yMin = 0;

    const x = (age) => padL + ((age - xMin)/(xMax - xMin)) * (width - padL - padR);
    const y = (val) => padT + (1 - (val - yMin)/(yMax - yMin)) * (height - padT - padB);

    const mkPath = (key) => rows.map((r,i)=>{
      const cmd = i===0 ? 'M' : 'L';
      return `${cmd} ${x(r.age).toFixed(2)} ${y(r[key]).toFixed(2)}`;
    }).join(' ');

    const svg = el('svg', { width:String(width), height:String(height), style:{ width:'100%', height:'auto', display:'block' }});
    svg.appendChild(el('rect', { x:'0', y:'0', width:String(width), height:String(height), fill:'#0f1117' }));

    // grid + labels
    const ticks = 4;
    for (let i=0;i<=ticks;i++){
      const v = (yMax*i)/ticks;
      const yy = y(v);
      svg.appendChild(el('line', { x1:String(padL), y1:String(yy), x2:String(width-padR), y2:String(yy), stroke:'rgba(255,255,255,.06)' }));
      svg.appendChild(el('text', { x:String(padL-8), y:String(yy+4), fill:'#5a6080', 'text-anchor':'end',
        style:{ fontFamily:'monospace', fontSize:'11px' }}, fmt(v)));
    }
    svg.appendChild(el('line', { x1:String(padL), y1:String(height-padB), x2:String(width-padR), y2:String(height-padB), stroke:'rgba(255,255,255,.12)' }));
    svg.appendChild(el('text', { x:String(width-padR), y:String(height-10), fill:'#5a6080', 'text-anchor':'end',
      style:{ fontFamily:'monospace', fontSize:'11px' }}, 'Age'));

    // series
    svg.appendChild(el('path', { d: mkPath('robClose'), fill:'none', stroke:'#6c8ef0', 'stroke-width':'2' }));
    svg.appendChild(el('path', { d: mkPath('tinaClose'), fill:'none', stroke:'#a06cf0', 'stroke-width':'2' }));
    svg.appendChild(el('path', { d: mkPath('combined'), fill:'none', stroke:'#5dd87a', 'stroke-width':'2.5' }));

    // legend
    const legend = el('g');
    const items = [
      { label:'Rob (Vision)', col:'#6c8ef0' },
      { label:'Tina (Aware)', col:'#a06cf0' },
      { label:'Combined', col:'#5dd87a' }
    ];
    items.forEach((it,i)=>{
      const lx = padL + i*150, ly = 16;
      legend.appendChild(el('rect', { x:String(lx), y:String(ly-9), width:'10', height:'10', fill:it.col }));
      legend.appendChild(el('text', { x:String(lx+14), y:String(ly), fill:'#c0c5d8',
        style:{ fontFamily:'system-ui', fontSize:'12px', fontWeight:'800' }}, it.label));
    });
    svg.appendChild(legend);

    return svg;
  }

  // ---------------- Render ----------------
  function render() {
    tabs.innerHTML = '';
    tabs.appendChild(tabButton('super','Super'));
    tabs.appendChild(tabButton('adviser','Adviser Summary'));

    left.innerHTML = '';
    right.innerHTML = '';

    try {
      const rows = buildTimeline();

      const earliest = Math.min(state.robRetireAge, state.tinaRetireAge);
      const atEarliest = rows.find(r => r.age === earliest) || rows[0];
      const at90 = rows.find(r => r.age === 90) || rows[rows.length-1];
      const exhausted = rows.find(r => r.combined <= 0);

      // LEFT controls
      if (state.tab === 'super') {
        const controls = el('div', {}, [
          toggle(state.showActuals ? 'Actuals: ON (to FY2025)' : 'Actuals: OFF (from FY2026)', state.showActuals, () => { state.showActuals = !state.showActuals; render(); }),

          slider('Rob work return', 3, 15, 0.05, state.robWorkReturn*100, fmtPct(state.robWorkReturn), v => { state.robWorkReturn = v/100; render(); }),
          slider('Tina work return', 3, 15, 0.05, state.tinaWorkReturn*100, fmtPct(state.tinaWorkReturn), v => { state.tinaWorkReturn = v/100; render(); }),
          slider('Retirement return', 0, 12, 0.05, state.retireReturn*100, fmtPct(state.retireReturn), v => { state.retireReturn = v/100; render(); }),

          slider('Rob retires at age', 55, 67, 1, state.robRetireAge, String(state.robRetireAge), v => { state.robRetireAge = v; render(); }),
          slider('Tina retires at age', 55, 67, 1, state.tinaRetireAge, String(state.tinaRetireAge), v => { state.tinaRetireAge = v; render(); }),

          slider('Gross income (annual)', state.spendMin, state.spendMax, 5000, state.grossSpend, fmt(state.grossSpend), v => { state.grossSpend = v; render(); }),

          slider('Split when both retired (Rob %)', 0, 100, 5, state.splitPct, state.splitPct + '%', v => { state.splitPct = v; render(); }),

          slider('Concessional cap each', 0, 35000, 500, state.concessionalEach, fmt(state.concessionalEach), v => { state.concessionalEach = v; render(); }),

          slider('Other assets (non-super)', 0, 1000000, 10000, state.otherAssets, fmt(state.otherAssets), v => { state.otherAssets = v; render(); }),

          toggle(state.usePension ? 'Age Pension: ON' : 'Age Pension: OFF', state.usePension, () => { state.usePension = !state.usePension; render(); }),

          slider('End age', 70, 100, 1, state.endAge, String(state.endAge), v => { state.endAge = v; render(); })
        ]);

        left.appendChild(panel('Controls', controls));
      } else {
        left.appendChild(panel('Assumptions', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'Locked historical actuals (ages 48–53) come from V4.2. Forecast seeds from FY2025 close:',
          el('ul', {}, [
            el('li', {}, `Rob (Vision) seed: ${fmt(FINAL_ACTUAL_CLOSE.rob)}`),
            el('li', {}, `Tina (Aware) seed: ${fmt(FINAL_ACTUAL_CLOSE.tina)}`),
            el('li', {}, `Default concessional cap: $30,000 each per year (briefing)`),
            el('li', {}, `Gross income default: $150,000 (range $50k–$500k)`),
          ])
        ])));
      }

      // RIGHT results
      if (state.tab === 'super') {
        const cards = el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px' }}, [
          card('Balance at earliest retirement', fmt(atEarliest.combined), `Age ${earliest}`, '#5dd87a'),
          card('Gross income (Year 1)', fmt(state.grossSpend) + ' / yr', 'Household spend', '#6c8ef0'),
          card('Age Pension (retirement year)', fmt(atEarliest.pension), state.usePension ? 'From age 67' : 'Disabled', atEarliest.pension>0 ? '#f0b96c' : '#f06c6c'),
          card(exhausted ? 'Exhausted at age' : 'Still running at', exhausted ? String(exhausted.age) : String(state.endAge), exhausted ? 'Household runs out' : 'Horizon intact', exhausted ? '#f06c6c' : '#5dd87a'),
          card('Balance at 90', fmt(at90.combined), `Rob ${fmt(at90.robClose)} · Tina ${fmt(at90.tinaClose)}`, at90.combined>0 ? '#a06cf0' : '#f06c6c')
        ]);

        right.appendChild(panel('Key Results', cards));
        right.appendChild(panel('Balance Graph', balanceChart(rows)));

        // CSV buttons
        const exportRow = el('div', { style:{ display:'flex', gap:'10px', flexWrap:'wrap' }}, [
          el('button', {
            style:{ padding:'8px 10px', borderRadius:'10px', border:'1px solid #252a3a', background:'rgba(93,216,122,.10)', color:'#5dd87a', cursor:'pointer', fontWeight:'900' },
            onClick: () => exportCSV(
              'timeline.csv',
              ['Age','Phase','RobClose','TinaClose','Combined','RobSpend','TinaSpend','Pension'],
              rows.map(r => [r.age, r.phase, Math.round(r.robClose), Math.round(r.tinaClose), Math.round(r.combined), Math.round(r.robSpend), Math.round(r.tinaSpend), Math.round(r.pension)])
            )
          }, 'Export CSV: Timeline')
        ]);
        right.appendChild(panel('Export', exportRow));

        // Timeline table (first 45 rows)
        const slice = rows.slice(0, 45);
        right.appendChild(panel('Timeline (first 45 rows)', table(
          ['Age','Phase','Rob Close','Tina Close','Combined','Rob Spend','Tina Spend','Pension'],
          slice.map(r => ([
            String(r.age),
            r.phase,
            fmt(r.robClose),
            fmt(r.tinaClose),
            fmt(r.combined),
            r.robSpend>0 ? fmt(r.robSpend) : '—',
            r.tinaSpend>0 ? fmt(r.tinaSpend) : '—',
            r.pension>0 ? fmt(r.pension) : '—'
          ]))
        )));
      }

      if (state.tab === 'adviser') {
        right.appendChild(panel('Reference figures (from briefing)', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'Your briefing states (as at Apr 2026 estimate): Rob $903k, Tina $723k, combined $1.626M and projected retirement balances ~$1.73M / $1.43M at age 60 with 8% p.a. and $30k cap each. This model seeds from confirmed FY2025 close and lets you tune returns and spend to reconcile scenarios.', 【1-99d79b】
        ])));
      }

    } catch (e) {
      left.innerHTML = '';
      right.innerHTML = '';
      right.appendChild(el('div', {
        style:{
          background:'#161923',
          border:'1px solid rgba(240,108,108,.35)',
          borderRadius:'12px',
          padding:'16px',
          color:'#f06c6c',
          fontFamily:'monospace',
          whiteSpace:'pre-wrap'
        }
      }, `UI ERROR:\n\n${e && e.stack ? e.stack : String(e)}`));
    }
  }

  render();
}
``
