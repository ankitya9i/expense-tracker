export type Expense = {
  id: string;
  amount: string;
  category: string;
  description: string;
  date: string;
  createdAt: string;
};

export type ListExpensesResponse = {
  expenses: Expense[];
  totalAmount: string;
  count: number;
};

export type CreateExpenseInput = {
  amount: string;
  category: string;
  description: string;
  date: string;
};

export type SortKey = 'date_desc' | 'date_asc';
