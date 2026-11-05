import { submitGcashPayment } from "@/app/customer/orders/payment-actions";
import FormSubmitButton from "@/components/FormSubmitButton";

export default function GcashPaymentSubmission({ orderId, orderNumber, merchantName, paymentType, accountName, mobileNumber, qrUrl, total, paymentStatus, submittedAt, reference, orderStatus }: {
  orderId: string;
  orderNumber: string;
  merchantName: string;
  paymentType: string;
  accountName: string | null;
  mobileNumber: string | null;
  qrUrl: string | null;
  total: number | string;
  paymentStatus: string;
  submittedAt: string | null;
  reference: string | null;
  orderStatus: string;
}) {
  if (paymentStatus === "paid") return <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">✓ GCash payment confirmed by {merchantName}.</div>;
  if (["cancelled","rejected","delivered"].includes(orderStatus)) return null;
  return <section className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-[#102e57]">Pay with GCash</h3><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-sky-800">{submittedAt ? "Verification pending" : "Payment needed"}</span></div>
    <p className="mt-1 text-xs leading-5 text-slate-600">Pay the exact order total below, including the delivery fee. The merchant will verify the transaction before marking it paid.</p>
    <div className="mt-3 rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Amount to pay</p><p className="text-2xl font-black text-[#102e57]">₱{Number(total).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
    {paymentType === "qr" && qrUrl ? <div className="mt-3 text-center"><img src={qrUrl} alt={merchantName+" GCash QR code"} className="mx-auto h-48 w-48 rounded-xl border border-slate-200 bg-white object-contain p-2"/><p className="mt-2 text-xs text-slate-600">Scan this QR using GCash. If you are viewing this on the same phone, save the QR image and use the QR upload option in your GCash app if available.</p></div> : <div className="mt-3 rounded-xl bg-white p-3"><p className="text-xs text-slate-500">GCash account name</p><p className="font-extrabold text-[#102e57]">{accountName}</p><p className="mt-2 text-xs text-slate-500">GCash mobile number</p><p className="text-lg font-black tracking-wide text-[#102e57]">{mobileNumber}</p></div>}
    {submittedAt ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Proof submitted. Waiting for merchant verification.</strong><p className="mt-1">Transaction reference: {reference || "Not available"}</p><p>The merchant will update this order when the payment is confirmed.</p></div> : <form action={submitGcashPayment} encType="multipart/form-data" className="mt-4 space-y-3 border-t border-sky-100 pt-4">
      <input type="hidden" name="order_id" value={orderId}/>
      <label className="block text-xs font-bold text-slate-700">GCash transaction reference number<input name="transaction_reference" required minLength={6} maxLength={40} pattern="[A-Za-z0-9-]{6,40}" placeholder="Enter the reference number from your receipt" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/></label>
      <label className="block text-xs font-bold text-slate-700">Upload GCash receipt / screenshot <span className="text-rose-600">· required</span><input name="payment_proof" type="file" required accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-3 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[#102e57] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"/></label>
      <p className="text-[11px] text-slate-500">JPG, PNG or WebP · Maximum 5 MB. Do not upload your GCash password, MPIN or OTP.</p>
      <FormSubmitButton pendingLabel="Submitting proof…" className="w-full rounded-full bg-[#102e57] px-4 py-3 text-sm font-black text-white">Submit payment proof</FormSubmitButton>
    </form>}
  </section>;
}
