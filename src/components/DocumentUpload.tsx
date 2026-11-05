"use client";

import { useRef, useState } from "react";

const MAX_BYTES = 1.5 * 1024 * 1024; // target after compression
const HARD_MAX = 5 * 1024 * 1024;

// Compress a photo to JPEG, shrinking until it fits. Returns null if it cannot be read.
async function compressToJpeg(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    // Try decreasing quality until under the target size
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    // Last attempt — take whatever we have if under the hard limit
    const last = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.35));
    if (last && last.size <= HARD_MAX) {
      return new File([last], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
    return null;
  } catch {
    return null;
  }
}

export default function DocumentUpload({ name, label, hint, required = false, capture }: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  capture?: "user" | "environment";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError("");
    if (!file) { setPreview(null); return; }

    const isImage = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!isImage) {
      input.value = "";
      setPreview(null);
      setError("Please choose a photo (JPG, PNG or WEBP).");
      return;
    }

    setBusy(true);
    const compressed = await compressToJpeg(file);
    setBusy(false);

    if (!compressed) {
      input.value = "";
      setPreview(null);
      setError("Could not prepare this photo. Try a smaller JPG or PNG.");
      return;
    }

    // Replace the input's files so the form submits the compressed JPEG
    const transfer = new DataTransfer();
    transfer.items.add(compressed);
    input.files = transfer.files;

    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(compressed); });
  }

  return <div>
    <label htmlFor={`doc-${name}`} className="block text-sm font-bold">{label} {required ? <span className="font-normal text-rose-600">· required</span> : <span className="font-normal text-slate-400">(optional)</span>}</label>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-orange-200 bg-orange-50/50 p-3">
      {preview
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={preview} alt={`${label} preview`} className="h-16 w-24 shrink-0 rounded-lg border border-orange-100 bg-white object-cover" />
        : <div aria-hidden="true" className="grid h-16 w-24 shrink-0 place-items-center rounded-lg bg-white text-2xl text-orange-300">🪪</div>}
      <input ref={inputRef} id={`doc-${name}`} name={name} type="file" required={required} accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" capture={capture} onChange={onChange}
        className="w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-[#102e57] file:px-4 file:py-2 file:text-xs file:font-bold file:text-white" />
    </div>
    {busy && <p className="mt-1 text-xs font-semibold text-orange-600">Compressing photo…</p>}
    {error && <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">{error}</p>}
  </div>;
}
