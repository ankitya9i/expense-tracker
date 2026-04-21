import { useState, useRef, useMemo, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createExpense, ApiError } from '../lib/api';
import { newIdempotencyKey } from '../lib/uuid';

const CATEGORIES = ['Food', 'Travel', 'Groceries', 'Bills', 'Entertainment', 'Health', 'Other'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type FieldErrors = Partial<Record<'amount' | 'category' | 'description' | 'date', string>>;

function validate(input: {
  amount: string;
  category: string;
  description: string;
  date: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.amount.trim()) errors.amount = 'Amount is required';
  else if (!/^\d+(\.\d{1,2})?$/.test(input.amount.trim()))
    errors.amount = 'Use numbers only, up to 2 decimals';
  else if (Number(input.amount) <= 0) errors.amount = 'Amount must be greater than zero';

  if (!input.category.trim()) errors.category = 'Category is required';
  if (!input.description.trim()) errors.description = 'Description is required';
  if (!input.date) errors.date = 'Date is required';
  return errors;
}

export function ExpenseForm() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  // Stable key per in-flight submission — protects against double-click + retries.
  const idempotencyKeyRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: (key: string) =>
      createExpense({ amount, category, description, date }, key),
    onSuccess: () => {
      idempotencyKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setAmount('');
      setDescription('');
      setTouched(false);
      setErrors({});
    },
  });

  const fieldErrors = useMemo(
    () => validate({ amount, category, description, date }),
    [amount, category, description, date],
  );
  const hasErrors = Object.keys(fieldErrors).length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setErrors(fieldErrors);
    if (hasErrors) return;
    if (mutation.isPending) return;
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey();
    mutation.mutate(idempotencyKeyRef.current);
  }

  const submissionError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
      ? 'Network error — please try again'
      : null;

  return (
    <form onSubmit={onSubmit} className="card">
      <h2>Add Expense</h2>

      <div className="field">
        <label htmlFor="amount">Amount (₹)</label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 250.00"
          aria-invalid={!!errors.amount}
        />
        {touched && errors.amount && <span className="error">{errors.amount}</span>}
      </div>

      <div className="field">
        <label htmlFor="category">Category</label>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this for?"
          aria-invalid={!!errors.description}
          maxLength={500}
        />
        {touched && errors.description && <span className="error">{errors.description}</span>}
      </div>

      <div className="field">
        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayIso()}
          aria-invalid={!!errors.date}
        />
        {touched && errors.date && <span className="error">{errors.date}</span>}
      </div>

      <button type="submit" disabled={mutation.isPending || (touched && hasErrors)}>
        {mutation.isPending ? 'Saving…' : 'Add expense'}
      </button>

      {submissionError && (
        <div role="alert" className="error">
          {submissionError}
        </div>
      )}
    </form>
  );
}
