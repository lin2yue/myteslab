"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = common_vendor.defineComponent({
  name: "UiBadge",
  emits: ["click"]
});
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o(($event) => _ctx.$emit("click"))
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createComponent(Component);
