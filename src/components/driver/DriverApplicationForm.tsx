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
  const licenseRequired = vehicle !== "" && vehicle !== "Bicycle";
  return <form action={action} className="mt-6 space-y-5">
    {mode === "new" && <>
      <label className="block text-sm font-bold">Vehicle type<select required name="vehicle_type" value={vehicle} onChange={e => setVehicle(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"><option value="" disabled>Select your vehicle</option><option>Motorcycle</option><option>Bicycle</option><option>Car</option><option>Other</option></select></label>
      <label className="block text-sm font-bold">Plate number <span className="font-normal text-slate-400">(optional)</span><input name="vehicle_plate" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" placeholder="Vehicle plate number" /></label>
    </>}
    <div className="rounded-2xl border border-orange-100 bg-white p-4">
      <p className="text-sm font-black">Identification</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">We verify every delivery partner. Photos are stored privately and only SUGOMATE Operations can view them. Make sure details are sharp and fully inside the frame.</p>
      <div className="mt-4 space-y-4">
        <DocumentUpload name="id_document" label="Valid government ID" hint="UMID, Philippine National ID, passport, PhilHealth, voter’s, postal or similar (front side)." required />
        <DocumentUpload name="selfie_document" label="Selfie holding your ID" hint="Your face and the ID must both be clearly visible." required capture="user" />
        <DocumentUpload name="license_document" label="Driver’s license" hint={licenseRequired ? "Required for motorized vehicles." : "Required for motorcycle, car or other motorized vehicles."} required={licenseRequired} />
      </div>
    </div>
    <FormSubmitButton pendingLabel="Uploading documents…" className="w-full rounded-full bg-[#102e57] px-6 py-3.5 text-sm font-extrabold text-white sm:w-auto">{mode === "new" ? "Submit delivery partner application" : "Submit documents"}</FormSubmitButton>
  </form>;
}
