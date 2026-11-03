import { redirect } from "next/navigation";

type Search = { category?: string; municipality?: string; error?: string };

export default async function CustomerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.municipality) query.set("municipality", params.municipality);
  if (params.error) query.set("error", params.error);
  redirect(`/dashboard${query.size ? `?${query.toString()}` : ""}#marketplace`);
}
