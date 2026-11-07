"use client";

import { Camera, UserRound } from "lucide-react";
import FormSubmitButton from "@/components/FormSubmitButton";
import { updateDriverProfilePhoto } from "@/app/driver/actions";

export default function DriverProfilePhotoUpload({ currentPhotoUrl }: { currentPhotoUrl: string | null }) {
  return <section className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
    {currentPhotoUrl ? <img src={currentPhotoUrl} alt="Your driver profile" className="h-16 w-16 rounded-2xl border border-slate-100 object-cover"/> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-600"><UserRound size={28}/></div>}
    <div className="min-w-0 flex-1">
      <h2 className="text-sm font-black">Customer-facing driver photo</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">A clear face photo helps customers recognize you after you claim an order. Your ID and verification selfie remain private.</p>
    </div>
    <form action={updateDriverProfilePhoto} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <label className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-800 sm:flex-none">
        <Camera size={15}/> Choose photo
        <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/webp" capture="user" required className="sr-only"/>
      </label>
      <FormSubmitButton pendingLabel="Saving…" className="min-h-10 rounded-full bg-[#102e57] px-4 py-2 text-xs font-black text-white">Save photo</FormSubmitButton>
    </form>
  </section>;
}
