<template>
  <view class="shrink-0" :style="wrapperStyle" @click="$emit('click', $event)">
    <image
      v-if="iconPngSrc"
      :src="iconPngSrc"
      mode="aspectFit"
      :style="{ width: sizePx + 'px', height: sizePx + 'px', opacity: opacity }"
    />

    <view v-else-if="name === 'play'" class="relative" :style="innerStyle">
      <view :style="playTriangleStyle" />
    </view>

    <view v-else-if="name === 'pause'" class="flex items-center justify-center" :style="innerStyle">
      <view :style="pauseBarStyle" />
      <view :style="{ ...pauseBarStyle, ...pauseBarGapStyle }" />
    </view>

    <view v-else-if="name === 'close' || name === 'clear'" class="relative" :style="innerStyle">
      <view class="absolute left-1/2 top-1/2" :style="closeLineStyleA" />
      <view class="absolute left-1/2 top-1/2" :style="closeLineStyleB" />
    </view>

    <view v-else-if="name === 'search'" class="relative" :style="innerStyle">
      <view :style="searchCircleStyle" />
      <view class="absolute" :style="searchHandleStyle" />
    </view>

    <view v-else-if="name === 'chevron-right' || name === 'arrow-right'" class="relative" :style="innerStyle">
      <view :style="chevronRightStyle" />
    </view>

    <view v-else-if="name === 'arrow-left'" class="relative" :style="innerStyle">
      <view :style="chevronLeftStyle" />
    </view>

    <view v-else-if="name === 'sort-descending'" class="flex flex-col justify-center" :style="innerStyle">
      <view :style="sortLineStyle(1)" />
      <view :style="{ ...sortLineStyle(0.82), ...sortLineGapStyle }" />
      <view :style="{ ...sortLineStyle(0.64), ...sortLineGapStyle }" />
    </view>

    <view v-else-if="name === 'volume-up'" class="relative" :style="innerStyle">
      <view :style="speakerBodyStyle" />
      <view class="absolute" :style="speakerWaveStyle(0)" />
      <view class="absolute" :style="speakerWaveStyle(1)" />
    </view>

    <view v-else-if="name === 'equalizer'" class="flex items-end justify-center" :style="innerStyle">
      <view :style="equalizerBarStyle(0.55)" />
      <view :style="{ ...equalizerBarStyle(0.9), ...equalizerBarGapStyle }" />
      <view :style="{ ...equalizerBarStyle(0.7), ...equalizerBarGapStyle }" />
    </view>
 
    <view v-else-if="name === 'play-circle'" class="relative" :style="innerStyle">
      <view :style="playCircleStyle" />
      <view class="absolute" :style="playCircleTriangleStyle" />
    </view>

    <view v-else-if="name === 'clock'" class="relative" :style="innerStyle">
      <view :style="clockFaceStyle" />
      <view class="absolute left-1/2 top-1/2" :style="clockHandStyleA" />
      <view class="absolute left-1/2 top-1/2" :style="clockHandStyleB" />
    </view>

    <view v-else-if="name === 'music-note'" class="relative" :style="innerStyle">
      <view class="absolute" :style="noteStemStyle" />
      <view class="absolute" :style="noteHeadStyle" />
    </view>

    <view v-else-if="name === 'download'" class="relative" :style="innerStyle">
      <view class="absolute" :style="downloadStemStyle" />
      <view class="absolute" :style="downloadArrowStyle" />
      <view class="absolute" :style="downloadBaseStyle" />
    </view>

    <view v-else class="rounded-sm" :style="fallbackStyle" />
  </view>
</template>

<script>
import { defineComponent, computed } from 'vue';

