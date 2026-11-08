-- Accept common mobile-upload image formats for merchant store logos.
-- The server validates the file signature before storing it.
update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/webp','image/jpeg','image/png']
where id = 'merchant-logos';
