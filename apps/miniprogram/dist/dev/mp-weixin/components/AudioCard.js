"use strict";
const common_vendor = require("../common/vendor.js");
const utils_image = require("../utils/image.js");
if (!Math) {
  UiIcon();
}
const UiIcon = () => "./UiIcon.js";
const _sfc_main = {
  __name: "AudioCard",
  props: {
    audio: Object,
    isPlaying: Boolean
  },
  emits: ["play", "download"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const imageError = common_vendor.ref(false);
    const handleImageError = () => {
      imageError.value = true;
    };
    const formatCount = (count) => {
      if (count > 1e4) {
        return `${(count / 1e4).toFixed(1)}万`;
      }
      return `${count}`;
    };
    const formatDuration = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    };
    const handleDownloadClick = () => {
      emit("download");
    };
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: __props.audio.cover_url && !imageError.value
      }, __props.audio.cover_url && !imageError.value ? {
        b: common_vendor.unref(utils_image.getOptimizedImage)(__props.audio.cover_url, 200),
        c: common_vendor.o(handleImageError)
      } : {
        d: common_vendor.p({
          name: "music-note",
          size: "8",
          color: "rgba(255,255,255,0.2)"
        })
      }, {
        e: common_vendor.p({
          name: "play",
          size: "4",
          color: "rgba(255,255,255,0.9)"
        }),
        f: common_vendor.t(__props.audio.title),
        g: common_vendor.p({
          name: "play-solid",
          size: "3",
          opacity: "0.8"
        }),
        h: common_vendor.t(formatCount(__props.audio.play_count || 0)),
        i: common_vendor.p({
          name: "clock",
          size: "3",
          opacity: "0.8"
        }),
        j: common_vendor.t(__props.audio.duration ? formatDuration(__props.audio.duration) : "--:--"),
        k: __props.audio.album
      }, __props.audio.album ? {
        l: common_vendor.t(__props.audio.album)
      } : {}, {
        m: common_vendor.o(($event) => _ctx.$emit("play")),
        n: common_vendor.o(handleDownloadClick)
      });
    };
  }
};
wx.createComponent(_sfc_main);
