"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function submitMerchantRefundEvidence(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const caseId=String(formData.get("case_id")??""); const reference=String(formData.get("reference")??"").trim();
 const file=formData.get("proof");
 if(!/^[0-9a-f-]{36}$/i.test(caseId)||reference.length<4||!(file instanceof File)||file.size<1||file.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)) redirect("/merchant/refunds?error=evidence");
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg"; const path=`${user.id}/${caseId}/${randomUUID()}.${ext}`;
 const {error:uploadError}=await supabase.storage.from("merchant-refund-proofs").upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError) redirect("/merchant/refunds?error=upload");
 const {error}=await supabase.rpc("merchant_submit_direct_gcash_refund_evidence",{p_case_id:caseId,p_reference:reference,p_proof_path:path});
 if(error){await supabase.storage.from("merchant-refund-proofs").remove([path]);redirect("/merchant/refunds?error=submit");}
 revalidatePath("/merchant/refunds"); revalidatePath("/customer/refunds"); redirect("/merchant/refunds?submitted=1");
}
