import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, BadgeDollarSign, Plus } from 'lucide-react';
import { TransactionFiltersPanel } from '@/components/transactions/TransactionFiltersPanel';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/transactions/TransactionList';
import {
  deleteIncome,
  getCategories,
  getIncomes,
  getPaymentMethods,
  getProjects,
  saveIncome,
} from '@/db/database';
import { toast } from '@/hooks/use-toast';
import { totalIncome } from '@/lib/calculations';
import { formatSAR } from '@/lib/currency';
import {
  EMPTY_TRANSACTION_FILTERS,
  filterIncomes,
  type TransactionFilters,
} from '@/lib/transactions';
import type { Category, Income as IncomeRecord, PaymentMethod, Project } from '@/types/finance';

type FormMode = 'create' | 'edit' | 'duplicate';

export default function Income() {
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<IncomeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    void Promise.all([getIncomes(), getCategories(), getPaymentMethods(), getProjects()])
      .then(([storedIncomes, storedCategories, storedMethods, storedProjects]) => {
        setIncomes(storedIncomes);
        setCategories(storedCategories);
        setPaymentMethods(storedMethods);
        setProjects(storedProjects);
      })
      .catch(() => setLoadError('تعذر قراءة حركات الدخل المحفوظة على هذا الجهاز.'))
      .finally(() => setLoading(false));
  }, []);

  const visibleIncomes = useMemo(
    () => filterIncomes(incomes, filters, categories, paymentMethods, projects),
    [incomes, filters, categories, paymentMethods, projects],
  );

  function openForm(mode: FormMode, income: IncomeRecord | null = null) {
    setSelectedIncome(income);
    setFormMode(mode);
  }

  async function handleSave(record: IncomeRecord) {
    await saveIncome(record);
    setIncomes((current) => {
      const exists = current.some((income) => income.id === record.id);
      return exists
        ? current.map((income) => (income.id === record.id ? record : income))
        : [record, ...current];
    });
    setFormMode(null);
    setSelectedIncome(null);
    toast({
      title:
        formMode === 'edit'
          ? 'تم تحديث الدخل بنجاح'
          : formMode === 'duplicate'
            ? 'تم نسخ الدخل بنجاح'
            : 'تم تسجيل الدخل بنجاح',
    });
  }

  async function handleDelete(income: IncomeRecord) {
    if (!window.confirm('هل أنت متأكد من حذف حركة الدخل هذه؟')) return;
    try {
      await deleteIncome(income.id);
      setIncomes((current) => current.filter((item) => item.id !== income.id));
      toast({ title: 'تم حذف حركة الدخل' });
    } catch {
      toast({ title: 'تعذر حذف حركة الدخل', variant: 'destructive' });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ArrowDownToLine className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black md:text-3xl">الدخل</h1>
          </div>
          <p className="text-sm text-muted-foreground">أدر دخلك الشخصي ومدفوعات العمل بدقة ومن مكان واحد.</p>
        </div>
        <button type="button" onClick={() => openForm('create')} className="primary-button">
          <Plus className="h-5 w-5" />
          إضافة دخل
        </button>
      </header>

      <TransactionFiltersPanel
        kind="income"
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
          <p className="mt-1 text-2xl font-black">{visibleIncomes.length}</p>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">إجمالي الدخل المعروض</p>
          <p className="mt-1 text-2xl font-black text-primary" dir="ltr">
            {formatSAR(totalIncome(visibleIncomes))}
          </p>
        </div>
      </section>

      {loadError && <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">جارٍ تحميل الدخل...</div>
      ) : visibleIncomes.length > 0 ? (
        <TransactionList
          kind="income"
          records={visibleIncomes}
          categories={categories}
          paymentMethods={paymentMethods}
          projects={projects}
          onEdit={(record) => openForm('edit', record as IncomeRecord)}
          onDuplicate={(record) => openForm('duplicate', record as IncomeRecord)}
          onDelete={(record) => void handleDelete(record as IncomeRecord)}
        />
      ) : (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BadgeDollarSign className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">
            {incomes.length === 0 ? 'لا توجد حركات دخل حتى الآن' : 'لا توجد نتائج مطابقة'}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {incomes.length === 0
              ? 'سجّل أول دخل ليبقى محفوظًا محليًا ويمكنك الرجوع إليه دون اتصال.'
              : 'جرّب تغيير البحث أو مسح الفلاتر الحالية.'}
          </p>
          {incomes.length === 0 ? (
            <button type="button" onClick={() => openForm('create')} className="primary-button mt-5">
              <Plus className="h-4 w-4" />
              إضافة أول دخل
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
          kind="income"
          mode={formMode}
          initialRecord={selectedIncome}
          categories={categories}
          paymentMethods={paymentMethods}
          projects={projects}
          onClose={() => {
            setFormMode(null);
            setSelectedIncome(null);
          }}
          onSave={(record) => handleSave(record as IncomeRecord)}
        />
      )}
    </div>
  );
}