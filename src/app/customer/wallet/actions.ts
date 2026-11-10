"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { walletCustomerContext } from "@/lib/wallet-server";

export async function submitWalletTopup(formData: FormData) {
  const { user, db } = await walletCustomerContext();
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("payment_method") ?? "");
  const reference = String(formData.get("payment_reference") ?? "").trim().slice(0,120);
  const file = formData.get("proof");
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000 || !["gcash","bank"].includes(method) || reference.length < 4 || !(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(file.type)) redirect("/customer/wallet?error=topup-input");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await db.storage.from("wallet-topup-proofs").upload(path, file, { contentType:file.type, upsert:false });
  if (uploadError) redirect("/customer/wallet?error=proof-upload");
  const { error } = await db.from("wallet_top_up_requests").insert({
    customer_id:user.id, amount, payment_method:method, payment_reference:reference, proof_path:path, status:"pending_review"
  });
  if (error) {
    await db.storage.from("wallet-topup-proofs").remove([path]);
    redirect("/customer/wallet?error=request-save");
  }
  revalidatePath("/customer/wallet");
  redirect("/customer/wallet?topup=submitted");
}

export async function requestWalletWithdrawal(formData: FormData) {
  const { user, admin } = await walletCustomerContext();
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("payout_method") ?? "");
  const accountName = String(formData.get("account_name") ?? "").trim().slice(0,120);
  const accountNumber = String(formData.get("account_number") ?? "").trim().slice(0,80);
  const bankName = String(formData.get("bank_name") ?? "").trim().slice(0,120);
  const { error } = await admin.rpc("wallet_customer_request_withdrawal", {
    p_customer_id:user.id,p_amount:amount,p_payout_method:method,p_account_name:accountName,
    p_account_number:accountNumber,p_bank_name:bankName || null
  });
  if (error) redirect("/customer/wallet?error=withdrawal");
  revalidatePath("/customer/wallet");
  redirect("/customer/wallet?withdrawal=submitted");
}
