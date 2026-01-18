"use strict";
const common_vendor = require("../common/vendor.js");
const UiIcon = () => "./UiIcon.js";
const _sfc_main = common_vendor.defineComponent({
  name: "SectionHeader",
  components: { UiIcon },
  props: {
    showMore: {
      type: Boolean,
      default: false
    }
  },
  emits: ["more"]
});
if (!Array) {
  const _component_UiIcon = common_vendor.resolveComponent("UiIcon");
  _component_UiIcon();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: _ctx.showMore
  }, _ctx.showMore ? {
    b: common_vendor.p({
      name: "chevron-right",
      size: "4",
      color: "rgba(255,255,255,0.4)"
    }),
    c: common_vendor.o(($event) => _ctx.$emit("more"))
  } : {});
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createComponent(Component);
