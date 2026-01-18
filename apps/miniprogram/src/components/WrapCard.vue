<template>
  <view
    class="bg-white/5 border border-white/10 rounded-2xl p-0 overflow-hidden flex flex-col mb-4 active:bg-white/10 transition-colors h-full"
    @click="handleClick"
  >
    <!-- Aspect Ratio Box -->
    <view class="relative w-full pt-[75%] bg-white/5">
        <image 
            v-if="!imageError"
            :src="displayImageUrl" 
            class="absolute top-0 left-0 w-full h-full block transition-opacity duration-300" 
            mode="aspectFill" 
            @error="handleImageError"
        />
        <view v-else class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/5">
            <UiIcon name="image" size="6" color="rgba(255,255,255,0.2)" />
        </view>
    </view>
    
    <view class="p-3 flex-1 flex flex-col justify-center">
      <text class="text-white/90 text-sm font-medium truncate w-full block">{{ wrap.name }}</text>
      <text class="text-white/40 text-xs mt-0.5 block">{{ wrap.category || 'Uncategorized' }}</text>
    </view>
  </view>
</template>

<script>
import { defineComponent, computed, ref, watch } from 'vue';
import { getOptimizedImage } from '../utils/image';

export default defineComponent({
  name: 'WrapCard',
  props: {
    wrap: {
      type: Object,
      required: true,
    },
    modelId: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const imageError = ref(false);

    const displayImageUrl = computed(() => {
      const rawUrl = props.wrap.preview_image_url || props.wrap.image_url;
      return getOptimizedImage(rawUrl);
    });

    watch(displayImageUrl, () => {
      imageError.value = false;
    }, { immediate: true });

    const handleImageError = (e) => {
        console.warn('WrapCard image load failed:', props.wrap.name, e);
        imageError.value = true;
    };

    const handleClick = () => {
      uni.navigateTo({
        url: `/pages/wrap-detail/index?id=${props.wrap.id}&modelId=${props.modelId}`,
      });
    };

    return {
      displayImageUrl,
      handleClick,
      imageError,
      handleImageError,
    };
  },
});
</script>
