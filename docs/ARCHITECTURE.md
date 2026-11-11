# معماری فنی ویرا

نسخه: 0.5-draft  
هدف: تبدیل نمونهٔ اولیهٔ تک‌فایلی به سامانه‌ای ماژولار، local-first و قابل‌آزمایش.

## ۱. اصول معماری

1. جداسازی رابط کاربری، منطق دامنه، ذخیره‌سازی و اتصال‌های بیرونی
2. موتور زمان‌بندی مستقل از هوش مصنوعی
3. کارکرد آفلاین هستهٔ محصول بدون مدل AI محلی
4. حداقل‌سازی وابستگی‌ها و هزینهٔ اجرا
5. نسخه‌دار بودن مدل داده و مهاجرت کنترل‌شده
6. آزمون‌پذیری منطق تاریخ، تکرار، اعلان و زمان‌بندی
7. امنیت کلیدهای API در سمت سرور

## ۲. لایه‌های پیشنهادی

### Presentation
صفحات و اجزای رابط:
- Dashboard
- Tasks
- Calendar
- Planner (day/week)
- Alarms
- Goals & Habits
- Documents
- Reports
- Settings

این لایه نباید مستقیماً قواعد زمان‌بندی یا منطق ذخیره‌سازی را در event handlerها پیاده کند.

### Application
Use caseها و هماهنگ‌کننده‌ها:
- CreateTask / UpdateTask / CompleteTask
- CreateRecurringEvent
- ApplyScheduleException
- GenerateDailyPlan
- RescheduleOverdueTasks
- ScheduleReminder
- ImportTasks
- Backup / Restore

### Domain
قواعد مستقل از UI و سرویس:
- Task
- TimeBlock
- ScheduleTemplate
- RecurrenceRule
- ScheduleException
- Reminder
- Goal / Habit
- DocumentReference
- SchedulingPolicy

### Infrastructure
پیاده‌سازی جزئیات:
- Local database adapter
- Backup/export adapter
- Notification adapter
- Audio adapter
- AI provider adapter
- Web search adapter
- Backend API client

## ۳. ساختار پوشهٔ پیشنهادی

ساختار نهایی باید مرحله‌به‌مرحله ایجاد شود؛ لازم نیست همهٔ پوشه‌ها در یک commit خالی ساخته شوند.

```text
/
  index.html
  README.md
  docs/
    PRODUCT_SPEC.md
    ARCHITECTURE.md
  src/
    app/
    domain/
      tasks/
      calendar/
      scheduling/
      reminders/
      goals/
      documents/
    application/
    infrastructure/
      storage/
      notifications/
      audio/
      ai/
      web-search/
    ui/
      components/
      pages/
      styles/
  tests/
    unit/
    integration/
```

تا وقتی build tooling انتخاب نشده، پروژه می‌تواند بدون framework سنگین و با JavaScript ماژولار پیش برود. انتخاب ابزار باید بر اساس نیاز واقعی و هزینهٔ نگهداری باشد.

## ۴. مدل دادهٔ اولیه

### Task
فیلدهای پیشنهادی:
- id
- title
- description
- plannedDate
- startTime
- endTime
- durationMinutes
- deadline
- priority
- categoryId
- status
- progress
- dependencyIds
- parentTaskId
- recurrenceRuleId
- reminderIds
- createdAt / updatedAt
- source
- version

قواعد اعتبارسنجی:
- مدت باید مثبت باشد.
- اگر start و end وجود دارند، end باید بعد از start باشد.
- deadline از زمان برنامه‌ریزی جداست.
- زمان‌های نامشخص نباید به‌صورت ساختگی پر شوند.

### ScheduleTemplate
- id
- name
- effectiveFrom
- effectiveUntil
- weeklyEntries
- timezone
- isActive

### ScheduleException
- id
- date یا dateRange
- affectedEntryIds
- replacementEntries
- reason
- createdAt

استثناها باید به الگوی پایه ارجاع دهند و آن را بازنویسی نکنند.

### Reminder
- id
- targetType / targetId
- triggerAt
- offsetMinutes
- soundId
- speakText
- repeatPolicy
- snoozeOptions
- status

### TimeBlock
- id
- taskId یا eventId
- startAt
- endAt
- kind
- isFixed
- sourcePlanId

