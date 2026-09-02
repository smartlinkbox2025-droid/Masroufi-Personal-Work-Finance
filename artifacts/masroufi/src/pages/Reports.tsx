import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { BriefcaseBusiness, CalendarRange, Download, FileDown, FileText, UserRound, WalletCards } from 'lucide-react';
import { getCategories, getExpenses, getIncomes, getPaymentMethods, getProjects } from '@/db/database';
import { formatSAR } from '@/lib/currency';
import { projectStatusLabel } from '@/lib/projects';
import {
  aggregateExpenseCategories, aggregateExpenseProjects, aggregateIncomeCategories,
  aggregatePaymentMethods, calculateAnnualReport, calculatePeriodSummary,
  calculatePersonalReport, calculateProjectReport, calculateWorkReport,
  currentMonthPeriod, listPeriodTransactions, monthPeriod, periodFromDates,
  type BreakdownRow, type PeriodSummary, type ReportPeriod, type ReportSources,
  type ReportTransaction,
} from '@/lib/reports';
import {
  exportAnnualReportToExcel,
  exportMonthlyReportToExcel,
  exportPersonalReportToExcel,
  exportProjectReportToExcel,
  exportWorkReportToExcel,
} from '@/lib/export';
import { exportReportElementToPdf } from '@/lib/pdf';

type ReportTab = 'monthly' | 'annual' | 'work' | 'personal' | 'project';
const tabItems: Array<{ id: ReportTab; label: string; icon: typeof FileText }> = [
  { id: 'monthly', label: 'الشهري', icon: CalendarRange },
  { id: 'annual', label: 'السنوي', icon: FileText },
  { id: 'work', label: 'العمل', icon: BriefcaseBusiness },
  { id: 'personal', label: 'الشخصي', icon: UserRound },
  { id: 'project', label: 'المشروع', icon: WalletCards },
];

export default function Reports() {
  const now = new Date();
  const [sources, setSources] = useState<ReportSources | null>(null);
  const [tab, setTab] = useState<ReportTab>('monthly');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [annualYear, setAnnualYear] = useState(now.getFullYear());
  const defaults = currentMonthPeriod(now);
  const [workFrom, setWorkFrom] = useState(defaults.from);
  const [workTo, setWorkTo] = useState(defaults.to);
  const [personalFrom, setPersonalFrom] = useState(defaults.from);
  const [personalTo, setPersonalTo] = useState(defaults.to);
  const [projectId, setProjectId] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void Promise.all([getExpenses(), getIncomes(), getProjects(), getCategories(), getPaymentMethods()]).then(([expenses, incomes, projects, categories, paymentMethods]) => {
      const loaded = { expenses, incomes, projects, categories, paymentMethods };
      setSources(loaded);
      setProjectId((current) => current || projects[0]?.id || '');
    });
  }, []);
  if (!sources) return <div className="mx-auto max-w-7xl p-4 md:p-8"><div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">جارٍ إعداد التقارير من بيانات الجهاز...</div></div>;
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <header><h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl"><FileText className="h-7 w-7 text-primary" />مركز التقارير المالية</h1><p className="mt-2 text-sm text-muted-foreground">تقارير رقمية دقيقة من الحركات الفعلية، دون رسوم بيانية أو بيانات مخزنة مسبقًا.</p></header>
      <nav className="overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-sm"><div className="flex min-w-max gap-1">{tabItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${tab === id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><Icon className="h-4 w-4" />{label}</button>)}</div></nav>
       <div ref={reportRef}>
         {tab === 'monthly' && <MonthlyReport reportRef={reportRef} sources={sources} month={month} year={year} setMonth={setMonth} setYear={setYear} />}
         {tab === 'annual' && <AnnualReportView reportRef={reportRef} sources={sources} year={annualYear} setYear={setAnnualYear} />}
         {tab === 'work' && <WorkReportView reportRef={reportRef} sources={sources} from={workFrom} to={workTo} setFrom={setWorkFrom} setTo={setWorkTo} />}
         {tab === 'personal' && <PersonalReportView reportRef={reportRef} sources={sources} from={personalFrom} to={personalTo} setFrom={setPersonalFrom} setTo={setPersonalTo} />}
         {tab === 'project' && <ProjectReportView reportRef={reportRef} sources={sources} projectId={projectId} setProjectId={setProjectId} />}
       </div>
    </div>
  );
}

