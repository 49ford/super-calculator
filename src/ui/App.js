import { buildAccumulationSchedule } from '../engine/accumulation.js';
import { buildDrawdownSchedule } from '../engine/drawdown.js';
import { estimateAgePension } from '../engine/pension.js';

export function mountApp(root) {
  root.innerHTML = '';
  root.style.minHeight = '100vh';
  root.style.background = '#0f1117';
  root.style.color = '#e8eaf0';
  root.style.fontFamily =
    'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

  const state = {
    tab: 'super',
    returnRate: 0.08,
    grossSpend: 200000,
  };

  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style') Object.assign(n.style, v);
      else if (k.startsWith('on'))
        n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    });
    [].concat(children).forEach(c => {
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else if (c) n.appendChild(c);
    });
    return n;
  };

  const header = el(
    'div',
    { style: { padding: '16px', borderBottom: '1px solid #252a3a' } },
    [
      el('h2', {}, 'Super Calculator V6 (Offline)'),
      el(
        'div',
        { style: { color: '#7a8099', fontSize: '12px' } },
        'V6 engine • offline • no server'
      ),
    ]
  );

  const nav = el(
    'div',
    { style: { display: 'flex', gap: '12px', padding: '12px' } },
    [
      tabBtn('super', 'Super'),
      tabBtn('adviser', 'Adviser Summary'),
    ]
  );

  function tabBtn(id, label) {
    return el(
      'button',
      {
        onClick: () => {
          state.tab = id;
          render();
        },
        style: {
          padding: '6px 12px',
          background: state.tab === id ? '#6c8ef0' : '#1b2030',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        },
      },
      label
    );
  }

  const body = el('div', { style: { padding: '16px' } });

  function summaryCard(title, value, subtitle) {
  return el('div', {
    style: {
      background: '#161923',
      border: '1px solid #252a3a',
      borderRadius: '12px',
      padding: '16px'
    }
  }, [
    el('div', {
      style: { fontSize: '12px', color: '#7a8099', marginBottom: '6px' }
    }, title),
    el('div', {
      style: { fontSize: '22px', fontWeight: '700', marginBottom: '4px' }
    }, value),
    el('div', {
      style: { fontSize: '11px', color: '#5a6080' }
    }, subtitle)
  ]);
}

function formatCurrency(num) {
  return '$' + Math.round(num).toLocaleString('en-AU');
}
  
  function render() {
    body.innerHTML = '';

    if (state.tab === 'super') {
      const accum = buildAccumulationSchedule({
        startAge: 54,
        endAge: 60,
        startBalance: 820000,
        concessionalCap: 32500,
        contributionsTax: 0.15,
        returnRate: state.returnRate,
      });

      const draw = buildDrawdownSchedule({
        startAge: 60,
        endAge: 90,
        startBalance: accum.at(-1).closingBalance,
        annualSpend: state.grossSpend,
        returnRate: state.returnRate,
      });

      const pension = estimateAgePension({
        financialAssets: draw.rows[0].openingBalance,
        homeowner: true,
        fullPension: 45000,
        assetThreshold: 470000,
        assetTaperPerDollar: 0.078,
        deemingThreshold: 100000,
        deemingRateLow: 0.0025,
        deemingRateHigh: 0.0225,
        incomeFreeArea: 9000,
        incomeTaperRate: 0.5,
      });

      body.appendChild(
        el('pre', { style: { whiteSpace: 'pre-wrap' } }, JSON.stringify(
          {
            accumulationEnd: accum.at(-1),
            firstDrawdownYear: draw.rows[0],
            pensionAtRetirement: pension,
          },
          null,
          2
        ))
      );
    }

    if (state.tab === 'adviser') {
// ---- Summary cards ----
const summaryRow = el('div', {
  style: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  }
});

summaryRow.appendChild(
  summaryCard(
    'Super at Retirement',
    formatCurrency(accum.at(-1).closingBalance),
    'Balance at age ' + accum.at(-1).age
  )
);

summaryRow.appendChild(
  summaryCard(
    'Gross Income (Year 1)',
    formatCurrency(draw.rows[0].spend) + ' / yr',
    'First retirement year'
  )
);

summaryRow.appendChild(
  summaryCard(
    'Age Pension',
    formatCurrency(pension),
    pension > 0 ? 'Payable at retirement' : 'Not eligible at retirement'
  )
);

body.appendChild(summaryRow);

  root.appendChild(header);
  root.appendChild(nav);
  root.appendChild(body);

  render();
}

