"use client";

import { useState } from "react";

type PasswordFieldProps = {
  name: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
};

export default function PasswordField({
  name,
  autoComplete = "new-password",
  minLength = 8,
  required = true,
  className = "",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-2">
      <input
        required={required}
        name={name}
        type={visible ? "text" : "password"}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border border-slate-200 px-4 py-3 pr-20 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-3 my-auto rounded-md px-2 text-sm font-semibold text-slate-500 hover:text-[#102e57] focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
