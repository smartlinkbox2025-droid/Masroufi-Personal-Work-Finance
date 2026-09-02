import { useEffect, useMemo, useState } from 'react';
import { Plus, ReceiptText, Wallet } from 'lucide-react';
import { TransactionFiltersPanel } from '@/components/transactions/TransactionFiltersPanel';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/transactions/TransactionList';
import {
  deleteExpense,
  getCategories,
  getExpenses,
  getPaymentMethods,
  getProjects,
  saveExpense,
} from '@/db/database';
import { toast } from '@/hooks/use-toast';
import { totalExpenses } from '@/lib/calculations';
import { formatSAR } from '@/lib/currency';
import {
  EMPTY_TRANSACTION_FILTERS,
  filterExpenses,
  type TransactionFilters,
} from '@/lib/transactions';
import type { Category, Expense, PaymentMethod, Project } from '@/types/finance';

type FormMode = 'create' | 'edit' | 'duplicate';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    void Promise.all([
      getExpenses(),
      getCategories(),
      getPaymentMethods(),
      getProjects(),
    ])
      .then(([storedExpenses, storedCategories, storedMethods, storedProjects]) => {
        setExpenses(storedExpenses);
        setCategories(storedCategories);
        setPaymentMethods(storedMethods);
        setProjects(storedProjects);
      })
      .catch(() => setLoadError('تعذر قراءة المصروفات المحفوظة على هذا الجهاز.'))
      .finally(() => setLoading(false));
  }, []);

  const visibleExpenses = useMemo(
    () => filterExpenses(expenses, filters, categories, paymentMethods, projects),
    [expenses, filters, categories, paymentMethods, projects],
  );

  function openForm(mode: FormMode, expense: Expense | null = null) {
    setSelectedExpense(expense);
    setFormMode(mode);
  }

  async function handleSave(record: Expense) {
    await saveExpense(record);
    setExpenses((current) => {
      const exists = current.some((expense) => expense.id === record.id);
      return exists
        ? current.map((expense) => (expense.id === record.id ? record : expense))
        : [record, ...current];
    });
    setFormMode(null);
    setSelectedExpense(null);
    toast({
      title:
        formMode === 'edit'
          ? 'تم تحديث المصروف بنجاح'
          : formMode === 'duplicate'
            ? 'تم نسخ المصروف بنجاح'
            : 'تم تسجيل المصروف بنجاح',
    });
  }

  async function handleDelete(expense: Expense) {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      await deleteExpense(expense.id);
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
      toast({ title: 'تم حذف المصروف' });
    } catch {
      toast({ title: 'تعذر حذف المصروف', variant: 'destructive' });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-destructive" />
            <h1 className="text-2xl font-black md:text-3xl">المصروفات</h1>
          </div>
          <p className="text-sm text-muted-foreground">سجّل مصروفك خلال لحظات وتتبّع نفقات العمل والحياة الشخصية.</p>
        </div>
        <button type="button" onClick={() => openForm('create')} className="destructive-button">
          <Plus className="h-5 w-5" />
          إضافة مصروف
        </button>
      </header>

      <TransactionFiltersPanel
        kind="expense"
        filters={filters}
        categories={categories}
        paymentMethods={paymentMethods}
        projects={projects}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_TRANSACTION_FILTERS)}
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">عدد الحركات المعروضة</p>
          <p className="mt-1 text-2xl font-black">{visibleExpenses.length}</p>
        </div>
        <div className="rounded-2xl border border-destructive/15 bg-destructive/5 p-4">
          <p className="text-xs text-muted-foreground">إجمالي المصروفات المعروضة</p>
          <p className="mt-1 text-2xl font-black text-destructive" dir="ltr">
            {formatSAR(totalExpenses(visibleExpenses))}
          </p>
        </div>
      </section>

      {loadError && <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">جارٍ تحميل المصروفات...</div>
      ) : visibleExpenses.length > 0 ? (
        <TransactionList
          kind="expense"
          records={visibleExpenses}
          categories={categories}
          paymentMethods={paymentMethods}
          projects={projects}
          onEdit={(record) => openForm('edit', record as Expense)}
          onDuplicate={(record) => openForm('duplicate', record as Expense)}
          onDelete={(record) => void handleDelete(record as Expense)}
        />
      ) : (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ReceiptText className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">
            {expenses.length === 0 ? 'لا توجد مصروفات حتى الآن' : 'لا توجد نتائج مطابقة'}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {expenses.length === 0
              ? 'ابدأ بأول حركة، وستبقى محفوظة محليًا على هذا الجهاز.'
              : 'جرّب تغيير البحث أو مسح الفلاتر الحالية.'}
          </p>
          {expenses.length === 0 ? (
            <button type="button" onClick={() => openForm('create')} className="destructive-button mt-5">
              <Plus className="h-4 w-4" />
              إضافة أول مصروف
            </button>
          ) : (
            <button type="button" onClick={() => setFilters(EMPTY_TRANSACTION_FILTERS)} className="secondary-button mt-5">
              مسح الفلاتر
            </button>
          )}
        </div>
      )}

      {formMode && (
        <TransactionForm
          kind="expense"
          mode={formMode}
          initialRecord={selectedExpense}
          categories={categories}
          paymentMethods={paymentMethods}
          projects={projects}
          onClose={() => {
            setFormMode(null);
            setSelectedExpense(null);
          }}
          onSave={(record) => handleSave(record as Expense)}
        />
      )}
    </div>
  );
}