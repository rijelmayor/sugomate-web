import type { Metadata } from "next";
import "./globals.css";
import SessionRefresh from "@/components/SessionRefresh";
export const metadata: Metadata = {
  metadataBase: new URL("https://sugomate.com"),
  title: "SUGOMATE — Imong sugo, kami bahala.",
  description: "Your everyday delivery partner for food, groceries, parcels, errands and more. Get ready for the SUGOMATE app.",
  applicationName: "SUGOMATE",
  openGraph: { title: "SUGOMATE — Imong sugo, kami bahala.", description: "Order, request, and deliver in one app.", url: "https://sugomate.com", siteName: "SUGOMATE", type: "website" }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SessionRefresh />{children}</body></html>;
}
