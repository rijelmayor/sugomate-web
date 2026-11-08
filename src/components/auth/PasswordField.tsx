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
    <span className="relative mt-2 block">
      <input
        required={required}
        name={name}
        type={visible ? "text" : "password"}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border border-slate-200 px-4 py-3 pr-14 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-2 flex w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#102e57] focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9 7-.2 1-1 2.3-2.3 3.5M6.2 6.2C3.8 7.7 2.3 10 2 12c.5 2.5 4 7 10 7 1.2 0 2.3-.2 3.3-.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
