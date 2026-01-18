<template>
  <view class="min-h-screen bg-gradient-to-b from-[#1F1F1F] to-[#0B0B0C] text-white/70">
    <view v-if="loading" class="flex items-center justify-center h-screen">
      <text class="text-white/40">Loading...</text>
    </view>
    <view v-else-if="wrap" class="pb-20">
      <!-- 1. Top: 3D Preview (Effect) -->
      <view 
        class="relative"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
      >
        <image 
          v-if="wrap.preview_image_url && !previewError"
          :src="getOptimizedImage(wrap.preview_image_url)" 
          class="w-full h-auto block bg-black/20" 
          mode="widthFix" 
          @error="handlePreviewError"
        />
        <view v-else class="w-full h-64 bg-white/5 flex items-center justify-center">
             <text class="text-white/20 text-sm">Preview Unavailable</text>
        </view>
        <view class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pt-12 pointer-events-none">
            <text class="text-xs text-white/50 uppercase tracking-widest mb-1">Preview Effect</text>
        </view>

        <!-- Navigation Arrows -->
        <view 
            v-if="prevWrap" 
            class="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-black/40 backdrop-blur-md rounded-full active:bg-black/60 transition-colors z-10"
            @click.stop="switchWrap(prevWrap)"
        >
            <UiIcon name="arrow-left" size="5" color="rgba(255,255,255,0.8)" />
        </view>
        <view 
            v-if="nextWrap" 
            class="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black/40 backdrop-blur-md rounded-full active:bg-black/60 transition-colors z-10"
            @click.stop="switchWrap(nextWrap)"
        >
            <UiIcon name="arrow-right" size="5" color="rgba(255,255,255,0.8)" />
        </view>
      </view>

      <view class="p-4 space-y-6">
        <!-- Info -->
        <view>
            <text class="text-2xl font-bold text-white block">{{ wrap.name }}</text>
            <text class="text-white/60 block">{{ wrap.category }}</text>
            <text v-if="wrapsList.length > 0" class="text-white/30 text-xs mt-1 block">
                {{ currentIndex + 1 }} / {{ wrapsList.length }}
            </text>
        </view>

        <!-- 2. Bottom: Original Texture (Source) -->
        <view class="bg-white/5 rounded-xl p-4 border border-white/10">
            <text class="text-sm text-white/40 mb-3 block">原始贴图 (Texture Source)</text>
            <image 
                v-if="!textureError"
                :src="getOptimizedImage(wrap.wrap_image_url)" 
                class="w-full rounded-lg bg-black/40 mb-4" 
                mode="widthFix" 
                @error="handleTextureError"
            />
            <view v-else class="w-full h-40 bg-white/5 rounded-lg mb-4 flex items-center justify-center border border-white/5">
                <text class="text-white/20 text-xs">Texture Unavailable</text>
            </view>
            
            <button 
                @click="handleGetWrap" 
                class="w-full bg-white text-black font-bold rounded-full py-3 active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
                <text>获取高清原图链接</text>
            </button>
            <text class="text-xs text-center text-white/30 mt-2 block">点击复制链接，请在浏览器中打开下载</text>
        </view>
      </view>
    </view>

    <view v-else class="flex items-center justify-center h-screen">
      <text class="text-white/40">Wrap not found.</text>
    </view>

    <InstructionsModal :visible="showModal" @close="showModal = false" type="wrap" />
  </view>
</template>

<script>
import { defineComponent, ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { wrapsService } from '../../services/wraps.js';
import { audioService } from '../../services/audio.js'; 
import { getOptimizedImage } from '../../utils/image';
import InstructionsModal from '../../components/InstructionsModal.vue';
import UiIcon from '../../components/UiIcon.vue';

const WEBVIEW_HOST = 'http://localhost:5173'; 

export default defineComponent({
  components: {
    InstructionsModal,
    UiIcon
  },
  setup() {
    const wrap = ref(null);
    const wrapsList = ref([]);
    const currentModelId = ref('');
    const loading = ref(true);
    const showModal = ref(false);

    const visualizerUrl = computed(() => {
        if (!wrap.value || !wrap.value.model_3d_url) return '';
        
        const modelUrl = encodeURIComponent(wrap.value.model_3d_url);
        const textureUrl = encodeURIComponent(wrap.value.image_url);

        return `${WEBVIEW_HOST}/visualizer.html?modelUrl=${modelUrl}&textureUrl=${textureUrl}`;
    });

    const previewError = ref(false);
    const textureError = ref(false);

    const handlePreviewError = () => {
        previewError.value = true;
    };

    const handleTextureError = () => {
        textureError.value = true;
    };

    const currentIndex = computed(() => {
        if (!wrap.value || !wrapsList.value.length) return -1;
        return wrapsList.value.findIndex(w => w.id === wrap.value.id);
    });

    const prevWrap = computed(() => {
        if (currentIndex.value <= 0) return null;
        return wrapsList.value[currentIndex.value - 1];
    });

    const nextWrap = computed(() => {
         if (currentIndex.value === -1 || currentIndex.value >= wrapsList.value.length - 1) return null;
         return wrapsList.value[currentIndex.value + 1];
    });

    const switchWrap = (targetWrap) => {
        if (!targetWrap) return;
        wrap.value = targetWrap;
        // Reset errors
        previewError.value = false;
        textureError.value = false;
    };

    // Swipe Logic
    const touchStartX = ref(0);
    const handleTouchStart = (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
            touchStartX.value = e.changedTouches[0].clientX;
        }
    };
    const handleTouchEnd = (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchEndX - touchStartX.value;
            // Threshold 50px
            if (Math.abs(diff) > 50) {
                if (diff > 0 && prevWrap.value) {
                    switchWrap(prevWrap.value);
                } else if (diff < 0 && nextWrap.value) {
                    switchWrap(nextWrap.value);
                }
            }
        }
    };

    onLoad(async (options) => {
      const { id, slug, modelId } = options || {};
      currentModelId.value = modelId || '';

      let data;
      if (id) {
        const response = await wrapsService.fetchWrapById(id);
        data = response.data;
      } else if (slug) {
        const response = await wrapsService.fetchWrapBySlug(slug);
        data = response.data;
      }

      if (data) {
        wrap.value = data;
        
        // Fetch siblings if modelId is present
        if (currentModelId.value) {
            const listRes = await wrapsService.fetchWraps({ 
                modelId: currentModelId.value,
                pageSize: 100 
            });
            wrapsList.value = listRes.data || [];
        }
      }

      loading.value = false;
    });

    const handleGetWrap = () => {
      // Use original URL for detailed texture
      const rawUrl = wrap.value?.wrap_image_url || wrap.value?.image_url;
      let downloadUrl = audioService.getDownloadUrl(rawUrl);
      
      if (downloadUrl) {
        // Append force download param for Aliyun OSS / Standard S3
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl += `${separator}response-content-disposition=attachment`;

        uni.setClipboardData({
          data: downloadUrl,
          success: () => {
            showModal.value = true;
          },
        });
      } else {
        uni.showToast({ title: '无下载链接', icon: 'none' });
      }
    };

    return {
      wrap,
      wrapsList,
      currentIndex,
      loading,
      visualizerUrl,
      getOptimizedImage,
      handleGetWrap,
      showModal,
      previewError,
      textureError,
      handlePreviewError,
      handleTextureError,
      prevWrap,
      nextWrap,
      switchWrap,
      handleTouchStart,
      handleTouchEnd
    };
  }
});
</script>


