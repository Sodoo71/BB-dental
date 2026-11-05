import { roleNames } from "@/lib/domain";
import type { Field } from "./ui";
export function employeeFields(editing = false): Field[] {
  return [
    { key: "name", label: "Овог нэр", required: true },
    { key: "phone", label: "Утас", type: "tel", required: true },
    { key: "email", label: "Имэйл", type: "email" },
    { key: "telegramChatId", label: "Telegram Chat ID (заавал биш)" },
    {
      key: "role",
      label: "Нэвтрэх эрх",
      type: "select",
      required: true,
      default: "RECEPTION",
      options: Object.entries(roleNames).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      key: "password",
      label: editing ? "Шинэ нууц үг (солих бол)" : "Нууц үг",
      type: "password",
      required: !editing,
      hint: "Хамгийн багадаа 8 тэмдэгт.",
    },
    {
      key: "passwordConfirmation",
      label: editing ? "Шинэ нууц үг давтах" : "Нууц үг давтах",
      type: "password",
      required: !editing,
    },
    { key: "active", label: "Идэвхтэй данс", type: "checkbox" },
  ];
}
