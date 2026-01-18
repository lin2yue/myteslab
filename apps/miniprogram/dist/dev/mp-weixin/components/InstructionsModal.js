"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  __name: "InstructionsModal",
  props: {
    visible: Boolean,
    type: {
      type: String,
      default: "audio"
      // 'audio' | 'wrap'
    }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: __props.visible
      }, __props.visible ? common_vendor.e({
        b: common_vendor.o(($event) => _ctx.$emit("close")),
        c: __props.type === "audio"
      }, __props.type === "audio" ? {} : __props.type === "wrap" ? {} : {}, {
        d: __props.type === "wrap",
        e: common_vendor.o(($event) => _ctx.$emit("close"))
      }) : {});
    };
  }
};
wx.createComponent(_sfc_main);
