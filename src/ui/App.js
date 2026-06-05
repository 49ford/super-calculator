import { estimateAgePension } from '../engine/pension.js';

export function mountApp(root) {
  // ---------------- Hard fail‑loud traps (so you never get silent black again) ----------------
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
    } catch (_) {
      // last resort: do nothing
    }
  };

  window.onerror = (message, source, lineno, colno, error) => {
    showFatal(`${message}\n@ ${source}:${lineno}:${colno}`, error);
    return true;
  };
  window.onunhandledrejection = (event) => {
    showFatal('Unhandled promise rejection', event && event.reason ? event.reason : event);
  };

  try {
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

    // ---------------- Locked actuals (ages 48–53) and FY2025 close seeds ----------------
    // (These are the same numbers from your v4.2 reference: age 53 close Rob 829,122.86 / Tina 658,880.00)
    const ACTUALS = [
      { age:48, robOpen:462151.00, tinaOpen:335957.00, robContrib:22479.00, tinaContrib:23249.00, robReturnPct:19.24, tinaReturnPct:18.10 },
      { age:49, robOpen:570166.00, tinaOpen:416543.00, robContrib:22876.00, tinaContrib:26669.00, robReturnPct:18.07, tinaReturnPct:16.50 },
      { age:50, robOpen:567311.00, tinaOpen:419005.00, robContrib:24993.00, tinaContrib:26669.00, robReturnPct:-4.42, tinaReturnPct:-5.63 },
      { age:51, robOpen:652528.00, tinaOpen:484791.00, robContrib:27208.00, tinaContrib:26669.00, robReturnPct:10.39, tinaReturnPct:9.05  },
      { age:52, robOpen:730025.00, tinaOpen:559116.00, robContrib:26551.00, tinaContrib:26669.00, robReturnPct:7.55,  tinaReturnPct:9.57  },
      { age:53, robOpen:829122.86, tinaOpen:658880.00, robContrib:29608.32, tinaContrib:30000.00, robReturnPct:9.76,  tinaReturnPct:12.77 },
    ];
    const FINAL_ACTUAL_CLOSE = { rob: 829122.86, tina: 658880.00 };

    // ---------------- State defaults (your spec) ----------------
    const state = {
      tab: 'super',
      showActuals: true,
      endAge: 90,

      robRetireAge: 60,
      tinaRetireAge: 60,

      // seeds (Vision vs Aware)
      robSeed: FINAL_ACTUAL_CLOSE.rob,
      tinaSeed: FINAL_ACTUAL_CLOSE.tina,

      // contrib (default 30k each)
      concessionalEach: 30000,
      contribTax: 0.15,

      // returns (nuanced)
      robWorkReturn: 0.08,
      tinaWorkReturn: 0.08,
      retireReturn: 0.08,

      // spend slider
      grossSpend: 150000,
      spendMin: 50000,
      spendMax: 500000,

      splitPct: 50,

      // pension
      usePension: true,
      homeowner: true,
      otherAssets: 0,

      fullPension: 44855,
      assetThreshold: 470000,
      assetTaperPerDollar: 0.078,
      deemingThreshold: 100000,
      deemingRateLow: 0.0025,
      deemingRateHigh: 0.0225,
      incomeFreeArea: 9000,
      incomeTaperRate: 0.5
    };

    // ---------------- Layout (left controls / right results) ----------------
    const header = el('div', { style: { padding:'16px 20px', background:'#161923', borderBottom:'1px solid #252a3a' }}, [
      el('div', { style:{ fontSize:'10px', letterSpacing:'2px', color:'#5a6080', textTransform:'uppercase' }}, 'V6 NEXT · Stable Build'),
      el('div', { style:{ fontSize:'20px', fontWeight:'900', marginTop:'4px' }}, 'Super Calculator'),
      el('div', { style:{ fontSize:'12px', color:'#7a8099', marginTop:'2px' }}, 'Controls left · Graph & results right · Spend 50k–500k')
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

    // ---------------- Model ----------------
    function buildTimeline() {
      const startAge = state.showActuals ? 48 : 54;
      const rows = [];

      // actual rows
      if (state.showActuals) {
        for (let i=0;i<ACTUALS.length;i++){
          const a = ACTUALS[i];
          const next = ACTUALS[i+1];
          const robClose = next ? next.robOpen : FINAL_ACTUAL_CLOSE.rob;
          const tinaClose = next ? next.tinaOpen : FINAL_ACTUAL_CLOSE.tina;
          rows.push({
            age: a.age,
            phase: 'ACTUAL',
            robClose,
            tinaClose,
            pension: 0,
            robSpend: 0,
            tinaSpend: 0,
            combined: robClose + tinaClose
          });
        }
      }

      // forecast seed at age 54
      let robBal = state.robSeed;
      let tinaBal = state.tinaSeed;
      const netEach = state.concessionalEach * (1 - state.contribTax);

      for (let age=54; age<=state.endAge; age++){
        const robWorking = age < state.robRetireAge;
        const tinaWorking = age < state.tinaRetireAge;

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

        // apply retirement return BEFORE spend (per your v4.2 description)
        if (!robWorking) robBal = robBal + robBal * state.retireReturn;
        if (!tinaWorking) tinaBal = tinaBal + tinaBal * state.retireReturn;

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

        let robSpend = 0, tinaSpend = 0;

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
          phase: 'FORECAST',
          robClose: robBal,
          tinaClose: tinaBal,
          combined: robBal + tinaBal,
          robSpend,
          tinaSpend,
          pension
        });
      }

      return rows.filter(r => r.age >= startAge);
    }

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

      const ticks = 4;
      for (let i=0;i<=ticks;i++){
        const v = (yMax*i)/ticks;
        const yy = y(v);
        svg.appendChild(el('line', { x1:String(padL), y1:String(yy), x2:String(width-padR), y2:String(yy), stroke:'rgba(255,255,255,.06)' }));
        svg.appendChild(el('text', { x:String(padL-8), y:String(yy+4), fill:'#5a6080', 'text-anchor':'end', style:{ fontFamily:'monospace', fontSize:'11px' }}, fmt(v)));
      }
      svg.appendChild(el('line', { x1:String(padL), y1:String(height-padB), x2:String(width-padR), y2:String(height-padB), stroke:'rgba(255,255,255,.12)' }));

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
        legend.appendChild(el('text', { x:String(lx+14), y:String(ly), fill:'#c0c5d8', style:{ fontFamily:'system-ui', fontSize:'12px', fontWeight:'800' }}, it.label));
      });
      svg.appendChild(legend);

      return svg;
    }

    function render() {
      tabs.innerHTML = '';
      tabs.appendChild(tabButton('super','Super'));
      tabs.appendChild(tabButton('adviser','Adviser Summary'));

      left.innerHTML = '';
      right.innerHTML = '';

      const rows = buildTimeline();

      const earliest = Math.min(state.robRetireAge, state.tinaRetireAge);
      const atEarliest = rows.find(r => r.age === earliest) || rows[0];
      const at90 = rows.find(r => r.age === 90) || rows[rows.length-1];
      const exhausted = rows.find(r => r.combined <= 0);

      if (state.tab === 'super') {
        // controls
        left.appendChild(panel('Controls', el('div', {}, [
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
        ])));

        // results
        const cards = el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px' }}, [
          card('Balance at earliest retirement', fmt(atEarliest.combined), `Age ${earliest}`, '#5dd87a'),
          card('Gross income (Year 1)', fmt(state.grossSpend) + ' / yr', 'Household spend', '#6c8ef0'),
          card('Age Pension (retirement year)', fmt(atEarliest.pension), state.usePension ? 'From age 67' : 'Disabled', atEarliest.pension>0 ? '#f0b96c' : '#f06c6c'),
          card(exhausted ? 'Exhausted at age' : 'Still running at', exhausted ? String(exhausted.age) : String(state.endAge), exhausted ? 'Household runs out' : 'Horizon intact', exhausted ? '#f06c6c' : '#5dd87a'),
          card('Balance at 90', fmt(at90.combined), `Rob ${fmt(at90.robClose)} · Tina ${fmt(at90.tinaClose)}`, at90.combined>0 ? '#a06cf0' : '#f06c6c')
        ]);

        right.appendChild(panel('Key Results', cards));
        right.appendChild(panel('Balance Graph', balanceChart(rows)));

        // export + table
        right.appendChild(panel('Export', el('div', { style:{ display:'flex', gap:'10px', flexWrap:'wrap' }}, [
          el('button', {
            style:{ padding:'8px 10px', borderRadius:'10px', border:'1px solid #252a3a', background:'rgba(93,216,122,.10)', color:'#5dd87a', cursor:'pointer', fontWeight:'900' },
            onClick: () => exportCSV(
              'timeline.csv',
              ['Age','Phase','RobClose','TinaClose','Combined','RobSpend','TinaSpend','Pension'],
              rows.map(r => [r.age, r.phase, Math.round(r.robClose), Math.round(r.tinaClose), Math.round(r.combined), Math.round(r.robSpend), Math.round(r.tinaSpend), Math.round(r.pension)])
            )
          }, 'Export CSV: Timeline')
        ])));

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
      } else {
        left.appendChild(panel('Assumptions', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'Locked actuals ages 48–53, seeded forecast from FY2025 close:',
          el('ul', {}, [
            el('li', {}, `Rob (Vision) seed: ${fmt(FINAL_ACTUAL_CLOSE.rob)}`),
            el('li', {}, `Tina (Aware) seed: ${fmt(FINAL_ACTUAL_CLOSE.tina)}`),
            el('li', {}, `Default concessional cap: $30,000 each per year`),
            el('li', {}, `Gross income default: $150,000 (range $50k–$500k)`),
          ])
        ])));

        right.appendChild(panel('Adviser Summary', el('div', { style:{ color:'#7a8099', fontSize:'12px', lineHeight:'1.6' }}, [
          'This is a deterministic planning model designed for scenario comparison and Excel reconciliation.',
          el('ul', {}, [
            el('li', {}, 'Actuals are locked through FY2025; forecasts begin FY2026.'),
            el('li', {}, 'Returns are nominal and deterministic (no Monte Carlo).'),
            el('li', {}, 'Spend is gross household income requirement; Age Pension offsets spend after 67 if enabled.'),
          ])
        ])));
      }
    }

    render();

  } catch (e) {
    showFatal('Fatal error during mountApp()', e);
  }
}
