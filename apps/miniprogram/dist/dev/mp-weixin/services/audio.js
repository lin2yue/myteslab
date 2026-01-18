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
const normalizeUrlForPlayback = (url) => {
  if (!url || typeof url !== "string")
    return "";
  if (!/^https?:\/\//i.test(url))
    return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return url;
  }
  const safeDecode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch (err) {
      return value;
    }
  };
  const encodedPath = parsed.pathname.split("/").map((segment) => encodeURIComponent(safeDecode(segment))).join("/");
  return `${parsed.origin}${encodedPath}${parsed.search}${parsed.hash}`;
};
const audioService = {
  async fetchAudios(sortBy = "created_at", page = 1, pageSize = 20, searchQuery = "") {
    console.log(`🔍 fetchAudios called: sort=${sortBy}, page=${page}, size=${pageSize}`);
    const { client, error } = ensureClient();
    if (!client)
      return { data: [], error };
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = client.from("audios").select("*");
    const keyword = searchQuery ? searchQuery.trim() : "";
    if (keyword) {
      const pattern = `*${keyword}*`;
      query = query.or(`title.ilike.${pattern},album.ilike.${pattern}`);
    }
    if (sortBy === "hot") {
      query = query.order("play_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }
    query = query.range(from, to);
    const { data, error: queryError } = await query;
    if (queryError) {
      console.error("Error fetching audios:", queryError);
      return { data: [], error: queryError };
    }
    return { data, error: null };
  },
  async fetchBanners() {
    const { client, error } = ensureClient();
    if (!client)
      return { data: [], error };
    const { data, error: queryError } = await client.from("banners").select("*").eq("is_active", true).order("sort_order", { ascending: true });
    if (queryError) {
      console.error("Error fetching banners:", queryError);
      return { data: [], error: queryError };
    }
    return { data, error: null };
  },
  // Optimized for Albums Page (Only distinct albums and covers)
  async fetchAlbumsData() {
    const { client, error } = ensureClient();
    if (!client)
      return { data: [], error };
    const { data, error: queryError } = await client.from("audios").select("album, cover_url").not("album", "is", null);
    if (queryError) {
      console.error("Error fetching albums:", queryError);
      return { data: [], error: queryError };
    }
    return { data, error: null };
  },
  async incrementStat(id, type) {
    const { client } = ensureClient();
    if (!client)
      return;
    const { error } = await client.rpc("increment_audio_stat", {
      row_id: id,
      stat_type: type
    });
    if (error)
      console.error("Error incrementing stat:", error);
  },
  async fetchAudiosByAlbum(albumName) {
    const { client, error } = ensureClient();
    if (!client)
      return { data: [], error };
    let query = client.from("audios").select("*").eq("album", albumName).order("play_count", { ascending: false }).order("created_at", { ascending: false });
    const { data, error: queryError } = await query;
    if (queryError) {
      console.error("Error fetching album audios:", queryError);
      return { data: [], error: queryError };
    }
    return { data, error: null };
  },
  getPlayableUrl(url) {
    if (!url)
      return "";
    const cdnHost = "https://cdn.tewan.club";
    const ossHost = "https://lock-sounds.oss-cn-beijing.aliyuncs.com";
    let playableUrl = url;
    if (playableUrl.startsWith(ossHost)) {
      playableUrl = `${cdnHost}${playableUrl.slice(ossHost.length)}`;
    }
    return normalizeUrlForPlayback(playableUrl);
  },
  getDownloadUrl(url, cacheKey = "") {
    if (!url)
      return "";
    const cdnHost = "https://cdn.tewan.club";
    const ossHost = "https://lock-sounds.oss-cn-beijing.aliyuncs.com";
    const normalized = normalizeUrlForPlayback(url);
    const splitHash = (input) => {
      const hashIndex = input.indexOf("#");
      if (hashIndex < 0)
        return { base: input, hash: "" };
      return { base: input.slice(0, hashIndex), hash: input.slice(hashIndex) };
    };
    const splitQuery = (input) => {
      const queryIndex = input.indexOf("?");
      if (queryIndex < 0)
        return { base: input, query: "" };
      return { base: input.slice(0, queryIndex), query: input.slice(queryIndex + 1) };
    };
    const parseQuery = (query2) => {
      const pairs = query2 ? query2.split("&").filter(Boolean) : [];
      const items2 = [];
      for (const pair of pairs) {
        const idx = pair.indexOf("=");
        const key = idx >= 0 ? pair.slice(0, idx) : pair;
        const value = idx >= 0 ? pair.slice(idx + 1) : "";
        if (!key)
          continue;
        items2.push([key, value]);
      }
      return items2;
    };
    const setQueryParam = (items2, key, value) => {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(String(value));
      for (let i = 0; i < items2.length; i += 1) {
        if (items2[i][0] === encodedKey || items2[i][0] === key) {
          items2[i] = [encodedKey, encodedValue];
          return;
        }
      }
      items2.push([encodedKey, encodedValue]);
    };
    const { base: withoutHash, hash } = splitHash(normalized);
    const { base: withoutQuery, query } = splitQuery(withoutHash);
    let pathPart = "";
    if (withoutQuery.startsWith(ossHost)) {
      pathPart = withoutQuery.slice(ossHost.length);
    } else if (withoutQuery.startsWith(cdnHost)) {
      pathPart = withoutQuery.slice(cdnHost.length);
    } else {
      return normalized;
    }
    const items = parseQuery(query);
    setQueryParam(items, "download", "1");
    if (cacheKey)
      setQueryParam(items, "v", cacheKey);
    const finalQuery = items.length > 0 ? `?${items.map(([k, v]) => `${k}=${v}`).join("&")}` : "";
    return `${cdnHost}${pathPart}${finalQuery}${hash}`;
  },
  getDownloadFallbackUrl(url) {
    if (!url)
      return "";
    const cdnHost = "https://cdn.tewan.club";
    const ossHost = "https://lock-sounds.oss-cn-beijing.aliyuncs.com";
    const normalized = normalizeUrlForPlayback(url);
    if (normalized.startsWith(cdnHost)) {
      return `${ossHost}${normalized.slice(cdnHost.length)}`;
    }
    return normalized;
  }
};
exports.audioService = audioService;
