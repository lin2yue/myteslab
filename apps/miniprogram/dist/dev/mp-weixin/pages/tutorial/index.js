"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  setup() {
    const assetBase = "https://cdn.tewan.club";
    const tutorialFilenames = [
      "锁车音教程1.jpg",
      "锁车音教程2.jpg",
      "锁车音教程3.jpg",
      "锁车音教程4.jpg",
      "锁车音教程5.jpg",
      "锁车音教程6.jpg"
    ];
    const tutorialImages = tutorialFilenames.map((name) => `${assetBase}/tutorial/${encodeURIComponent(name)}`);
    return {
      tutorialImages
    };
  },
  onShareAppMessage() {
    return {
      title: "特斯拉自定义锁车音更换教程",
      path: "/pages/tutorial/index"
    };
  },
  onShareTimeline() {
    return {
      title: "特斯拉自定义锁车音更换教程"
    };
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($setup.tutorialImages, (img, index, i0) => {
      return {
        a: index,
        b: img
      };
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
