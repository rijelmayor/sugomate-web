import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request:NextRequest){
 // Link prefetches only fetch loading shells, so skip the two auth calls for them (the real navigation is still verified).
 if(request.headers.get("next-router-prefetch")==="1"||request.headers.get("purpose")==="prefetch") return NextResponse.next();
 let response=NextResponse.next({request});
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll(){return request.cookies.getAll();},setAll(cookiesToSet,headers){cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));Object.entries(headers??{}).forEach(([key,value])=>response.headers.set(key,value));}}});
 const {data:{user}}=await supabase.auth.getUser(), path=request.nextUrl.pathname;
 const publicRoute=path==="/register"||path==="/login"||path==="/verify-phone"||path.startsWith("/auth/");
 if(user&&!publicRoute){const {data:profile}=await supabase.from("profiles").select("phone_verified_at").eq("id",user.id).maybeSingle();if(!profile?.phone_verified_at){const url=request.nextUrl.clone();url.pathname="/verify-phone";url.search="";return NextResponse.redirect(url);}}
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};