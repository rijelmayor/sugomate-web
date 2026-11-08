import Link from "next/link";

export const metadata = {
  title: "Terms of Service | SUGOMATE",
  description: "Terms and conditions for customers, merchants, and delivery partners using SUGOMATE in the Philippines.",
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-xl font-extrabold">{title}</h2>
    <div className="mt-3 space-y-3 leading-7 text-slate-600">{children}</div>
  </section>
);

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-[#102e57] sm:py-16">
      <article className="mx-auto max-w-4xl rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Legal</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-500">Effective date: November 8, 2026</p>

        <p className="mt-6 leading-7 text-slate-600">
          These Terms of Service (“Terms”) govern your access to and use of the SUGOMATE website, mobile applications,
          marketplace, ordering tools, delivery coordination, and related services (collectively, the “Platform”).
          SUGOMATE is operated in the Philippines as a sole proprietorship (“SUGOMATE,” “we,” “us,” or “our”).
          By registering, accessing an account, placing or accepting an order, applying as a merchant or delivery
          partner, or otherwise using the Platform, you agree to these Terms and our <Link href="/privacy" className="font-bold text-orange-600">Privacy Policy</Link>.
          If you do not agree, do not use the Platform.
        </p>

        <Section title="1. What SUGOMATE does">
          <p>SUGOMATE is a technology platform that helps customers discover participating local merchants, request goods or errands, and coordinate delivery through participating delivery partners. Depending on availability, services may include food, groceries, retail items, parcels, and other permitted errands.</p>
          <p>SUGOMATE may facilitate discovery, order transmission, payment-status communication, delivery matching, status updates, and customer support. A merchant is generally responsible for the goods it lists and sells; a delivery partner is responsible for the delivery activities assigned to them. The Platform does not guarantee that a particular merchant, item, service, or delivery partner will always be available.</p>
          <p>Service coverage, operating hours, minimum order requirements, delivery estimates, and available features may vary by location and may change as the Platform develops.</p>
        </Section>

        <Section title="2. Eligibility and accounts">
          <p>You must be legally capable of entering into an agreement to create and use an account. Information you submit must be accurate, complete, and kept up to date. You must not impersonate another person or create an account using information you are not authorized to use.</p>
          <p>Keep your password, one-time passwords (OTPs), and account access secure. Do not share verification codes with anyone, including a person claiming to be SUGOMATE support. Notify SUGOMATE promptly if you suspect unauthorized access or inaccurate account activity.</p>
          <p>We may verify mobile numbers, email addresses, merchant details, identity information, vehicle information, or other details reasonably needed for account security, onboarding, legal compliance, or safe service operations. Merchant and delivery partner applications may be reviewed and may be approved, declined, paused, or revoked based on applicable requirements and Platform rules.</p>
        </Section>

        <Section title="3. Customer orders and delivery">
          <p>Before submitting an order, review the merchant, item descriptions, quantities, prices, delivery address, delivery fee, applicable charges, and payment method. Your order request is subject to merchant acceptance, stock availability, service coverage, operating hours, and delivery partner availability.</p>
          <p>Displayed preparation and delivery times are estimates, not guarantees. Delays may occur because of traffic, weather, distance, merchant preparation, inaccurate addresses, safety concerns, or other circumstances outside reasonable control. Keep your phone reachable and provide complete delivery instructions.</p>
          <p>You must provide a safe and accessible pickup or drop-off location and ensure that someone authorized can receive the order. You may be responsible for reasonable additional costs or losses caused by an incorrect address, unavailable recipient, or failure to follow reasonable delivery instructions, to the extent permitted by law.</p>
          <p>Inspect delivered items promptly. Report missing, incorrect, damaged, spoiled, or materially misdescribed items through the available support channel as soon as reasonably possible, with the order details and supporting information. This does not remove any mandatory consumer rights or statutory remedies.</p>
        </Section>

        <Section title="4. Merchants and store operators">
          <p>Merchants are responsible for the accuracy and legality of their store profiles, product listings, descriptions, prices, stock status, promotions, business information, and required permits or registrations. Merchants must comply with applicable tax, consumer protection, food safety, product safety, labeling, licensing, and other legal requirements.</p>
          <p>Merchants must accept or decline orders promptly, maintain accurate inventory, prepare accepted orders with reasonable care, package items safely, and hand orders only to the properly assigned delivery partner or recipient. Merchants must not mark an order as ready, handed over, or completed when that status is not accurate.</p>
          <p>Merchants must not list unlawful, counterfeit, stolen, unsafe, restricted, or prohibited goods or services. SUGOMATE may remove listings or restrict accounts where reasonably necessary for safety, compliance, customer protection, or Platform integrity.</p>
          <p>Merchant commissions, service fees, billing arrangements, settlement timing, and other commercial terms will be disclosed through the relevant onboarding materials, Platform settings, or separate merchant agreement. Where a separate written agreement applies, it will govern the specific commercial matter to the extent of any conflict with these general Terms.</p>
        </Section>

        <Section title="5. Delivery partners">
          <p>Delivery partners must provide truthful onboarding information and maintain any driver's license, vehicle registration, insurance, permits, and other qualifications required by law for the delivery activity they undertake. They must obey traffic laws, use appropriate safety equipment, and never operate a vehicle while impaired or otherwise unfit to drive.</p>
          <p>Delivery partners must handle orders carefully, protect customer and merchant information, follow pickup and drop-off instructions, update delivery statuses accurately, and provide proof of delivery only when the delivery has actually occurred. They must not misuse customer addresses, contact details, order contents, photographs, or location information.</p>
          <p>Cash-on-delivery (COD) orders must be handled using the amount and collection instructions shown in the Platform. Delivery partners must collect and account for the correct amount, keep transaction records, and follow the applicable remittance and reconciliation process. They must not demand undisclosed charges.</p>
          <p>For electronic payments, a submitted receipt or screenshot is not by itself confirmation that payment has cleared. The Platform or authorized merchant process may require verification before an order is treated as paid or preparation is authorized. Users must not submit altered, reused, or misleading payment evidence.</p>
          <p>These Terms describe Platform participation requirements and do not waive any rights or obligations arising under applicable labor, tax, insurance, or other laws. The legal nature of any working or commercial relationship depends on the actual arrangement and applicable law.</p>
        </Section>

        <Section title="6. Prices, delivery fees, and payments">
          <p>The order total may include item prices, delivery fees, service charges, and other charges disclosed before order confirmation. The amount payable and available payment methods will be shown in the checkout or order flow. Do not pay amounts that are not shown in the Platform or otherwise properly communicated by an authorized merchant or delivery partner.</p>
          <p>Available payment methods may include COD and supported electronic payment methods. For electronic payments, follow the displayed payment instructions and submit accurate transaction references or proof when requested. An order is not considered paid merely because a user uploaded an image; payment must be confirmed through the applicable verification process.</p>
          <p>For COD, the customer must pay the amount displayed as due at delivery. Delivery partners and merchants must follow the Platform's collection, delivery-fee, and remittance instructions. Users must not privately alter the order total or agree to off-platform charges that bypass required records.</p>
          <p>Refunds, reversals, adjustments, and payment disputes will be assessed using the order record, payment confirmation, merchant and delivery status, evidence provided, and applicable law. Processing time may depend on the payment provider or financial institution. Nothing in these Terms excludes a refund or remedy required by law.</p>
        </Section>

        <Section title="7. Cancellations, failed deliveries, and refunds">
          <p>Cancellation availability may depend on the order stage. A request may no longer be cancellable without cost after a merchant has accepted or prepared it, a delivery partner has collected it, or a service has already been performed, except where a refund or other remedy is required by law or the circumstances justify it.</p>
          <p>If a merchant cannot fulfill an order, an item is unavailable, a delivery cannot safely proceed, or a material service failure occurs, SUGOMATE may coordinate a cancellation, replacement, adjustment, or refund as appropriate. Perishable, prepared, personalized, or time-sensitive goods may have practical limitations, but those limitations do not override mandatory consumer rights.</p>
          <p>We may request photographs, receipts, transaction references, or other reasonable evidence to investigate a complaint. Refunds will be returned through the original or another appropriate payment method where practicable and lawful. A customer is not entitled to duplicate recovery for the same loss.</p>
        </Section>

        <Section title="8. Prohibited conduct">
          <p>You must not use the Platform for fraud, theft, harassment, discrimination, threats, unlawful transactions, money laundering, or the sale or delivery of prohibited goods. You must not falsify identities, addresses, order statuses, ratings, delivery evidence, or payment records.</p>
          <p>You must not interfere with Platform security, probe or attack systems without authorization, introduce malicious code, scrape or harvest personal information, manipulate dispatch or pricing, evade legitimate fees, or use another person's account. You must not use customer, merchant, or rider information for unrelated marketing or personal purposes.</p>
        </Section>

        <Section title="9. Ratings, communications, and user content">
          <p>Ratings, reviews, photographs, messages, and other content you submit must be truthful, lawful, relevant, and respectful. Do not post another person's personal information, confidential material, threats, defamatory statements, or content you do not have the right to share.</p>
          <p>You retain ownership of content you submit. You grant SUGOMATE a limited, non-exclusive permission to host, display, reproduce, and use that content as reasonably necessary to operate, secure, support, and improve the Platform. We may remove content that violates these Terms or applicable law.</p>
        </Section>

        <Section title="10. Privacy and location">
          <p>Our <Link href="/privacy" className="font-bold text-orange-600">Privacy Policy</Link> explains the personal information processed through the Platform, including account details, order records, addresses, location information, payment evidence, merchant and rider onboarding information, and delivery proof. Location access should be used only for relevant features such as address selection, delivery coordination, or route-related functions, subject to device permissions.</p>
          <p>Users must access and use personal information only for the transaction or operational purpose for which it was provided. In particular, customer addresses and phone numbers must not be retained, copied, or used for unrelated contact after the service need ends, except where lawful retention is required.</p>
        </Section>

        <Section title="11. Platform availability and intellectual property">
          <p>We work to keep the Platform reliable and secure but do not promise uninterrupted, error-free, or always-available service. We may perform maintenance, change features, limit availability, or temporarily suspend parts of the Platform for security, legal, operational, or technical reasons.</p>
          <p>The SUGOMATE name, logo, branding, software, design, and Platform materials are owned by or licensed to their respective rights holders. You receive a limited, revocable, non-transferable right to use the Platform for its intended purpose. No other intellectual property rights are transferred to you.</p>
        </Section>

        <Section title="12. Suspension and account closure">
          <p>You may stop using the Platform and request account closure through the available account or support process. We may restrict, suspend, or terminate access where reasonably necessary because of fraud, safety risks, repeated violations, non-payment, legal requirements, or threats to users or Platform integrity. Where appropriate, we will provide notice or an opportunity to address the issue.</p>
          <p>Closing an account does not automatically cancel outstanding orders, settle unpaid balances, erase records that must lawfully be retained, or end obligations relating to completed transactions, disputes, or investigations.</p>
        </Section>

        <Section title="13. Disclaimers and liability">
          <p>SUGOMATE provides the technology and coordination described in these Terms. Unless expressly stated otherwise, merchants remain responsible for their goods, product descriptions, preparation, and legal compliance; delivery partners remain responsible for their delivery conduct and legal compliance.</p>
          <p>To the extent permitted by law, SUGOMATE is not liable for indirect or consequential loss, interruptions outside its reasonable control, or independent acts or omissions of users. This provision does not exclude liability for SUGOMATE's own obligations where liability cannot lawfully be excluded, nor does it limit consumer rights or remedies under Philippine law.</p>
        </Section>

        <Section title="14. Complaints and dispute handling">
          <p>For an order concern, contact the available SUGOMATE support channel and include the order reference, issue, and relevant evidence. We may review platform records and coordinate with the customer, merchant, delivery partner, and payment provider to resolve the concern.</p>
          <p>These Terms are governed by the laws of the Republic of the Philippines. Nothing here prevents a consumer from exercising a right or remedy before a government agency or court with proper jurisdiction under applicable law. Where appropriate, parties should first attempt to resolve operational concerns in good faith.</p>
        </Section>

        <Section title="15. Changes to these Terms">
          <p>We may revise these Terms to reflect changes in the Platform, business operations, or applicable law. The current version will be posted on this page with its effective date. If a change materially affects users, we will provide notice through the Platform or another reasonable channel where practicable. Continued use after the revised Terms take effect constitutes acceptance to the extent permitted by law.</p>
        </Section>

        <Section title="16. Operator and contact information">
          <p>SUGOMATE is operated in the Philippines as a sole proprietorship. The registered proprietor's full legal name, registered business address, and dedicated customer-support contact details must be displayed here once confirmed against the business registration and official contact channels. A dedicated email address has not yet been established. Until official contact details are published, use the support or contact channel made available within the SUGOMATE Platform, if available.</p>
          <p>This document is a platform terms draft prepared for operational use. The operator details in this section must be completed and the Terms should receive Philippine legal review before public launch.</p>
        </Section>

        <div className="mt-10 border-t border-slate-100 pt-6 text-sm text-slate-500">
          Read our <Link href="/privacy" className="font-bold text-orange-600">Privacy Policy</Link> for details about personal information.
        </div>
      </article>
    </main>
  );
}
