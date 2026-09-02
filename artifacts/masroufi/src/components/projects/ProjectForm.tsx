import { useState, type FormEvent } from 'react';
import { X, BriefcaseBusiness } from 'lucide-react';
import { formatAmountInput, parseAmountToHalalas } from '@/lib/currency';
import { todayISO } from '@/lib/transactions';
import type { Project, ProjectStatus } from '@/types/finance';

export function ProjectForm({
  initialProject,
  onClose,
  onSave,
}: {
  initialProject?: Project | null;
  onClose: () => void;
  onSave: (project: Project) => Promise<void>;
}) {
  const [name, setName] = useState(initialProject?.name ?? '');
  const [client, setClient] = useState(initialProject?.client ?? '');
  const [location, setLocation] = useState(initialProject?.location ?? '');
  const [startDate, setStartDate] = useState(initialProject?.startDate ?? todayISO());
  const [expectedEndDate, setExpectedEndDate] = useState(initialProject?.expectedEndDate ?? '');
  const [contractValue, setContractValue] = useState(initialProject?.contractValueHalalas === undefined ? '' : formatAmountInput(initialProject.contractValueHalalas));
  const [budget, setBudget] = useState(initialProject?.budgetHalalas === undefined ? '' : formatAmountInput(initialProject.budgetHalalas));
  const [status, setStatus] = useState<ProjectStatus>(initialProject?.status ?? 'active');
  const [notes, setNotes] = useState(initialProject?.notes ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError('أدخل اسم المشروع.');
    if (!startDate) return setError('اختر تاريخ بداية المشروع.');
    if (expectedEndDate && expectedEndDate < startDate) return setError('تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.');
    const contractValueHalalas = contractValue ? parseAmountToHalalas(contractValue) : null;
    const budgetHalalas = budget ? parseAmountToHalalas(budget) : null;
    if (contractValue && (contractValueHalalas === null || contractValueHalalas < 0)) return setError('أدخل قيمة عقد صالحة.');
    if (budget && (budgetHalalas === null || budgetHalalas < 0)) return setError('أدخل ميزانية صالحة.');
    setSaving(true);
    setError('');
    const now = new Date().toISOString();
    try {
      await onSave({
        id: initialProject?.id ?? crypto.randomUUID(),
        name: name.trim(),
        client: client.trim() || undefined,
        location: location.trim() || undefined,
        startDate,
        expectedEndDate: expectedEndDate || undefined,
        contractValueHalalas: contractValueHalalas ?? undefined,
        budgetHalalas: budgetHalalas ?? undefined,
        status,
        notes: notes.trim() || undefined,
        createdAt: initialProject?.createdAt ?? now,
        updatedAt: now,
      });
    } catch {
      setError('تعذر حفظ المشروع محليًا. حاول مرة أخرى.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="project-form-title" className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
            <div><h2 id="project-form-title" className="text-lg font-bold">{initialProject ? 'تعديل المشروع' : 'إضافة مشروع'}</h2><p className="text-xs text-muted-foreground">تُحفظ بيانات المشروع على هذا الجهاز فقط</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-secondary" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5">
          {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          <Field label="اسم المشروع" required><input value={name} onChange={(e) => setName(e.target.value)} className="field-input" autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="العميل"><input value={client} onChange={(e) => setClient(e.target.value)} className="field-input" /></Field><Field label="الموقع"><input value={location} onChange={(e) => setLocation(e.target.value)} className="field-input" /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="تاريخ البداية" required><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field-input" dir="ltr" /></Field><Field label="النهاية المتوقعة"><input type="date" value={expectedEndDate} onChange={(e) => setExpectedEndDate(e.target.value)} className="field-input" dir="ltr" /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="قيمة العقد (ر.س)"><input inputMode="decimal" value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="اختياري" className="field-input" dir="ltr" /></Field><Field label="الميزانية (ر.س)"><input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="اختياري" className="field-input" dir="ltr" /></Field></div>
          <Field label="الحالة"><select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="field-input"><option value="active">نشط</option><option value="paused">متوقف</option><option value="completed">مكتمل</option><option value="archived">مؤرشف</option></select></Field>
          <Field label="الملاحظات"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="field-input resize-y" /></Field>
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="secondary-button">إلغاء</button><button type="submit" disabled={saving} className="primary-button">{saving ? 'جارٍ الحفظ...' : 'حفظ المشروع'}</button></div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-2 block font-bold">{label} {required && <span className="text-destructive">*</span>}</span>{children}</label>;
}