export type DoctorRow = {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  totalAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  todayAppointments: number;
  upcomingAppointments: number;
  patientsBooked: number;
  patientsSeen: number;
  workingDays: number;
};
