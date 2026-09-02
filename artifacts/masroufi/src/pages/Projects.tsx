import { useEffect, useMemo, useState } from 'react';
import { Archive, Briefcase, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { deleteProject, getExpenses, getIncomes, getProjects, saveProject } from '@/db/database';
import { toast } from '@/hooks/use-toast';
import { formatSAR } from '@/lib/currency';
import { calculateProjectFinancials, projectStatusLabel } from '@/lib/projects';
import type { Expense, Income, Project, ProjectStatus } from '@/types/finance';

const statusOrder: ProjectStatus[] = ['active', 'paused', 'completed', 'archived'];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([getProjects(), getExpenses(), getIncomes()])
      .then(([storedProjects, storedExpenses, storedIncomes]) => {
        setProjects(storedProjects);
        setExpenses(storedExpenses);
        setIncomes(storedIncomes);
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleProjects = useMemo(
    () =>
      projects
        .filter((project) => status === 'all' || project.status === status)
        .filter((project) =>
          [project.name, project.client, project.location].some((value) =>
            value?.toLocaleLowerCase('ar').includes(query.trim().toLocaleLowerCase('ar')),
          ),
        )
        .sort(
          (a, b) =>
            statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [projects, query, status],
  );

  async function handleSave(project: Project) {
    await saveProject(project);
    setProjects((current) =>
      current.some((item) => item.id === project.id)
        ? current.map((item) => (item.id === project.id ? project : item))
        : [project, ...current],
    );
    setFormOpen(false);
    setEditingProject(null);
    toast({ title: editingProject ? 'تم تحديث المشروع بنجاح' : 'تم إنشاء المشروع بنجاح' });
  }

  async function archiveProject(project: Project) {
    const archived = { ...project, status: 'archived' as const, updatedAt: new Date().toISOString() };
    await saveProject(archived);
    setProjects((current) => current.map((item) => (item.id === project.id ? archived : item)));
    toast({ title: 'تمت أرشفة المشروع ويمكنك فتحه من فلتر المؤرشف' });
  }

  async function removeProject(project: Project) {
    const linked = expenses.some((expense) => expense.projectId === project.id) ||
      incomes.some((income) => income.projectId === project.id);
    if (linked) {
      toast({
        title: 'لا يمكن حذف مشروع مرتبط بحركات مالية',
        description: 'استخدم الأرشفة بدلًا من الحذف للحفاظ على المصروفات والدفعات.',
        variant: 'destructive',
      });
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا المشروع؟')) return;
    await deleteProject(project.id);
    setProjects((current) => current.filter((item) => item.id !== project.id));
    toast({ title: 'تم حذف المشروع' });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" /><h1 className="text-2xl font-black md:text-3xl">المشاريع</h1></div>
          <p className="text-sm text-muted-foreground">تابع قيمة العقود والدفعات والمصروفات لكل مشروع من مكان واحد.</p>
        </div>
        <button type="button" onClick={() => { setEditingProject(null); setFormOpen(true); }} className="primary-button"><Plus className="h-5 w-5" />إضافة مشروع</button>
      </header>

      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><span className="sr-only">البحث في المشاريع</span><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المشروع أو العميل أو الموقع..." className="field-input pr-10" /></label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | 'all')} className="field-input sm:max-w-48">
            <option value="all">كل الحالات</option><option value="active">نشط</option><option value="paused">متوقف</option><option value="completed">مكتمل</option><option value="archived">مؤرشف</option>
          </select>
        </div>
      </section>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">جارٍ تحميل المشاريع...</div> : visibleProjects.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Briefcase className="h-8 w-8" /></div>
          <h2 className="text-xl font-bold">{projects.length ? 'لا توجد نتائج مطابقة' : 'لا توجد مشاريع حتى الآن'}</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{projects.length ? 'جرّب تغيير البحث أو فلتر الحالة.' : 'أنشئ أول مشروع لتبدأ ربط الدفعات والمصروفات به.'}</p>
          {!projects.length && <button type="button" onClick={() => setFormOpen(true)} className="primary-button mt-5"><Plus className="h-4 w-4" />إضافة مشروع</button>}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleProjects.map((project) => {
            const financials = calculateProjectFinancials(project, incomes, expenses);
            return <article key={project.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><Link href={`/projects/${project.id}`} className="text-lg font-black hover:text-primary">{project.name}</Link>{project.client && <p className="mt-1 text-sm text-muted-foreground">{project.client}</p>}</div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${project.status === 'active' ? 'bg-primary/10 text-primary' : project.status === 'archived' ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'}`}>{projectStatusLabel(project.status)}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="قيمة العقد" value={project.contractValueHalalas === undefined ? '—' : formatSAR(project.contractValueHalalas)} />
                <Metric label="الدخل المستلم" value={formatSAR(financials.receivedIncome)} tone="positive" />
                <Metric label="المصروفات" value={formatSAR(financials.expenses)} tone="negative" />
                <Metric label="صافي التدفق" value={formatSAR(financials.cashFlow)} tone={financials.cashFlow >= 0 ? 'positive' : 'negative'} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Link href={`/projects/${project.id}`} className="secondary-button"><Eye className="h-4 w-4" />التفاصيل</Link>
                <button type="button" onClick={() => { setEditingProject(project); setFormOpen(true); }} className="secondary-button"><Pencil className="h-4 w-4" />تعديل</button>
                {project.status !== 'archived' && <button type="button" onClick={() => void archiveProject(project)} className="secondary-button"><Archive className="h-4 w-4" />أرشفة</button>}
                <button type="button" onClick={() => void removeProject(project)} className="secondary-button text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" />حذف</button>
              </div>
            </article>;
          })}
        </div>
      )}

      {formOpen && <ProjectForm initialProject={editingProject} onClose={() => { setFormOpen(false); setEditingProject(null); }} onSave={handleSave} />}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return <div className="min-w-0 rounded-xl bg-muted/50 p-3"><p className="truncate text-[11px] text-muted-foreground">{label}</p><p className={`mt-1 truncate text-sm font-bold ${tone === 'positive' ? 'text-primary' : tone === 'negative' ? 'text-destructive' : ''}`} dir="ltr">{value}</p></div>;
}