import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | SUGOMATE",
  description: "How SUGOMATE collects, uses, shares, and protects personal information in its delivery platform.",
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-xl font-extrabold">{title}</h2>
    <div className="mt-3 space-y-3 leading-7 text-slate-600">{children}</div>
  </section>
);

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-[#102e57] sm:py-16">
      <article className="mx-auto max-w-4xl rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Legal</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Effective date: November 8, 2026</p>

        <p className="mt-6 leading-7 text-slate-600">
          This Privacy Policy explains how SUGOMATE (“SUGOMATE,” “we,” “us,” or “our”), a delivery and errands
          platform operated in the Philippines as a sole proprietorship, collects, uses, stores, and shares personal
          information when you use our website, mobile applications, marketplace, and related services. We handle
          personal information in accordance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173),
          its Implementing Rules and Regulations, and applicable National Privacy Commission issuances.
        </p>
        <p className="mt-3 leading-7 text-slate-600">
          This Policy applies to customers, merchant owners and staff, delivery partners, applicants, website visitors,
          and people who contact us. Please read it together with our <Link href="/terms" className="font-bold text-orange-600">Terms of Service</Link>.
        </p>

        <Section title="1. Personal information we collect">
          <p>Depending on your role and how you use SUGOMATE, we may collect the following categories:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Account and contact details:</strong> name, email address, mobile number, account identifier, login and authentication records, and account preferences.</li>
            <li><strong>Customer and order details:</strong> delivery addresses, saved address labels, order contents, merchant selected, order history, delivery instructions, complaints, ratings, and communications relating to an order.</li>
            <li><strong>Location and delivery details:</strong> address coordinates or device location when you grant permission or enter a location, pickup and drop-off points, route or dispatch information, delivery status, and proof-of-delivery records.</li>
            <li><strong>Merchant information:</strong> store and branch names, business address, contact details, product listings, prices, inventory, business application information, and documents or permits submitted for review.</li>
            <li><strong>Delivery partner information:</strong> application and profile details, vehicle type and plate details, license or identification information and document images where requested, service availability, delivery assignments, earnings and payout records, and performance or safety-related records.</li>
            <li><strong>Payment and transaction information:</strong> order totals, delivery fees, payment method, payment status, transaction references, uploaded receipts or screenshots, COD collection and remittance records, refunds, adjustments, and billing history. We do not intend to collect or store full payment-card credentials through ordinary order forms.</li>
            <li><strong>Device and technical information:</strong> IP address, browser or device type, operating system, app version, access times, diagnostic logs, and security events generated when you use the Platform.</li>
            <li><strong>Support and communications:</strong> messages, feedback, reports, photographs, and other information you choose to provide when requesting assistance or reporting a problem.</li>
          </ul>
          <p>Please provide only information requested for the relevant feature or transaction. Do not upload another person’s identification, payment record, or personal information unless you are authorized to do so.</p>
        </Section>

        <Section title="2. How we use personal information">
          <p>We process personal information for specific and legitimate purposes, including to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>create, authenticate, secure, and administer customer, merchant, and delivery partner accounts;</li>
            <li>verify mobile numbers, email addresses, merchant applications, delivery partner applications, and submitted supporting documents;</li>
            <li>display merchants and products, receive orders, coordinate preparation, assign or offer deliveries, and communicate order progress;</li>
            <li>identify pickup and drop-off locations, support dispatch and navigation, and provide relevant delivery estimates;</li>
            <li>process or verify payments, record COD collections, reconcile transactions, calculate fees, and administer refunds or adjustments;</li>
            <li>provide customer support, investigate complaints, resolve disputes, and maintain order and transaction histories;</li>
            <li>detect fraud, fake payment evidence, account misuse, unsafe activity, and violations of Platform rules;</li>
            <li>maintain, troubleshoot, protect, analyze, and improve the Platform and its services;</li>
            <li>send service notices, OTPs, order updates, security alerts, and important policy changes;</li>
            <li>meet tax, accounting, regulatory, law-enforcement, and other legal obligations; and</li>
            <li>establish, exercise, or defend legal claims and protect the rights and safety of users and SUGOMATE.</li>
          </ul>
        </Section>

        <Section title="3. Lawful basis for processing">
          <p>We process personal information only when a lawful basis applies. Depending on the information and purpose, this may include your consent; the necessity of processing to provide a service you requested or perform a contract; compliance with a legal obligation; protection of vital interests; or legitimate interests pursued by SUGOMATE or another party where those interests are not overridden by your fundamental rights and freedoms.</p>
          <p>Where we rely on consent, you may withdraw it. Withdrawal does not make prior lawful processing invalid and may affect features that require the information or permission. We will explain when information is required to provide a requested service and when it is optional.</p>
        </Section>

        <Section title="4. When information is shared">
          <p>We do not sell personal information. We disclose information only when reasonably necessary for the purposes described in this Policy, with appropriate safeguards and subject to applicable law. Depending on the transaction, recipients may include:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Merchants:</strong> relevant customer name, order items, order instructions, and information needed to prepare and fulfill the order.</li>
            <li><strong>Assigned delivery partners:</strong> customer name or delivery contact details, pickup and drop-off information, order reference, and delivery instructions needed to complete the assigned delivery.</li>
            <li><strong>Customers:</strong> relevant merchant/store information and delivery progress or delivery partner details needed to understand and receive the order.</li>
            <li><strong>Technology and operations providers:</strong> hosting, database, authentication, SMS or email delivery, mapping, analytics, customer support, payment processing, and security providers that help operate the Platform.</li>
            <li><strong>Professional advisers and authorities:</strong> accountants, auditors, lawyers, regulators, courts, law-enforcement agencies, or government bodies when disclosure is reasonably necessary or legally required.</li>
          </ul>
          <p>We limit disclosures to information reasonably needed for the recipient’s role. Merchants and delivery partners must use customer information only to fulfill the relevant order and must not reuse it for unrelated marketing, personal contact, or other purposes.</p>
          <p>Some service providers may process information using systems located outside the Philippines. Where this occurs, we take steps appropriate to the circumstances to require confidentiality, security, and a level of protection consistent with applicable privacy obligations.</p>
        </Section>

        <Section title="5. Location information and device permissions">
          <p>Location information may be collected when you enter an address, choose a map location, or grant device location permission. We use it for address selection, service-area checks, delivery matching, dispatch, route coordination, and delivery-related updates.</p>
          <p>Location access should be limited to the feature and period reasonably needed. You can manage location permissions through your device settings. If you disable location access, you may still be able to enter an address manually, but some location-dependent features may not work as intended.</p>
        </Section>

        <Section title="6. Payment information and proof of payment">
          <p>SUGOMATE may record payment method, amount, transaction reference, payment status, and supporting evidence such as a receipt or screenshot uploaded for verification. Electronic payment evidence may be reviewed by an authorized merchant or administrator, or checked through an available payment-provider process, before the order is treated as paid.</p>
          <p>Do not upload passwords, PINs, one-time passwords, full card numbers, or unrelated financial information. If a third-party payment provider handles a transaction, its own privacy policy and terms may also apply to the information it collects directly.</p>
        </Section>

        <Section title="7. Cookies, logs, and analytics">
          <p>The website and Platform may use essential cookies, session technologies, and technical logs to maintain sign-in sessions, protect accounts, remember necessary settings, troubleshoot errors, and understand service reliability. If optional analytics or similar technologies are introduced, we will provide appropriate notice and choices where required by law.</p>
        </Section>

        <Section title="8. Data retention and secure disposal">
          <p>We retain personal information only for as long as reasonably necessary for the purpose for which it was collected, to provide the service, maintain legitimate business and accounting records, address disputes, protect the Platform, or comply with legal requirements. Retention periods vary by record type and applicable obligations; we do not retain identifiable information indefinitely merely in case it may be useful in the future.</p>
          <p>When information is no longer needed and no legal or legitimate retention ground applies, we will take reasonable steps to delete, anonymize, or securely dispose of it. Some transaction, accounting, fraud-prevention, or legal records may remain after account closure for the period required or permitted by law.</p>
        </Section>

        <Section title="9. Security measures">
          <p>We use reasonable organizational, physical, and technical safeguards designed to protect personal information against unauthorized access, use, alteration, disclosure, loss, or destruction. Measures may include access restrictions, authentication controls, secure hosting configurations, monitoring, backups, staff or service-provider confidentiality obligations, and review of security incidents.</p>
          <p>No website, application, network, or storage system is completely secure. You are responsible for keeping your credentials private, using a secure device, and notifying us promptly if you suspect account compromise or unauthorized disclosure.</p>
        </Section>

        <Section title="10. Your rights as a data subject">
          <p>Subject to the Data Privacy Act and other applicable laws, you may exercise rights that include:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>the right to be informed about the collection and processing of your personal information;</li>
            <li>the right to reasonable access to personal information and relevant processing details;</li>
            <li>the right to correct inaccurate or incomplete information;</li>
            <li>the right to object to certain processing, or withdraw consent where consent is the basis;</li>
            <li>the right to request erasure or blocking where the legal conditions are met;</li>
            <li>the right to data portability where applicable;</li>
            <li>the right to lodge a complaint with the National Privacy Commission; and</li>
            <li>the right to claim damages where provided by law.</li>
          </ul>
          <p>To protect your account and other people, we may ask you to verify your identity or authority before acting on a request. Some information may need to be retained or processed despite a request where a lawful basis or legal obligation applies. We will explain the outcome where permitted.</p>
        </Section>

        <Section title="11. Children and minors">
          <p>SUGOMATE’s account and transaction services are intended for people who can legally enter into the relevant transaction. A parent or legal guardian should supervise any use by a minor where permitted. We do not knowingly seek to collect children’s personal information beyond what is necessary and lawfully authorized. If you believe a child has provided personal information without appropriate authority, contact us so we can review the matter.</p>
        </Section>

        <Section title="12. Third-party services and links">
          <p>The Platform may link to or rely on services operated by third parties, such as payment providers, map services, app stores, or communication providers. Those services may collect information under their own privacy notices and terms. SUGOMATE is not responsible for the privacy practices of independent third-party websites or services that it does not control.</p>
        </Section>

        <Section title="13. Personal data breaches">
          <p>If a personal data breach occurs, we will assess and respond to it in accordance with applicable law, including making notifications to the National Privacy Commission and affected individuals when legally required. We will take reasonable steps to contain the incident, investigate its cause, reduce potential harm, and improve safeguards.</p>
        </Section>

        <Section title="14. Changes to this Privacy Policy">
          <p>We may update this Policy when our services, data practices, or legal requirements change. The latest version will be posted on this page with its effective date. If a change materially affects how personal information is processed, we will provide additional notice or seek consent where required by law.</p>
        </Section>

        <Section title="15. Privacy contact and operator details">
          <p>SUGOMATE is operated in the Philippines as a sole proprietorship. The registered proprietor’s full legal name, registered business address, and designated Data Protection Officer or privacy contact details must be confirmed and published here before public launch. A dedicated email address has not yet been established.</p>
          <p>For now, submit privacy questions or requests through the official SUGOMATE support/contact channel when it is made available. We will publish the dedicated privacy contact details on this page once established. You may also contact the National Privacy Commission through its official website at <a href="https://privacy.gov.ph/" target="_blank" rel="noreferrer" className="font-bold text-orange-600">privacy.gov.ph</a>.</p>
          <p>This Policy is a working draft and should be reviewed against SUGOMATE’s actual data flows, vendor contracts, retention schedule, and privacy compliance arrangements before public launch.</p>
        </Section>

        <div className="mt-10 border-t border-slate-100 pt-6 text-sm text-slate-500">
          Read our <Link href="/terms" className="font-bold text-orange-600">Terms of Service</Link>.
        </div>
      </article>
    </main>
  );
}
