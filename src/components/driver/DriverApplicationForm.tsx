"use client";

import { useState } from "react";
import DocumentUpload from "@/components/DocumentUpload";
import FormSubmitButton from "@/components/FormSubmitButton";

// mode "new": full application. mode "docs": an existing pending applicant adding missing documents.
export default function DriverApplicationForm({ action, mode, fixedVehicle }: {
  action: (formData: FormData) => void | Promise<void>;
  mode: "new" | "docs";
  fixedVehicle?: string;
}) {
  const [vehicle, setVehicle] = useState(fixedVehicle ?? "");
  const licenseRecommended = vehicle !== "" && vehicle !== "Bicycle";
  return <form action={action} className="mt-6 space-y-5">
    {mode === "new" && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">Age <span className="font-normal text-slate-400">(recommended)</span>
          <input name="age" type="number" min="18" max="80" placeholder="e.g. 25" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
        </label>
        <label className="block text-sm font-bold">Vehicle type
          <select required name="vehicle_type" value={vehicle} onChange={e => setVehicle(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal">
            <option value="" disabled>Select your vehicle</option>
            <option>Motorcycle</option>
            <option>Bicycle</option>
            <option>Car</option>
            <option>Other</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-bold">Home / base address <span className="font-normal text-slate-400">(recommended)</span>
        <textarea name="address" rows={2} placeholder="Street, barangay, municipality" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
      </label>
      <label className="block text-sm font-bold">Plate number <span className="font-normal text-slate-400">(optional)</span>
        <input name="vehicle_plate" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" placeholder="Vehicle plate number" />
      </label>
    </>}
    <div className="rounded-2xl border border-orange-100 bg-white p-4">
      <p className="text-sm font-black">Driver profile photo <span className="font-normal text-slate-500">(shown to customers after assignment)</span></p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Upload a clear face photo in good lighting. This is separate from your private verification selfie and will only be shown to the customer assigned to your delivery.</p>
      <div className="mt-3"><DocumentUpload name="profile_photo" label="Customer-facing profile photo" hint="Face photo only — do not upload an ID or license here." required={false} capture="user" /></div>
      <div className="mt-5 border-t border-orange-100 pt-4">
      <p className="text-sm font-black">Private identification documents <span className="font-normal text-slate-500">(for Admin verification only)</span></p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Uploading a valid ID or driver’s license helps our team know you better and speeds up review. Photos are stored privately. Not required to submit the application.</p>
      <div className="mt-4 space-y-4">
        <DocumentUpload name="id_document" label="Valid government ID" hint="UMID, National ID, passport, PhilHealth, voter’s ID, etc. (front side)." required={false} />
        <DocumentUpload name="selfie_document" label="Selfie holding your ID" hint="Optional. Your face and the ID must both be clearly visible." required={false} capture="user" />
        <DocumentUpload name="license_document" label="Driver’s license" hint={licenseRecommended ? "Recommended for motorized vehicles." : "Recommended for motorcycle, car or other motorized vehicles."} required={false} />
      </div>
      </div>
    </div>
    <FormSubmitButton pendingLabel="Submitting application…" className="w-full rounded-full bg-[#102e57] px-6 py-3.5 text-sm font-extrabold text-white sm:w-auto">{mode === "new" ? "Submit delivery partner application" : "Submit documents"}</FormSubmitButton>
  </form>;
}
