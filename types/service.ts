export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  durationMin: string;
  price: string;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
