"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { categoryGlyph } from "@/components/customer/CategoryTile";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const MAX_DIMENSION = 1200;

async function toWebp(source: File): Promise<File> {
  if (!source.type.startsWith("image/")) throw new Error("Choose a valid image file.");
  if (source.size > MAX_SOURCE_BYTES) throw new Error("That photo is over 20 MB. Choose a smaller one.");
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5]) {
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob || blob.type !== "image/webp") throw new Error("This browser cannot convert photos to WebP. Try Chrome.");
      if (blob.size <= MAX_UPLOAD_BYTES) return new File([blob], "category.webp", { type: "image/webp" });
      width = Math.round(width * 0.85); height = Math.round(height * 0.85);
    }
    throw new Error("Could not shrink this photo enough. Choose a smaller one.");
  } finally { bitmap.close(); }
}

/** Photo upload for a store category. No photo = the gradient default shown to customers. */
export default function CategoryImagePicker({ slug, initialUrl = "" }: { slug: string; initialUrl?: string }) {
  const [preview, setPreview] = useState(initialUrl);
  const [broken, setBroken] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const objectUrl = useRef<string | null>(null);
  const { Icon, tint } = categoryGlyph(slug);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const source = input.files?.[0];
    if (!source) return;
    setBusy(true); setMessage("Preparing photo…");
    try {
      const file = await toWebp(source);
      const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      setPreview(objectUrl.current); setBroken(false); setRemoved(false);
      setMessage(`Ready to save · ${(file.size / 1024).toFixed(0)} KB`);
    } catch (error) {
      input.value = ""; setMessage(error instanceof Error ? error.message : "Could not process this photo.");
    } finally { setBusy(false); }
  }

  const showPhoto = Boolean(preview) && !broken && !removed;
  return <div className="sm:col-span-full">
    <input type="hidden" name="image_url" value={initialUrl} />
    <span className="text-[11px] font-bold">Category photo <span className="font-medium text-slate-400">(optional · no photo uses the gradient)</span></span>
    <div className="mt-1.5 flex items-center gap-3">
      <div aria-hidden="true" className={`relative h-24 w-[77px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${tint}`}>
        {!showPhoto && <Icon size={30} strokeWidth={1.25} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80" />}
        {showPhoto && <img src={preview} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <label className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#102b4e] transition active:scale-95 focus-within:ring-2 focus-within:ring-orange-400 ${busy ? "cursor-wait opacity-60" : "cursor-pointer hover:border-orange-300"}`}>
          <ImagePlus aria-hidden="true" size={14} />{showPhoto ? "Replace photo" : "Upload photo"}
          <input type="file" name="category_image" accept="image/*" disabled={busy} onChange={onChange} className="sr-only" />
        </label>
        {(initialUrl || preview) && !removed && <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-rose-600"><Trash2 aria-hidden="true" size={12} /><input type="checkbox" name="remove_image" onChange={e => { setRemoved(e.target.checked); }} className="accent-rose-600" />Remove photo</label>}
        {removed && <button type="button" onClick={() => { setRemoved(false); }} className="text-[11px] font-semibold text-slate-500 underline">Photo will be removed on save · undo</button>}
        <p role="status" aria-live="polite" className="text-[11px] text-slate-500">{message || "Portrait photo works best. Converted to WebP automatically."}</p>
      </div>
    </div>
  </div>;
}
