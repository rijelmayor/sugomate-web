"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: string;
  tone: "merchant" | "delivery";
};

export default function FinancialSettingsSubmitButton({ children, tone }: Props) {
  const { pending } = useFormStatus();
  const colors =
    tone === "merchant"
      ? "from-yellow-300 to-orange-400"
      : "from-cyan-200 to-sky-400";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-live="polite"
      className={`inline-flex min-h-11 min-w-48 items-center justify-center rounded-full bg-gradient-to-r ${colors} px-6 py-3 text-xs font-black text-slate-900 shadow-md shadow-black/20 transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243c] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0`}
    >
      {pending ? "Saving settings…" : children}
    </button>
  );
}
