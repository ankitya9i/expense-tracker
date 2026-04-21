import type { SortKey } from '../types/api';

const CATEGORIES = ['Food', 'Travel', 'Groceries', 'Bills', 'Entertainment', 'Health', 'Other'];

type Props = {
  category: string;
  onCategoryChange: (v: string) => void;
  sort: SortKey;
  onSortChange: (v: SortKey) => void;
};

export function Filters({ category, onCategoryChange, sort, onSortChange }: Props) {
  return (
    <div className="card filters">
      <div className="field">
        <label htmlFor="filter-category">Category</label>
        <select
          id="filter-category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="filter-sort">Sort</label>
        <select
          id="filter-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
        </select>
      </div>
    </div>
  );
}
