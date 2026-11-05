# Deploy order (all updates combined)

1. **Supabase SQL Editor — run in this order (each file once):**
   1. `supabase/migrations/20261105110000_customer_read_delivery_fees.sql` — optional; shows delivery fee in the basket.
   2. `supabase/migrations/20261105120000_driver_application_documents.sql` — **required** before the new rider application page works. Creates the private `driver-documents` bucket, adds `selfie_storage_path`, and blocks approving a pending rider who has no ID.
2. Commit the project files to GitHub (Vercel deploys automatically).
3. Test:
   - Rider: register a test account → /driver/apply → upload ID, selfie, license → admin sees "View ID ↗" links in Rider applications.
   - Existing pending riders (no ID) see an "upload your ID" form on /driver/apply; admins cannot approve them until they do.
   - Customer: place an order and watch the line on /customer/orders move forward; merchant/rider/customer sound alerts: tap "Enable … alerts" once per device.

## Rider identification rules
- Required: government ID (front), selfie holding the ID. Driver's license required unless the vehicle is a Bicycle.
- Photos are shrunk on the phone before upload (JPG/PNG/WEBP, max 5 MB), stored privately, readable only by the applicant and admins (links expire after 10 minutes).
