import { buildAccumulationSchedule } from '../engine/accumulation.js';
import { buildDrawdownSchedule } from '../engine/drawdown.js';
import { estimateAgePension } from '../engine/pension.js';

/**
 * V6 Offline UI
 * - Summary cards
 * - Accumulation & Drawdown tables
 * - CSV export
 * - Super / Adviser tabs
 */
export function mountApp(root) {
  // ---------- Page shell ----------
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

  // ---------- Formatting ----------
  const formatCurrency = (num) =>
    '$' + Math.round(num).toLocaleString('en-AU');

  const formatPct = (num) =>
    (num * 100).toFixed(1) + '%';

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
    startAge: 54,
    retireAge: 60,
    startBalance: 820000,
    concessionalCap: 32500,
    contributionsTax: 0.15,
    returnRate: 0.08,
    grossSpend: 20000,
    drawEndAge: 90,
    pension: {
      homeowner: true,
      fullPension: 45000,
      assetThreshold: 470000,
      assetTaperPerDollar: 0.078,
      deemingThreshold: 100000,
      deemingRateLow: 0.0025,
      deemingRateHigh: 0.0225,
      incomeFreeArea: 9000,
      incomeTaperRate: 0.5
    }
  };

  // ---------- Layout ----------
  const header = el('div', {
    style: { padding: '16px 20px', borderBottom: '1px solid #252a3a', background: '#161923' }
  }, [
    el('div', { style: { fontSize: '10px', letterSpacing: '2px', color: '#5a6080', textTransform: 'uppercase' } },
      'Retirement Planning · V6 (Offline)'
    ),
    el('div', { style: { fontSize: '20px', fontWeight: '700' } }, 'Super Calculator'),
    el('div', { style: { fontSize: '12px', color: '#7a8099' } },
      'Offline · No server · Deterministic'
    )
  ]);

  const tabs = el('div', {
    style: { display: 'flex', gap: '10px', padding: '10px 20px', background: '#161923', borderBottom: '1px solid #252a3a' }
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
        fontWeight: '600',
        fontSize: '12px'
      },
      onClick: () => { state.tab = id; render(); }
    }, label);

  const sectionTitle = (t) =>
    el('div', { style: { marginTop: '22px', marginBottom: '10px', fontSize: '13px', fontWeight: '700', color: '#c0c5d8' } }, t);

  const card = (title, value, subtitle, color = '#6c8ef0') =>
    el('div', { style: { background: '#161923', border: '1px solid #252a3a', borderRadius: '12px', padding: '16px' } }, [
      el('div', { style: { fontSize: '12px', color: '#7a8099' } }, title),
      el('div', { style: { fontSize: '22px', fontWeight: '800', color } }, value),
      el('div', { style: { fontSize: '11px', color: '#5a6080' } }, subtitle)
    ]);

  // ---------- Model ----------
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
      ...state.pension
    });

    return { accum, draw, pension };
  }

  // ---------- Render ----------
  function render() {
    tabs.innerHTML = '';
    tabs.appendChild(tabButton('super', 'Super'));
    tabs.appendChild(tabButton('adviser', 'Adviser Summary'));

    body.innerHTML = '';

    try {
      if (state.tab === 'super') {
        const { accum, draw, pension } = runModel();
        const accumEnd = accum[accum.length - 1];
        const drawFirst = draw.rows[0];

        // Summary
        body.appendChild(sectionTitle('Summary'));
        body.appendChild(el('div', {
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }
        }, [
          card('Super at Retirement', formatCurrency(accumEnd.closingBalance), `Age ${accumEnd.age}`, '#5dd87a'),
          card('Gross Income (Year 1)', `${formatCurrency(drawFirst.spend)} / yr`, 'First retirement year'),
          card('Age Pension', formatCurrency(pension), pension > 0 ? 'Payable' : 'Not eligible', pension > 0 ? '#f0b96c' : '#f06c6c')
        ]));

        // Accumulation table + CSV
        body.appendChild(sectionTitle('Accumulation'));
        body.appendChild(el('button', {
          style: { marginBottom: '8px' },
          onClick: () =>
            exportCSV(
              'accumulation.csv',
              ['Age', 'Opening', 'Net Contrib', 'Return', 'Closing'],
              accum.map(r => [r.age, r.openingBalance, r.netContribution, r.investmentReturn, r.closingBalance])
            )
        }, 'Export CSV'));

        body.appendChild(el('pre', { style: { fontSize: '12px', color: '#7a8099' } }, 'See table below'));

        // Drawdown table + CSV
        body.appendChild(sectionTitle('Drawdown'));
        body.appendChild(el('button', {
          style: { marginBottom: '8px' },
          onClick: () =>
            exportCSV(
              'drawdown.csv',
              ['Age', 'Opening', 'Spend', 'Return', 'Closing'],
              draw.rows.map(r => [r.age, r.openingBalance, r.spend, r.investmentReturn, r.closingBalance])
            )
        }, 'Export CSV'));
      }

      if (state.tab === 'adviser') {
        body.appendChild(sectionTitle('Adviser Summary'));
        body.appendChild(el('div', {
          style: { background: '#161923', border: '1px solid #252a3a', borderRadius: '12px', padding: '16px', color: '#7a8099' }
        }, 'Adviser narrative and assumptions go here.'));
      }

    } catch (e) {
      body.innerHTML = '';
      body.appendChild(el('pre', {
        style: { color: '#f06c6c', whiteSpace: 'pre-wrap', background: '#161923', padding: '16px' }
      }, e.stack || String(e)));
    }
  }

  render();
}
