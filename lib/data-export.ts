import { db } from "./db";
import { editableSettingKeys } from "./clinic-settings";

// This is a portable clinic-data export, not a database restore image.
// Authentication material and integration credentials are deliberately omitted.
export async function exportClinicData() {
  return db.$transaction(
    async (tx) => ({
      format: "bb-dental-clinic-data-v1",
      exportedAt: new Date().toISOString(),
      users: await tx.user.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          active: true,
          approvalStatus: true,
          approvedById: true,
          approvedAt: true,
          createdAt: true,
        },
      }),
      doctors: await tx.doctor.findMany({
        select: {
          id: true,
          userId: true,
          name: true,
          specialty: true,
          sortOrder: true,
          bio: true,
          imageUrl: true,
          active: true,
        },
      }),
      patients: await tx.patient.findMany(),
      services: await tx.service.findMany(),
      schedules: await tx.schedule.findMany(),
      leaves: await tx.leave.findMany(),
      appointments: await tx.appointment.findMany(),
      treatments: await tx.treatment.findMany(),
      payments: await tx.payment.findMany(),
      paymentMethods: await tx.paymentMethodOption.findMany(),
      expenses: await tx.expense.findMany(),
      inventory: await tx.inventoryItem.findMany(),
      stockMovements: await tx.stockMovement.findMany(),
      documents: await tx.document.findMany(),
      patientNotes: await tx.patientNote.findMany(),
      patientTransfers: await tx.patientTransfer.findMany(),
      nurseShifts: await tx.nurseShift.findMany(),
      auditLog: await tx.auditLog.findMany(),
      settings: await tx.setting.findMany({
        where: { key: { in: [...editableSettingKeys] } },
      }),
    }),
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
