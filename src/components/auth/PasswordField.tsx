"use client";

import { useState } from "react";

type PasswordFieldProps = {
  name: string;
  autoComplete?: string;
  minLength?: number;
};

export default function PasswordField({ name, autoComplete = "new-password", minLength }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mt-2 flex w-full items-center rounded-xl border border-slate-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
      <input
        required
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        className="w-full min-w-0 rounded-l-xl px-4 py-3 font-normal outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="shrink-0 rounded-r-xl px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