function MonthlyReport({ reportRef, sources, month, year, setMonth, setYear }: { reportRef: RefObject<HTMLDivElement | null>; sources: ReportSources; month: number; year: number; setMonth: (value: number) => void; setYear: (value: number) => void }) {
  const period = monthPeriod(year, month);
  const summary = calculatePeriodSummary(sources, period);
  const expenseCategories = aggregateExpenseCategories(sources, period);
  const projectRows = aggregateExpenseProjects(sources, period);
  const methods = aggregatePaymentMethods(sources, period);
  const incomeCategories = aggregateIncomeCategories(sources, period);
  const transactions = listPeriodTransactions(sources, period);
  const title = `التقرير الشهري — ${period.label}`;
  return <ReportShell reportRef={reportRef} title={title} onExportExcel={() => exportMonthlyReportToExcel(sources, period)} filters={<><SelectMonth value={month} onChange={setMonth} /><YearInput value={year} onChange={setYear} /></>}>
    <SummaryCards summary={summary} />
    {!transactions.length && <EmptyReport />}
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="المصروفات حسب التصنيف"><BreakdownTable rows={expenseCategories} typeColumn /></ReportCard><ReportCard title="المصروفات حسب المشروع"><ProjectExpenseTable rows={projectRows} /></ReportCard><ReportCard title="المصروفات حسب طريقة الدفع"><BreakdownTable rows={methods} /></ReportCard><ReportCard title="الدخل حسب المصدر / التصنيف"><BreakdownTable rows={incomeCategories} typeColumn /></ReportCard></div>
    <ReportCard title="جميع الحركات المالية في الفترة"><TransactionsTable rows={transactions} /></ReportCard>
  </ReportShell>;
}

function AnnualReportView({ reportRef, sources, year, setYear }: { reportRef: RefObject<HTMLDivElement | null>; sources: ReportSources; year: number; setYear: (value: number) => void }) {
  const report = calculateAnnualReport(sources, year);
  const hasData = report.summary.incomeCount + report.summary.expenseCount > 0;
  const title = `التقرير السنوي — ${year}`;
  return <ReportShell reportRef={reportRef} title={title} onExportExcel={() => exportAnnualReportToExcel(sources, year)} filters={<YearInput value={year} onChange={setYear} />}>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><MoneyCard label="إجمالي الدخل" value={report.summary.totalIncome} /><MoneyCard label="إجمالي المصروفات" value={report.summary.totalExpenses} negative /><MoneyCard label="صافي التدفق" value={report.summary.net} negative={report.summary.net < 0} /><MoneyCard label="متوسط الدخل الشهري" value={Math.round(report.averageIncome)} /><MoneyCard label="متوسط المصروف الشهري" value={Math.round(report.averageExpenses)} negative /></div>
    {!hasData && <EmptyReport />}
    <ReportCard title="تفصيل الأشهر الاثني عشر"><div className="overflow-x-auto"><table className="report-table"><thead><tr><th>الشهر</th><th>الدخل</th><th>المصروف</th><th>الصافي</th></tr></thead><tbody>{report.months.map((row) => <tr key={row.month}><td>{row.label}</td><MoneyCell value={row.totalIncome} /><MoneyCell value={row.totalExpenses} /><MoneyCell value={row.net} /></tr>)}<tr className="font-black"><td>الإجمالي</td><MoneyCell value={report.summary.totalIncome} /><MoneyCell value={report.summary.totalExpenses} /><MoneyCell value={report.summary.net} /></tr></tbody></table></div></ReportCard>
    <ReportCard title="مؤشرات السنة"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Insight label="أعلى شهر مصروفات" value={hasData && report.highestExpenseMonth ? `${report.highestExpenseMonth.label} · ${formatSAR(report.highestExpenseMonth.totalExpenses)}` : 'لا توجد بيانات كافية'} /><Insight label="أقل شهر مصروفات يحتوي بيانات" value={report.lowestExpenseMonth ? `${report.lowestExpenseMonth.label} · ${formatSAR(report.lowestExpenseMonth.totalExpenses)}` : 'لا توجد بيانات كافية'} /><Insight label="أعلى شهر دخل" value={hasData && report.highestIncomeMonth ? `${report.highestIncomeMonth.label} · ${formatSAR(report.highestIncomeMonth.totalIncome)}` : 'لا توجد بيانات كافية'} /><Insight label="أعلى تصنيف مصروفات" value={report.topExpenseCategory ? `${report.topExpenseCategory.name} · ${formatSAR(report.topExpenseCategory.amount)}` : 'لا توجد بيانات كافية'} /><Insight label="مصروفات العمل" value={formatSAR(report.summary.workExpenses)} /><Insight label="المصروفات الشخصية" value={formatSAR(report.summary.personalExpenses)} /></div></ReportCard>
  </ReportShell>;
}

