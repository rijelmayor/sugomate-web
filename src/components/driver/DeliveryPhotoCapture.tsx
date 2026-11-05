"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2 } from "lucide-react";

export default function DeliveryPhotoCapture() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-extrabold text-[#102e57] transition hover:bg-orange-100 active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        {fileName ? <CheckCircle2 size={20} aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}
        {fileName ? "Photo selected · Change photo" : "Take delivery photo"}
      </button>
      <input
        ref={inputRef}
        required
        type="file"
        name="delivery_proof"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="Delivery photo"
        className="sr-only"
        onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
      />
      {fileName && <p className="break-all text-xs text-emerald-700">Selected: {fileName}</p>}
    </div>
  );
}
