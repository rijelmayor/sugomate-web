"use client";

import { useState } from "react";

type PasswordFieldProps = {
  name: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export default function PasswordField({
  name,
  autoComplete = "new-password",
  minLength = 8,
  required = true,
  className = "",
  value,
  onChange,
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
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={`w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-2 my-auto flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:text-[#102e57] focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {visible ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.3 3.2M6.2 6.2C4.2 7.5 2.9 9.5 2.5 12c.5 1.2 2.2 4 6 5.5 1.1.4 2.3.5 3.5.5" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="2.7" /></svg>
        )}
      </button>
    </div>
  );
}
