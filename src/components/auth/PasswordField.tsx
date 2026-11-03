"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

type Props = {
  name: string;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
};

export default function PasswordField({ name, placeholder, autoComplete, minLength }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-2">
      <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#102e57]" />
      <input
        required
        name={name}
        type={visible ? "text" : "password"}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#102e57] transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
      </button>
    </div>
  );
}
