"use strict";
const CDN_HOST = "https://cdn.tewan.club";
const OSS_HOST = "https://lock-sounds.oss-cn-beijing.aliyuncs.com";
const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
};
const normalizeRemoteUrl = (url) => {
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
  const encodedPath = parsed.pathname.split("/").map((segment) => encodeURIComponent(safeDecode(segment))).join("/");
  return `${parsed.origin}${encodedPath}${parsed.search}${parsed.hash}`;
};
const rewriteOssToCdn = (url) => {
  if (!url || typeof url !== "string")
    return "";
  if (url.startsWith(OSS_HOST)) {
    return `${CDN_HOST}${url.slice(OSS_HOST.length)}`;
  }
  return url;
};
const getOptimizedImage = (url) => {
  const rewritten = rewriteOssToCdn(url);
  return normalizeRemoteUrl(rewritten);
};
exports.getOptimizedImage = getOptimizedImage;
