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

  const el = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'style') Object.assign(n.style, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  });
  [].concat(children).forEach(c => {
    if (typeof c === 'string') n.appendChild(document.createTextNode(c));
    else if (c) n.appendChild(c);
  });
  return n;
};

// ✅ correct helper (now in scope for render + cards)
const formatCurrency = (num) =>
  '$' + Math.round(num).toLocaleString('en-AU');

const th = (label) =>
  el('th', { style: { textAlign: 'right', padding: '6px', color: '#7a8099' } }, label);

const td = (value) =>
  el('td', { style: { textAlign: 'right', padding: '6px' } }, value);

const body = el('div', { style: { padding: '24px' } });
  root.appendChild(
    el('h2', {}, 'Super Calculator V6 (Offline)'));
  root.appendChild(body);

  // --- Known‑good engine execution ---
  const accum = buildAccumulationSchedule({
    startAge: 54,
    endAge: 60,
    startBalance: 820000,
    concessionalCap: 32500,
    contributionsTax: 0.15,
    returnRate: 0.08,
  });

  const draw = buildDrawdownSchedule({
    startAge: 60,
    endAge: 90,
    startBalance: accum[accum.length - 1].closingBalance,
    annualSpend: 20000,
    returnRate: 0.08,
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

body.appendChild(el('h3', { style: { marginTop: '24px' } }, 'Accumulation'));

const accumTable = el('table', {
  style: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#0f1117',
    border: '1px solid #252a3a',
    borderRadius: '12px',
    overflow: 'hidden'
  }
});

accumTable.appendChild(
  el('thead', {}, [
    el('tr', {}, [
      th('Age'),
      th('Opening'),
      th('Net Contrib'),
      th('Return'),
      th('Closing')
    ])
  ])
);

const accumBody = el('tbody');
accum.forEach(r => {
  accumBody.appendChild(
    el('tr', {}, [
      td(r.age),
      td(formatCurrency(r.openingBalance)),
      td(formatCurrency(r.netContribution)),
      td(formatCurrency(r.investmentReturn)),
      td(formatCurrency(r.closingBalance))
    ])
  );
});
  
accumTable.appendChild(accumBody);
body.appendChild(accumTable);
  
// ---------- Accumulation Table ----------
body.appendChild(el('h3', { style: { marginTop: '24px' } }, 'Accumulation'));

const accumTable = el('table', {
  style: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#0f1117',
    border: '1px solid #252a3a',
    borderRadius: '12px'
  }
});

accumTable.appendChild(
  el('thead', {}, [
    el('tr', {}, [
      el('th', {}, 'Age'),
      el('th', {}, 'Opening'),
      el('th', {}, 'Net Contrib'),
      el('th', {}, 'Return'),
      el('th', {}, 'Closing')
    ])
  ])
);

const accumBody = el('tbody');
accum.forEach(r => {
  accumBody.appendChild(
    el('tr', {}, [
      el('td', {}, r.age),
      el('td', {}, formatCurrency(r.openingBalance)),
      el('td', {}, formatCurrency(r.netContribution)),
      el('td', {}, formatCurrency(r.investmentReturn)),
      el('td', {}, formatCurrency(r.closingBalance))
    ])
  );
});

accumTable.appendChild(accumBody);
body.appendChild(accumTable);
  
// ---------- Drawdown Table ----------
body.appendChild(el('h3', { style: { marginTop: '24px' } }, 'Drawdown'));

const drawTable = el('table', {
  style: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#0f1117',
    border: '1px solid #252a3a',
    borderRadius: '12px'
  }
});

drawTable.appendChild(
  el('thead', {}, [
    el('tr', {}, [
      el('th', {}, 'Age'),
      el('th', {}, 'Opening'),
      el('th', {}, 'Spend'),
      el('th', {}, 'Return'),
      el('th', {}, 'Closing')
    ])
  ])
);

const drawBody = el('tbody');
draw.rows.forEach(r => {
  drawBody.appendChild(
    el('tr', {}, [
      el('td', {}, r.age),
      el('td', {}, formatCurrency(r.openingBalance)),
      el('td', {}, formatCurrency(r.spend)),
      el('td', {}, formatCurrency(r.investmentReturn)),
      el('td', {}, formatCurrency(r.closingBalance))
    ])
  );
});

drawTable.appendChild(drawBody);
body.appendChild(drawTable);
  
    // Super at Retirement
    el('div', {
      style: {
        background: '#161923',
        border: '1px solid #252a3a',
        borderRadius: '12px',
        padding: '16px'
      }
    }, [
      el('div', { style: { fontSize: '12px', color: '#7a8099' } }, 'Super at Retirement'),
      el('div', { style: { fontSize: '24px', fontWeight: '700' } },
        formatCurrency(accum[accum.length - 1].closingBalance)
      ),
      el('div', { style: { fontSize: '11px', color: '#5a6080' } },
        'Balance at age ' + accum[accum.length - 1].age
      )
    ]),

    // Gross Income (Year 1)
    el('div', {
      style: {
        background: '#161923',
        border: '1px solid #252a3a',
        borderRadius: '12px',
        padding: '16px'
      }
    }, [
      el('div', { style: { fontSize: '12px', color: '#7a8099' } }, 'Gross Income (Year 1)'),
      el('div', { style: { fontSize: '22px', fontWeight: '700' } },
        formatCurrency(draw.rows[0].spend) + ' / yr'
      ),
      el('div', { style: { fontSize: '11px', color: '#5a6080' } },
        'First retirement year'
      )
    ]),

    // Age Pension
    el('div', {
      style: {
        background: '#161923',
        border: '1px solid #252a3a',
        borderRadius: '12px',
        padding: '16px'
      }
    }, [
      el('div', { style: { fontSize: '12px', color: '#7a8099' } }, 'Age Pension'),
      el('div', { style: { fontSize: '22px', fontWeight: '700' } },
        formatCurrency(pension)
      ),
      el('div', { style: { fontSize: '11px', color: '#5a6080' } },
        pension > 0 ? 'Payable at retirement' : 'Not eligible at retirement'
      )
    ])

  ])
);
}
