# Time Clinic Booking System

Энэ бол Next.js, Prisma, PostgreSQL, React дээр бүтээгдсэн бүрэн эмнэлгийн цаг захиалгын систем юм. Аппликешнд эмнэлгийн нүүр хуудас, өвчтөний цаг захиалах хэсэг, бодит боломжит цагийн тооцоо, эмч, хуваарь, захиалгын менежмент бүхий админ самбар багтсан байна.

## Ерөнхий тойм

Энэ төсөл нь эмнэлэг, шүдний эмнэлэг, клиникийн ажлын урсгалд зориулагдсан бөгөөд:

- өвчтөн үйлчилгээ сонгон цаг захиалах боломжтой
- эмч бүр долоо хоногийн хэвшилтэй хуваарьтай
- тодорхой өдөр амралтын өдөр эсвэл хаалттай байх боломжтой
- захиалгын цагийн сонголт статик биш, бодит дүрэмд тулгуурлан тооцогддог
- админ захиалгын төлөвийг харах, удирдах боломжтой
- шинэ захиалга бүрт эмч рүү Telegram мэдэгдэл илгээх боломжтой

## Онцлог боломжууд

### Нээлттэй вэб хэсэг
- эмнэлгийн нүүр хуудас
- статистик, үйлчилгээ, booking call-to-action хэсгүүд
- өвчтөний цаг захиалах форма
- эмч болон үйлчилгээ сонгох
- сервер талдаа тооцогдсон бодит боломжит цагууд
- утасны дугаараар өвчтөнийг upsert хийх логик

### Эмчийн хуваарь
- эмч бүрийн долоо хоногийн хуваарь
- амралтын өдөр тэмдэглэх
- тухайн өдөр өөрчлөх override
- хаагдсан хугацааны муж нэмэх

### Захиалгын удирдлага
- төлөвүүд: PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
- админ хэсгээс захиалгуудыг харах, шүүх
- админ хэсгээс шуурхай захиалга үүсгэх
- дараагийн боломжит цагийг хурдан олох функц

### Аюулгүй байдал, эрхийн удирдлага
- cookie-based session auth
- админ route-ууд хамгаалагдсан
- PATIENT, ADMIN, SUPER_ADMIN, DOCTOR эрхийн дэмжлэг

### Мэдэгдэл
- Telegram chat ID-ээр эмч рүү мэдэгдэл илгээх боломж
- Telegram тохиргоо байхгүй үед аюулгүйгээр алгасах

## Технологи

- Next.js 16 (App Router)
- React 19
- TypeScript
- Prisma ORM
- PostgreSQL
- Tailwind CSS
- Lucide React icon

## Төсөлний бүтэц

```bash
.
├── app/
│   ├── admin/
│   ├── api/
│   ├── components/
│   ├── generated/prisma/
│   ├── login/
│   └── page.tsx
├── hooks/
├── lib/
├── prisma/
├── public/
├── types/
├── .env
├── next.config.ts
├── package.json
├── prisma.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── README.md
└── postcss.config.mjs
```

## Үндсэн Prisma моделүүд

Энэ аппликешнд дараах моделүүд хэрэглэгдэнэ:

- User
- Doctor
- DoctorSchedule
- DoctorAvailabilityException
- Service
- Patient
- Appointment
- AppointmentNote
- PatientNote

Хуваарь тооцох логик нь дараах зүйлс дээр суурилдаг:

- долоо хоногийн тогтмол цаг
- ганц өдрийн амралт / exception
- өдөр тусгай override
- хаагдсан цагийн муж
- одоо байгаа захиалгуудын зөрчил

## Захиалгын логик

Аппликешн нь [lib/availability.ts](lib/availability.ts) файл дахь availability engine ашиглан боломжит цагийг тооцоолдог.

Энэ логик дараах зүйлсийг шалгана:

- эмч идэвхтэй эсэх
- үйлчилгээ идэвхтэй эсэх
- сонгосон огноо зөв эсэх
- эмч тухайн өдөр ажиллахгүй эсэх
- сонгосон цаг хаагдсан мужид унаж байгаа эсэх
- сонгосон цаг өмнөх захиалгатай давхцаж байгаа эсэх
- цаг өмнөх өдөр/цаг болсон эсэх

Ингэснээр боломжит цагийг зөвхөн UI-д биш, сервер талд шалгаж баталгаажуулдаг.

## Нэвтрэлт, эрхийн систем

Энэ төсөл нь [lib/auth.ts](lib/auth.ts) дээр ажилладаг cookie-based session auth ашигладаг.

Дэмжигдсэн ролууд:

- PATIENT
- ADMIN
- SUPER_ADMIN
- DOCTOR

Админ ба super-admin route-ууд зөвшөөрөлтэй session-гүйгээр нэвтрэх боломжгүй.

## Environment Variables

Проектийн root-д `.env` файл үүсгээд дараах утгуудыг бичнэ:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
AUTH_SECRET="replace-with-a-strong-random-secret"
TELEGRAM_BOT_TOKEN="optional-telegram-bot-token"
NODE_ENV="development"
```

Тэмдэглэл:

- `DATABASE_URL` заавал шаардлагатай
- `AUTH_SECRET` session signing-д шаардлагатай
- `TELEGRAM_BOT_TOKEN` сонголттой, байхгүй үед мэдэгдэл илгээхийг аюулгүйгээр алгасна

## Локал хөгжүүлэлт

Нэмэлтүүд суулгана:

```bash
npm install
```

Prisma client generate:

```bash
npx prisma generate
```

Database migration ажиллуулах:

```bash
npx prisma migrate dev
```

Dev server эхлүүлнэ:

```bash
npm run dev
```

Браузер дээр нээнэ:

```text
http://localhost:3000
```

## Production build

```bash
npm run build
npm run start
```

## Хэрэгтэй script-ууд

```bash
npm run dev      # development server эхлүүлэх
npm run build    # production build хийх
npm run start    # production server ажиллуулах
npm run lint     # lint шалгах
npx prisma generate  # Prisma client шинэчлэх
npx prisma migrate dev  # schema өөрчлөлтийг ашиглах
```

## Тэмдэглэл

- Энэ апп нь mock биш, бодит клиникийн цаг захиалгын урсгалыг дагадаг
- боломжит цагийн тооцоо төвлөрсөн нэг жишигт ажилладаг
- Telegram мэдэгдэл нь optional бөгөөд bot token байхгүй үед аюулгүйгээр ажилладаг

## Лиценз

Энэ төсөл нь дотоод клиник/цаг захиалгын workflow-д зориулагдсан бөгөөд default лиценз файлгүй байна.
