"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import StoreAvatar from "@/components/merchant/StoreAvatar";

const SIZE = 512;
const MAX_BYTES = 1024 * 1024;

async function squareWebp(source: File): Promise<File> {
  if (!source.type.startsWith("image/")) throw new Error("Choose a valid image file.");
  if (source.size > 20 * 1024 * 1024) throw new Error("That photo is over 20 MB. Choose a smaller one.");
  const bitmap = await createImageBitmap(source);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process this photo.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob || blob.type !== "image/webp") throw new Error("This browser cannot convert photos to WebP. Try Chrome.");
      if (blob.size <= MAX_BYTES) return new File([blob], "logo.webp", { type: "image/webp" });
    }
    throw new Error("Could not shrink this logo enough. Choose another image.");
  } finally { bitmap.close(); }
}

/** Square store-logo upload. The picture is centre-cropped and converted to WebP in the browser. */
export default function StoreLogoPicker({ name, initialUrl = "" }: { name: string; initialUrl?: string }) {
  const [preview, setPreview] = useState(initialUrl);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const objectUrl = useRef<string | null>(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const source = input.files?.[0];
    if (!source) return;
    setBusy(true); setMessage("Preparing logo…");
    try {
      const file = await squareWebp(source);
      const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      setPreview(objectUrl.current); setRemoved(false);
      setMessage("Ready. Press “Save store settings” to apply.");
    } catch (error) { input.value = ""; setMessage(error instanceof Error ? error.message : "Could not process this image."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 flex items-center gap-4">
    <input type="hidden" name="existing_logo_url" value={initialUrl} />
    <StoreAvatar name={name} logoUrl={removed ? null : preview} size={80} />
    <div className="flex min-w-0 flex-col items-start gap-2">
      <label className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold transition active:scale-95 focus-within:ring-2 focus-within:ring-orange-400 ${busy ? "cursor-wait opacity-60" : "cursor-pointer hover:border-orange-300"}`}>
        <ImagePlus aria-hidden="true" size={15} />{preview && !removed ? "Change logo" : "Upload logo"}
        <input type="file" name="store_logo" accept="image/*" disabled={busy} onChange={onChange} className="sr-only" />
      </label>
      {(initialUrl || preview) && <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-rose-600"><Trash2 aria-hidden="true" size={13} /><input type="checkbox" name="remove_logo" checked={removed} onChange={e => setRemoved(e.target.checked)} className="accent-rose-600" />Remove logo</label>}
      <p role="status" aria-live="polite" className="text-xs text-slate-500">{message || "Square image works best. No logo shows your store’s first letter."}</p>
    </div>
  </div>;
}
