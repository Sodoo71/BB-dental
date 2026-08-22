export type Doctor = { id: string; name: string; title: string | null };
export type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: string | number | null;
};

export type PatientForm = {
  fullName: string;
  phone: string;
  age: string;
  gender: string;
  startTime: string;
  chiefComplaint: string;
};

export type ToastState = { success: boolean; message: string } | null;
