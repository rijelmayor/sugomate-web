"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

async function compressToWebp(source: File): Promise<File> {
  if (!source.type.startsWith("image/")) throw new Error("Choose a valid image file.");
  if (source.size > MAX_SOURCE_BYTES) throw new Error("The selected photo is too large to process. Choose a photo under 20 MB.");

  const bitmap = await createImageBitmap(source);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not process this photo.");
      context.drawImage(bitmap, 0, 0, width, height);

      const quality = [0.84, 0.78, 0.72, 0.66, 0.60, 0.54, 0.48][attempt];
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob || blob.type !== "image/webp") throw new Error("WebP conversion is not supported by this browser. Please update Chrome and try again.");

      if (blob.size <= MAX_UPLOAD_BYTES) {
        const baseName = source.name.replace(/\.[^.]+$/, "") || "product-photo";
        return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
      }

      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
    throw new Error("Could not compress this photo below 4.5 MB. Please choose a smaller photo.");
  } finally {
    bitmap.close();
  }
}

export default function ProductImagePicker({ initialUrl = "" }: { initialUrl?: string }) {
  const [preview, setPreview] = useState(initialUrl);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const objectUrl = useRef<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const otherInput = input === cameraInput.current ? galleryInput.current : cameraInput.current;
    const source = input.files?.[0];
    if (!source) return;

    setProcessing(true);
    setMessage("Compressing photo to WebP…");
    setFileName("");
    if (otherInput) otherInput.value = "";

    try {
      const compressed = await compressToWebp(source);
      const transfer = new DataTransfer();
      transfer.items.add(compressed);
      input.files = transfer.files;

      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(compressed);
      setPreview(objectUrl.current);
      setFileName(`${compressed.name} · ${(source.size / 1024 / 1024).toFixed(2)} MB → ${(compressed.size / 1024 / 1024).toFixed(2)} MB`);
      setMessage("Ready to save. Photo converted to WebP.");
    } catch (error) {
      input.value = "";
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
      setPreview(initialUrl);
      setMessage(error instanceof Error ? error.message : "Unable to process this photo.");
    } finally {
      setProcessing(false);
    }
  }

  return <div className="sm:col-span-2">
    <span className="text-xs font-bold">Product photo</span><input type="hidden" name="image_url" value={initialUrl}/>
    <div className="mt-2 grid gap-3 sm:grid-cols-[160px_1fr]">
      <div className="grid aspect-[4/3] min-h-36 place-items-center overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50">
        {preview ? <img src={preview} alt="Product photo preview" className="h-full max-h-48 w-full object-contain p-3"/> : <div className="text-center text-orange-400"><div className="text-4xl">📷</div><p className="mt-1 text-[10px] font-bold">Full photo preview</p></div>}
      </div>
      <div className="flex flex-col justify-center gap-2">
        <label className={`flex items-center justify-center gap-2 rounded-xl bg-[#102e57] px-4 py-3 text-sm font-bold text-white ${processing ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
          <span>{processing ? "⏳ Processing photo…" : "📸 Capture with camera"}</span>
          <input ref={cameraInput} className="sr-only" type="file" name="product_image" accept="image/*" capture="environment" disabled={processing} onChange={handleChange}/>
        </label>
        <label className={`flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-[#102e57] ${processing ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
          <span>🖼️ Choose from gallery</span>
          <input ref={galleryInput} className="sr-only" type="file" name="product_image" accept="image/*" disabled={processing} onChange={handleChange}/>
        </label>
        <p className="text-[11px] text-slate-500">{fileName || "Camera and gallery photos are converted to WebP · Maximum upload 4.5 MB."}</p>
        {message && <p role="status" aria-live="polite" className="text-[11px] font-medium text-slate-600">{message}</p>}
      </div>
    </div>
  </div>;
}
