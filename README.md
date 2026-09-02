# مصروفي

**مصروفي** تطبيق عربي Local-First لإدارة المصروفات والدخل الشخصي والعمل
والمشاريع والتقارير، مع دعم RTL وPWA والعمل دون اتصال.

## الخصوصية والبيانات

- لا يوجد Backend أو API أو قاعدة بيانات سحابية.
- لا يتم إرسال البيانات المالية إلى Server.
- تحفظ البيانات محليًا في **IndexedDB داخل المتصفح**.
- حذف بيانات الموقع من المتصفح قد يؤدي إلى حذف بيانات التطبيق.
- أنشئ Backup دوريًا، واحفظ ملف النسخة الاحتياطية في مكان آمن.

## المزايا

- إدارة المصروفات الشخصية ومصروفات العمل.
- إدارة الدخل الشخصي ودخل العمل.
- إدارة المشاريع وربط حركات العمل بها.
- Dashboard وتقارير شهرية وسنوية وتقارير العمل والشخصي والمشروع.
- تصدير Excel وPDF محليًا.
- Backup وRestore كاملان مع معاينة والتحقق قبل الاستعادة.
- حذف كل البيانات مع تأكيد ونسخة احتياطية اختيارية قبل الحذف.
- PWA تعمل Offline بعد تحميل App Shell.

## التقنية والمعمارية

- React
- TypeScript
- Vite
- IndexedDB
- PWA وService Worker
- GitHub Pages
- Local-First Architecture
- Hash Routing عبر Wouter

المبالغ المالية تحفظ كأعداد صحيحة بالهللات، ثم تعرض بالريال عند الحاجة.
المحرك الحسابي والتقارير يعملان من البيانات المحلية مباشرة.

## النسخ الاحتياطي والاستعادة

من صفحة الإعدادات:

1. اختر **إنشاء نسخة احتياطية كاملة** لتنزيل ملف JSON يحتوي بيانات التطبيق المالية
   وإعداداته.
2. احتفظ بالملف في مكان آمن؛ فهو يحتوي بياناتك المالية.
3. استخدم **اختيار نسخة للاستعادة** لقراءة الملف والتحقق منه.
4. راجع المعاينة ثم أكد الاستعادة.

لا تبدأ الاستعادة قبل التأكد من أن الملف يخص تطبيق مصروفي. ينشئ التطبيق نسخة
داخلية من البيانات الحالية قبل الاستعادة.

## التثبيت كتطبيق PWA

على المتصفحات التي تدعم تثبيت تطبيقات الويب، افتح التطبيق عبر HTTPS ثم استخدم
خيار **تثبيت التطبيق** أو **Add to Home Screen** من قائمة المتصفح. قد يختلف
ظهور خيار التثبيت حسب المتصفح والجهاز، ولا يظهر في كل البيئات.

بعد أول تحميل ناجح يمكن فتح App Shell وبعض الوظائف محليًا دون اتصال. يجب إنشاء
نسخة احتياطية دورية لأن بيانات التطبيق محلية على الجهاز.

## التطوير المحلي

يتطلب المشروع Node.js وpnpm.

```bash
pnpm install
pnpm --filter @workspace/masroufi run dev
```

الأوامر الأساسية:

```bash
pnpm --filter @workspace/masroufi run typecheck
pnpm --filter @workspace/masroufi run test
pnpm --filter @workspace/masroufi run build
```

لتشغيل التطبيق محليًا تحت مسار فرعي:

```bash
BASE_PATH=/masroufi/ pnpm --filter @workspace/masroufi run build
```

## GitHub Pages

يتم النشر عبر `.github/workflows/deploy-masroufi-pages.yml` عند Push إلى
`main` أو يدويًا من تبويب Actions. يقوم Workflow بالخطوات التالية:

1. تثبيت Node.js وpnpm.
2. تشغيل `pnpm install --frozen-lockfile`.
3. تشغيل TypeScript check والاختبارات.
4. بناء Production.
5. رفع `artifacts/masroufi/dist/public` كـPages artifact.
6. نشر artifact على GitHub Pages.

### Repository Base Path

يستخدم Vite المتغير `BASE_PATH`. يقوم Workflow بضبطه تلقائيًا إلى:

```text
/<repository-name>/
```

لذلك تعمل ملفات JavaScript وCSS وManifest والأيقونات وService Worker تحت
Repository Subpath. لا تضع اسم المستودع داخل الكود؛ يتم أخذه من سياق GitHub
Actions.

### إعداد Pages في GitHub

بعد أول تشغيل ناجح:

1. افتح إعدادات المستودع.
2. افتح Pages.
3. اختر GitHub Actions كمصدر النشر إن لم يكن مختارًا تلقائيًا.
4. أعد Push إلى `main` لإعادة النشر.

يستخدم التطبيق Hash Routing، لذلك تعمل الروابط التالية مع Refresh دون إعداد
خادم لإعادة كتابة المسارات:

```text
/#/
/#/expenses
/#/income
/#/projects
/#/reports
/#/settings
```

## التراخيص

لم يتم تحديد License مستقل للمشروع في هذه المرحلة. يعتمد التطبيق على مكتبات
مفتوحة المصدر، ومن أهمها:

- `xlsx` — Apache-2.0
- `jspdf` — MIT
- `html2canvas-pro` — MIT

لم تتم ترقية Major Versions بغرض النشر.