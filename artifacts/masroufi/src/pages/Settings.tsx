import { useEffect, useState, type FormEvent } from 'react';
import {
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileDown,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  ShieldAlert,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  getAllData,
  getCategories,
  getExpenses,
  getIncomes,
  getPaymentMethods,
  getProjects,
  resetToCleanState,
  saveCategory,
  savePaymentMethod,
} from '@/db/database';
import type { Category, PaymentMethod } from '@/types/finance';
import {
  createBackup,
  downloadBackup,
  readBackupFile,
  restoreBackup,
  type BackupPreview,
} from '@/lib/backup';
import { exportAllDataToExcel } from '@/lib/export';

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryScope, setCategoryScope] = useState<Category['scope']>('personal');
  const [categoryKind, setCategoryKind] = useState<Category['kind']>('expense');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [paymentMethodName, setPaymentMethodName] = useState('');
  const [message, setMessage] = useState('');
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');

  useEffect(() => {
    void Promise.all([getCategories(), getPaymentMethods()]).then(
      ([storedCategories, storedMethods]) => {
        setCategories(storedCategories);
        setPaymentMethods(storedMethods);
      },
    );
  }, []);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    const existingCategory = categories.find((category) => category.id === editingCategoryId);
    const category: Category = {
      id: existingCategory?.id ?? crypto.randomUUID(),
      name,
      scope: existingCategory?.scope ?? categoryScope,
      kind: existingCategory?.kind ?? categoryKind,
      isVisible: true,
      isDefault: existingCategory?.isDefault ?? false,
    };
    await saveCategory(category);
    setCategories((current) =>
      existingCategory
        ? current.map((item) => (item.id === category.id ? category : item))
        : [...current, category],
    );
    setCategoryName('');
    setEditingCategoryId(null);
  }

  function startEditingCategory(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setCategoryKind(category.kind);
    setCategoryScope(category.scope);
    document.getElementById('category-name')?.focus();
  }

  function cancelEditingCategory() {
    setEditingCategoryId(null);
    setCategoryName('');
  }

  async function toggleCategory(category: Category) {
    const updated = { ...category, isVisible: !category.isVisible };
    await saveCategory(updated);
    setCategories((current) =>
      current.map((item) => (item.id === category.id ? updated : item)),
    );
  }

  async function addPaymentMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = paymentMethodName.trim();
    if (!name) return;
    const method: PaymentMethod = {
      id: crypto.randomUUID(),
      name,
      isVisible: true,
      isDefault: false,
    };
    await savePaymentMethod(method);
    setPaymentMethods((current) => [...current, method]);
    setPaymentMethodName('');
  }

  async function togglePaymentMethod(method: PaymentMethod) {
    const updated = { ...method, isVisible: !method.isVisible };
    await savePaymentMethod(updated);
    setPaymentMethods((current) =>
      current.map((item) => (item.id === method.id ? updated : item)),
    );
  }

  async function handleBackup() {
    const backup = await createBackup();
    downloadBackup(backup);
    setMessage(`تم إنشاء النسخة الاحتياطية: ${backup.data.expenses.length} مصروف، ${backup.data.incomes.length} دخل، ${backup.data.projects.length} مشروع.`);
  }

  async function handleExcelExport() {
    const [expenses, incomes, projects, storedCategories, storedMethods] = await Promise.all([
      getExpenses(),
      getIncomes(),
      getProjects(),
      getCategories(),
      getPaymentMethods(),
    ]);
    exportAllDataToExcel({ expenses, incomes, projects, categories: storedCategories, paymentMethods: storedMethods });
    setMessage('تم تجهيز ملف Excel محليًا على جهازك.');
  }

  async function handleRestoreFile(file: File) {
    const result = await readBackupFile(file);
    if (!result.valid) {
      setMessage(result.error);
      setRestorePreview(null);
      return;
    }
    setMessage('');
    setRestorePreview(result.preview);
  }

  async function handleRestore() {
    if (!restorePreview) return;
    setRestoreBusy(true);
    const safetyBackup = await createBackup();
    try {
      await restoreBackup(restorePreview.backup);
      setMessage('تمت استعادة النسخة الاحتياطية بنجاح. سيتم تحديث التطبيق.');
      window.setTimeout(() => window.location.reload(), 350);
    } catch {
      try {
        await restoreBackup(safetyBackup);
        setMessage('فشلت الاستعادة، وتمت إعادة البيانات الحالية بالكامل.');
      } catch {
        setMessage('فشلت الاستعادة وإعادة النسخة الحالية. لا تغلق الصفحة وحاول مرة أخرى.');
      }
    } finally {
      setRestoreBusy(false);
      setRestorePreview(null);
    }
  }

  async function handleDeleteAll() {
    if (deletePhrase !== 'حذف') return;
    await resetToCleanState();
    setDeleteOpen(false);
    setDeletePhrase('');
    setMessage('تم حذف البيانات وإعادة التطبيق إلى حالة نظيفة قابلة للاستخدام.');
    window.setTimeout(() => window.location.reload(), 350);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-7 h-7 text-primary" />
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-1">الإعدادات</h2>
          <p className="text-muted-foreground text-sm">
            خصّص التصنيفات وطرق الدفع المحفوظة على جهازك.
          </p>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold mb-1">خصوصيتك أولًا</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            بياناتك المالية محفوظة محليًا على هذا الجهاز ولا يتم إرسالها إلى خادم خارجي. ننصح بإنشاء نسخة احتياطية دورية لحماية بياناتك.
          </p>
        </div>
      </div>

      {message && <div role="status" className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm font-bold text-primary">{message}</div>}

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <header className="p-5 border-b border-border flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-lg">النسخ والتصدير</h3>
            <p className="text-xs text-muted-foreground">كل العمليات تتم محليًا ولا تُرسل بياناتك إلى أي خدمة خارجية.</p>
          </div>
        </header>
        <div className="p-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => void handleBackup()} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground hover:opacity-90">
            <Download className="h-4 w-4" /> إنشاء نسخة احتياطية كاملة
          </button>
          <button type="button" onClick={() => void handleExcelExport()} className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 font-bold text-primary hover:bg-primary/10">
            <FileDown className="h-4 w-4" /> تصدير كل البيانات إلى Excel
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 font-bold hover:bg-muted">
            <Upload className="h-4 w-4" /> اختيار نسخة للاستعادة
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleRestoreFile(file);
              event.target.value = '';
            }} />
          </label>
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        <p className="font-bold text-foreground">تنبيه تخزين محلي</p>
        <p className="mt-2 leading-relaxed">حذف بيانات المتصفح أو إزالة بيانات الموقع قد يؤدي إلى حذف بيانات التطبيق المحلية، لذلك احتفظ بنسخة احتياطية دورية.</p>
      </div>

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <header className="p-5 border-b border-border flex items-center gap-3">
          <Tags className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-lg">التصنيفات</h3>
            <p className="text-xs text-muted-foreground">
              لا تُحذف التصنيفات المستخدمة؛ يمكن إخفاؤها بأمان.
            </p>
          </div>
        </header>
        <div className="p-5 space-y-5">
          <form onSubmit={addCategory} className="grid sm:grid-cols-2 lg:grid-cols-[1fr_9rem_9rem_auto] gap-3">
            <label className="sr-only" htmlFor="category-name">اسم التصنيف</label>
            <input
              id="category-name"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="اسم التصنيف"
              className="bg-background border border-input rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <label className="sr-only" htmlFor="category-scope">نوع التصنيف</label>
            <select
              aria-label="نوع استخدام التصنيف"
              value={categoryKind}
              onChange={(event) => setCategoryKind(event.target.value as Category['kind'])}
              disabled={editingCategoryId !== null}
              className="bg-background border border-input rounded-xl px-4 py-2.5"
            >
              <option value="expense">مصروف</option>
              <option value="income">دخل</option>
            </select>
            <select
              id="category-scope"
              value={categoryScope}
              onChange={(event) => setCategoryScope(event.target.value as Category['scope'])}
              disabled={editingCategoryId !== null}
              className="bg-background border border-input rounded-xl px-4 py-2.5"
            >
              <option value="personal">شخصي</option>
              <option value="work">عمل</option>
              <option value="both">مشترك</option>
            </select>
            <div className="flex gap-2">
              <button className="flex-1 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 flex items-center justify-center gap-2">
                {editingCategoryId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingCategoryId ? 'حفظ' : 'إضافة'}
              </button>
              {editingCategoryId && (
                <button type="button" onClick={cancelEditingCategory} className="rounded-xl border border-border px-3" aria-label="إلغاء تعديل التصنيف">
                  إلغاء
                </button>
              )}
            </div>
          </form>
          <div className="grid md:grid-cols-2 gap-3">
            {categories.map((category) => (
              <div key={category.id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className={category.isVisible ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>
                    {category.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {category.kind === 'income' ? 'دخل' : 'مصروف'}
                    {' · '}
                    {category.scope === 'work' ? 'عمل' : category.scope === 'personal' ? 'شخصي' : 'مشترك'}
                  </p>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => startEditingCategory(category)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                    aria-label={`تعديل ${category.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleCategory(category)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                    aria-label={category.isVisible ? `إخفاء ${category.name}` : `إظهار ${category.name}`}
                  >
                    {category.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <header className="p-5 border-b border-border flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-lg">طرق الدفع والاستلام</h3>
            <p className="text-xs text-muted-foreground">تُستخدم الطرق النشطة في نماذج المصروفات والدخل.</p>
          </div>
        </header>
        <div className="p-5 space-y-5">
          <form onSubmit={addPaymentMethod} className="flex flex-col sm:flex-row gap-3">
            <label className="sr-only" htmlFor="payment-method-name">اسم طريقة الدفع</label>
            <input
              id="payment-method-name"
              value={paymentMethodName}
              onChange={(event) => setPaymentMethodName(event.target.value)}
              placeholder="مثال: محفظة إلكترونية"
              className="flex-1 bg-background border border-input rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <button className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> إضافة طريقة
            </button>
          </form>
          <div className="grid sm:grid-cols-2 gap-3">
            {paymentMethods.map((method) => (
              <div key={method.id} className="border border-border rounded-xl p-4 flex items-center justify-between gap-3">
                <span className={method.isVisible ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>
                  {method.name}
                </span>
                <button
                  type="button"
                  onClick={() => void togglePaymentMethod(method)}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                  aria-label={method.isVisible ? `إخفاء ${method.name}` : `إظهار ${method.name}`}
                >
                  {method.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h3 className="font-bold text-lg text-destructive">منطقة خطرة</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">حذف جميع المصروفات والدخل والمشاريع والإعدادات المحلية من هذا الجهاز لا يمكن التراجع عنه بدون نسخة احتياطية.</p>
            <button type="button" onClick={() => setDeleteOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2.5 font-bold text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> حذف جميع البيانات
            </button>
          </div>
        </div>
      </section>

      {restorePreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="restore-title">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
          <h3 id="restore-title" className="text-xl font-black">معاينة النسخة الاحتياطية</h3>
          <p className="mt-2 text-sm text-muted-foreground">تاريخ النسخة: <strong dir="ltr">{new Date(restorePreview.backup.createdAt).toLocaleString('ar-SA')}</strong></p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <PreviewCount label="المصروفات" value={restorePreview.expensesCount} />
            <PreviewCount label="حركات الدخل" value={restorePreview.incomesCount} />
            <PreviewCount label="المشاريع" value={restorePreview.projectsCount} />
            <PreviewCount label="التصنيفات" value={restorePreview.categoriesCount} />
            <PreviewCount label="طرق الدفع" value={restorePreview.paymentMethodsCount} />
          </div>
          <p className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm font-bold text-destructive">استعادة النسخة الاحتياطية ستستبدل البيانات الحالية على هذا الجهاز.</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setRestorePreview(null)} className="rounded-xl border border-border px-4 py-2.5 font-bold">إلغاء</button>
            <button type="button" disabled={restoreBusy} onClick={() => void handleRestore()} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground disabled:opacity-50">{restoreBusy ? 'جارٍ الاستعادة...' : 'استعادة النسخة'}</button>
          </div>
        </div>
      </div>}

      {deleteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
          <h3 id="delete-title" className="text-xl font-black text-destructive">حذف جميع البيانات</h3>
          <p className="mt-3 text-sm font-bold leading-relaxed">سيتم حذف جميع المصروفات والدخل والمشاريع والإعدادات المحلية من هذا الجهاز. لا يمكن التراجع عن العملية بدون نسخة احتياطية.</p>
          <button type="button" onClick={() => void handleBackup()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary">
            <Download className="h-4 w-4" /> إنشاء نسخة احتياطية أولًا
          </button>
          <label className="mt-5 block text-sm font-bold">اكتب «حذف» للتأكيد
            <input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} className="mt-2 field-input w-full" placeholder="حذف" />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => { setDeleteOpen(false); setDeletePhrase(''); }} className="rounded-xl border border-border px-4 py-2.5 font-bold">إلغاء</button>
            <button type="button" disabled={deletePhrase !== 'حذف'} onClick={() => void handleDeleteAll()} className="rounded-xl bg-destructive px-4 py-2.5 font-bold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-40">حذف نهائي</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

function PreviewCount({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black" dir="ltr">{value}</p></div>;
}