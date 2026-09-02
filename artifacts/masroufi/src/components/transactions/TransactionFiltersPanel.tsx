import { Filter, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { TransactionFilters } from '@/lib/transactions';
import type { Category, PaymentMethod, Project } from '@/types/finance';

interface TransactionFiltersPanelProps {
  kind: 'expense' | 'income';
  filters: TransactionFilters;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  projects: Project[];
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  onChange: (filters: TransactionFilters) => void;
  onClear: () => void;
}

export function TransactionFiltersPanel({
  kind,
  filters,
  categories,
  paymentMethods,
  projects,
  filtersOpen,
  onFiltersOpenChange,
  onChange,
  onClear,
}: TransactionFiltersPanelProps) {
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== '' && !(key === 'scope' && value === 'all'),
  );
  const update = <K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">البحث</span>
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder={kind === 'expense' ? 'ابحث في المصروفات...' : 'ابحث في الدخل...'}
            className="field-input pr-10"
          />
        </label>
        <button
          type="button"
          onClick={() => onFiltersOpenChange(!filtersOpen)}
          className={`secondary-button relative ${filtersOpen ? 'border-primary text-primary' : ''}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          الفلاتر
          {hasFilters && <span className="h-2 w-2 rounded-full bg-primary" aria-label="فلاتر مفعلة" />}
        </button>
      </div>

      {filtersOpen && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Filter className="h-4 w-4 text-primary" />
            تصفية النتائج
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FilterField label="من تاريخ">
              <input type="date" value={filters.fromDate} onChange={(event) => update('fromDate', event.target.value)} className="field-input" dir="ltr" />
            </FilterField>
            <FilterField label="إلى تاريخ">
              <input type="date" value={filters.toDate} onChange={(event) => update('toDate', event.target.value)} className="field-input" dir="ltr" />
            </FilterField>
            <FilterField label="النوع">
              <select value={filters.scope} onChange={(event) => update('scope', event.target.value as TransactionFilters['scope'])} className="field-input">
                <option value="all">الكل</option>
                <option value="work">{kind === 'expense' ? 'مصروف عمل' : 'دخل عمل'}</option>
                <option value="personal">{kind === 'expense' ? 'مصروف شخصي' : 'دخل شخصي'}</option>
              </select>
            </FilterField>
            <FilterField label={kind === 'expense' ? 'التصنيف' : 'المصدر / التصنيف'}>
              <select value={filters.categoryId} onChange={(event) => update('categoryId', event.target.value)} className="field-input">
                <option value="">كل التصنيفات</option>
                {categories.filter((category) => category.kind === kind).map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="المشروع">
              <select value={filters.projectId} onChange={(event) => update('projectId', event.target.value)} className="field-input">
                <option value="">كل المشاريع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label={kind === 'expense' ? 'طريقة الدفع' : 'طريقة الاستلام'}>
              <select value={filters.paymentMethodId} onChange={(event) => update('paymentMethodId', event.target.value)} className="field-input">
                <option value="">كل الطرق</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </FilterField>
          </div>
          <button type="button" onClick={onClear} disabled={!hasFilters} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
            <RotateCcw className="h-4 w-4" />
            مسح الفلاتر
          </button>
        </div>
      )}
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}