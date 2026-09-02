import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Archive, BriefcaseBusiness, Pencil, Plus, ReceiptText, WalletCards } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/transactions/TransactionList';
import { deleteExpense, deleteIncome, getCategories, getExpenses, getIncomes, getPaymentMethods, getProjects, saveExpense, saveIncome, saveProject } from '@/db/database';
import { toast } from '@/hooks/use-toast';
import { formatSAR } from '@/lib/currency';
import { calculateProjectFinancials, projectStatusLabel } from '@/lib/projects';
import { formatArabicDate } from '@/lib/transactions';
import type { Category, Expense, Income, PaymentMethod, Project } from '@/types/finance';

type FormMode = 'create' | 'edit' | 'duplicate';

export default function ProjectDetails() {
  const [, params] = useRoute('/projects/:id');
  const [, navigate] = useLocation();
  const projectId = params?.id;
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [transactionKind, setTransactionKind] = useState<'expense' | 'income' | null>(null);
  const [transactionMode, setTransactionMode] = useState<FormMode>('create');
  const [selectedTransaction, setSelectedTransaction] = useState<Expense | Income | null>(null);

  async function refresh() {
    const [storedProjects, storedExpenses, storedIncomes, storedCategories, storedMethods] = await Promise.all([getProjects(), getExpenses(), getIncomes(), getCategories(), getPaymentMethods()]);
    setProjects(storedProjects); setExpenses(storedExpenses); setIncomes(storedIncomes); setCategories(storedCategories); setMethods(storedMethods);
    setProject(storedProjects.find((item) => item.id === projectId) ?? null);
  }

  useEffect(() => { void refresh(); }, [projectId]);

  const projectExpenses = useMemo(() => expenses.filter((expense) => expense.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date)), [expenses, projectId]);
  const projectIncomes = useMemo(() => incomes.filter((income) => income.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date)), [incomes, projectId]);
  const financials = project ? calculateProjectFinancials(project, incomes, expenses) : null;
  const categoryRows = useMemo(() => {
    const totals = new Map<string, number>();
    projectExpenses.forEach((expense) => totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amountHalalas));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [projectExpenses]);
  const recent = useMemo(() => [...projectExpenses.map((item) => ({ ...item, entryKind: 'expense' as const })), ...projectIncomes.map((item) => ({ ...item, entryKind: 'income' as const }))].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [projectExpenses, projectIncomes]);

  if (!project || !financials) {
    return <div className="mx-auto max-w-4xl p-4 md:p-8"><div className="rounded-2xl border border-border bg-card p-10 text-center"><h1 className="text-xl font-bold">المشروع غير موجود</h1><Link href="/projects" className="primary-button mt-5">العودة إلى المشاريع</Link></div></div>;
  }

  async function saveProjectChanges(updated: Project) {
    await saveProject(updated); setProject(updated); setProjects((current) => current.map((item) => item.id === updated.id ? updated : item)); setProjectFormOpen(false); toast({ title: 'تم تحديث المشروع بنجاح' });
  }
  async function saveTransaction(record: Expense | Income) {
    if ('categoryId' in record) await saveExpense(record); else await saveIncome(record);
    await refresh(); setTransactionKind(null); setSelectedTransaction(null); toast({ title: transactionMode === 'edit' ? 'تم تحديث الحركة' : transactionMode === 'duplicate' ? 'تم نسخ الحركة' : 'تم تسجيل الحركة بنجاح' });
  }
  async function removeExpense(record: Expense) {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    await deleteExpense(record.id); await refresh(); toast({ title: 'تم حذف المصروف وتحديث أرقام المشروع' });
  }
  async function removeIncome(record: Income) {
    if (!window.confirm('هل أنت متأكد من حذف حركة الدخل هذه؟')) return;
    await deleteIncome(record.id); await refresh(); toast({ title: 'تم حذف الدفعة وتحديث أرقام المشروع' });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/projects" className="secondary-button"><ArrowRight className="h-4 w-4" />كل المشاريع</Link><div className="flex gap-2"><button type="button" onClick={() => setProjectFormOpen(true)} className="secondary-button"><Pencil className="h-4 w-4" />تعديل المشروع</button>{project.status !== 'archived' && <button type="button" onClick={() => void saveProjectChanges({ ...project, status: 'archived', updatedAt: new Date().toISOString() })} className="secondary-button"><Archive className="h-4 w-4" />أرشفة</button>}</div></div>
      <header className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-primary"><BriefcaseBusiness className="h-6 w-6" /><span className="text-sm font-bold">تفاصيل المشروع</span></div><h1 className="text-2xl font-black md:text-3xl">{project.name}</h1>{project.client && <p className="mt-2 text-muted-foreground">العميل: {project.client}</p>}</div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">{projectStatusLabel(project.status)}</span></div><div className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{project.location && <Info label="الموقع" value={project.location} />}<Info label="تاريخ البداية" value={formatArabicDate(project.startDate)} />{project.expectedEndDate && <Info label="النهاية المتوقعة" value={formatArabicDate(project.expectedEndDate)} />}</div></header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><FinanceCard label="قيمة العقد" value={project.contractValueHalalas === undefined ? 'غير محددة' : formatSAR(project.contractValueHalalas)} /><FinanceCard label="الدخل المستلم" value={formatSAR(financials.receivedIncome)} tone="positive" /><FinanceCard label="إجمالي المصروفات" value={formatSAR(financials.expenses)} tone="negative" /><FinanceCard label="صافي التدفق النقدي" value={formatSAR(financials.cashFlow)} tone={financials.cashFlow >= 0 ? 'positive' : 'negative'} /></section>
      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="mb-4 font-bold">الميزانية والتحصيل</h2><div className="space-y-3 text-sm"><Row label="الميزانية" value={project.budgetHalalas === undefined ? 'غير محددة' : formatSAR(project.budgetHalalas)} /><Row label="المتبقي من الميزانية" value={financials.remainingBudget === null ? 'غير محدد' : financials.budgetOverrun ? `تجاوز الميزانية: ${formatSAR(financials.budgetOverrun)}` : formatSAR(financials.remainingBudget)} danger={financials.budgetOverrun > 0} /><Row label="استهلاك الميزانية" value={financials.budgetUsagePercent === null ? 'غير محددة' : `${financials.budgetUsagePercent.toFixed(1)}%`} danger={financials.budgetOverrun > 0} /><Row label="المتبقي للتحصيل" value={financials.contractRemaining === null ? 'غير محدد' : financials.contractOverpayment ? `زيادة مستلمة: ${formatSAR(financials.contractOverpayment)}` : formatSAR(financials.contractRemaining)} /></div></div><div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="mb-4 font-bold">المصروفات حسب التصنيف</h2>{categoryRows.length ? <div className="space-y-3">{categoryRows.map(([categoryId, amount]) => <div key={categoryId}><div className="flex justify-between gap-3 text-sm"><span>{categories.find((item) => item.id === categoryId)?.name ?? 'تصنيف غير متاح'}</span><strong dir="ltr">{formatSAR(amount)} · {financials.expenses ? ((amount / financials.expenses) * 100).toFixed(1) : '0'}%</strong></div><div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${financials.expenses ? Math.min((amount / financials.expenses) * 100, 100) : 0}%` }} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد مصروفات مسجلة لهذا المشروع.</p>}</div></section>

      <section className="grid gap-4 lg:grid-cols-2"><TransactionSection title="مصروفات المشروع" icon={<ReceiptText className="h-5 w-5 text-destructive" />} empty="لا توجد مصروفات مسجلة لهذا المشروع" hasRecords={projectExpenses.length > 0} canAdd={project.status !== 'archived'} total={formatSAR(financials.expenses)} action="إضافة مصروف للمشروع" onAdd={() => { setTransactionKind('expense'); setTransactionMode('create'); setSelectedTransaction(null); }}><TransactionList kind="expense" records={projectExpenses} categories={categories} paymentMethods={methods} projects={projects} onEdit={(record) => { setTransactionKind('expense'); setTransactionMode('edit'); setSelectedTransaction(record); }} onDuplicate={(record) => { setTransactionKind('expense'); setTransactionMode('duplicate'); setSelectedTransaction(record); }} onDelete={(record) => void removeExpense(record as Expense)} /></TransactionSection><TransactionSection title="دفعات المشروع" icon={<WalletCards className="h-5 w-5 text-primary" />} empty="لا توجد دفعات مستلمة لهذا المشروع" hasRecords={projectIncomes.length > 0} canAdd={project.status !== 'archived'} total={formatSAR(financials.receivedIncome)} action="إضافة دفعة للمشروع" onAdd={() => { setTransactionKind('income'); setTransactionMode('create'); setSelectedTransaction(null); }}><TransactionList kind="income" records={projectIncomes} categories={categories} paymentMethods={methods} projects={projects} onEdit={(record) => { setTransactionKind('income'); setTransactionMode('edit'); setSelectedTransaction(record); }} onDuplicate={(record) => { setTransactionKind('income'); setTransactionMode('duplicate'); setSelectedTransaction(record); }} onDelete={(record) => void removeIncome(record as Income)} /></TransactionSection></section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="mb-4 font-bold">آخر الحركات المالية</h2>{recent.length ? <div className="divide-y divide-border">{recent.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><span className="font-medium">{record.entryKind === 'income' ? 'دفعة مستلمة' : 'مصروف'}</span><span className="mx-2 text-muted-foreground">·</span><span className="text-muted-foreground">{formatArabicDate(record.date)}{record.description ? ` · ${record.description}` : ''}</span></div><strong className={record.entryKind === 'income' ? 'text-primary' : 'text-destructive'} dir="ltr">{record.entryKind === 'income' ? '+ ' : '− '}{formatSAR(record.amountHalalas)}</strong></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد حركات مالية بعد.</p>}</section>

      {projectFormOpen && <ProjectForm initialProject={project} onClose={() => setProjectFormOpen(false)} onSave={saveProjectChanges} />}
      {transactionKind && <TransactionForm kind={transactionKind} mode={transactionMode} initialRecord={selectedTransaction} defaults={{ scope: 'work', projectId }} categories={categories} paymentMethods={methods} projects={projects} onClose={() => { setTransactionKind(null); setSelectedTransaction(null); }} onSave={saveTransaction} />}
    </div>
  );
}

function FinanceCard({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) { return <div className={`rounded-2xl border p-4 shadow-sm ${tone === 'positive' ? 'border-primary/20 bg-primary/5' : tone === 'negative' ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-card'}`}><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-lg font-black ${tone === 'positive' ? 'text-primary' : tone === 'negative' ? 'text-destructive' : ''}`} dir="ltr">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>; }
function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <div className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><strong className={danger ? 'text-destructive' : ''} dir="ltr">{value}</strong></div>; }
function TransactionSection({ title, icon, empty, hasRecords, canAdd, total, action, onAdd, children }: { title: string; icon: React.ReactNode; empty: string; hasRecords: boolean; canAdd: boolean; total: string; action: string; onAdd: () => void; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2">{icon}<h2 className="font-bold">{title}</h2></div>{canAdd && <button type="button" onClick={onAdd} className="rounded-xl p-2 text-primary hover:bg-primary/10" aria-label={action}><Plus className="h-5 w-5" /></button>}</div><div className="mt-4"><div className="mb-3 rounded-xl bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">الإجمالي: </span><strong dir="ltr">{total}</strong></div>{hasRecords ? children : <div className="rounded-xl border border-dashed border-border p-5 text-center"><p className="text-sm text-muted-foreground">{empty}</p>{canAdd ? <button type="button" onClick={onAdd} className="primary-button mt-4">{action}</button> : <p className="mt-2 text-xs text-muted-foreground">المشروع مؤرشف ولا يقبل حركات جديدة.</p>}</div>}</div></div>; }