"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = common_vendor.defineComponent({
  name: "UiIcon",
  props: {
    name: {
      type: String,
      required: true
    },
    size: {
      type: [String, Number],
      default: 5
    },
    color: {
      type: String,
      default: "rgba(255,255,255,0.75)"
    },
    opacity: {
      type: [String, Number],
      default: 1
    }
  },
  emits: ["click"],
  setup(props) {
    const sizePx = common_vendor.computed(() => {
      const n = Number(props.size);
      if (!Number.isFinite(n))
        return 20;
      return Math.round(n * 4);
    });
    const iconPngSrc = common_vendor.computed(() => {
      if (props.name === "play-solid")
        return "/static/icons/icon-play.png";
      if (props.name === "clock")
        return "/static/icons/icon-clock.png";
      return "";
    });
    const wrapperStyle = common_vendor.computed(() => {
      const px = `${sizePx.value}px`;
      return {
        width: px,
        height: px,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: `${props.opacity}`
      };
    });
    const innerStyle = common_vendor.computed(() => {
      const px = `${sizePx.value}px`;
      return {
        width: px,
        height: px,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      };
    });
    const playTriangleStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const h = Math.max(10, Math.round(px * 0.56));
      const w = Math.max(9, Math.round(px * 0.44));
      const halfH = Math.round(h / 2);
      return {
        width: "0px",
        height: "0px",
        borderTop: `${halfH}px solid transparent`,
        borderBottom: `${halfH}px solid transparent`,
        borderLeft: `${w}px solid ${props.color}`,
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: `${Math.round(-w * 0.42)}px`,
        marginTop: `${Math.round(-halfH)}px`
      };
    });
    const pauseBarStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.max(2, Math.round(px * 0.18));
      const h = Math.max(8, Math.round(px * 0.62));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`
      };
    });
    const pauseBarGapStyle = common_vendor.computed(() => ({
      marginLeft: `${Math.max(3, Math.round(sizePx.value * 0.12))}px`
    }));
    const closeLineStyleBase = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.max(10, Math.round(px * 0.72));
      const h = Math.max(2, Math.round(px * 0.12));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(h / 2))}px`,
        transformOrigin: "center",
        marginLeft: `${Math.round(-w / 2)}px`,
        marginTop: `${Math.round(-h / 2)}px`
      };
    });
    const closeLineStyleA = common_vendor.computed(() => ({
      ...closeLineStyleBase.value,
      transform: "rotate(45deg)"
    }));
    const closeLineStyleB = common_vendor.computed(() => ({
      ...closeLineStyleBase.value,
      transform: "rotate(-45deg)"
    }));
    const searchCircleStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const d = Math.max(10, Math.round(px * 0.58));
      const b = Math.max(2, Math.round(px * 0.1));
      return {
        width: `${d}px`,
        height: `${d}px`,
        border: `${b}px solid ${props.color}`,
        borderRadius: "9999px",
        position: "absolute",
        left: `${Math.round(px * 0.12)}px`,
        top: `${Math.round(px * 0.12)}px`,
        boxSizing: "border-box"
      };
    });
    const searchHandleStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.max(2, Math.round(px * 0.12));
      const h = Math.max(6, Math.round(px * 0.32));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
        right: `${Math.round(px * 0.18)}px`,
        bottom: `${Math.round(px * 0.14)}px`,
        transform: "rotate(45deg)",
        transformOrigin: "center"
      };
    });
    const chevronRightStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const s = Math.max(8, Math.round(px * 0.36));
      const b = Math.max(2, Math.round(px * 0.1));
      return {
        width: `${s}px`,
        height: `${s}px`,
        borderTop: `${b}px solid ${props.color}`,
        borderRight: `${b}px solid ${props.color}`,
        transform: "rotate(45deg)"
      };
    });
    const chevronLeftStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const s = Math.max(8, Math.round(px * 0.36));
      const b = Math.max(2, Math.round(px * 0.1));
      return {
        width: `${s}px`,
        height: `${s}px`,
        borderTop: `${b}px solid ${props.color}`,
        borderLeft: `${b}px solid ${props.color}`,
        transform: "rotate(-45deg)"
      };
    });
    const sortLineStyle = (ratio) => {
      const px = sizePx.value;
      const h = Math.max(2, Math.round(px * 0.12));
      const w = Math.max(10, Math.round(px * 0.72 * ratio));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(h / 2))}px`,
        opacity: 0.9
      };
    };
    const sortLineGapStyle = common_vendor.computed(() => ({
      marginTop: `${Math.max(2, Math.round(sizePx.value * 0.12))}px`
    }));
    const speakerBodyStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.round(px * 0.32);
      const h = Math.round(px * 0.44);
      const b = Math.max(2, Math.round(px * 0.1));
      return {
        width: `${w}px`,
        height: `${h}px`,
        borderLeft: `${b}px solid ${props.color}`,
        borderTop: `${b}px solid ${props.color}`,
        borderBottom: `${b}px solid ${props.color}`,
        borderRadius: `${Math.max(2, Math.round(px * 0.08))}px`,
        position: "absolute",
        left: `${Math.round(px * 0.18)}px`,
        top: `${Math.round(px * 0.28)}px`,
        boxSizing: "border-box",
        opacity: 0.9
      };
    });
    const speakerWaveStyle = (index) => {
      const px = sizePx.value;
      const b = Math.max(2, Math.round(px * 0.1));
      const d = Math.round(px * (0.38 + index * 0.14));
      const left = Math.round(px * 0.46);
      const top = Math.round(px * (0.22 - index * 0.02));
      return {
        width: `${d}px`,
        height: `${d}px`,
        borderRight: `${b}px solid ${props.color}`,
        borderTop: `${b}px solid transparent`,
        borderBottom: `${b}px solid transparent`,
        borderRadius: "9999px",
        left: `${left}px`,
        top: `${top}px`,
        opacity: 0.55,
        boxSizing: "border-box"
      };
    };
    const equalizerBarGapStyle = common_vendor.computed(() => ({
      marginLeft: `${Math.max(3, Math.round(sizePx.value * 0.12))}px`
    }));
    const equalizerBarStyle = (ratio) => {
      const px = sizePx.value;
      const w = Math.max(2, Math.round(px * 0.14));
      const h = Math.max(6, Math.round(px * 0.78 * ratio));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
        opacity: 0.9
      };
    };
    const playCircleStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const d = Math.max(10, Math.round(px * 0.76));
      const b = Math.max(1, Math.round(px * 0.08));
      return {
        width: `${d}px`,
        height: `${d}px`,
        border: `${b}px solid ${props.color}`,
        borderRadius: "9999px",
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: `${Math.round(-d / 2)}px`,
        marginTop: `${Math.round(-d / 2)}px`,
        boxSizing: "border-box",
        opacity: 0.75
      };
    });
    const playCircleTriangleStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const h = Math.max(8, Math.round(px * 0.34));
      const w = Math.max(7, Math.round(px * 0.28));
      const halfH = Math.round(h / 2);
      return {
        width: "0px",
        height: "0px",
        borderTop: `${halfH}px solid transparent`,
        borderBottom: `${halfH}px solid transparent`,
        borderLeft: `${w}px solid ${props.color}`,
        left: "50%",
        top: "50%",
        marginLeft: `${Math.round(-w * 0.36)}px`,
        marginTop: `${Math.round(-halfH)}px`,
        opacity: 0.75
      };
    });
    const clockFaceStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const d = Math.max(10, Math.round(px * 0.76));
      const b = Math.max(1, Math.round(px * 0.08));
      return {
        width: `${d}px`,
        height: `${d}px`,
        border: `${b}px solid ${props.color}`,
        borderRadius: "9999px",
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: `${Math.round(-d / 2)}px`,
        marginTop: `${Math.round(-d / 2)}px`,
        boxSizing: "border-box",
        opacity: 0.75
      };
    });
    const clockHandBase = common_vendor.computed(() => {
      const px = sizePx.value;
      const h = Math.max(6, Math.round(px * 0.3));
      const w = Math.max(1, Math.round(px * 0.08));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
        transformOrigin: "bottom",
        marginLeft: `${Math.round(-w / 2)}px`,
        marginTop: `${Math.round(-h + 1)}px`,
        opacity: 0.75
      };
    });
    const clockHandStyleA = common_vendor.computed(() => ({
      ...clockHandBase.value,
      transform: "rotate(0deg)"
    }));
    const clockHandStyleB = common_vendor.computed(() => ({
      ...clockHandBase.value,
      height: `${Math.max(4, Math.round(sizePx.value * 0.22))}px`,
      transform: "rotate(60deg)"
    }));
    const noteStemStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.max(2, Math.round(px * 0.12));
      const h = Math.round(px * 0.62);
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
        right: `${Math.round(px * 0.32)}px`,
        top: `${Math.round(px * 0.14)}px`,
        opacity: 0.5
      };
    });
    const noteHeadStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const d = Math.round(px * 0.34);
      return {
        width: `${d}px`,
        height: `${Math.round(d * 0.82)}px`,
        backgroundColor: props.color,
        borderRadius: "9999px",
        left: `${Math.round(px * 0.28)}px`,
        bottom: `${Math.round(px * 0.16)}px`,
        opacity: 0.5,
        transform: "rotate(-18deg)"
      };
    });
    const downloadStemStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.max(2, Math.round(px * 0.12));
      const h = Math.round(px * 0.42);
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
        left: "50%",
        top: `${Math.round(px * 0.16)}px`,
        marginLeft: `${Math.round(-w / 2)}px`,
        opacity: 0.8
      };
    });
    const downloadArrowStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.round(px * 0.28);
      const h = Math.round(px * 0.18);
      return {
        width: "0px",
        height: "0px",
        borderLeft: `${Math.round(w / 2)}px solid transparent`,
        borderRight: `${Math.round(w / 2)}px solid transparent`,
        borderTop: `${h}px solid ${props.color}`,
        left: "50%",
        top: `${Math.round(px * 0.5)}px`,
        marginLeft: `${Math.round(-w / 2)}px`,
        opacity: 0.8
      };
    });
    const downloadBaseStyle = common_vendor.computed(() => {
      const px = sizePx.value;
      const w = Math.round(px * 0.64);
      const h = Math.max(2, Math.round(px * 0.12));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(h / 2))}px`,
        left: "50%",
        bottom: `${Math.round(px * 0.18)}px`,
        marginLeft: `${Math.round(-w / 2)}px`,
        opacity: 0.6
      };
    });
    const fallbackStyle = common_vendor.computed(() => {
      const px = Math.round(sizePx.value * 0.42);
      return {
        width: `${px}px`,
        height: `${px}px`,
        backgroundColor: props.color,
        opacity: 0.45
      };
    });
    return {
      sizePx,
      iconPngSrc,
      wrapperStyle,
      innerStyle,
      playTriangleStyle,
      pauseBarStyle,
      pauseBarGapStyle,
      closeLineStyleA,
      closeLineStyleB,
      searchCircleStyle,
      searchHandleStyle,
      chevronRightStyle,
      chevronLeftStyle,
      sortLineStyle,
      sortLineGapStyle,
      speakerBodyStyle,
      speakerWaveStyle,
      equalizerBarStyle,
      equalizerBarGapStyle,
      playCircleStyle,
      playCircleTriangleStyle,
      clockFaceStyle,
      clockHandStyleA,
      clockHandStyleB,
      noteStemStyle,
      noteHeadStyle,
      downloadStemStyle,
      downloadArrowStyle,
      downloadBaseStyle,
      fallbackStyle
    };
  }
});
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: _ctx.iconPngSrc
  }, _ctx.iconPngSrc ? {
    b: _ctx.iconPngSrc,
    c: _ctx.sizePx + "px",
    d: _ctx.sizePx + "px",
    e: _ctx.opacity
  } : _ctx.name === "play" ? {
    g: common_vendor.s(_ctx.playTriangleStyle),
    h: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "pause" ? {
    j: common_vendor.s(_ctx.pauseBarStyle),
    k: common_vendor.s(_ctx.pauseBarStyle),
    l: common_vendor.s(_ctx.pauseBarGapStyle),
    m: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "close" || _ctx.name === "clear" ? {
    o: common_vendor.s(_ctx.closeLineStyleA),
    p: common_vendor.s(_ctx.closeLineStyleB),
    q: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "search" ? {
    s: common_vendor.s(_ctx.searchCircleStyle),
    t: common_vendor.s(_ctx.searchHandleStyle),
    v: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "chevron-right" || _ctx.name === "arrow-right" ? {
    x: common_vendor.s(_ctx.chevronRightStyle),
    y: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "arrow-left" ? {
    A: common_vendor.s(_ctx.chevronLeftStyle),
    B: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "sort-descending" ? {
    D: common_vendor.s(_ctx.sortLineStyle(1)),
    E: common_vendor.s(_ctx.sortLineStyle(0.82)),
    F: common_vendor.s(_ctx.sortLineGapStyle),
    G: common_vendor.s(_ctx.sortLineStyle(0.64)),
    H: common_vendor.s(_ctx.sortLineGapStyle),
    I: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "volume-up" ? {
    K: common_vendor.s(_ctx.speakerBodyStyle),
    L: common_vendor.s(_ctx.speakerWaveStyle(0)),
    M: common_vendor.s(_ctx.speakerWaveStyle(1)),
    N: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "equalizer" ? {
    P: common_vendor.s(_ctx.equalizerBarStyle(0.55)),
    Q: common_vendor.s(_ctx.equalizerBarStyle(0.9)),
    R: common_vendor.s(_ctx.equalizerBarGapStyle),
    S: common_vendor.s(_ctx.equalizerBarStyle(0.7)),
    T: common_vendor.s(_ctx.equalizerBarGapStyle),
    U: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "play-circle" ? {
    W: common_vendor.s(_ctx.playCircleStyle),
    X: common_vendor.s(_ctx.playCircleTriangleStyle),
    Y: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "clock" ? {
    aa: common_vendor.s(_ctx.clockFaceStyle),
    ab: common_vendor.s(_ctx.clockHandStyleA),
    ac: common_vendor.s(_ctx.clockHandStyleB),
    ad: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "music-note" ? {
    af: common_vendor.s(_ctx.noteStemStyle),
    ag: common_vendor.s(_ctx.noteHeadStyle),
    ah: common_vendor.s(_ctx.innerStyle)
  } : _ctx.name === "download" ? {
    aj: common_vendor.s(_ctx.downloadStemStyle),
    ak: common_vendor.s(_ctx.downloadArrowStyle),
    al: common_vendor.s(_ctx.downloadBaseStyle),
    am: common_vendor.s(_ctx.innerStyle)
  } : {
    an: common_vendor.s(_ctx.fallbackStyle)
  }, {
    f: _ctx.name === "play",
    i: _ctx.name === "pause",
    n: _ctx.name === "close" || _ctx.name === "clear",
    r: _ctx.name === "search",
    w: _ctx.name === "chevron-right" || _ctx.name === "arrow-right",
    z: _ctx.name === "arrow-left",
    C: _ctx.name === "sort-descending",
    J: _ctx.name === "volume-up",
    O: _ctx.name === "equalizer",
    V: _ctx.name === "play-circle",
    Z: _ctx.name === "clock",
    ae: _ctx.name === "music-note",
    ai: _ctx.name === "download",
    ao: common_vendor.s(_ctx.wrapperStyle),
    ap: common_vendor.o(($event) => _ctx.$emit("click", $event))
  });
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createComponent(Component);
