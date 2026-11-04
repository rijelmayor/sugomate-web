import { signOut } from "@/app/dashboard/actions";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";

export default function PortalSignOut({ className = "" }: { className?: string }) {
  return <form action={signOut}><SignOutSubmitButton className={className || "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"} /></form>;
}
