import { requireCustomer } from "@/lib/auth";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer();
  return children;
}
