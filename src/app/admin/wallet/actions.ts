"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { walletAdminContext } from "@/lib/wallet-server";

export async function saveWalletPaymentInstructions(formData:FormData){
 const {user,admin}=await walletAdminContext();
 const method=String(formData.get("payment_method")??"");
 const displayName=String(formData.get("display_name")??"").trim().slice(0,80);
 const accountName=String(formData.get("account_name")??"").trim().slice(0,120);
 const accountNumber=String(formData.get("account_number")??"").trim().slice(0,80);
 const bankName=String(formData.get("bank_name")??"").trim().slice(0,120);
 const instructions=String(formData.get("instructions")??"").trim().slice(0,1000);
 const enabled=formData.get("is_enabled")==="on";
 if(!["gcash","bank"].includes(method)||displayName.length<2||accountName.length<2||accountNumber.length<5) redirect("/admin/wallet?error=payment-instructions");
 const {data:saved,error}=await admin.from("wallet_payment_instructions").upsert({payment_method:method,display_name:displayName,account_name:accountName,account_number:accountNumber,bank_name:bankName||null,instructions,is_enabled:enabled,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"payment_method"}).select("id").single();
 if(error||!saved) redirect("/admin/wallet?error=payment-instructions");
 const {error:auditError}=await admin.from("wallet_audit_events").insert({actor_user_id:user.id,actor_role:"admin",event_type:"wallet_payment_instructions_updated",entity_type:"wallet_payment_instructions",entity_id:saved.id,details:{payment_method:method,enabled}});
 if(auditError) redirect("/admin/wallet?error=payment-instructions-audit");
 revalidatePath("/admin/wallet"); revalidatePath("/customer/wallet");
 redirect("/admin/wallet?saved=1");
}
export async function reviewWalletWithdrawal(formData:FormData){
 const {user,admin}=await walletAdminContext();
 const requestId=String(formData.get("request_id")??"");
 const decision=String(formData.get("decision")??"");
 const reference=String(formData.get("payment_reference")??"").trim();
 const note=String(formData.get("admin_note")??"").trim().slice(0,500);
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||!["paid","rejected"].includes(decision)||(decision==="paid"&&reference.length<4)) redirect("/admin/wallet?error=withdrawal-review");
 const {error}=await admin.rpc("wallet_admin_review_withdrawal",{p_request_id:requestId,p_admin_id:user.id,p_decision:decision,p_payment_reference:reference||null,p_admin_note:note||null});
 if(error) redirect("/admin/wallet?error=withdrawal-review");
 const {data:req}=await admin.from("wallet_withdrawal_requests").select("customer_id,amount,status").eq("id",requestId).maybeSingle();
 await admin.from("wallet_audit_events").insert({actor_user_id:user.id,actor_role:"admin",event_type:"withdrawal_"+decision+"_notification_pending",entity_type:"withdrawal_request",entity_id:requestId,details:{customer_id:req?.customer_id,amount:req?.amount}});
 revalidatePath("/admin/wallet"); revalidatePath("/customer/wallet");
 redirect("/admin/wallet?withdrawalReviewed=1");
}
export async function rejectWalletTopup(formData:FormData){
 const {user,admin}=await walletAdminContext();
 const requestId=String(formData.get("request_id")??"");
 const note=String(formData.get("admin_note")??"").trim().slice(0,500);
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||note.length<3) redirect("/admin/wallet?error=topup-rejection");
 const {data:req}=await admin.from("wallet_top_up_requests").select("id,status").eq("id",requestId).maybeSingle();
 if(!req||!["pending_review","otp_pending"].includes(req.status)) redirect("/admin/wallet?error=topup-rejection");
 const {error}=await admin.from("wallet_top_up_requests").update({status:"rejected",admin_note:note,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",requestId).in("status",["pending_review","otp_pending"]);
 if(error) redirect("/admin/wallet?error=topup-rejection");
 await admin.from("wallet_authorization_challenges").update({consumed_at:new Date().toISOString()}).eq("top_up_request_id",requestId).is("consumed_at",null);
 await admin.from("wallet_audit_events").insert({actor_user_id:user.id,actor_role:"admin",event_type:"topup_rejected",entity_type:"top_up_request",entity_id:requestId,details:{reason:note}});
 revalidatePath("/admin/wallet"); revalidatePath("/customer/wallet");
 redirect("/admin/wallet?topupRejected=1");
}
