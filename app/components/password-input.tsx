"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
export default function PasswordInput({
  visibilityLabel = "Нууц үг",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { visibilityLabel?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-eye"
        aria-label={`${visibilityLabel} ${visible ? "нуух" : "харах"}`}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
