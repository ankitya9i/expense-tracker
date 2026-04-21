import { useQuery } from '@tanstack/react-query';
import { listExpenses } from '../lib/api';
import type { SortKey } from '../types/api';

type Props = {
  category: string;
  sort: SortKey;
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ExpenseList({ category, sort }: Props) {
  const query = useQuery({
    queryKey: ['expenses', { category, sort }],
    queryFn: () => listExpenses({ category: category || undefined, sort }),
  });

  if (query.isLoading) return <div className="card loading">Loading expenses…</div>;

  if (query.isError) {
    return (
      <div className="card">
        <div role="alert" className="error">
          Couldn't load expenses. {query.error instanceof Error ? query.error.message : ''}
        </div>
        <button type="button" onClick={() => query.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const data = query.data!;
  if (data.expenses.length === 0) {
    return (
      <div className="card empty">
        <span className="empty-icon" aria-hidden>•••</span>
        No expenses match the current filters.
      </div>
    );
  }

  return (
    <div className="card">
      <div className="total-row">
        <strong>Total:</strong> <span>₹{data.totalAmount}</span>
        <span className="count">({data.count} {data.count === 1 ? 'entry' : 'entries'})</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.expenses.map((e) => (
            <tr key={e.id}>
              <td>{formatDate(e.date)}</td>
              <td>
                <span className="pill" data-category={e.category}>
                  {e.category}
                </span>
              </td>
              <td>{e.description}</td>
              <td className="right">₹{e.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
