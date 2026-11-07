/* JAZMI — konfigurasi Supabase (aman dipublikasikan).
   Isi dengan nilai dari Supabase → Project Settings → API:
   - Project URL
   - anon public key  (BUKAN service_role key — itu rahasia, jangan pernah ditaruh di sini)
   Keamanan datang dari aturan RLS di supabase-setup.sql, bukan dari kerahasiaan key ini. */
window.JAZMI_AUTH = {
  url: "https://mxucxnpccndtqvihgcwq.supabase.co",
  anonKey: "sb_publishable_8tRsjLV8rXmg1nhp5psD-Q_aXoIXWJ2",
  bucket: "alat-privat"
};
