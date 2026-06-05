import { buildAccumulationSchedule } from '../engine/accumulation.js';
import { buildDrawdownSchedule } from '../engine/drawdown.js';
import { estimateAgePension } from '../engine/pension.js';

// V6 Offline UI (no framework)
// Renders: Summary cards + Accumulation table + Drawdown table
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
      else if (k.startsWith('on') && typeof v === 'function') {
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

  // ---------- Formatting helpers ----------
  const formatCurrency = (num) =>
    '$' + Math.round(num).toLocaleString('en-AU');

  const formatPct = (num) =>
    (num * 100).toFixed(1) + '%';

  // ---------- Simple state ----------
  const state = {
    tab: 'super',
    // Inputs (keep these simple first; we’ll expand to full V4.2 parity later)
    startAge: 54,
    retireAge: 60,
    startBalance: 820000,
    concessionalCap: 32500,
    contributionsTax: 0.15,
    returnRate: 0.08,     // decimal (0.08 = 8%)
    grossSpend: 20000,    // annual gross retirement spend
    drawEndAge: 90,

    // Pension assumptions (placeholder values; we’ll expose sliders later)
    pension: {
      homeowner: true,
      fullPension: 45000,
      assetThreshold: 470000,
      assetTaperPerDollar: 0.078,  // $78 per $1,000 ≈ 0.078 per $
      deemingThreshold: 100000,
      deemingRateLow: 0.0025,
      deemingRateHigh: 0.0225,
      incomeFreeArea: 9000,
      incomeTaperRate: 0.5
    }
  };

  // ---------- Layout: header + tabs + body ----------
  const header = el('div', {
    style: {
      padding: '16px 20px',
      borderBottom: '1px solid #252a3a',
      background: '#161923'
    }
  }, [
    el('div', { style: { fontSize: '10px', letterSpacing: '2px', color: '#5a6080', textTransform: 'uppercase' } },
      'Retirement Planning · V6 (Offline)'
    ),
    el('div', { style: { fontSize: '20px', fontWeight: '700', marginTop: '4px' } },
      'Super Calculator'
    ),
    el('div', { style: { fontSize: '12px', color: '#7a8099', marginTop: '2px' } },
      'Roberto & Tina · Offline build (no server / no Babel)'
    )
  ]);

  const tabs = el('div', {
    style: {
      display: 'flex',
      gap: '10px',
      padding: '10px 20px',
      borderBottom: '1px solid #252a3a',
      background: '#161923'
    }
  });

  const body = el('div', { style: { padding: '18px 20px' } });

  root.appendChild(header);
  root.appendChild(tabs);
  root.appendChild(body);

  // ---------- UI components ----------
  function tabButton(id, label) {
    const btn = el('button', {
      style: {
        padding: '7px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        border: '1px solid #252a3a',
        background: state.tab === id ? '#6c8ef0' : 'transparent',
        color: state.tab === id ? '#ffffff' : '#7a8099',
        fontWeight: '600',
        fontSize: '12px'
      },
      onClick: () => {
        state.tab = id;
        render();
      }
    }, label);
    return btn;
  }

  function sectionTitle(text) {
    return el('div', {
      style: {
        marginTop: '22px',
        marginBottom: '10px',
        fontSize: '13px',
        fontWeight: '700',
        color: '#c0c5d8'
      }
    }, text);
  }

  function card(title, value, subtitle, color = '#6c8ef0') {
    return el('div', {
      style: {
        background: '#161923',
        border: '1px solid #252a3a',
        borderRadius: '12px',
        padding: '16px'
      }
    }, [
      el('div', { style: { fontSize: '12px', color: '#7a8099', marginBottom: '6px' } }, title),
      el('div', { style: { fontSize: '22px', fontWeight: '800', color } }, value),
      el('div', { style: { fontSize: '11px', color: '#5a6080', marginTop: '4px' } }, subtitle)
    ]);
  }

  function sliderRow(label, valueText, inputEl) {
    return el('div', { style: { margin: '10px 0' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } }, [
        el('div', { style: { fontSize: '12px', color: '#c0c5d8' } }, label),
        el('div', { style: { fontSize: '12px', color: '#6c8ef0', fontFamily: 'monospace' } }, valueText),
      ]),
      inputEl
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
        el('th', { style: { textAlign: 'right', padding: '8px 10px', color: '#7a8099', fontSize: '11px', borderBottom: '1px solid #252a3a' } }, h)
      ))
    ]);

    const tbody = el('tbody');
    rows.forEach((r, i) => {
      tbody.appendChild(
        el('tr', {
          style: { background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent' }
        }, r.map(cell =>
          el('td', { style: { textAlign: 'right', padding: '8px 10px', fontFamily: 'monospace', color: '#c0c5d8', fontSize: '12px' } }, cell)
        ))
      );
    });

    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    return tbl;
  }

  // ---------- Model runner ----------
  function runModel() {
    const accum = buildAccumulationSchedule({
      startAge: state.startAge,
      endAge: state.retireAge,
      startBalance: state.startBalance,
      concessionalCap: state.concessionalCap,
      contributionsTax: state.contributionsTax,
      returnRate: state.returnRate,
    });

    const draw = buildDrawdownSchedule({
      startAge: state.retireAge,
      endAge: state.drawEndAge,
      startBalance: accum[accum.length - 1].closingBalance,
      annualSpend: state.grossSpend,
      returnRate: state.returnRate,
    });

    const pension = estimateAgePension({
      financialAssets: draw.rows[0].openingBalance,
      homeowner: state.pension.homeowner,
      fullPension: state.pension.fullPension,
      assetThreshold: state.pension.assetThreshold,
      assetTaperPerDollar: state.pension.assetTaperPerDollar,
      deemingThreshold: state.pension.deemingThreshold,
      deemingRateLow: state.pension.deemingRateLow,
      deemingRateHigh: state.pension.deemingRateHigh,
      incomeFreeArea: state.pension.incomeFreeArea,
      incomeTaperRate: state.pension.incomeTaperRate,
    });

    return { accum, draw, pension };
  }

  // ---------- Render (fail-loud) ----------
  function render() {
    // tabs
    tabs.innerHTML = '';
    tabs.appendChild(tabButton('super', 'Super'));
    tabs.appendChild(tabButton('adviser', 'Adviser Summary'));

    // body
    body.innerHTML = '';

    try {
      if (state.tab === 'super') {
        const { accum, draw, pension } = runModel();

        // Controls
        body.appendChild(sectionTitle('Controls'));

        const returnSlider = el('input', {
          type: 'range',
          min: '3',
          max: '15',
          step: '0.1',
          value: String(state.returnRate * 100),
          style: { width: '100%' },
          onInput: (e) => { state.returnRate = (+e.target.value) / 100; render(); }
        });
        body.appendChild(sliderRow('Investment return', formatPct(state.returnRate), returnSlider));

        const spendSlider = el('input', {
          type: 'range',
          min: '5000',
          max: '300000',
          step: '5000',
          value: String(state.grossSpend),
          style: { width: '100%' },
          onInput: (e) => { state.grossSpend = (+e.target.value); render(); }
        });
        body.appendChild(sliderRow('Gross spend (annual)', formatCurrency(state.grossSpend), spendSlider));

        // Summary cards (A)
        body.appendChild(sectionTitle('Summary'));

        const cards = el('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }
        });

        const accumEnd = accum[accum.length - 1];
        const drawFirst = draw.rows[0];

        cards.appendChild(card(
          'Super at Retirement',
          formatCurrency(accumEnd.closingBalance),
          `Balance at age ${accumEnd.age}`,
          '#5dd87a'
        ));

        cards.appendChild(card(
          'Gross Income (Year 1)',
          `${formatCurrency(drawFirst.spend)} / yr`,
          'First retirement year',
          '#6c8ef0'
        ));

        cards.appendChild(card(
          'Age Pension (est.)',
          formatCurrency(pension),
          pension > 0 ? 'Payable at retirement' : 'Not eligible at retirement',
          pension > 0 ? '#f0b96c' : '#f06c6c'
        ));

        body.appendChild(cards);

        // Tables (B)
        body.appendChild(sectionTitle('Accumulation Table'));
        body.appendChild(table(
          ['Age', 'Opening', 'Net Contrib', 'Return', 'Closing'],
          accum.map(r => ([
            String(r.age),
            formatCurrency(r.openingBalance),
            formatCurrency(r.netContribution),
            formatCurrency(r.investmentReturn),
            formatCurrency(r.closingBalance),
          ]))
        ));

        body.appendChild(sectionTitle('Drawdown Table'));
        body.appendChild(table(
          ['Age', 'Opening', 'Spend', 'Return', 'Closing'],
          draw.rows.map(r => ([
            String(r.age),
            formatCurrency(r.openingBalance),
            formatCurrency(r.spend),
            formatCurrency(r.investmentReturn),
            formatCurrency(r.closingBalance),
          ]))
        ));
      }

      if (state.tab === 'adviser') {
        body.appendChild(sectionTitle('Adviser Summary (V6)'));
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
          'This is the V6 adviser panel placeholder. Next steps:',
          el('ul', { style: { marginTop: '10px' } }, [
            el('li', {}, 'Add “Funds exhausted age” and “Balance at 90” KPIs'),
            el('li', {}, 'Add assumptions + disclaimer block'),
            el('li', {}, 'Add Compare + Household tabs (V4.2 parity)'),
            el('li', {}, 'Add export (CSV)'),
          ])
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
