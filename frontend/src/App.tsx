import { useState } from 'react';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { Filters } from './components/Filters';
import type { SortKey } from './types/api';

export function App() {
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');

  return (
    <main className="container">
      <header>
        <h1>Expense Tracker</h1>
      </header>

      <div className="grid">
        <ExpenseForm />
        <div className="stack">
          <Filters
            category={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={setSort}
          />
          <ExpenseList category={category} sort={sort} />
        </div>
      </div>
    </main>
  );
}
