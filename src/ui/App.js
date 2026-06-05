import { estimateAgePension } from '../engine/pension.js';

/**
 * V6 NEXT — Dual person + Graphs (Offline, no framework)
 * - Rob + Tina modelled separately
 * - Gap years: earliest retire funds spend while other continues accumulating
 * - SVG chart: Rob, Tina, Combined balances over age
 * - Controls: sliders for returns, retire ages, gross spend, split, pension toggle
 * - Tables: yearly timeline + exports
 */

export function mountApp(root) {
  // ---------- Base page ----------
  root.innerHTML = '';
  root.style.minHeight = '100vh';
  root.style.background = '#0f1117';
  root.style.color = '#e8eaf0';
  root.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

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
  const fmt = (num) => '$' + Math.round(num).toLocaleString('en-AU');
  const fmtPct = (dec) => (dec * 100).toFixed(1) + '%';
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // ---------- CSV export ----------
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

  // ---------- State ----------
  const state = {
    tab: 'super',

    // Ages
    startAge: 54,
    endAge: 90,

    // Starting balances
    robStartBal: 820000,
    tinaStartBal: 820000,

    // Contributions (forecast = hit cap)
    concessionalCap: 32500,
    contribTax: 0.15,

    // Return rates (work phase)
    robWorkReturn: 0.08,
    tinaWorkReturn: 0.08,

    // Retirement return (applies once retired)
    retireReturn: 0.08,

    // Retirement ages
    robRetireAge: 60,
    tinaRetireAge: 60,

    // Household gross spend per year (drawdown)
    grossSpend: 20000,

    // Split when both retired (Rob share %)
    splitPct: 50,

    // Gap-year rule: retired spouse funds 100% (recommended)
    gapRule: 'retired100', // 'retired100' only for now

    // Pension toggle + parameters (simple, editable later)
    usePension: true,
    pensionParams: {
      homeowner: true,
      fullPension: 45000,
      assetThreshold: 470000,
      assetTaperPerDollar: 0.078,
      deemingThreshold: 100000,
      deemingRateLow: 0.0025,
      deemingRateHigh: 0.0225,
      incomeFreeArea: 9000,
      incomeTaperRate: 0.5
    },

    // Display options
    showTimelineRows: 40
  };

  // ---------- Layout ----------
  const header = el('div', {
    style: {
      padding: '16px 20px',
      borderBottom: '1px solid #252a3a',
      background: '#161923'
    }
  }, [
    el('div', { style: { fontSize: '10px', letterSpacing: '2px', color: '#5a6080', textTransform: 'uppercase' } },
      'V6 NEXT · Dual-person · Offline'
    ),
    el('div', { style: { fontSize: '20px', fontWeight: '800', marginTop: '4px' } }, 'Super Calculator'),
    el('div', { style: { fontSize: '12px', color: '#7a8099', marginTop: '2px' } },
      'Graphs + Sliders + Tables + CSV (no server / no Babel)'
    )
  ]);

  const tabs = el('div', {
    style: {
      display: 'flex',
      gap: '10px',
      padding: '10px 20px',
      background: '#161923',
      borderBottom: '1px solid #252a3a'
    }
  });

  const body = el('div', { style: { padding: '18px 20px' } });

  root.appendChild(header);
  root.appendChild(tabs);
  root.appendChild(body);

  // ---------- UI helpers ----------
  const tabButton = (id, label) =>
    el('button', {
      style: {
        padding: '7px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        border: '1px solid #252a3a',
        background: state.tab === id ? '#6c8ef0' : 'transparent',
        color: state.tab === id ? '#fff' : '#7a8099',
        fontWeight: '700',
        fontSize: '12px'
      },
      onClick: () => { state.tab = id; render(); }
    }, label);

  const sectionTitle = (t) =>
    el('div', {
      style: {
        marginTop: '22px',
        marginBottom: '10px',
        fontSize: '13px',
        fontWeight: '800',
        color: '#c0c5d8'
      }
    }, t);

  const panel = (title, content) =>
    el('div', {
      style: {
        background: '#161923',
        border: '1px solid #252a3a',
        borderRadius: '12px',
        padding: '14px',
        marginTop: '16px'
      }
    }, [
      el('div', { style: { fontSize: '12px', color: '#7a8099', marginBottom: '10px', fontWeight: '700' } }, title),
      content
    ]);

  const card = (title, value, subtitle, color = '#6c8ef0') =>
    el('div', {
      style: {
        background: '#0f1117',
        border: '1px solid #252a3a',
        borderRadius: '12px',
        padding: '16px'
      }
    }, [
      el('div', { style: { fontSize: '12px', color: '#7a8099', marginBottom: '6px' } }, title),
      el('div', { style: { fontSize: '22px', fontWeight: '900', color } }, value),
      el('div', { style: { fontSize: '11px', color: '#5a6080', marginTop: '4px' } }, subtitle)
    ]);

  function slider(label, min, max, step, value, display, onInput) {
    return el('div', { style: { margin: '10px 0' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } }, [
        el('div', { style: { fontSize: '12px', color: '#c0c5d8', fontWeight: '700' } }, label),
        el('div', { style: { fontSize: '12px', color: '#6c8ef0', fontFamily: 'monospace' } }, display)
      ]),
      el('input', {
        type: 'range',
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(value),
        style: { width: '100%' },
        onInput: (e) => onInput(+e.target.value)
      })
    ]);
  }

  function table(headers, rows) {
    const tbl = el('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        background: '#0f1117',
        border: '1px solid #252a3a',
        borderRadius: '12px',
        overflow: 'hidden'
      }
    });

    const thead = el('thead', {}, [
      el('tr', {}, headers.map(h =>
        el('th', {
          style: {
            textAlign: 'right',
            padding: '8px 10px',
            color: '#7a8099',
            fontSize: '11px',
            borderBottom: '1px solid #252a3a'
          }
        }, h)
      ))
    ]);

    const tbody = el('tbody');
    rows.forEach((r, i) => {
      tbody.appendChild(
        el('tr', {
          style: { background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent' }
        }, r.map(cell =>
          el('td', {
            style: {
              textAlign: 'right',
              padding: '8px 10px',
              fontFamily: 'monospace',
              color: '#c0c5d8',
              fontSize: '12px',
              borderBottom: '1px solid rgba(37,42,58,.35)'
            }
          }, cell)
        ))
      );
    });

    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    return tbl;
  }

  // ---------- Core simulation (dual-person, gap years + retirement) ----------
  function simulate() {
    const startAge = state.startAge;
    const endAge = state.endAge;

    const netContrib = state.concessionalCap * (1 - state.contribTax);

    let robBal = state.robStartBal;
    let tinaBal = state.tinaStartBal;

    const rows = [];

    for (let age = startAge; age <= endAge; age++) {
      const robWorking = age < state.robRetireAge;
      const tinaWorking = age < state.tinaRetireAge;

      const robOpen = robBal;
      const tinaOpen = tinaBal;

      // Step 1: working spouse accumulates contributions + work return
      if (robWorking) {
        const before = robBal + netContrib;
        robBal = before + (before * state.robWorkReturn);
      }
      if (tinaWorking) {
        const before = tinaBal + netContrib;
        tinaBal = before + (before * state.tinaWorkReturn);
      }

      // Step 2: if anyone retired, apply household spend funded by retired spouse(s)
      const anyRetired = (!robWorking) || (!tinaWorking);

      // Pension only considered from age 67 onwards (simple rule)
      let pension = 0;
      if (state.usePension && age >= 67) {
        pension = estimateAgePension({
          financialAssets: robBal + tinaBal, // use current-year balances (post working contribs)
          ...state.pensionParams
        });
      }

      const grossSpend = anyRetired ? state.grossSpend : 0;
      const netSuperSpend = Math.max(0, grossSpend - pension);

      let robSpend = 0;
      let tinaSpend = 0;

      if (anyRetired && netSuperSpend > 0) {
        const bothRetired = (!robWorking) && (!tinaWorking);

        if (bothRetired) {
          // split spend by pct; if one side runs out, other covers remainder
          const targetRob = netSuperSpend * (state.splitPct / 100);
          const targetTina = netSuperSpend - targetRob;

          robSpend = Math.min(robBal, targetRob);
          tinaSpend = Math.min(tinaBal, targetTina);

          let remaining = netSuperSpend - (robSpend + tinaSpend);
          if (remaining > 0) {
            // cover remainder from whoever still has balance
            const robAvail = Math.max(0, robBal - robSpend);
            const tinaAvail = Math.max(0, tinaBal - tinaSpend);

            const robExtra = Math.min(robAvail, remaining);
            robSpend += robExtra;
            remaining -= robExtra;

            const tinaExtra = Math.min(tinaAvail, remaining);
            tinaSpend += tinaExtra;
            remaining -= tinaExtra;
          }
        } else if (!robWorking && tinaWorking) {
          // gap years: retired spouse funds 100%
          robSpend = Math.min(robBal, netSuperSpend);
        } else if (robWorking && !tinaWorking) {
          tinaSpend = Math.min(tinaBal, netSuperSpend);
        }
      }

      // Apply withdrawals
      robBal = Math.max(0, robBal - robSpend);
      tinaBal = Math.max(0, tinaBal - tinaSpend);

      // Step 3: apply retirement return to retired spouse balances only
      if (!robWorking) robBal = robBal + (robBal * state.retireReturn);
      if (!tinaWorking) tinaBal = tinaBal + (tinaBal * state.retireReturn);

      const total = robBal + tinaBal;

      rows.push({
        age,
        robWorking,
        tinaWorking,
        robOpen,
        tinaOpen,
        robSpend,
        tinaSpend,
        pension,
        robClose: robBal,
        tinaClose: tinaBal,
        totalClose: total
      });
    }

    return rows;
  }

  // ---------- SVG chart (balances over age) ----------
  function balanceChart(rows) {
    const width = 980;
    const height = 260;
    const padL = 48, padR = 18, padT = 18, padB = 32;

    const ages = rows.map(r => r.age);
    const xMin = ages[0], xMax = ages[ages.length - 1];

    const yMax = Math.max(...rows.map(r => r.totalClose)) * 1.05;
    const yMin = 0;

    const x = (age) => padL + ((age - xMin) / (xMax - xMin)) * (width - padL - padR);
    const y = (val) => padT + (1 - (val - yMin) / (yMax - yMin)) * (height - padT - padB);

    const path = (key) => {
      let d = '';
      rows.forEach((r, i) => {
        const xv = x(r.age);
        const yv = y(r[key]);
        d += (i === 0 ? 'M' : 'L') + xv.toFixed(2) + ' ' + yv.toFixed(2) + ' ';
      });
      return d.trim();
    };

    // axes ticks
    const yTicks = 4;
    const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => (yMax * i) / yTicks);

    const svg = el('svg', { width: String(width), height: String(height), style: { width: '100%', height: 'auto', display: 'block' } });

    // background
    svg.appendChild(el('rect', { x: '0', y: '0', width: String(width), height: String(height), fill: '#0f1117' }));

    // grid + y labels
    yTickVals.forEach(v => {
      const yy = y(v);
      svg.appendChild(el('line', { x1: String(padL), y1: String(yy), x2: String(width - padR), y2: String(yy), stroke: 'rgba(255,255,255,.06)' }));
      svg.appendChild(el('text', { x: String(padL - 8), y: String(yy + 4), fill: '#5a6080', 'text-anchor': 'end', style: { fontFamily: 'monospace', fontSize: '11px' } }, fmt(v)));
    });

    // x axis
    svg.appendChild(el('line', { x1: String(padL), y1: String(height - padB), x2: String(width - padR), y2: String(height - padB), stroke: 'rgba(255,255,255,.12)' }));
    svg.appendChild(el('text', { x: String(width - padR), y: String(height - 10), fill: '#5a6080', 'text-anchor': 'end', style: { fontFamily: 'monospace', fontSize: '11px' } }, 'Age'));

    // lines
    svg.appendChild(el('path', { d: path('robClose'), fill: 'none', stroke: '#6c8ef0', 'stroke-width': '2' }));
    svg.appendChild(el('path', { d: path('tinaClose'), fill: 'none', stroke: '#a06cf0', 'stroke-width': '2' }));
    svg.appendChild(el('path', { d: path('totalClose'), fill: 'none', stroke: '#5dd87a', 'stroke-width': '2.5' }));

    // legend
    const legend = el('g');
    const items = [
      { label: 'Rob', col: '#6c8ef0' },
      { label: 'Tina', col: '#a06cf0' },
      { label: 'Combined', col: '#5dd87a' }
    ];
    items.forEach((it, i) => {
      const lx = padL + i * 110;
      const ly = 14;
      legend.appendChild(el('rect', { x: String(lx), y: String(ly - 9), width: '10', height: '10', fill: it.col }));
      legend.appendChild(el('text', { x: String(lx + 14), y: String(ly), fill: '#c0c5d8', style: { fontFamily: 'system-ui', fontSize: '12px', fontWeight: '700' } }, it.label));
    });
    svg.appendChild(legend);

    return svg;
  }

  // ---------- Render ----------
  function render() {
    tabs.innerHTML = '';
    tabs.appendChild(tabButton('super', 'Super'));
    tabs.appendChild(tabButton('adviser', 'Adviser Summary'));
    body.innerHTML = '';

    try {
      if (state.tab === 'super') {
        const rows = simulate();

        const startAge = state.startAge;
        const retireStartAge = Math.min(state.robRetireAge, state.tinaRetireAge);

        const atRetire = rows.find(r => r.age === retireStartAge) || rows[0];
        const at90 = rows.find(r => r.age === 90) || rows[rows.length - 1];
        const exhausted = rows.find(r => r.totalClose <= 0);

        // Controls panel (big leap)
        const controls = el('div', {}, [
          slider('Rob start balance', 0, 2000000, 10000, state.robStartBal, fmt(state.robStartBal), v => { state.robStartBal = v; render(); }),
          slider('Tina start balance', 0, 2000000, 10000, state.tinaStartBal, fmt(state.tinaStartBal), v => { state.tinaStartBal = v; render(); }),
          slider('Rob work return', 3, 15, 0.1, state.robWorkReturn * 100, fmtPct(state.robWorkReturn), v => { state.robWorkReturn = v / 100; render(); }),
          slider('Tina work return', 3, 15, 0.1, state.tinaWorkReturn * 100, fmtPct(state.tinaWorkReturn), v => { state.tinaWorkReturn = v / 100; render(); }),
          slider('Retirement return', 0, 12, 0.1, state.retireReturn * 100, fmtPct(state.retireReturn), v => { state.retireReturn = v / 100; render(); }),
          slider('Rob retires at age', 55, 67, 1, state.robRetireAge, String(state.robRetireAge), v => { state.robRetireAge = v; render(); }),
          slider('Tina retires at age', 55, 67, 1, state.tinaRetireAge, String(state.tinaRetireAge), v => { state.tinaRetireAge = v; render(); }),
          slider('Gross spend (annual)', 5000, 300000, 5000, state.grossSpend, fmt(state.grossSpend), v => { state.grossSpend = v; render(); }),
          slider('Split when both retired (Rob %)', 0, 100, 5, state.splitPct, state.splitPct + '%', v => { state.splitPct = v; render(); }),
          el('div', { style: { marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center' } }, [
            el('button', {
              style: {
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #252a3a',
                background: state.usePension ? 'rgba(93,216,122,.12)' : 'transparent',
                color: state.usePension ? '#5dd87a' : '#7a8099',
                cursor: 'pointer',
                fontWeight: '800'
              },
              onClick: () => { state.usePension = !state.usePension; render(); }
            }, state.usePension ? 'Age Pension: ON' : 'Age Pension: OFF'),
            el('div', { style: { fontSize: '11px', color: '#5a6080' } },
              'Gap years: retired spouse funds 100% (recommended)'
            )
          ])
        ]);

        body.appendChild(panel('Controls', controls));

        // Summary cards
        const cards = el('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }
        }, [
          card('Combined at first retirement', fmt(atRetire.totalClose), `Age ${retireStartAge} (earliest retirement)`, '#5dd87a'),
          card('Gross income (Year 1)', `${fmt(state.grossSpend)} / yr`, 'Household spend', '#6c8ef0'),
          card('Age Pension (est.)', fmt(atRetire.pension), state.usePension ? 'Applied from age 67 (assets+income test)' : 'Disabled', atRetire.pension > 0 ? '#f0b96c' : '#f06c6c'),
          card(exhausted ? 'Exhausted at age' : 'Still running at age', exhausted ? String(exhausted.age) : String(state.endAge), exhausted ? 'Household runs out' : '40-year horizon intact', exhausted ? '#f06c6c' : '#5dd87a'),
          card('Balance at 90', fmt(at90.totalClose), 'Combined (nominal)', at90.totalClose > 0 ? '#a06cf0' : '#f06c6c'),
          card('Rob / Tina at 90', `${fmt(at90.robClose)} / ${fmt(at90.tinaClose)}`, 'Individual balances', '#7a8099')
        ]);

        body.appendChild(panel('Summary', cards));

        // Chart
        body.appendChild(panel('Balance Graph', balanceChart(rows)));

        // CSV exports
        const exportRow = el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, [
          el('button', {
            style: {
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid #252a3a',
              background: 'rgba(93,216,122,.10)',
              color: '#5dd87a',
              cursor: 'pointer',
              fontWeight: '800'
            },
            onClick: () => {
              exportCSV(
                'timeline.csv',
                ['Age','RobOpen','TinaOpen','RobSpend','TinaSpend','Pension','RobClose','TinaClose','TotalClose'],
                rows.map(r => [
                  r.age,
                  Math.round(r.robOpen),
                  Math.round(r.tinaOpen),
                  Math.round(r.robSpend),
                  Math.round(r.tinaSpend),
                  Math.round(r.pension),
                  Math.round(r.robClose),
                  Math.round(r.tinaClose),
                  Math.round(r.totalClose)
                ])
              );
            }
          }, 'Export CSV: Timeline'),
          el('button', {
            style: {
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid #252a3a',
              background: 'rgba(108,142,240,.10)',
              color: '#6c8ef0',
              cursor: 'pointer',
              fontWeight: '800'
            },
            onClick: () => {
              const accumRows = rows.filter(r => r.age <= Math.max(state.robRetireAge, state.tinaRetireAge));
              exportCSV(
                'accumulation.csv',
                ['Age','RobClose','TinaClose','CombinedClose','RobWorking','TinaWorking'],
                accumRows.map(r => [
                  r.age,
                  Math.round(r.robClose),
                  Math.round(r.tinaClose),
                  Math.round(r.totalClose),
                  r.robWorking ? 'Y' : 'N',
                  r.tinaWorking ? 'Y' : 'N'
                ])
              );
            }
          }, 'Export CSV: Accumulation'),
          el('button', {
            style: {
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid #252a3a',
              background: 'rgba(160,108,240,.10)',
              color: '#a06cf0',
              cursor: 'pointer',
              fontWeight: '800'
            },
            onClick: () => {
              const drawRows = rows.filter(r => r.age >= retireStartAge);
              exportCSV(
                'drawdown.csv',
                ['Age','RobSpend','TinaSpend','Pension','RobClose','TinaClose','TotalClose'],
                drawRows.map(r => [
                  r.age,
                  Math.round(r.robSpend),
                  Math.round(r.tinaSpend),
                  Math.round(r.pension),
                  Math.round(r.robClose),
                  Math.round(r.tinaClose),
                  Math.round(r.totalClose)
                ])
              );
            }
          }, 'Export CSV: Drawdown')
        ]);

        body.appendChild(panel('Exports', exportRow));

        // Timeline table (limited rows for readability)
        body.appendChild(sectionTitle('Timeline (yearly)'));
        const maxRows = clamp(state.showTimelineRows, 10, rows.length);
        const tail = rows.slice(0, maxRows);
        body.appendChild(table(
          ['Age','Rob Close','Tina Close','Combined','Rob Spend','Tina Spend','Pension'],
          tail.map(r => ([
            String(r.age),
            fmt(r.robClose),
            fmt(r.tinaClose),
            fmt(r.totalClose),
            r.robSpend > 0 ? fmt(r.robSpend) : '—',
            r.tinaSpend > 0 ? fmt(r.tinaSpend) : '—',
            r.pension > 0 ? fmt(r.pension) : '—'
          ]))
        ));

        body.appendChild(el('div', { style: { marginTop: '10px', fontSize: '11px', color: '#5a6080' } },
          `Showing first ${maxRows} years from age ${startAge}. Increase rows via code later if desired.`
        ));
      }

      if (state.tab === 'adviser') {
        body.appendChild(sectionTitle('Adviser Summary (NEXT)'));
        body.appendChild(el('div', {
          style: {
            background: '#161923',
            border: '1px solid #252a3a',
            borderRadius: '12px',
            padding: '16px',
            color: '#7a8099',
            lineHeight: '1.6'
          }
        }, [
          el('div', { style: { color: '#c0c5d8', fontWeight: '800', marginBottom: '10px' } }, 'What this model is doing'),
          el('ul', {}, [
            el('li', {}, 'Rob & Tina are modelled separately with different returns and retirement ages.'),
            el('li', {}, 'Earliest retirement triggers household spending; gap years funded 100% by retired spouse.'),
            el('li', {}, 'When both retired, spend is split by the chosen % (with automatic top-up if one side runs out).'),
            el('li', {}, 'Age Pension estimate is simplified (assets + deeming income test), applied from age 67 when enabled.'),
            el('li', {}, 'Returns are nominal; this is a deterministic planning tool (not probabilistic advice).')
          ]),
          el('div', { style: { marginTop: '12px', color: '#5a6080', fontSize: '11px' } },
            'Next: add Household tab, Compare scenarios, and chart overlays (poor/base/strong sequences).'
          )
        ]));
      }

    } catch (e) {
      body.innerHTML = '';
      body.appendChild(el('div', {
        style: {
          background: '#161923',
          border: '1px solid rgba(240,108,108,.35)',
          borderRadius: '12px',
          padding: '16px',
          color: '#f06c6c',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap'
        }
      }, `UI ERROR:\n\n${e && e.stack ? e.stack : String(e)}`));
    }
  }

  render();
}
