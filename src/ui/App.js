import { estimateAgePension } from '../engine/pension.js';

/**
 * V6 NEXT — Presentable dual-person offline model (no React/Babel)
 * - Locked actuals through FY2024–25 (ages 48–53)
 * - Dual person (Rob Vision, Tina Aware) with separate balances/returns/retire ages
 * - Left controls, right results + fully functional SVG balance chart
 * - Gross income (spend) default 150k, range 50k–500k
 * - Nuanced sliders, instant redraw, fail-loud UI errors
 */

export function mountApp(root) {
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

  // ---------- Locked ACTUALS (ages 48–53 = FY2020–FY2025) ----------
  // Sourced from V4.2 reference ACTUALS table and FINAL_ACTUAL_CLOSE seeds. 【1-e8b0c6】
  const ACTUALS = [
    { age:48, robOpen:462151.00, tinaOpen:335957.00, robContrib:22479.00, tinaContrib:23249.00, robReturnPct:19.24, tinaReturnPct:18.10 },
    { age:49, robOpen:570166.00, tinaOpen:416543.00, robContrib:22876.00, tinaContrib:26669.00, robReturnPct:18.07, tinaReturnPct:16.50 },
    { age:50, robOpen:567311.00, tinaOpen:419005.00, robContrib:24993.00, tinaContrib:26669.00, robReturnPct:-4.42, tinaReturnPct:-5.63 },
    { age:51, robOpen:652528.00, tinaOpen:484791.00, robContrib:27208.00, tinaContrib:26669.00, robReturnPct:10.39, tinaReturnPct:9.05  },
    { age:52, robOpen:730025.00, tinaOpen:559116.00, robContrib:26551.00, tinaContrib:26669.00, robReturnPct:7.55,  tinaReturnPct:9.57  },
    { age:53, robOpen:829122.86, tinaOpen:658880.00, robContrib:29608.32, tinaContrib:30000.00, robReturnPct:9.76,  tinaReturnPct:12.77 },
  ];

  const FINAL_ACTUAL_CLOSE = { rob: 829122.86, tina: 658880.00, age: 53, fy: 2025 }; // seeds forecast from age 54 【1-e8b0c6】
  const CONTRIB_TAX = 0.15; // contributions tax (kept explicit as per model constants) 【1-e8b0c6】

  // ---------- State (defaults aligned to your request) ----------
  const state = {
    tab: 'super',

    // display
    showActuals: true,

    // ages
    startAge: 48,
    endAge: 90,
    robRetireAge: 60,
    tinaRetireAge: 60,

    // starting balances (forecast seed at age 54 is final FY2025 close)
    robSeed: FINAL_ACTUAL_CLOSE.rob,
    tinaSeed: FINAL_ACTUAL_CLOSE.tina,

    // contributions (cap each)
    concessionalCapEach: 30000, // per your briefing cap maximised 【1-cb1ed8】
    contribTax: 0.15,

    // return rates (nuanced)
    robWorkReturn: 0.08,
    tinaWorkReturn: 0.08,
    retireReturn: 0.08,

    // gross income/spend (your requested range)
    grossSpend: 150000,
    spendMin: 50000,
    spendMax: 500000,

    // split when both retired
    splitPct: 50,

    // pension (toggle + extra assets)
    usePension: true,
    otherAssets: 0,
    homeowner: true,

    // deeming (simple parameterised defaults)
    deemingThreshold: 100000,
    deemingRateLow: 0.0025,
    deemingRateHigh: 0.0225,
    incomeFreeArea: 9000,
    incomeTaperRate: 0.5,

    // assets test defaults (from v4.2 constants)
    fullPension: 44855,            // FY2025 couple full pension p.a. 【1-e8b0c6】
    assetThreshold: 470000,        // couple homeowner threshold 【1-e8b0c6】
    assetTaperPerDollar: 0.078     // $78 per $1000 => 0.078 per $ 【1-e8b0c6】
  };

  // ---------- Layout ----------
  const header = el('div', {
    style: {
      padding:'16px 20px',
      background:'#161923',
      borderBottom:'1px solid #252a3a'
    }
  }, [
    el('div', { style:{ fontSize:'10px', letterSpacing:'2px', color:'#5a6080', textTransform:'uppercase' } },
      'V6 NEXT · Dual-person · Offline'
    ),
    el('div', { style:{ fontSize:'20px', fontWeight:'900', marginTop:'4px' } },
      'Super Calculator'
    ),
    el('div', { style:{ fontSize:'12px', color:'#7a8099', marginTop:'2px' } },
      'Sliders left · Graphs & Results right · Locked actuals through FY2024–25'
    )
  ]);

  const tabs = el('div', {
    style: {
      display:'flex',
      gap:'10px',
      padding:'10px 20px',
      background:'#161923',
      borderBottom:'1px solid #252a3a'
    }
  });

  const main = el('div', {
    style: {
      display:'grid',
      gridTemplateColumns:'360px 1fr',
      gap:'16px',
      padding:'16px 20px'
    }
  });

  const left = el('div', { style:{ position:'sticky', top:'10px', alignSelf:'start' } });
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
    return el('div', {
      style:{
        background:'#161923',
        border:'1px solid #252a3a',
        borderRadius:'12px',
        padding:'14px',
        marginBottom:'16px'
      }
    }, [
      el('div', { style:{ fontSize:'12px', color:'#7a8099', fontWeight:'800', marginBottom:'10px' } }, title),
      content
    ]);
  }

  function slider(label, min, max, step, value, display, onInput) {
    return el('div', { style:{ margin:'10px 0' } }, [
      el('div', { style:{ display:'flex', justifyContent:'space-between', marginBottom:'6px' } }, [
        el('div', { style:{ fontSize:'12px', color:'#c0c5d8', fontWeight:'700' } }, label),
        el('div', { style:{ fontSize:'12px', color:'#6c8ef0', fontFamily:'monospace' } }, display)
      ]),
      el('input', {
        type:'range', min:String(min), max:String(max), step:String(step), value:String(value),
        style:{ width:'100%' },
        onInput:(e)=>onInput(+e.target.value)
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

  function table(headers, rows) {
    const tbl = el('table', {
      style:{
        width:'100%',
        borderCollapse:'collapse',
        background:'#0f1117',
        border:'1px solid #252a3a',
        borderRadius:'12px',
        overflow:'hidden'
      }
    });

    tbl.appendChild(el('thead', {}, [
      el('tr', {}, headers.map(h =>
        el('th', { style:{ textAlign:'right', padding:'8px 10px', color:'#7a8099', fontSize:'11px', borderBottom:'1px solid #252a3a' } }, h)
      ))
    ]));

    const tbody = el('tbody');
    rows.forEach((r,i)=> {
      tbody.appendChild(el('tr', { style:{ background: i%2===0 ? 'rgba(255,255,255,.02)' : 'transparent' } },
        r.map(cell => el('td', {
          style:{ textAlign:'right', padding:'8px 10px', fontFamily:'monospace', fontSize:'12px', color:'#c0c5d8', borderBottom:'1px solid rgba(37,42,58,.35)' }
        }, cell))
      ));
    });
    tbl.appendChild(tbody);
    return tbl;
  }

  // ---------- Simulation ----------
  function buildTimeline() {
    const startAge = state.showActuals ? 48 : 54;
    const endAge = state.endAge;

    let robBal = state.robSeed;
    let tinaBal = state.tinaSeed;

    const netEach = state.concessionalCapEach * (1 - state.contribTax);

    const rows = [];

    // actuals
    if (state.showActuals) {
      for (let i = 0; i < ACTUALS.length; i++) {
        const r = ACTUALS[i];
        const next = ACTUALS[i+1];

        const robClose = next ? next.robOpen : FINAL_ACTUAL_CLOSE.rob;
        const tinaClose = next ? next.tinaOpen : FINAL_ACTUAL_CLOSE.tina;

        rows.push({
          age: r.age,
          phase: 'ACTUAL',
          robOpen: r.robOpen,
          tinaOpen: r.tinaOpen,
          robContrib: r.robContrib,
          tinaContrib: r.tinaContrib,
          robSpend: 0,
          tinaSpend: 0,
          pension: 0,
          robClose,
          tinaClose,
          combined: robClose + tinaClose
        });
      }
      // seed forecast at age 54
      robBal = FINAL_ACTUAL_CLOSE.rob;
      tinaBal = FINAL_ACTUAL_CLOSE.tina;
    }

    // forecast
    for (let age = 54; age <= endAge; age++) {
      if (!state.showActuals && age < 54) continue;

      const robWorking = age < state.robRetireAge;
      const tinaWorking = age < state.tinaRetireAge;

      const robOpen = robBal;
      const tinaOpen = tinaBal;

      // contributions + work returns while working
      if (robWorking) {
        const before = robBal + netEach;
        robBal = before + (before * state.robWorkReturn);
      } else {
        robBal = robBal; // no contrib
      }

      if (tinaWorking) {
        const before = tinaBal + netEach;
        tinaBal = before + (before * state.tinaWorkReturn);
      } else {
        tinaBal = tinaBal;
      }

      const anyRetired = (!robWorking) || (!tinaWorking);
      const bothRetired = (!robWorking) && (!tinaWorking);

      // pension from age 67 (simple gate)
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

      // retirement returns on retired balances only
      if (!robWorking) robBal = robBal + (robBal * state.retireReturn);
      if (!tinaWorking) tinaBal = tinaBal + (tinaBal * state.retireReturn);

      rows.push({
        age,
        phase: 'FORECAST',
        robOpen,
        tinaOpen,
        robContrib: robWorking ? state.concessionalCapEach : 0,
        tinaContrib: tinaWorking ? state.concessionalCapEach : 0,
        robSpend,
        tinaSpend,
        pension,
        robClose: robBal,
        tinaClose: tinaBal,
        combined: robBal + tinaBal
      });
    }

    // filter to startAge
    return rows.filter(r => r.age >= startAge);
  }

  // ---------- SVG chart (balances over age) ----------
  function balanceChart(rows) {
    const width = 980;
    const height = 300;
    const padL = 58, padR = 18, padT = 18, padB = 34;

    const ages = rows.map(r => r.age);
    const xMin = ages[0], xMax = ages[ages.length - 1];
    const yMax = Math.max(...rows.map(r => r.combined)) * 1.05;
    const yMin = 0;

    const x = (age) => padL + ((age - xMin) / (xMax - xMin)) * (width - padL - padR);
    const y = (val) => padT + (1 - (val - yMin) / (yMax - yMin)) * (height - padT - padB);

    const path = (key) => rows.map((r,i)=>{
      const d = (i===0?'M':'L') + x(r.age).toFixed(2) + ' ' + y(r[key]).toFixed(2);
      return d;
    }).join(' ');

    const svg = el('svg', { width:String(width), height:String(height), style:{ width:'100%', height:'auto', display:'block' }});
    svg.appendChild(el('rect', { x:'0', y:'0', width:String(width), height:String(height), fill:'#0f1117' }));

    // y grid + labels
    const ticks = 4;
    for (let i=0;i<=ticks;i++){
      const v = (yMax*i)/ticks;
      const yy = y(v);
      svg.appendChild(el('line',{x1:String(padL),y1:String(yy),x2:String(width-padR),y2:String(yy),stroke:'rgba(255,255,255,.06)'}));
      svg.appendChild(el('text',{x:String(padL-8),y:String(yy+4),fill:'#5a6080','text-anchor':'end',style:{fontFamily:'monospace',fontSize:'11px'}}, fmt(v)));
    }
    svg.appendChild(el('line',{x1:String(padL),y1:String(height-padB),x2:String(width-padR),y2:String(height-padB),stroke:'rgba(255,255,255,.12)'}));
    svg.appendChild(el('text',{x:String(width-padR),y:String(height-10),fill:'#5a6080','text-anchor':'end',style:{fontFamily:'monospace',fontSize:'11px'}},'Age'));

    // lines
    svg.appendChild(el('path',{d:path('robClose'),fill:'none',stroke:'#6c8ef0','stroke-width':'2'}));
    svg.appendChild(el('path',{d:path('tinaClose'),fill:'none',stroke:'#a06cf0','stroke-width':'2'}));
    svg.appendChild(el('path',{d:path('combined'),fill:'none',stroke:'#5dd87a','stroke-width':'2.5'}));

    // legend
    const legend = el('g');
    const items = [
      {label:'Rob (Vision)', col:'#6c8ef0'},
      {label:'Tina (Aware)', col:'#a06cf0'},
      {label:'Combined', col:'#5dd87a'}
    ];
    items.forEach((it,i)=>{
      const lx = padL + i*150;
      const ly = 16;
      legend.appendChild(el('rect',{x:String(lx),y:String(ly-9),width:'10',height:'10',fill:it.col}));
      legend.appendChild(el('text',{x:String(lx+14),y:String(ly),fill:'#c0c5d8',style:{fontFamily:'system-ui',fontSize:'12px',fontWeight:'800'}},it.label));
    });
    svg.appendChild(legend);

    return svg;
  }

  // ---------- Render ----------
  function render() {
    tabs.innerHTML = '';
    tabs.appendChild(tabButton('super','Super'));
    tabs.appendChild(tabButton('adviser','Adviser Summary'));

    left.innerHTML = '';
    right.innerHTML = '';

    try {
      const rows = buildTimeline();

      const earliestRetire = Math.min(state.robRetireAge, state.tinaRetireAge);
      const atRetire = rows.find(r => r.age === earliestRetire) || rows[0];
      const at90 = rows.find(r => r.age === 90) || rows[rows.length - 1];
      const exhausted = rows.find(r => r.combined <= 0);

      // ---------- Controls (left) ----------
      if (state.tab === 'super') {
        const controls = el('div', {}, [
          toggle(state.showActuals ? 'Actuals: ON (to FY2025)' : 'Actuals: OFF (start FY2026)', state.showActuals, () => { state.showActuals = !state.showActuals; render(); }),

          slider('Rob work return', 3, 15, 0.05, state.robWorkReturn*100, fmtPct(state.robWorkReturn), v => { state.robWorkReturn = v/100; render(); }),
          slider('Tina work return', 3, 15, 0.05, state.tinaWorkReturn*100, fmtPct(state.tinaWorkReturn), v => { state.tinaWorkReturn = v/100; render(); }),
          slider('Retirement return', 0, 12, 0.05, state.retireReturn*100, fmtPct(state.retireReturn), v => { state.retireReturn = v/100; render(); }),

          slider('Rob retires at age', 55, 67, 1, state.robRetireAge, String(state.robRetireAge), v => { state.robRetireAge = v; render(); }),
          slider('Tina retires at age', 55, 67, 1, state.tinaRetireAge, String(state.tinaRetireAge), v => { state.tinaRetireAge = v; render(); }),

          slider('Gross income (annual)', state.spendMin, state.spendMax, 5000, state.grossSpend, fmt(state.grossSpend), v => { state.grossSpend = v; render(); }),

          slider('Split when both retired (Rob %)', 0, 100, 5, state.splitPct, state.splitPct + '%', v => { state.splitPct = v; render(); }),

          slider('Concessional cap each', 0, 35000, 500, state.concessionalCapEach, fmt(state.concessionalCapEach), v => { state.concessionalCapEach = v; render(); }),

          slider('Other assets (non-super)', 0, 1000000, 10000, state.otherAssets, fmt(state.otherAssets), v => { state.otherAssets = v; render(); }),

          toggle(state.usePension ? 'Age Pension: ON' : '
