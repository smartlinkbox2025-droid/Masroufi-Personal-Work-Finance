import { Copy, Pencil, Trash2 } from 'lucide-react';
import { formatSAR } from '@/lib/currency';
import { formatArabicDate } from '@/lib/transactions';
import type { Category, Expense, Income, PaymentMethod, Project } from '@/types/finance';

type TransactionRecord = Expense | Income;

interface TransactionListProps {
  kind: 'expense' | 'income';
  records: TransactionRecord[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  projects: Project[];
  onEdit: (record: TransactionRecord) => void;
  onDuplicate: (record: TransactionRecord) => void;
  onDelete: (record: TransactionRecord) => void;
}

function categoryIdOf(record: TransactionRecord): string {
  return 'categoryId' in record ? record.categoryId : record.category;
}

export function TransactionList({
  kind,
  records,
  categories,
  paymentMethods,
  projects,
  onEdit,
  onDuplicate,
  onDelete,
}: TransactionListProps) {
  return (
    <div className="space-y-3">
      {records.map((record) => {
        const category = categories.find((item) => item.id === categoryIdOf(record));
        const method = paymentMethods.find((item) => item.id === record.paymentMethodId);
        const project = projects.find((item) => item.id === record.projectId);
        return (
          <article
            key={record.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      record.scope === 'work'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {record.scope === 'work' ? 'عمل' : 'شخصي'}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {category?.name ?? 'تصنيف غير متاح'}
                  </span>
                </div>
                <p
                  className={`text-2xl font-black tabular-nums ${
                    kind === 'expense' ? 'text-destructive' : 'text-primary'
                  }`}
                  dir="ltr"
                >
                  {kind === 'expense' ? '− ' : '+ '}
                  {formatSAR(record.amountHalalas)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{formatArabicDate(record.date)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <ActionButton label="تعديل" onClick={() => onEdit(record)}>
                  <Pencil className="h-4 w-4" />
                </ActionButton>
                <ActionButton label="نسخ" onClick={() => onDuplicate(record)}>
                  <Copy className="h-4 w-4" />
                </ActionButton>
                <ActionButton destructive label="حذف" onClick={() => onDelete(record)}>
                  <Trash2 className="h-4 w-4" />
                </ActionButton>
              </div>
            </div>

            {(record.description || record.notes || project || method) && (
              <div className="mt-4 border-t border-border pt-3 text-sm">
                {record.description && <p className="font-medium">{record.description}</p>}
                {record.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{record.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {project && <span>المشروع: {project.name}</span>}
                  {method && (
                    <span>{kind === 'expense' ? 'طريقة الدفع' : 'طريقة الاستلام'}: {method.name}</span>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ActionButton({
  label,
  destructive,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}