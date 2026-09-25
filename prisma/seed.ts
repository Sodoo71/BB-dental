import { randomUUID, scryptSync } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../app/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

function hashPassword(password: string) {
  const salt = randomUUID();
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const rawDbUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://neondb_owner:npg_DA7cev5GBxrQ@ep-cold-breeze-azyxz1o0-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const cleanDbUrl = rawDbUrl
  .replace(/channel_binding=[^&]+&?/g, "")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

const pool = new Pool({
  connectionString: cleanDbUrl,
  ssl: { rejectUnauthorized: false },
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  console.log("🌱 Starting BB Dental Clinic database seed...");

  // 1. SERVICES
  const servicesData = [
    {
      name: "Шүдний ерөнхий үзлэг & оношилгоо",
      slug: "general-consultation",
      category: "EXAM",
      description:
        "Амны хөндийн иж бүрэн үзлэг, дижитал рентген оношилгоо болон эмчилгээний төлөвлөгөө гаргах.",
      shortDescription: "Бүрэн үзлэг, рентген оношилгоо, зөвлөгөө",
      durationMin: 30,
      price: 30000,
      imageUrl:
        "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80",
      sortOrder: 1,
      isActive: true,
    },
    {
      name: "Гэрлийн ломбо (Шүд нөхөх)",
      slug: "composite-filling",
      category: "TREATMENT",
      description:
        "Япон, Германы чанартай нийлмэл ломбоны материалаар шүдний байгалийн өнгө, хэлбэрийг сэргээн ломбодох.",
      shortDescription: "Байгалийн өнгөтэй өндөр бат бөх гэрлийн ломбо",
      durationMin: 45,
      price: 85000,
      imageUrl:
        "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80",
      sortOrder: 2,
      isActive: true,
    },
    {
      name: "Сувгийн эмчилгээ (1 суваг)",
      slug: "root-canal",
      category: "TREATMENT",
      description:
        "Шүдний зөөлцийн үрэвслийг зогсоох, суваг цэвэрлэх, ариутгах болон тусгай материалаар битүүмжлэх.",
      shortDescription: "Суваг цэвэрлэх, өвдөлт намдаах, битүүмжлэх",
      durationMin: 60,
      price: 120000,
      imageUrl:
        "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&auto=format&fit=crop&q=80",
      sortOrder: 3,
      isActive: true,
    },
    {
      name: "Шүдний чулуу түүх & AirFlow",
      slug: "scaling-airflow",
      category: "HYGIENE",
      description:
        "Хэт авиан аппарат болон AirFlow технологиор шүдний хатуу, зөөлөн өнгөр, чулууг өвдөлтгүй цэвэрлэх.",
      shortDescription: "Шүд өнгөр, чулуу өвдөлтгүй мэргэжлийн цэвэрлэгээ",
      durationMin: 40,
      price: 60000,
      imageUrl:
        "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&auto=format&fit=crop&q=80",
      sortOrder: 4,
      isActive: true,
    },
    {
      name: "Лазер цайруулалт (Zoom White)",
      slug: "laser-whitening",
      category: "COSMETIC",
      description:
        "Мэргэжлийн дэвшилтэт гэрлийн технологиор шүдийг 3-6 өнгө цайруулах аюулгүй, үр дүнтэй арга.",
      shortDescription: "Шүдний байгалийн цагаан өнгийг сэргээх",
      durationMin: 60,
      price: 350000,
      imageUrl:
        "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=600&auto=format&fit=crop&q=80",
      sortOrder: 5,
      isActive: true,
    },
    {
      name: "Циркон бүрээс (Zirconia Crown)",
      slug: "zirconia-crown",
      category: "PROSTHETICS",
      description:
        "Байгалийн шүдтэй ижил тунгалаг, өндөр бат бэх чанартай бүрэн керамик циркон бүрээс.",
      shortDescription: "Өндөр чанартай, байгалийн мэт циркон бүрээс",
      durationMin: 60,
      price: 450000,
      imageUrl:
        "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=600&auto=format&fit=crop&q=80",
      sortOrder: 6,
      isActive: true,
    },
    {
      name: "Имплант шүд суулгах (Швейцарь, Солонгос)",
      slug: "dental-implant",
      category: "SURGERY",
      description:
        "Алдсан шүдийг эрүүний ясанд титан тулгуур суулган байгалийн шүд мэт бат бөх сэргээх.",
      shortDescription: "Насан туршийн баталгаатай суулгац шүд",
      durationMin: 90,
      price: 1800000,
      imageUrl:
        "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80",
      sortOrder: 7,
      isActive: true,
    },
    {
      name: "Хүүхдийн шүдний үзлэг & Фторжуулалт",
      slug: "pediatric-fluoride",
      category: "PEDIATRIC",
      description:
        "Хүүхдэд зориулсан айдасгүй үзлэг, сүүн шүдний цоорол зогсоох түрхлэг, өнгөт ломбо.",
      shortDescription: "Хүүхдэд ээлтэй айдасгүй үзлэг, фторт түрхлэг",
      durationMin: 30,
      price: 40000,
      imageUrl:
        "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600&auto=format&fit=crop&q=80",
      sortOrder: 8,
      isActive: true,
    },
    {
      name: "Гажиг заслын зөвлөгөө & Брекет",
      slug: "orthodontic-braces",
      category: "ORTHODONTICS",
      description:
        "Шүдний буруу зуулт, тэгш бус байрлалыг засах металл болон шаазан брекет системийн зөвлөгөө, тохируулга.",
      shortDescription: "Тэгш сайхан шүдтэй болох брекет эмчилгээ",
      durationMin: 45,
      price: 50000,
      imageUrl:
        "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&auto=format&fit=crop&q=80",
      sortOrder: 9,
      isActive: true,
    },
    {
      name: "Шүд авах (Мэс заслын бус)",
      slug: "tooth-extraction",
      category: "SURGERY",
      description:
        "Хүндрэлгүй шүдийг орчин үеийн мэдээ алдуулалтын дор өвдөлтгүй, түргэн шуурхай авах.",
      shortDescription: "Өвдөлтгүй, найдвартай шүд авах үйлчилгээ",
      durationMin: 30,
      price: 50000,
      imageUrl:
        "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80",
      sortOrder: 10,
      isActive: true,
    },
  ];

  console.log("Creating services...");
  const createdServices = [];
  for (const s of servicesData) {
    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      create: s,
      update: s,
    });
    createdServices.push(service);
  }

  // 2. DOCTORS
  const doctorsData = [
    {
      name: "Б. Тэмүүлэн",
      specialty: "Нүүр амны эмчилгээ",
      title: "Ахлах их эмч",
      description:
        "10 гаруй жилийн туршлагатай, сувгийн болон гоо сайхны ломбоны чиглэлээр мэргэшсэн ахлах эмч.",
      experience: 10,
      phone: "99112233",
      email: "temuulen@bbdental.mn",
      telegramChatId: process.env.ADMIN_CHAT_ID || "8411351733",
      avatarUrl:
        "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80",
      imageUrl:
        "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80",
      sortOrder: 1,
      isActive: true,
    },
    {
      name: "О. Цолмон",
      specialty: "Нүүр амны согог засал",
      title: "Согог заслын их эмч",
      description:
        "Шүдний циркон бүрээс, гүүрэлсэн шүдэлбэр, имплантын дараах нөхөн сэргээлтээр мэргэшсэн.",
      experience: 8,
      phone: "88223344",
      email: "tsolmon@bbdental.mn",
      telegramChatId: null,
      avatarUrl:
        "https://images.unsplash.com/photo-1594824813589-7634f1981d11?w=400&auto=format&fit=crop&q=80",
      imageUrl:
        "https://images.unsplash.com/photo-1594824813589-7634f1981d11?w=400&auto=format&fit=crop&q=80",
      sortOrder: 2,
      isActive: true,
    },
    {
      name: "М. Энхжин",
      specialty: "Гажиг засал",
      title: "Гажиг заслын нарийн мэргэжлийн эмч",
      description:
        "Хүүхэд болон насанд хүрэгчдийн шүдний тэгш бус байрлалыг засах бүх төрлийн брекет систем хариуцсан эмч.",
      experience: 6,
      phone: "95114455",
      email: "enkhjin@bbdental.mn",
      telegramChatId: null,
      avatarUrl:
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&auto=format&fit=crop&q=80",
      imageUrl:
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&auto=format&fit=crop&q=80",
      sortOrder: 3,
      isActive: true,
    },
    {
      name: "Д. Ариунболд",
      specialty: "Хүүхдийн шүд & Мэс засал",
      title: "Хүүхдийн их эмч",
      description:
        "Хүүхдэд айдас түгшүүр үүсгэхгүйгээр шүд эмчлэх, сүүн шүдний цоорол эмчлэх, урьдчилан сэргийлэх мэргэжилтэн.",
      experience: 7,
      phone: "91998877",
      email: "ariunbold@bbdental.mn",
      telegramChatId: null,
      avatarUrl:
        "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&auto=format&fit=crop&q=80",
      imageUrl:
        "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&auto=format&fit=crop&q=80",
      sortOrder: 4,
      isActive: true,
    },
  ];

  console.log("Creating doctors and schedules...");
  const createdDoctors = [];
  for (const doc of doctorsData) {
    let doctor = await prisma.doctor.findFirst({ where: { name: doc.name } });
    if (!doctor) {
      doctor = await prisma.doctor.create({ data: doc });
    } else {
      doctor = await prisma.doctor.update({
        where: { id: doctor.id },
        data: doc,
      });
    }
    createdDoctors.push(doctor);

    // Monday to Friday (1-5) and Saturday (6)
    for (let day = 1; day <= 6; day++) {
      const isSaturday = day === 6;
      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_dayOfWeek: {
            doctorId: doctor.id,
            dayOfWeek: day,
          },
        },
        create: {
          doctorId: doctor.id,
          dayOfWeek: day,
          startTime: isSaturday ? "10:00" : "09:00",
          endTime: isSaturday ? "16:00" : "18:00",
          isDayOff: false,
          isActive: true,
        },
        update: {
          startTime: isSaturday ? "10:00" : "09:00",
          endTime: isSaturday ? "16:00" : "18:00",
          isDayOff: false,
          isActive: true,
        },
      });
    }

    // Sunday (0)
    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek: {
          doctorId: doctor.id,
          dayOfWeek: 0,
        },
      },
      create: {
        doctorId: doctor.id,
        dayOfWeek: 0,
        startTime: "09:00",
        endTime: "18:00",
        isDayOff: true,
        isActive: true,
      },
      update: {
        isDayOff: true,
      },
    });
  }

  // 3. SYSTEM USERS
  console.log("Creating system users...");
  const adminEmail =
    process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim() ||
    "sodoosodbileg71@gmail.com";
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "С. Содбилэг (Super Admin)",
      role: "SUPER_ADMIN",
      isActive: true,
      passwordHash: hashPassword(
        process.env.SUPER_ADMIN_PASSWORD || "123456789",
      ),
      phone: "95963531",
      telegramChatId: process.env.ADMIN_CHAT_ID || "8411351733",
    },
    update: {
      role: "SUPER_ADMIN",
      isActive: true,
      passwordHash: hashPassword(
        process.env.SUPER_ADMIN_PASSWORD || "123456789",
      ),
    },
  });

  const receptionEmail = "reception@bbdental.mn";
  await prisma.user.upsert({
    where: { email: receptionEmail },
    create: {
      email: receptionEmail,
      name: "А. Номин (Ресепшн)",
      role: "ADMIN",
      isActive: true,
      passwordHash: hashPassword("123456789"),
      phone: "95963531",
    },
    update: {
      role: "ADMIN",
      isActive: true,
      passwordHash: hashPassword("123456789"),
    },
  });

  if (createdDoctors[0]) {
    const doctorUserEmail = "temuulen@bbdental.mn";
    await prisma.user.upsert({
      where: { email: doctorUserEmail },
      create: {
        email: doctorUserEmail,
        name: createdDoctors[0].name,
        role: "DOCTOR",
        isActive: true,
        doctorId: createdDoctors[0].id,
        passwordHash: hashPassword("123456789"),
        phone: createdDoctors[0].phone,
        telegramChatId: createdDoctors[0].telegramChatId,
      },
      update: {
        doctorId: createdDoctors[0].id,
        role: "DOCTOR",
        isActive: true,
        passwordHash: hashPassword("123456789"),
      },
    });
  }

  // 4. PATIENTS
  console.log("Creating patients...");
  const patientsData = [
    {
      fullName: "Бат-Эрдэнэ Ганбаатар",
      phone: "99119922",
      age: 34,
      gender: "MALE" as const,
      email: "baterdene@example.com",
    },
    {
      fullName: "Хулан Болд",
      phone: "88997766",
      age: 28,
      gender: "FEMALE" as const,
      email: "khulan@example.com",
    },
    {
      fullName: "Төгөлдөр Даваа",
      phone: "95123456",
      age: 42,
      gender: "MALE" as const,
      email: "tuguldur@example.com",
    },
    {
      fullName: "Анужин Цэнгэл",
      phone: "91001122",
      age: 24,
      gender: "FEMALE" as const,
      email: "anujin@example.com",
    },
    {
      fullName: "Мөнх-Эрдэнэ Баяр",
      phone: "99881122",
      age: 50,
      gender: "MALE" as const,
      email: "munkherdene@example.com",
    },
    {
      fullName: "Сэргэлэн Батбаяр",
      phone: "80112233",
      age: 9,
      gender: "MALE" as const,
      email: null,
    },
  ];

  const createdPatients = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { phone: p.phone },
      create: p,
      update: {
        fullName: p.fullName,
        age: p.age,
        gender: p.gender,
        email: p.email,
      },
    });
    createdPatients.push(patient);
  }

  // 5. APPOINTMENTS (Past, Today, and Upcoming)
  console.log("Creating realistic appointments...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const makeDate = (dayOffset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    return d;
  };

  const sampleAppointments = [
    // Today's appointments
    {
      patient: createdPatients[0],
      doctor: createdDoctors[0],
      service: createdServices[1], // Ломбо
      date: makeDate(0),
      startTime: "10:00",
      endTime: "10:45",
      status: "CONFIRMED" as const,
      chiefComplaint: "Баруун дээд араа хүйтэн юманд янгинаж өвддөг",
    },
    {
      patient: createdPatients[1],
      doctor: createdDoctors[0],
      service: createdServices[3], // Чулуу түүх
      date: makeDate(0),
      startTime: "11:30",
      endTime: "12:10",
      status: "COMPLETED" as const,
      chiefComplaint: "Шүдний чулуу цэвэрлүүлэх, тогтмол үзлэг",
    },
    {
      patient: createdPatients[2],
      doctor: createdDoctors[1],
      service: createdServices[5], // Циркон бүрээс
      date: makeDate(0),
      startTime: "14:00",
      endTime: "15:00",
      status: "CONFIRMED" as const,
      chiefComplaint: "Зүүн доод арааны хуучин бүрээс унасан",
    },
    {
      patient: createdPatients[3],
      doctor: createdDoctors[2],
      service: createdServices[8], // Брекет
      date: makeDate(0),
      startTime: "16:00",
      endTime: "16:45",
      status: "PENDING" as const,
      chiefComplaint: "Брекет тавиулах зөвлөгөө авах",
    },
    // Past appointments
    {
      patient: createdPatients[4],
      doctor: createdDoctors[0],
      service: createdServices[2], // Суваг
      date: makeDate(-1),
      startTime: "11:00",
      endTime: "12:00",
      status: "COMPLETED" as const,
      chiefComplaint: "Шөнө унтуулахгүй хүчтэй өвдсөн",
    },
    {
      patient: createdPatients[0],
      doctor: createdDoctors[1],
      service: createdServices[0], // Үзлэг
      date: makeDate(-2),
      startTime: "15:00",
      endTime: "15:30",
      status: "COMPLETED" as const,
      chiefComplaint: "Анхны үзлэг",
    },
    {
      patient: createdPatients[1],
      doctor: createdDoctors[2],
      service: createdServices[4], // Цайруулалт
      date: makeDate(-3),
      startTime: "14:00",
      endTime: "15:00",
      status: "COMPLETED" as const,
      chiefComplaint: "Шүдний өнгө сэргээх",
    },
    {
      patient: createdPatients[3],
      doctor: createdDoctors[0],
      service: createdServices[1],
      date: makeDate(-4),
      startTime: "10:00",
      endTime: "10:45",
      status: "CANCELLED" as const,
      chiefComplaint: "Ажил гарсан тул хойшлуулсан",
    },
    // Upcoming appointments
    {
      patient: createdPatients[5], // Хүүхэд
      doctor: createdDoctors[3], // Хүүхдийн эмч
      service: createdServices[7], // Хүүхдийн үзлэг
      date: makeDate(1),
      startTime: "11:00",
      endTime: "11:30",
      status: "CONFIRMED" as const,
      chiefComplaint: "Сүүн шүд цоорсон, өвдөж эхэлсэн",
    },
    {
      patient: createdPatients[2],
      doctor: createdDoctors[1],
      service: createdServices[6], // Имплант
      date: makeDate(2),
      startTime: "14:00",
      endTime: "15:30",
      status: "CONFIRMED" as const,
      chiefComplaint: "Имплант суулгах 2 дахь шатны ажилбар",
    },
    {
      patient: createdPatients[4],
      doctor: createdDoctors[0],
      service: createdServices[1],
      date: makeDate(3),
      startTime: "16:00",
      endTime: "16:45",
      status: "PENDING" as const,
      chiefComplaint: "Нэмэлт ломбо хийлгэх",
    },
  ];

  for (const item of sampleAppointments) {
    if (!item.patient || !item.doctor || !item.service) continue;

    const existing = await prisma.appointment.findFirst({
      where: {
        patientPhone: item.patient.phone,
        appointmentDate: item.date,
        startTime: item.startTime,
      },
    });

    if (!existing) {
      await prisma.appointment.create({
        data: {
          patientName: item.patient.fullName,
          patientPhone: item.patient.phone,
          patientEmail: item.patient.email,
          patientId: item.patient.id,
          doctorId: item.doctor.id,
          serviceId: item.service.id,
          appointmentDate: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          status: item.status,
          chiefComplaint: item.chiefComplaint,
        },
      });
    }
  }

  // 6. SYSTEM SETTINGS
  console.log("Setting clinic system settings...");
  await prisma.systemSetting.upsert({
    where: { key: "clinic_info" },
    create: {
      key: "clinic_info",
      value: JSON.stringify({
        name: "BB Dental Clinic",
        phone: "9596-3531",
        secondaryPhone: "7711-2233",
        email: "info@bbdental.mn",
        address:
          "Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо, Чингисийн өргөн чөлөө",
        workHoursWeekdays: "09:00 - 18:00",
        workHoursSaturday: "10:00 - 16:00",
        workHoursSunday: "Амарна",
      }),
    },
    update: {
      value: JSON.stringify({
        name: "BB Dental Clinic",
        phone: "9596-3531",
        secondaryPhone: "7711-2233",
        email: "info@bbdental.mn",
        address:
          "Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо, Чингисийн өргөн чөлөө",
        workHoursWeekdays: "09:00 - 18:00",
        workHoursSaturday: "10:00 - 16:00",
        workHoursSunday: "Амарна",
      }),
    },
  });

  console.log("✅ BB Dental Clinic seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
