"use strict";
const common_vendor = require("../common/vendor.js");
const supabaseUrl = "https://eysiovvlutxhgnnydedr.supabase.co";
const supabaseKey = "sb_publishable_Lf8-OhxRZcwcDhTqUOpbBA_JxoM7zt5";
const client = common_vendor.module.createClient(supabaseUrl, supabaseKey);
if (client) {
  console.log("✅ Supabase Client (WeChat Stable) Initialized");
} else {
  console.error("❌ Supabase Client Init Failed: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}
const supabase = client;
exports.supabase = supabase;
