"use strict";
const common_vendor = require("../common/vendor.js");
const utils_image = require("../utils/image.js");
const UiCard = () => "./UiCard.js";
const UiBadge = () => "./UiBadge.js";
const _sfc_main = common_vendor.defineComponent({
  name: "AlbumCard",
  components: { UiCard, UiBadge },
  props: {
    album: {
      type: Object,
      required: true
    }
  },
  emits: ["click"],
  setup() {
    return {
      getOptimizedImage: utils_image.getOptimizedImage
    };
  }
});
if (!Array) {
  const _component_UiBadge = common_vendor.resolveComponent("UiBadge");
  const _component_UiCard = common_vendor.resolveComponent("UiCard");
  (_component_UiBadge + _component_UiCard)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: _ctx.getOptimizedImage(_ctx.album.cover_url, 600) || "/static/logo.png",
    b: common_vendor.t(_ctx.album.count),
    c: common_vendor.t(_ctx.album.name),
    d: common_vendor.o(($event) => _ctx.$emit("click"))
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createComponent(Component);
