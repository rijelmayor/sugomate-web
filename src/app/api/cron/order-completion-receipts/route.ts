import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReceiptJob = {
  id: string;
  order_id: string;
  customer_id: string;
  email_status: string;
  sms_status: string;
  email_attempts: number;
  sms_attempts: number;
};

type OrderItem = { product_name: string; quantity: number; unit_price: number; line_total: number };

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value || 0));
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

function normalizePhilippineMobile(input: string) {
  let value = input.trim();
  value = value.startsWith("+") ? "+" + value.slice(1).replace(/\D/g, "") : value.replace(/\D/g, "");
  if (/^09\d{9}$/.test(value)) return "+63" + value.slice(1);
  if (/^9\d{9}$/.test(value)) return "+63" + value;
  if (/^639\d{9}$/.test(value)) return "+" + value;
  if (/^\+639\d{9}$/.test(value)) return value;
  if (/^\+6309\d{9}$/.test(value)) return "+63" + value.slice(4);
  return null;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Receipt worker is missing Supabase server configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  const fromName = process.env.SMTP_FROM_NAME || "SUGOMATE";
  if (!host || !Number.isInteger(port) || !user || !pass || !fromEmail) {
    throw new Error("Email receipt SMTP is not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM_EMAIL.");
  }
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  try {
    await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to,
      subject,
      text,
      html,
    });
  } finally {
    transporter.close();
  }
}

async function sendSms(to: string, message: string) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) throw new Error("SMS receipt provider is not configured (TEXTBEE_API_KEY).");
  const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ recipients: [to], message }),
    cache: "no-store",
  });
  const body = await response.text();
  let result: { data?: { success?: boolean; failureCount?: number } } = {};
  try { result = JSON.parse(body); } catch { /* provider may return plain text */ }
  if (!response.ok || result.data?.success === false || (result.data?.failureCount ?? 0) > 0) {
    throw new Error(`SMS provider failed (HTTP ${response.status}): ${body.slice(0, 300)}`);
  }
}

async function recordChannel(
  supabase: ReturnType<typeof getAdminClient>,
  job: ReceiptJob,
  channel: "email" | "sms",
  status: "sent" | "failed" | "skipped",
  attempt: number,
  error?: string,
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    [`${channel}_status`]: status,
    [`${channel}_attempts`]: attempt,
    last_error: error ? `${channel}: ${error}`.slice(0, 1000) : null,
    updated_at: now,
  };
  if (status === "sent") patch[`${channel}_sent_at`] = now;
  const { error: updateError } = await supabase.from("order_completion_receipts").update(patch).eq("id", job.id);
  if (updateError) throw updateError;
}

