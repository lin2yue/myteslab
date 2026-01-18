"use strict";
const services_supabase = require("./supabase.js");
const ensureClient = () => {
  if (!services_supabase.supabase) {
    const error = new Error("Supabase client not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    console.error(error.message);
    return { client: null, error };
  }
  return { client: services_supabase.supabase, error: null };
};
const normalizeString = (value) => typeof value === "string" ? value.trim() : "";
const wrapsService = {
  async fetchModels() {
    const { client, error } = ensureClient();
    if (!client)
      return { data: [], error };
    const { data, error: queryError } = await client.from("wrap_models").select("*").eq("is_active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (queryError) {
      console.error("Error fetching wrap models:", queryError);
      return { data: [], error: queryError };
    }
    return { data: data || [], error: null };
  },
  async fetchWraps({ modelId = "", modelSlug = "", category = "", search = "", page = 1, pageSize = 30 } = {}) {
    const { client, error } = ensureClient();
    if (!client)
      return { data: [], error };
    const safeCategory = normalizeString(category);
    const safeSearch = normalizeString(search);
    const safeModelId = normalizeString(modelId);
    const safeModelSlug = normalizeString(modelSlug);
    let resolvedModelId = safeModelId;
    if (!resolvedModelId && safeModelSlug) {
      const { data: model, error: modelError } = await client.from("wrap_models").select("id").eq("slug", safeModelSlug).maybeSingle();
      if (modelError) {
        console.error("Error fetching wrap model id:", modelError);
        return { data: [], error: modelError };
      }
      resolvedModelId = model && model.id ? model.id : "";
    }
    const from = Math.max(0, (Number(page) - 1) * Number(pageSize));
    const to = from + Number(pageSize) - 1;
    if (resolvedModelId) {
      const { data: mappings, error: mapError } = await client.from("wrap_model_map").select("wrap_id").eq("model_id", resolvedModelId);
      if (mapError) {
        console.error("Error fetching wrap mappings:", mapError);
        return { data: [], error: mapError };
      }
      const ids = (mappings || []).map((m) => m && m.wrap_id).filter(Boolean);
      if (ids.length === 0)
        return { data: [], error: null };
      let query2 = client.from("wraps").select("*").in("id", ids).eq("is_active", true);
      if (safeCategory) {
        query2 = query2.eq("category", safeCategory);
      }
      if (safeSearch) {
        const pattern = `*${safeSearch}*`;
        query2 = query2.or(`name.ilike.${pattern},category.ilike.${pattern}`);
      }
      query2 = query2.order("sort_order", { ascending: true }).order("created_at", { ascending: false }).range(from, to);
      const { data: data2, error: queryError2 } = await query2;
      if (queryError2) {
        console.error("Error fetching wraps:", queryError2);
        return { data: [], error: queryError2 };
      }
      return { data: data2 || [], error: null };
    }
    let query = client.from("wraps").select("*").eq("is_active", true);
    if (safeCategory) {
      query = query.eq("category", safeCategory);
    }
    if (safeSearch) {
      const pattern = `*${safeSearch}*`;
      query = query.or(`name.ilike.${pattern},category.ilike.${pattern}`);
    }
    query = query.order("sort_order", { ascending: true }).order("created_at", { ascending: false }).range(from, to);
    const { data, error: queryError } = await query;
    if (queryError) {
      console.error("Error fetching wraps:", queryError);
      return { data: [], error: queryError };
    }
    return { data: data || [], error: null };
  },
  async fetchWrapById(id) {
    const { client, error } = ensureClient();
    if (!client)
      return { data: null, error };
    const wrapId = normalizeString(id);
    if (!wrapId)
      return { data: null, error: null };
    const { data, error: queryError } = await client.from("wraps").select("*").eq("id", wrapId).maybeSingle();
    if (queryError) {
      console.error("Error fetching wrap by id:", queryError);
      return { data: null, error: queryError };
    }
    return { data: data || null, error: null };
  },
  async fetchWrapBySlug(slug) {
    const { client, error } = ensureClient();
    if (!client)
      return { data: null, error };
    const safeSlug = normalizeString(slug);
    if (!safeSlug)
      return { data: null, error: null };
    const { data, error: queryError } = await client.from("wraps").select("*").eq("slug", safeSlug).maybeSingle();
    if (queryError) {
      console.error("Error fetching wrap by slug:", queryError);
      return { data: null, error: queryError };
    }
    return { data: data || null, error: null };
  }
};
exports.wrapsService = wrapsService;
