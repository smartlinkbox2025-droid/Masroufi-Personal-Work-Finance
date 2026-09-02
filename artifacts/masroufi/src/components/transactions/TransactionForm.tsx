import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react';
import { formatAmountInput, parseAmountToHalalas } from '@/lib/currency';
import { isProjectSelectable, todayISO } from '@/lib/transactions';
import type {
  Category,
  Expense,
  FinanceScope,
  Income,
  PaymentMethod,
  Project,
} from '@/types/finance';

type TransactionRecord = Expense | Income;

interface TransactionFormProps {
  kind: 'expense' | 'income';
  mode: 'create' | 'edit' | 'duplicate';
  defaults?: { scope?: FinanceScope; projectId?: string };
  initialRecord?: TransactionRecord | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  projects: Project[];
  onClose: () => void;
  onSave: (record: TransactionRecord) => Promise<void>;
}

function isExpense(record: TransactionRecord | null | undefined): record is Expense {
  return Boolean(record && 'categoryId' in record);
}

export function TransactionForm({
  kind,
  mode,
  defaults,
  initialRecord,
  categories,
  paymentMethods,
  projects,
  onClose,
  onSave,
}: TransactionFormProps) {
  const initialScope: FinanceScope = initialRecord?.scope ?? defaults?.scope ?? 'personal';
  const [amount, setAmount] = useState(
    initialRecord ? formatAmountInput(initialRecord.amountHalalas) : '',
  );
  const [date, setDate] = useState(initialRecord?.date ?? todayISO());
  const [scope, setScope] = useState<FinanceScope>(initialScope);
  const [categoryId, setCategoryId] = useState(
    isExpense(initialRecord) ? initialRecord.categoryId : initialRecord?.category ?? '',
  );
  const [projectId, setProjectId] = useState(initialRecord?.projectId ?? defaults?.projectId ?? '');
  const [paymentMethodId, setPaymentMethodId] = useState(
    initialRecord?.paymentMethodId ?? '',
  );
  const [description, setDescription] = useState(initialRecord?.description ?? '');
  const [notes, setNotes] = useState(initialRecord?.notes ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.kind === kind &&
          category.isVisible &&
          (category.scope === scope || category.scope === 'both'),
      ),
    [categories, kind, scope],
  );
  const availableProjects = projects.filter((project) =>
    isProjectSelectable(project, mode, initialRecord?.projectId),
  );
  const activePaymentMethods = paymentMethods.filter((method) => method.isVisible);

  useEffect(() => {
    if (!availableCategories.some((category) => category.id === categoryId)) {
      setCategoryId(availableCategories[0]?.id ?? '');
    }
  }, [availableCategories, categoryId]);

  useEffect(() => {
    if (scope !== 'work') setProjectId('');
  }, [scope]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountHalalas = parseAmountToHalalas(amount);
    if (amountHalalas === null || amountHalalas <= 0) {
      setError('أدخل مبلغًا صالحًا أكبر من صفر وبحد أقصى منزلتين عشريتين.');
      return;
    }
    if (!date) {
      setError('اختر تاريخ الحركة.');
      return;
    }
    if (!categoryId || !availableCategories.some((category) => category.id === categoryId)) {
      setError('اختر تصنيفًا مناسبًا لنوع الحركة.');
      return;
    }
    if (projectId && scope !== 'work') {
      setError('لا يمكن ربط حركة شخصية بمشروع عمل.');
      return;
    }
    if (projectId && !availableProjects.some((project) => project.id === projectId)) {
      setError('المشروع المختار غير صالح.');
      return;
    }
    if (
      paymentMethodId &&
      !activePaymentMethods.some((method) => method.id === paymentMethodId)
    ) {
      setError('طريقة الدفع المختارة غير متاحة.');
      return;
    }

    setSaving(true);
    setError('');
    const now = new Date().toISOString();
    const common = {
      id: mode === 'edit' && initialRecord ? initialRecord.id : crypto.randomUUID(),
      amountHalalas,
      date,
      scope,
      projectId: scope === 'work' && projectId ? projectId : undefined,
      paymentMethodId: paymentMethodId || undefined,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: mode === 'edit' && initialRecord ? initialRecord.createdAt : now,
    };
    const record: TransactionRecord =
      kind === 'expense'
        ? { ...common, categoryId }
        : { ...common, category: categoryId };

    try {
      await onSave(record);
    } catch {
      setError('تعذر حفظ الحركة محليًا. حاول مرة أخرى.');
      setSaving(false);
    }
  }

  const title =
    mode === 'edit'
      ? kind === 'expense'
        ? 'تعديل المصروف'
        : 'تعديل الدخل'
      : mode === 'duplicate'
        ? kind === 'expense'
          ? 'نسخ المصروف'
          : 'نسخ الدخل'
        : kind === 'expense'
          ? 'إضافة مصروف'
          : 'إضافة دخل';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-form-title"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                kind === 'expense'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {kind === 'expense' ? (
                <ArrowUpFromLine className="h-5 w-5" />
              ) : (
                <ArrowDownToLine className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 id="transaction-form-title" className="font-bold text-lg">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground">تُحفظ البيانات على هذا الجهاز فقط</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="إغلاق النموذج"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 p-5">
          {error && (
            <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المبلغ (ر.س)" htmlFor="transaction-amount" required>
              <input
                id="transaction-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                autoFocus
                className="field-input text-lg font-bold"
                dir="ltr"
              />
            </Field>
            <Field label="التاريخ" htmlFor="transaction-date" required>
              <input
                id="transaction-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="field-input"
                dir="ltr"
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">نوع الحركة <span className="text-destructive">*</span></legend>
            <div className="grid grid-cols-2 gap-3">
              {(['personal', 'work'] as FinanceScope[]).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-2xl border p-3 text-center text-sm font-medium transition-colors ${
                    scope === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="transaction-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="sr-only"
                  />
                  {value === 'work'
                    ? kind === 'expense'
                      ? 'مصروف عمل'
                      : 'دخل عمل'
                    : kind === 'expense'
                      ? 'مصروف شخصي'
                      : 'دخل شخصي'}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={kind === 'expense' ? 'التصنيف' : 'المصدر / التصنيف'}
              htmlFor="transaction-category"
              required
            >
              <select
                id="transaction-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="field-input"
              >
                <option value="">اختر التصنيف</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={kind === 'expense' ? 'طريقة الدفع' : 'طريقة الاستلام'} htmlFor="transaction-payment">
              <select
                id="transaction-payment"
                value={paymentMethodId}
                onChange={(event) => setPaymentMethodId(event.target.value)}
                className="field-input"
              >
                <option value="">بدون تحديد</option>
                {activePaymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {scope === 'work' && (
            <Field label="المشروع (اختياري)" htmlFor="transaction-project">
              <select
                id="transaction-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="field-input"
              >
                <option value="">مصروف/دخل عمل عام بدون مشروع</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {availableProjects.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">ستظهر المشاريع هنا بعد إضافتها في المرحلة التالية.</p>
              )}
            </Field>
          )}

          <Field label="البيان (اختياري)" htmlFor="transaction-description">
            <input
              id="transaction-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={kind === 'expense' ? 'مثال: شراء أدوات' : 'مثال: دفعة من العميل'}
              className="field-input"
            />
          </Field>
          <Field label="الملاحظات (اختياري)" htmlFor="transaction-notes">
            <textarea
              id="transaction-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="أضف أي تفاصيل تساعدك لاحقًا"
              rows={3}
              className="field-input resize-y"
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="secondary-button">
              إلغاء
            </button>
            <button type="submit" disabled={saving} className="primary-button disabled:cursor-wait disabled:opacity-60">
              {saving ? 'جارٍ الحفظ...' : 'حفظ الحركة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm">
      <span className="mb-2 block font-bold">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}