function WorkReportView({ reportRef, sources, from, to, setFrom, setTo }: RangeViewProps & { reportRef: RefObject<HTMLDivElement | null> }) {
  const period = periodFromDates(from, to);
  if (!period) return <ReportShell reportRef={reportRef} title="تقرير العمل" filters={<DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />}><InvalidRange /></ReportShell>;
  const report = calculateWorkReport(sources, period);
  const transactions = listPeriodTransactions(sources, period).filter((row) => row.scope === 'work');
  const title = `تقرير العمل — ${period.label}`;
  return <ReportShell reportRef={reportRef} title={title} onExportExcel={() => exportWorkReportToExcel(sources, period)} filters={<DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />}>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><MoneyCard label="دخل العمل" value={report.summary.workIncome} /><MoneyCard label="مصروفات العمل" value={report.summary.workExpenses} negative /><MoneyCard label="صافي تدفق العمل" value={report.workNet} negative={report.workNet < 0} /><MoneyCard label="مصروفات المشاريع" value={report.projectExpenses} negative /><MoneyCard label="مصروفات عمل عامة — بدون مشروع" value={report.generalExpenses} negative /><Insight label="مشاريع لديها حركات في الفترة" value={String(report.activeProjects)} /></div>
    {!transactions.length && <EmptyReport />}
    <ReportCard title="المشاريع داخل الفترة المختارة"><div className="overflow-x-auto"><table className="report-table"><thead><tr><th>المشروع</th><th>الدخل</th><th>المصروف</th><th>الصافي</th></tr></thead><tbody>{report.projectRows.map((row) => <tr key={row.id}><td>{row.name}</td><MoneyCell value={row.income} /><MoneyCell value={row.expenses} /><MoneyCell value={row.net} /></tr>)}</tbody></table>{!report.projectRows.length && <TableEmpty />}</div></ReportCard>
    <ReportCard title="حركات العمل"><TransactionsTable rows={transactions} /></ReportCard>
  </ReportShell>;
}

function PersonalReportView({ reportRef, sources, from, to, setFrom, setTo }: RangeViewProps & { reportRef: RefObject<HTMLDivElement | null> }) {
  const period = periodFromDates(from, to);
  if (!period) return <ReportShell reportRef={reportRef} title="التقرير الشخصي" filters={<DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />}><InvalidRange /></ReportShell>;
  const report = calculatePersonalReport(sources, period);
  const transactions = listPeriodTransactions(sources, period).filter((row) => row.scope === 'personal');
  const title = `التقرير الشخصي — ${period.label}`;
  return <ReportShell reportRef={reportRef} title={title} onExportExcel={() => exportPersonalReportToExcel(sources, period)} filters={<DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />}>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><MoneyCard label="الدخل الشخصي" value={report.summary.personalIncome} /><MoneyCard label="المصروفات الشخصية" value={report.summary.personalExpenses} negative /><MoneyCard label="صافي التدفق الشخصي" value={report.personalNet} negative={report.personalNet < 0} /><Insight label="حركات الدخل" value={String(sources.incomes.filter((item) => item.scope === 'personal' && item.date >= period.from && item.date <= period.to).length)} /><Insight label="حركات المصروفات" value={String(sources.expenses.filter((item) => item.scope === 'personal' && item.date >= period.from && item.date <= period.to).length)} /></div>
    {!transactions.length && <EmptyReport />}
    <ReportCard title="المصروفات الشخصية حسب التصنيف"><BreakdownTable rows={report.expenseCategories} /></ReportCard>
    <ReportCard title="الحركات الشخصية"><TransactionsTable rows={transactions} /></ReportCard>
  </ReportShell>;
}

