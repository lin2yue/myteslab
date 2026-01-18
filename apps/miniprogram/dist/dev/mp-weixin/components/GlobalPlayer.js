"use strict";
const common_vendor = require("../common/vendor.js");
const store_player = require("../store/player.js");
if (!Math) {
  UiIcon();
}
const UiIcon = () => "./UiIcon.js";
const _sfc_main = {
  __name: "GlobalPlayer",
  setup(__props) {
    const store = store_player.usePlayerStore();
    const { currentAudio, isPlaying, duration, currentTime } = common_vendor.storeToRefs(store);
    const toggle = () => {
      store.toggle();
    };
    const closePlayer = () => {
      store.close();
    };
    const progress = common_vendor.computed(() => {
      if (!duration.value)
        return 0;
      return currentTime.value / duration.value * 100;
    });
    const formatTime = (sec) => {
      if (!sec)
        return "0:00";
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? "0" + s : s}`;
    };
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.unref(currentAudio)
      }, common_vendor.unref(currentAudio) ? {
        b: progress.value + "%",
        c: common_vendor.t(common_vendor.unref(currentAudio).title),
        d: common_vendor.t(formatTime(common_vendor.unref(currentTime))),
        e: common_vendor.t(formatTime(common_vendor.unref(duration))),
        f: common_vendor.p({
          name: common_vendor.unref(isPlaying) ? "pause" : "play",
          size: "5",
          color: "#000000"
        }),
        g: common_vendor.o(toggle),
        h: common_vendor.p({
          name: "close",
          size: "4",
          color: "#9CA3AF"
        }),
        i: common_vendor.o(closePlayer)
      } : {});
    };
  }
};
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-434963d0"]]);
wx.createComponent(Component);