export default defineComponent({
  name: 'UiIcon',
  props: {
    name: {
      type: String,
      required: true,
    },
    size: {
      type: [String, Number],
      default: 5,
    },
    color: {
      type: String,
      default: 'rgba(255,255,255,0.75)',
    },
    opacity: {
      type: [String, Number],
      default: 1,
    },
  },
  emits: ['click'],
  setup(props) {
    const sizePx = computed(() => {
      const n = Number(props.size);
      if (!Number.isFinite(n)) return 20;
      return Math.round(n * 4);
    });

    const iconPngSrc = computed(() => {
      if (props.name === 'play-solid') return '/static/icons/icon-play.png';
      if (props.name === 'clock') return '/static/icons/icon-clock.png';
      return '';
    });

    const wrapperStyle = computed(() => {
      const px = `${sizePx.value}px`;
      return {
        width: px,
        height: px,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: `${props.opacity}`,
      };
    });

    const innerStyle = computed(() => {
      const px = `${sizePx.value}px`;
      return {
        width: px,
        height: px,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };
    });

    const playTriangleStyle = computed(() => {
      const px = sizePx.value;
      const h = Math.max(10, Math.round(px * 0.56));
      const w = Math.max(9, Math.round(px * 0.44));
      const halfH = Math.round(h / 2);
      return {
        width: '0px',
        height: '0px',
        borderTop: `${halfH}px solid transparent`,
        borderBottom: `${halfH}px solid transparent`,
        borderLeft: `${w}px solid ${props.color}`,
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: `${Math.round(-w * 0.42)}px`,
        marginTop: `${Math.round(-halfH)}px`,
      };
    });

    const pauseBarStyle = computed(() => {
      const px = sizePx.value;
      const w = Math.max(2, Math.round(px * 0.18));
      const h = Math.max(8, Math.round(px * 0.62));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
      };
    });

    const pauseBarGapStyle = computed(() => ({
      marginLeft: `${Math.max(3, Math.round(sizePx.value * 0.12))}px`,
    }));

    const closeLineStyleBase = computed(() => {
      const px = sizePx.value;
      const w = Math.max(10, Math.round(px * 0.72));
      const h = Math.max(2, Math.round(px * 0.12));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(h / 2))}px`,
        transformOrigin: 'center',
        marginLeft: `${Math.round(-w / 2)}px`,
        marginTop: `${Math.round(-h / 2)}px`,
      };
    });

    const closeLineStyleA = computed(() => ({
      ...closeLineStyleBase.value,
      transform: 'rotate(45deg)',
    }));

    const closeLineStyleB = computed(() => ({
      ...closeLineStyleBase.value,
      transform: 'rotate(-45deg)',
    }));

    const searchCircleStyle = computed(() => {
      const px = sizePx.value;
      const d = Math.max(10, Math.round(px * 0.58));
      const b = Math.max(2, Math.round(px * 0.1));
      return {
        width: `${d}px`,
        height: `${d}px`,
        border: `${b}px solid ${props.color}`,
        borderRadius: '9999px',
        position: 'absolute',
        left: `${Math.round(px * 0.12)}px`,
        top: `${Math.round(px * 0.12)}px`,
        boxSizing: 'border-box',
      };
    });

    const searchHandleStyle = computed(() => {
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
        transform: 'rotate(45deg)',
        transformOrigin: 'center',
      };
    });

    const chevronRightStyle = computed(() => {
      const px = sizePx.value;
      const s = Math.max(8, Math.round(px * 0.36));
      const b = Math.max(2, Math.round(px * 0.1));
      return {
        width: `${s}px`,
        height: `${s}px`,
        borderTop: `${b}px solid ${props.color}`,
        borderRight: `${b}px solid ${props.color}`,
        transform: 'rotate(45deg)',
      };
    });

    const chevronLeftStyle = computed(() => {
      const px = sizePx.value;
      const s = Math.max(8, Math.round(px * 0.36));
      const b = Math.max(2, Math.round(px * 0.1));
      return {
        width: `${s}px`,
        height: `${s}px`,
        borderTop: `${b}px solid ${props.color}`,
        borderLeft: `${b}px solid ${props.color}`,
        transform: 'rotate(-45deg)',
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
        opacity: 0.9,
      };
    };

    const sortLineGapStyle = computed(() => ({
      marginTop: `${Math.max(2, Math.round(sizePx.value * 0.12))}px`,
    }));

    const speakerBodyStyle = computed(() => {
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
        position: 'absolute',
        left: `${Math.round(px * 0.18)}px`,
        top: `${Math.round(px * 0.28)}px`,
        boxSizing: 'border-box',
        opacity: 0.9,
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
        borderRadius: '9999px',
        left: `${left}px`,
        top: `${top}px`,
        opacity: 0.55,
        boxSizing: 'border-box',
      };
    };

    const equalizerBarGapStyle = computed(() => ({
      marginLeft: `${Math.max(3, Math.round(sizePx.value * 0.12))}px`,
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
        opacity: 0.9,
      };
    };

    const playCircleStyle = computed(() => {
      const px = sizePx.value;
      const d = Math.max(10, Math.round(px * 0.76));
      const b = Math.max(1, Math.round(px * 0.08));
      return {
        width: `${d}px`,
        height: `${d}px`,
        border: `${b}px solid ${props.color}`,
        borderRadius: '9999px',
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: `${Math.round(-d / 2)}px`,
        marginTop: `${Math.round(-d / 2)}px`,
        boxSizing: 'border-box',
        opacity: 0.75,
      };
    });

    const playCircleTriangleStyle = computed(() => {
      const px = sizePx.value;
      const h = Math.max(8, Math.round(px * 0.34));
      const w = Math.max(7, Math.round(px * 0.28));
      const halfH = Math.round(h / 2);
      return {
        width: '0px',
        height: '0px',
        borderTop: `${halfH}px solid transparent`,
        borderBottom: `${halfH}px solid transparent`,
        borderLeft: `${w}px solid ${props.color}`,
        left: '50%',
        top: '50%',
        marginLeft: `${Math.round(-w * 0.36)}px`,
        marginTop: `${Math.round(-halfH)}px`,
        opacity: 0.75,
      };
    });

    const clockFaceStyle = computed(() => {
      const px = sizePx.value;
      const d = Math.max(10, Math.round(px * 0.76));
      const b = Math.max(1, Math.round(px * 0.08));
      return {
        width: `${d}px`,
        height: `${d}px`,
        border: `${b}px solid ${props.color}`,
        borderRadius: '9999px',
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: `${Math.round(-d / 2)}px`,
        marginTop: `${Math.round(-d / 2)}px`,
        boxSizing: 'border-box',
        opacity: 0.75,
      };
    });

    const clockHandBase = computed(() => {
      const px = sizePx.value;
      const h = Math.max(6, Math.round(px * 0.3));
      const w = Math.max(1, Math.round(px * 0.08));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
        transformOrigin: 'bottom',
        marginLeft: `${Math.round(-w / 2)}px`,
        marginTop: `${Math.round(-h + 1)}px`,
        opacity: 0.75,
      };
    });

    const clockHandStyleA = computed(() => ({
      ...clockHandBase.value,
      transform: 'rotate(0deg)',
    }));

    const clockHandStyleB = computed(() => ({
      ...clockHandBase.value,
      height: `${Math.max(4, Math.round(sizePx.value * 0.22))}px`,
      transform: 'rotate(60deg)',
    }));

    const noteStemStyle = computed(() => {
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
        opacity: 0.5,
      };
    });

    const noteHeadStyle = computed(() => {
      const px = sizePx.value;
      const d = Math.round(px * 0.34);
      return {
        width: `${d}px`,
        height: `${Math.round(d * 0.82)}px`,
        backgroundColor: props.color,
        borderRadius: '9999px',
        left: `${Math.round(px * 0.28)}px`,
        bottom: `${Math.round(px * 0.16)}px`,
        opacity: 0.5,
        transform: 'rotate(-18deg)',
      };
    });

    const downloadStemStyle = computed(() => {
      const px = sizePx.value;
      const w = Math.max(2, Math.round(px * 0.12));
      const h = Math.round(px * 0.42);
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(w / 2))}px`,
        left: '50%',
        top: `${Math.round(px * 0.16)}px`,
        marginLeft: `${Math.round(-w / 2)}px`,
        opacity: 0.8,
      };
    });

    const downloadArrowStyle = computed(() => {
      const px = sizePx.value;
      const w = Math.round(px * 0.28);
      const h = Math.round(px * 0.18);
      return {
        width: '0px',
        height: '0px',
        borderLeft: `${Math.round(w / 2)}px solid transparent`,
        borderRight: `${Math.round(w / 2)}px solid transparent`,
        borderTop: `${h}px solid ${props.color}`,
        left: '50%',
        top: `${Math.round(px * 0.5)}px`,
        marginLeft: `${Math.round(-w / 2)}px`,
        opacity: 0.8,
      };
    });

    const downloadBaseStyle = computed(() => {
      const px = sizePx.value;
      const w = Math.round(px * 0.64);
      const h = Math.max(2, Math.round(px * 0.12));
      return {
        width: `${w}px`,
        height: `${h}px`,
        backgroundColor: props.color,
        borderRadius: `${Math.max(1, Math.round(h / 2))}px`,
        left: '50%',
        bottom: `${Math.round(px * 0.18)}px`,
        marginLeft: `${Math.round(-w / 2)}px`,
        opacity: 0.6,
      };
    });

    const fallbackStyle = computed(() => {
      const px = Math.round(sizePx.value * 0.42);
      return {
        width: `${px}px`,
        height: `${px}px`,
        backgroundColor: props.color,
        opacity: 0.45,
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
      fallbackStyle,
    };
  },
});
</script>
