"use strict";
const common_vendor = require("../../common/vendor.js");
const services_wraps = require("../../services/wraps.js");
const services_audio = require("../../services/audio.js");
const utils_image = require("../../utils/image.js");
const InstructionsModal = () => "../../components/InstructionsModal.js";
const UiIcon = () => "../../components/UiIcon.js";
const WEBVIEW_HOST = "http://localhost:5173";
const _sfc_main = common_vendor.defineComponent({
  components: {
    InstructionsModal,
    UiIcon
  },
  setup() {
    const wrap = common_vendor.ref(null);
    const wrapsList = common_vendor.ref([]);
    const currentModelId = common_vendor.ref("");
    const loading = common_vendor.ref(true);
    const showModal = common_vendor.ref(false);
    const visualizerUrl = common_vendor.computed(() => {
      if (!wrap.value || !wrap.value.model_3d_url)
        return "";
      const modelUrl = encodeURIComponent(wrap.value.model_3d_url);
      const textureUrl = encodeURIComponent(wrap.value.image_url);
      return `${WEBVIEW_HOST}/visualizer.html?modelUrl=${modelUrl}&textureUrl=${textureUrl}`;
    });
    const previewError = common_vendor.ref(false);
    const textureError = common_vendor.ref(false);
    const handlePreviewError = () => {
      previewError.value = true;
    };
    const handleTextureError = () => {
      textureError.value = true;
    };
    const currentIndex = common_vendor.computed(() => {
      if (!wrap.value || !wrapsList.value.length)
        return -1;
      return wrapsList.value.findIndex((w) => w.id === wrap.value.id);
    });
    const prevWrap = common_vendor.computed(() => {
      if (currentIndex.value <= 0)
        return null;
      return wrapsList.value[currentIndex.value - 1];
    });
    const nextWrap = common_vendor.computed(() => {
      if (currentIndex.value === -1 || currentIndex.value >= wrapsList.value.length - 1)
        return null;
      return wrapsList.value[currentIndex.value + 1];
    });
    const switchWrap = (targetWrap) => {
      if (!targetWrap)
        return;
      wrap.value = targetWrap;
      previewError.value = false;
      textureError.value = false;
    };
    const touchStartX = common_vendor.ref(0);
    const handleTouchStart = (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        touchStartX.value = e.changedTouches[0].clientX;
      }
    };
    const handleTouchEnd = (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - touchStartX.value;
        if (Math.abs(diff) > 50) {
          if (diff > 0 && prevWrap.value) {
            switchWrap(prevWrap.value);
          } else if (diff < 0 && nextWrap.value) {
            switchWrap(nextWrap.value);
          }
        }
      }
    };
    common_vendor.onLoad(async (options) => {
      const { id, slug, modelId } = options || {};
      currentModelId.value = modelId || "";
      let data;
      if (id) {
        const response = await services_wraps.wrapsService.fetchWrapById(id);
        data = response.data;
      } else if (slug) {
        const response = await services_wraps.wrapsService.fetchWrapBySlug(slug);
        data = response.data;
      }
      if (data) {
        wrap.value = data;
        if (currentModelId.value) {
          const listRes = await services_wraps.wrapsService.fetchWraps({
            modelId: currentModelId.value,
            pageSize: 100
          });
          wrapsList.value = listRes.data || [];
        }
      }
      loading.value = false;
    });
    const handleGetWrap = () => {
      var _a, _b;
      const rawUrl = ((_a = wrap.value) == null ? void 0 : _a.wrap_image_url) || ((_b = wrap.value) == null ? void 0 : _b.image_url);
      let downloadUrl = services_audio.audioService.getDownloadUrl(rawUrl);
      if (downloadUrl) {
        const separator = downloadUrl.includes("?") ? "&" : "?";
        downloadUrl += `${separator}response-content-disposition=attachment`;
        common_vendor.index.setClipboardData({
          data: downloadUrl,
          success: () => {
            showModal.value = true;
          }
        });
      } else {
        common_vendor.index.showToast({ title: "无下载链接", icon: "none" });
      }
    };
    return {
      wrap,
      wrapsList,
      currentIndex,
      loading,
      visualizerUrl,
      getOptimizedImage: utils_image.getOptimizedImage,
      handleGetWrap,
      showModal,
      previewError,
      textureError,
      handlePreviewError,
      handleTextureError,
      prevWrap,
      nextWrap,
      switchWrap,
      handleTouchStart,
      handleTouchEnd
    };
  }
});
if (!Array) {
  const _component_UiIcon = common_vendor.resolveComponent("UiIcon");
  const _component_InstructionsModal = common_vendor.resolveComponent("InstructionsModal");
  (_component_UiIcon + _component_InstructionsModal)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: _ctx.loading
  }, _ctx.loading ? {} : _ctx.wrap ? common_vendor.e({
    c: _ctx.wrap.preview_image_url && !_ctx.previewError
  }, _ctx.wrap.preview_image_url && !_ctx.previewError ? {
    d: _ctx.getOptimizedImage(_ctx.wrap.preview_image_url),
    e: common_vendor.o((...args) => _ctx.handlePreviewError && _ctx.handlePreviewError(...args))
  } : {}, {
    f: _ctx.prevWrap
  }, _ctx.prevWrap ? {
    g: common_vendor.p({
      name: "arrow-left",
      size: "5",
      color: "rgba(255,255,255,0.8)"
    }),
    h: common_vendor.o(($event) => _ctx.switchWrap(_ctx.prevWrap))
  } : {}, {
    i: _ctx.nextWrap
  }, _ctx.nextWrap ? {
    j: common_vendor.p({
      name: "arrow-right",
      size: "5",
      color: "rgba(255,255,255,0.8)"
    }),
    k: common_vendor.o(($event) => _ctx.switchWrap(_ctx.nextWrap))
  } : {}, {
    l: common_vendor.o((...args) => _ctx.handleTouchStart && _ctx.handleTouchStart(...args)),
    m: common_vendor.o((...args) => _ctx.handleTouchEnd && _ctx.handleTouchEnd(...args)),
    n: common_vendor.t(_ctx.wrap.name),
    o: common_vendor.t(_ctx.wrap.category),
    p: _ctx.wrapsList.length > 0
  }, _ctx.wrapsList.length > 0 ? {
    q: common_vendor.t(_ctx.currentIndex + 1),
    r: common_vendor.t(_ctx.wrapsList.length)
  } : {}, {
    s: !_ctx.textureError
  }, !_ctx.textureError ? {
    t: _ctx.getOptimizedImage(_ctx.wrap.wrap_image_url),
    v: common_vendor.o((...args) => _ctx.handleTextureError && _ctx.handleTextureError(...args))
  } : {}, {
    w: common_vendor.o((...args) => _ctx.handleGetWrap && _ctx.handleGetWrap(...args))
  }) : {}, {
    b: _ctx.wrap,
    x: common_vendor.o(($event) => _ctx.showModal = false),
    y: common_vendor.p({
      visible: _ctx.showModal,
      type: "wrap"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
