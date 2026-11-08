import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/dashboard";

  const destination = new URL(safeNext, requestUrl.origin);
  const response = NextResponse.redirect(destination);

  if (!code) {
    destination.pathname = safeNext === "/reset-password" ? "/forgot-password" : "/login";
    destination.searchParams.set("error", safeNext === "/reset-password" ? "recovery" : "confirmation");
    return NextResponse.redirect(destination);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] Code exchange failed:", error.message);
    const failure = new URL(
      safeNext === "/reset-password" ? "/forgot-password" : "/login",
      requestUrl.origin,
    );
    failure.searchParams.set(
      "error",
      safeNext === "/reset-password" ? "recovery" : "confirmation",
    );
    return NextResponse.redirect(failure);
  }

  return response;
}
