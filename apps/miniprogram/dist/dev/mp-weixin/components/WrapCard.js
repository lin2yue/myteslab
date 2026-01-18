"use strict";
const common_vendor = require("../common/vendor.js");
const utils_image = require("../utils/image.js");
const _sfc_main = common_vendor.defineComponent({
  name: "WrapCard",
  props: {
    wrap: {
      type: Object,
      required: true
    },
    modelId: {
      type: String,
      default: ""
    }
  },
  setup(props) {
    const imageError = common_vendor.ref(false);
    const displayImageUrl = common_vendor.computed(() => {
      const rawUrl = props.wrap.preview_image_url || props.wrap.image_url;
      return utils_image.getOptimizedImage(rawUrl);
    });
    common_vendor.watch(displayImageUrl, () => {
      imageError.value = false;
    }, { immediate: true });
    const handleImageError = (e) => {
      console.warn("WrapCard image load failed:", props.wrap.name, e);
      imageError.value = true;
    };
    const handleClick = () => {
      common_vendor.index.navigateTo({
        url: `/pages/wrap-detail/index?id=${props.wrap.id}&modelId=${props.modelId}`
      });
    };
    return {
      displayImageUrl,
      handleClick,
      imageError,
      handleImageError
    };
  }
});
if (!Array) {
  const _component_UiIcon = common_vendor.resolveComponent("UiIcon");
  _component_UiIcon();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !_ctx.imageError
  }, !_ctx.imageError ? {
    b: _ctx.displayImageUrl,
    c: common_vendor.o((...args) => _ctx.handleImageError && _ctx.handleImageError(...args))
  } : {
    d: common_vendor.p({
      name: "image",
      size: "6",
      color: "rgba(255,255,255,0.2)"
    })
  }, {
    e: common_vendor.t(_ctx.wrap.name),
    f: common_vendor.t(_ctx.wrap.category || "Uncategorized"),
    g: common_vendor.o((...args) => _ctx.handleClick && _ctx.handleClick(...args))
  });
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createComponent(Component);
