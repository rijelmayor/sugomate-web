"use client";
import { useFormStatus } from "react-dom";

export default function FormSubmitButton({ children, className, pendingLabel }: {
  children: React.ReactNode;
  className: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}
    className={`${className} inline-flex items-center justify-center gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0`}>
    {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" /> }
    {pending ? (pendingLabel ?? "Please wait…") : children}
  </button>;
}
