"use client";

import { useRef, useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;

// Photo picker for ID documents: shows a preview and shrinks large phone photos before upload.
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
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { input.value = ""; setPreview(null); setError("Please choose a JPG, PNG or WEBP photo."); return; }
    setBusy(true);
    let finalFile = file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (blob && blob.size < file.size) {
        finalFile = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
        const transfer = new DataTransfer();
        transfer.items.add(finalFile);
        input.files = transfer.files;
      }
    } catch { /* keep the original photo */ }
    setBusy(false);
    if (finalFile.size > MAX_BYTES) { input.value = ""; setPreview(null); setError("This photo is too large (maximum 5 MB). Try a smaller one."); return; }
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(finalFile); });
  }

  return <div>
    <label htmlFor={`doc-${name}`} className="block text-sm font-bold">{label} {required ? <span className="font-normal text-rose-600">· required</span> : <span className="font-normal text-slate-400">(optional)</span>}</label>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-orange-200 bg-orange-50/50 p-3">
      {preview
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={preview} alt={`${label} preview`} className="h-16 w-24 shrink-0 rounded-lg border border-orange-100 bg-white object-cover" />
        : <div aria-hidden="true" className="grid h-16 w-24 shrink-0 place-items-center rounded-lg bg-white text-2xl text-orange-300">🪪</div>}
      <input ref={inputRef} id={`doc-${name}`} name={name} type="file" required={required} accept="image/jpeg,image/png,image/webp" capture={capture} onChange={onChange}
        className="w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-[#102e57] file:px-4 file:py-2 file:text-xs file:font-bold file:text-white" />
    </div>
    {busy && <p className="mt-1 text-xs font-semibold text-orange-600">Preparing photo…</p>}
    {error && <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">{error}</p>}
  </div>;
}
