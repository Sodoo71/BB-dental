import type { Prisma } from "@/app/generated/prisma/client";

// Use allowlists at the query boundary so reception never loads clinical fields.
export const receptionAppointmentSelect = {
  id: true, patientId: true, doctorId: true, serviceId: true,
  patientName: true, patientPhone: true, patientEmail: true,
  appointmentDate: true, startTime: true, endTime: true,
  status: true, isRepeat: true, createdAt: true, updatedAt: true,
  patient: { select: { id: true, fullName: true, phone: true, email: true, age: true, gender: true } },
  doctor: { select: { id: true, name: true, title: true } },
  service: { select: { id: true, name: true, price: true, durationMin: true } },
} satisfies Prisma.AppointmentSelect;

export const publicDoctorSelect = {
  id: true, name: true, specialty: true, title: true, description: true,
  experience: true, avatarUrl: true, imageUrl: true, sortOrder: true,
} satisfies Prisma.DoctorSelect;

export const publicServiceSelect = {
  id: true, name: true, slug: true, description: true, shortDescription: true,
  price: true, durationMin: true, category: true, imageUrl: true, sortOrder: true,
} satisfies Prisma.ServiceSelect;

export const bookingConfirmationSelect = {
  id: true, appointmentDate: true, startTime: true, endTime: true,
  status: true, doctorId: true, serviceId: true,
} satisfies Prisma.AppointmentSelect;
