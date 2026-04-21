import { useQuery } from '@tanstack/react-query';
import { getSummary } from '../lib/api';

function percentOf(part: string, whole: string): number {
  const p = Number(part);
  const w = Number(whole);
  if (!w) return 0;
  return Math.round((p / w) * 100);
}

export function CategorySummary() {
  const query = useQuery({
    queryKey: ['expenses', 'summary'],
    queryFn: getSummary,
  });

  if (query.isLoading) return <div className="card loading">Loading summary…</div>;

  if (query.isError) {
    return (
      <div className="card">
        <div role="alert" className="error">
          Couldn't load summary.
        </div>
      </div>
    );
  }

  const data = query.data!;
  if (data.count === 0) return null;

  return (
    <div className="card summary-card">
      <h2>Spending by category</h2>
      <ul className="summary-list">
        {data.byCategory.map((c) => {
          const pct = percentOf(c.total, data.grandTotal);
          return (
            <li key={c.category} className="summary-row">
              <div className="summary-row-head">
                <span className="pill" data-category={c.category}>
                  {c.category}
                </span>
                <span className="summary-meta">
                  {c.count} {c.count === 1 ? 'entry' : 'entries'}
                </span>
                <span className="summary-amount">₹{c.total}</span>
              </div>
              <div className="summary-bar" aria-hidden>
                <div
                  className="summary-bar-fill"
                  data-category={c.category}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="summary-pct">{pct}%</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
