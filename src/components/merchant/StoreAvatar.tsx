/** Store logo, or the store's first letter on the SUGOMATE gradient when there is no logo. */
export default function StoreAvatar({ name, logoUrl, size = 44 }: { name: string; logoUrl?: string | null; size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size }} className="relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-lg font-black text-white shadow-sm">
    {name.trim().charAt(0).toUpperCase() || "S"}
    {logoUrl && <img src={logoUrl} alt="" className="absolute inset-0 h-full w-full bg-white object-cover" />}
  </span>;
}

