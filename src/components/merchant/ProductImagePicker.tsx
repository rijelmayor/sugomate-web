"use client";

import { useEffect, useRef, useState } from "react";

export default function ProductImagePicker({ initialUrl = "" }: { initialUrl?: string }) {
  const [preview, setPreview] = useState(initialUrl);
  const [fileName, setFileName] = useState("");
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      setFileName("");
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
      setPreview(initialUrl);
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
    setFileName(file.name);
  }

  return <div className="sm:col-span-2">
    <span className="text-xs font-bold">Product photo</span>
    <div className="mt-2 grid gap-3 sm:grid-cols-[160px_1fr]">
      <div className="grid min-h-36 place-items-center overflow-hidden rounded-2xl border border-dashed border-orange-200 bg-orange-50">
        {preview ? <img src={preview} alt="Product photo preview" className="h-36 w-full object-cover"/> : <div className="text-center text-orange-400"><div className="text-4xl">📷</div><p className="mt-1 text-[10px] font-bold">Photo preview</p></div>}
      </div>
      <div className="flex flex-col justify-center gap-2">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#102e57] px-4 py-3 text-sm font-bold text-white">
          <span>📸 Capture with camera</span>
          <input className="sr-only" type="file" name="product_image" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleChange}/>
        </label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-[#102e57]">
          <span>🖼️ Choose from gallery</span>
          <input className="sr-only" type="file" name="product_image" accept="image/jpeg,image/png,image/webp" onChange={handleChange}/>
        </label>
        <p className="text-[11px] text-slate-500">{fileName || "JPG, PNG or WEBP · Maximum 5 MB. A new photo replaces the existing one."}</p>
      </div>
    </div>
  </div>;
}
