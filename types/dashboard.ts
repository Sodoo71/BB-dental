export type DayTrend = {
  date: string;
  dayName: string;
  total: number;
  completed: number;
  cancelled: number;
  revenue: number;
};

export type TopServiceStat = {
  id: string;
  name: string;
  count: number;
  revenue: number;
  percentage: number;
};

export type DoctorStat = {
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  totalAppointments: number;
  completedCount: number;
  confirmedCount: number;
};

export type Overview = {
  totalUsers: number;
  pendingUsers: number;
  totalAdmins: number;
  totalDoctors: number;
  activeDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  upcomingAppointments: number;
  doctorsWorkingToday: number;
  servicesCount: number;
  // Financial metrics
  totalCompletedRevenue: number;
  todayEstimatedRevenue: number;
  pendingPotentialRevenue: number;
  // Visual Analytics
  weeklyTrend: DayTrend[];
  topServices: TopServiceStat[];
  doctorWorkload: DoctorStat[];
};