async function processJob(supabase: ReturnType<typeof getAdminClient>, job: ReceiptJob) {
  const [{ data: order, error: orderError }, { data: authResult, error: authError }, { data: profile }] = await Promise.all([
    supabase.from("orders")
      .select("id,order_number,customer_id,merchant_id,subtotal,delivery_fee,total,payment_method,payment_status,delivered_at")
      .eq("id", job.order_id).maybeSingle(),
    supabase.auth.admin.getUserById(job.customer_id),
    supabase.from("profiles").select("display_name,phone").eq("id", job.customer_id).maybeSingle(),
  ]);
  if (orderError || !order) throw new Error(orderError?.message ?? "Completed order could not be found.");
  if (authError) throw new Error(authError.message);
  const customer = authResult.user;
  const [{ data: merchant }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("merchants").select("name").eq("id", order.merchant_id).maybeSingle(),
    supabase.from("order_items").select("product_name,quantity,unit_price,line_total").eq("order_id", order.id),
  ]);
  if (itemsError) throw new Error(itemsError.message);
  const customerName = profile?.display_name?.trim() || customer?.user_metadata?.full_name || "Customer";
  const merchantName = merchant?.name || "SUGOMATE Merchant";
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();
  const lines = (items ?? []) as OrderItem[];
  const itemText = lines.map(item => `${item.product_name} × ${item.quantity} — ${peso(Number(item.line_total))}`).join("\n");
  const itemHtml = lines.map(item =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #edf0f4">${escapeHtml(item.product_name)} × ${Number(item.quantity)}</td><td style="padding:8px 0;border-bottom:1px solid #edf0f4;text-align:right">${peso(Number(item.line_total))}</td></tr>`
  ).join("");
  const deliveredAt = order.delivered_at
    ? new Date(order.delivered_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })
    : new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
  const paymentLabel = String(order.payment_method || "").toLowerCase() === "gcash" ? "GCash" : "Cash on Delivery";
  const subject = `SUGOMATE receipt — Order ${orderNumber} delivered`;
  const plain = [
    `Hi ${customerName},`,
    `Your order from ${merchantName} has been successfully delivered.`,
    `Order: ${orderNumber}`,
    itemText,
    `Subtotal: ${peso(Number(order.subtotal))}`,
    `Delivery fee: ${peso(Number(order.delivery_fee))}`,
    `Total: ${peso(Number(order.total))}`,
    `Payment: ${paymentLabel} (${String(order.payment_status || "paid").toUpperCase()})`,
    `Delivered: ${deliveredAt} (Philippine time)`,
    "Thank you for choosing SUGOMATE! Imong sugo, Kami Bahala.",
  ].filter(Boolean).join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#172b4d"><div style="max-width:600px;margin:24px auto;background:#fff;border-radius:18px;overflow:hidden"><div style="background:#102e57;padding:28px;color:#fff"><div style="font-size:24px;font-weight:800;letter-spacing:1px">SUGOMATE</div><p style="margin:8px 0 0;color:#ffe0bd">Imong sugo, Kami Bahala.</p></div><div style="padding:28px"><div style="color:#16845b;font-weight:700">✓ ORDER DELIVERED</div><h1 style="font-size:22px;margin:12px 0">Thank you, ${escapeHtml(customerName)}!</h1><p>Your order from <strong>${escapeHtml(merchantName)}</strong> has been successfully delivered.</p><div style="background:#f5f7fb;border-radius:12px;padding:14px;margin:20px 0"><div style="font-size:12px;color:#64748b">ORDER REFERENCE</div><strong>${escapeHtml(orderNumber)}</strong><div style="font-size:12px;color:#64748b;margin-top:8px">Delivered ${escapeHtml(deliveredAt)} (Philippine time)</div></div><table style="width:100%;border-collapse:collapse">${itemHtml}</table><table style="width:100%;margin-top:16px;border-collapse:collapse"><tr><td style="padding:6px 0">Subtotal</td><td style="text-align:right">${peso(Number(order.subtotal))}</td></tr><tr><td style="padding:6px 0">Delivery fee</td><td style="text-align:right">${peso(Number(order.delivery_fee))}</td></tr><tr><td style="padding:12px 0;border-top:1px solid #dce2eb;font-weight:800">Total</td><td style="padding:12px 0;border-top:1px solid #dce2eb;text-align:right;font-weight:800">${peso(Number(order.total))}</td></tr></table><p style="margin-top:18px">Payment: <strong>${escapeHtml(paymentLabel)} — ${escapeHtml(String(order.payment_status || "paid").toUpperCase())}</strong></p><p style="margin-top:26px">Thank you for choosing SUGOMATE!<br/><strong>Imong sugo, Kami Bahala.</strong></p></div></div></body></html>`;

  if (job.email_status === "pending" || job.email_status === "failed") {
    const attempt = Number(job.email_attempts || 0) + 1;
    const email = customer?.email?.trim();
    if (!email) await recordChannel(supabase, job, "email", "skipped", attempt, "Customer account has no registered email address.");
    else {
      try { await sendEmail(email, subject, html, plain); await recordChannel(supabase, job, "email", "sent", attempt); }
      catch (error) { await recordChannel(supabase, job, "email", "failed", attempt, error instanceof Error ? error.message : "Email send failed."); }
    }
  }

  if (job.sms_status === "pending" || job.sms_status === "failed") {
    const attempt = Number(job.sms_attempts || 0) + 1;
    const phone = normalizePhilippineMobile(String(profile?.phone || ""));
    if (!phone) await recordChannel(supabase, job, "sms", "skipped", attempt, "Customer account has no valid registered mobile number.");
    else {
      const sms = `SUGOMATE: Your order #${orderNumber} from ${merchantName} was successfully delivered. Total: ${peso(Number(order.total))}. Payment: ${paymentLabel}. Thank you! Imong sugo, Kami Bahala.`;
      try { await sendSms(phone, sms); await recordChannel(supabase, job, "sms", "sent", attempt); }
      catch (error) { await recordChannel(supabase, job, "sms", "failed", attempt, error instanceof Error ? error.message : "SMS send failed."); }
    }
  }
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = getAdminClient();
    const { data: jobs, error } = await supabase.rpc("claim_order_completion_receipts", { p_limit: 10 });
    if (error) throw error;
    let processed = 0;
    for (const job of (jobs ?? []) as ReceiptJob[]) {
      try {
        await processJob(supabase, job);
        const { data: latest } = await supabase.from("order_completion_receipts")
          .select("email_status,sms_status,email_attempts,sms_attempts")
          .eq("id", job.id).maybeSingle();
        const terminal = (status: string, attempts: number) => ["sent", "skipped"].includes(status) || (status === "failed" && attempts >= 5);
        const done = !!latest && terminal(latest.email_status, latest.email_attempts) && terminal(latest.sms_status, latest.sms_attempts);
        await supabase.from("order_completion_receipts").update({
          locked_at: null, completed_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        processed++;
      } catch (jobError) {
        await supabase.from("order_completion_receipts").update({
          locked_at: null,
          last_error: (jobError instanceof Error ? jobError.message : "Receipt processing failed.").slice(0, 1000),
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
      }
    }
    return NextResponse.json({ ok: true, claimed: jobs?.length ?? 0, processed });
  } catch (error) {
    console.error("[order-completion-receipts]", error);
    return NextResponse.json({ error: "Receipt processing failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