function ProjectReportView({ reportRef, sources, projectId, setProjectId }: { reportRef: RefObject<HTMLDivElement | null>; sources: ReportSources; projectId: string; setProjectId: (value: string) => void }) {
  const report = calculateProjectReport(sources, projectId);
  return <ReportShell reportRef={reportRef} title="تقرير المشروع" onExportExcel={report ? () => exportProjectReportToExcel(sources, projectId) : undefined} filters={<label className="min-w-56"><span className="mb-1 block text-xs font-bold">المشروع</span><select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field-input"><option value="">اختر مشروعًا</option>{sources.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}>
    {!report ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">اختر مشروعًا لعرض تقريره الكامل.</div> : <>
      <ReportCard title={report.project.name}><div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Insight label="العميل" value={report.project.client ?? '—'} /><Insight label="الموقع" value={report.project.location ?? '—'} /><Insight label="الحالة" value={projectStatusLabel(report.project.status)} /><Insight label="قيمة العقد" value={report.project.contractValueHalalas === undefined ? 'غير محددة' : formatSAR(report.project.contractValueHalalas)} /><Insight label="الميزانية" value={report.project.budgetHalalas === undefined ? 'غير محددة' : formatSAR(report.project.budgetHalalas)} /><Insight label="المتبقي من العقد" value={report.financials.contractRemaining === null ? 'غير محدد' : formatSAR(report.financials.contractRemaining)} /><Insight label="المتبقي من الميزانية" value={report.financials.remainingBudget === null ? 'غير محدد' : formatSAR(report.financials.remainingBudget)} /><Insight label="استهلاك الميزانية" value={report.financials.budgetUsagePercent === null ? 'غير محدد' : `${report.financials.budgetUsagePercent.toFixed(1)}%`} /></div></ReportCard>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><MoneyCard label="الدخل المستلم" value={report.financials.receivedIncome} /><MoneyCard label="إجمالي المصروفات" value={report.financials.expenses} negative /><MoneyCard label="صافي التدفق" value={report.financials.cashFlow} negative={report.financials.cashFlow < 0} /><MoneyCard label="تجاوز الميزانية" value={report.financials.budgetOverrun} negative={report.financials.budgetOverrun > 0} /><MoneyCard label="زيادة التحصيل" value={report.financials.contractOverpayment} /></div>
      {!report.transactions.length && <EmptyReport />}
      <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="الدفعات المستلمة"><SimpleRecords rows={report.incomeRecords} /></ReportCard><ReportCard title="المصروفات"><SimpleRecords rows={report.expenseRecords} negative /></ReportCard></div>
      <ReportCard title="مصروفات المشروع حسب التصنيف"><BreakdownTable rows={report.expenseCategories} /></ReportCard>
      <ReportCard title="جميع الحركات المالية للمشروع"><TransactionsTable rows={report.transactions} /></ReportCard>
    </>}
  </ReportShell>;
}

interface RangeViewProps { sources: ReportSources; from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }
function ReportShell({ reportRef, title, filters, children, onExportExcel }: { reportRef: RefObject<HTMLDivElement | null>; title: string; filters: ReactNode; children: ReactNode; onExportExcel?: () => void }) {
  const exportPdf = () => {
    if (reportRef.current) void exportReportElementToPdf(reportRef.current, title);
  };
  return <div className="space-y-4">
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold text-primary">مصروفي · تقرير رقمي</p>
        <h2 className="mt-1 text-xl font-black">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">تاريخ إنشاء التقرير: <span dir="ltr">{new Date().toLocaleString('ar-SA')}</span></p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {filters}
        <div className="flex gap-2">
          {onExportExcel && <button type="button" onClick={onExportExcel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary hover:bg-primary/10"><Download className="h-4 w-4" />تصدير Excel</button>}
          {onExportExcel && <button type="button" onClick={exportPdf} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold hover:bg-muted"><FileDown className="h-4 w-4" />تصدير PDF</button>}
        </div>
      </div>
    </div>
    {children}
  </div>;
}
function SummaryCards({ summary }: { summary: PeriodSummary }) { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><MoneyCard label="إجمالي الدخل" value={summary.totalIncome} /><MoneyCard label="إجمالي المصروفات" value={summary.totalExpenses} negative /><MoneyCard label="صافي التدفق النقدي" value={summary.net} negative={summary.net < 0} /><MoneyCard label="دخل العمل" value={summary.workIncome} /><MoneyCard label="مصروفات العمل" value={summary.workExpenses} negative /><MoneyCard label="الدخل الشخصي" value={summary.personalIncome} /><MoneyCard label="المصروفات الشخصية" value={summary.personalExpenses} negative /></div>; }
function MoneyCard({ label, value, negative }: { label: string; value: number; negative?: boolean }) { return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-lg font-black ${negative ? 'text-destructive' : 'text-primary'}`} dir="ltr">{formatSAR(value)}</p></div>; }
function Insight({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function ReportCard({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"><h3 className="mb-4 font-black">{title}</h3>{children}</section>; }
function BreakdownTable({ rows, typeColumn }: { rows: BreakdownRow[]; typeColumn?: boolean }) { return <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>التصنيف</th>{typeColumn && <th>النوع</th>}<th>عدد الحركات</th><th>المبلغ</th><th>النسبة</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`breakdown-${row.id || index}-${index}`}><td>{row.name}</td>{typeColumn && <td>{row.typeLabel}</td>}<td>{row.count}</td><MoneyCell value={row.amount} /><td dir="ltr">{row.percentage.toFixed(2)}%</td></tr>)}</tbody></table>{!rows.length && <TableEmpty />}</div>; }
function ProjectExpenseTable({ rows }: { rows: ReturnType<typeof aggregateExpenseProjects> }) { return <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>المشروع</th><th>عدد الحركات</th><th>المصروفات</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td><MoneyCell value={row.expenses} /></tr>)}</tbody></table>{!rows.length && <TableEmpty />}</div>; }
function TransactionsTable({ rows }: { rows: ReportTransaction[] }) { return <div className="overflow-x-auto"><table className="report-table min-w-[900px]"><thead><tr><th>التاريخ</th><th>دخل / مصروف</th><th>عمل / شخصي</th><th>التصنيف</th><th>المشروع</th><th>البيان</th><th>طريقة الدفع / الاستلام</th><th>المبلغ</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.kind}-${row.id}`}><td dir="ltr">{row.date}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.kind === 'income' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{row.kind === 'income' ? 'دخل' : 'مصروف'}</span></td><td>{row.scope === 'work' ? 'عمل' : 'شخصي'}</td><td>{row.categoryName}</td><td>{row.projectName}</td><td>{row.description}</td><td>{row.methodName}</td><MoneyCell value={row.amount} /></tr>)}</tbody></table>{!rows.length && <TableEmpty />}</div>; }
function SimpleRecords({ rows, negative }: { rows: Array<{ id: string; date: string; description?: string; amountHalalas: number }>; negative?: boolean }) { return rows.length ? <div className="divide-y divide-border">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><strong dir="ltr">{row.date}</strong><p className="mt-1 text-xs text-muted-foreground">{row.description ?? 'بدون بيان'}</p></div><strong className={negative ? 'text-destructive' : 'text-primary'} dir="ltr">{formatSAR(row.amountHalalas)}</strong></div>)}</div> : <TableEmpty />; }
function MoneyCell({ value }: { value: number }) { return <td className={value < 0 ? 'text-destructive' : ''} dir="ltr">{formatSAR(value)}</td>; }
function SelectMonth({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <label><span className="mb-1 block text-xs font-bold">الشهر</span><select value={value} onChange={(e) => onChange(Number(e.target.value))} className="field-input"><option value={1}>يناير</option><option value={2}>فبراير</option><option value={3}>مارس</option><option value={4}>أبريل</option><option value={5}>مايو</option><option value={6}>يونيو</option><option value={7}>يوليو</option><option value={8}>أغسطس</option><option value={9}>سبتمبر</option><option value={10}>أكتوبر</option><option value={11}>نوفمبر</option><option value={12}>ديسمبر</option></select></label>; }
function YearInput({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <label><span className="mb-1 block text-xs font-bold">السنة</span><input type="number" min="2000" max="2100" value={value} onChange={(e) => onChange(Number(e.target.value))} className="field-input w-full sm:w-32" dir="ltr" /></label>; }
function DateRange({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }) { return <><label><span className="mb-1 block text-xs font-bold">من تاريخ</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-input" dir="ltr" /></label><label><span className="mb-1 block text-xs font-bold">إلى تاريخ</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-input" dir="ltr" /></label></>; }
function EmptyReport() { return <div className="rounded-2xl border border-dashed border-border bg-card p-7 text-center"><p className="font-bold">لا توجد حركات مالية في الفترة المحددة</p><p className="mt-1 text-sm text-muted-foreground">تظهر قيم الملخص صفرًا حتى تضيف حركات في هذه الفترة.</p></div>; }
function InvalidRange() { return <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5 text-sm font-bold text-destructive">تاريخ البداية يجب أن يسبق تاريخ النهاية</div>; }
function TableEmpty() { return <p className="py-6 text-center text-sm text-muted-foreground">لا توجد بيانات لهذا الجدول.</p>; }