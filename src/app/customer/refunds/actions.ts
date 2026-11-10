"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { walletCustomerContext } from "@/lib/wallet-server";

export async function requestOrderRefund(formData:FormData){
 const {db}=await walletCustomerContext();
 const orderId=String(formData.get("order_id")??"");
 const method=String(formData.get("refund_method")??"");
 if(!/^[0-9a-f-]{36}$/i.test(orderId)||!["direct_gcash","sugomate_wallet"].includes(method)) redirect("/customer/refunds?error=request");
 const {error}=await db.rpc("customer_request_order_refund",{p_order_id:orderId,p_method:method});
 if(error) redirect("/customer/refunds?error=request");
 revalidatePath("/customer/refunds"); revalidatePath("/customer/wallet");
 redirect("/customer/refunds?requested=1");
}
export async function confirmDirectGcashRefund(formData:FormData){
 const {db}=await walletCustomerContext();
 const caseId=String(formData.get("case_id")??"");
 if(!/^[0-9a-f-]{36}$/i.test(caseId)) redirect("/customer/refunds?error=confirm");
 const {error}=await db.rpc("customer_confirm_direct_gcash_refund",{p_case_id:caseId});
 if(error) redirect("/customer/refunds?error=confirm");
 revalidatePath("/customer/refunds"); revalidatePath("/customer/wallet");
 redirect("/customer/refunds?confirmed=1");
}