## ۵. ذخیره‌سازی و مهاجرت

نمونهٔ فعلی از LocalStorage با کلید `vira-planner-tasks-v1` استفاده می‌کند. این داده‌ها باید در مهاجرت حفظ شوند.

مسیر پیشنهادی:
1. ساخت adapter مستقل از UI برای storage
2. افزودن schema version و migration از v1
3. آزمون import داده‌های فعلی
4. انتقال به پایگاه دادهٔ محلی مناسب مانند IndexedDB، پس از بررسی نیازها
5. ساخت export/backup و restore پیش از هر تغییر پرریسک

هیچ migration نباید بی‌صدا دادهٔ ناسازگار را حذف کند. در صورت خطا، نسخهٔ اصلی داده باید حفظ شود و پیام روشن نمایش داده شود.

## ۶. موتور زمان‌بندی

موتور ورودی‌های صریح می‌گیرد:
- تعهدات ثابت (hard constraints)
- ترجیحات (soft constraints)
- وظایف با مدت، اولویت، deadline و dependency
- زمان‌های استراحت و buffer
- ساعات قابل برنامه‌ریزی

خروجی:
- time blocks پیشنهادی
- وظایف زمان‌بندی‌نشده
- تعارض‌ها
- توضیح علت هر تصمیم
- تغییرات نسبت به برنامهٔ فعلی

AI فقط ورودی زبان طبیعی را به ساختار قابل‌اعتبارسنجی تبدیل می‌کند. موتور نباید به پاسخ احتمالی مدل برای تشخیص تداخل یا رعایت محدودیت‌ها متکی باشد.

## ۷. اعلان و صدا

NotificationService باید از منطق وظایف جدا باشد و adapterهای مستقل داشته باشد:
- in-app notifications
- browser notifications
- audio playback
- speech synthesis
- future platform notification adapter

زمان‌بندی اعلان باید از دادهٔ پایدار بازسازی شود؛ اتکا به setTimeoutهای طولانی یا تایمر زندهٔ صفحه کافی نیست. رفتار پس از بسته‌شدن مرورگر به قابلیت واقعی مرورگر/سیستم‌عامل و مجوزهای کاربر وابسته است و باید جداگانه آزمون شود.

## ۸. AI و backend

- مرورگر نباید API key داشته باشد.
- درخواست‌های AI از backend عبور کنند.
- Provider interface امکان تعویض Mistral و افزودن providerهای دیگر را بدهد.
- AI اختیاری و قابل خاموش کردن باشد.
- اطلاعات خصوصی فقط در حد نیاز و با کنترل کاربر ارسال شود.
- خطا، محدودیت مصرف و هزینه مدیریت شوند.

## ۹. آزمون‌های ضروری

- تبدیل تاریخ ISO و نمایش شمسی
- شروع هفته از شنبه
- تغییر ماه و سال و سال کبیسه
- migration از LocalStorage v1
- حفظ استثناهای یک‌روزه
- تشخیص تداخل time blockها
- رعایت hard constraints
- زمان‌بندی بر اساس deadline و priority
- محاسبهٔ reminder و snooze
- restore از backup
- رفتار offline و خطاهای شبکه

## ۱۰. ترتیب اجرای فنی

1. ثبت baseline و افزودن اسناد پروژه
2. تست و ثبت رفتار فعلی؛ بدون حذف داده
3. تعریف مدل داده و schema version
4. استخراج منطق فعلی از app.js به ماژول‌ها
5. ساخت storage adapter و migration
6. ساخت برنامهٔ هفتگی و recurrence/exception
7. ساخت scheduling engine
8. ساخت notification/alarm service
9. افزودن backend و providerهای AI
10. توسعهٔ اسناد، اهداف، گزارش‌ها و جست‌وجوی وب

## ۱۱. محدودیت‌های شناخته‌شده

- آفلاین بودن به معنی تحلیل معنایی جدید PDF یا AI بدون اینترنت نیست.
- اعلان مرورگر پس از بسته‌شدن کامل مرورگر تضمین نمی‌شود.
- Local-first بودن به معنی همگام‌سازی خودکار بین دستگاه‌ها نیست.
- اجرای کد از راه GitHub connector جایگزین اجرای محلی، تست مرورگر و بررسی امنیتی نیست.
