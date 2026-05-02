<template>
  <view class="min-h-screen bg-gradient-to-b from-[#1F1F1F] to-[#0B0B0C] px-4 pb-32 text-white/70 pt-4">
    <view v-if="showSkeleton">
      <view class="mb-4">
        <view class="flex items-center">
          <view class="h-7 w-44 rounded-md bg-white/10"></view>
        </view>
        <view class="mt-2 h-4 w-56 rounded bg-white/10"></view>
      </view>

      <view class="h-44 mb-6 rounded-2xl overflow-hidden bg-white/10"></view>

      <view class="flex items-center justify-between mb-4">
        <view class="flex items-center gap-2">
          <view class="w-1.5 h-1.5 bg-[#E82127] rotate-45"></view>
          <view class="h-5 w-24 rounded bg-white/10"></view>
        </view>
        <view class="h-4 w-12 rounded bg-white/10"></view>
      </view>
      <view style="height: 24rpx;"></view>

      <view class="grid grid-cols-2 gap-3">
        <view v-for="n in 4" :key="n" class="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-3">
          <view class="w-full aspect-square rounded-lg bg-white/10 mb-2"></view>
          <view class="h-4 w-3/4 rounded bg-white/10"></view>
        </view>
      </view>
    </view>

    <view v-else>
      <view class="mb-4">
        <view class="flex items-center">
          <image src="/static/icons/LOGO.png" mode="heightFix" class="h-7" />
        </view>
        <text class="text-white/60 mt-1 text-sm">探索特斯拉个性化改装</text>
      </view>

      <swiper 
          v-if="banners.length > 0"
          class="h-44 mb-6 rounded-2xl overflow-hidden shadow-lg" 
          circular 
          autoplay 
          interval="5000" 
          duration="500"
          indicator-dots
          :indicator-active-color="swiperIndicatorColor.active"
          :indicator-color="swiperIndicatorColor.inactive"
      >
          <swiper-item v-for="(item, index) in banners" :key="index" @click="handleBannerClick(item)">
              <view class="w-full h-full relative group active:opacity-80 transition-opacity">
                   <image :src="getOptimizedImage(item.image)" class="w-full h-full object-cover" mode="aspectFill" />
                  <view class="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10 flex items-end p-5">
                      <text class="text-white font-semibold text-xl tracking-wide">{{ item.title }}</text>
                  </view>
              </view>
          </swiper-item>
      </swiper>

      <!-- Wraps Section -->
      <view>
        <SectionHeader :show-more="true" @more="goToWraps">
          车身涂装
        </SectionHeader>
        <view style="height: 24rpx;"></view>
        
        <view class="grid grid-cols-2 gap-3" v-if="hotWraps.length > 0">
           <WrapCard v-for="wrap in hotWraps" :key="wrap.id" :wrap="wrap" class="w-full" />
        </view>

        <view v-if="loading" class="text-center py-8">
            <text class="text-white/40">加载中...</text>
        </view>

        <!-- View More Wraps -->
        <view class="py-4">
            <button @click="goToWraps" class="w-full bg-white/5 border border-white/10 rounded-xl py-3 flex items-center justify-center active:bg-white/10">
               <text class="text-white/80 text-sm font-medium">查看更多涂装</text>
            </button>
         </view>
      </view>
    </view>
  </view>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue';
import { supabase } from '../../services/supabase';
import { wrapsService } from '../../services/wraps';
import SectionHeader from '../../components/SectionHeader.vue';
import WrapCard from '../../components/WrapCard.vue';
import { getOptimizedImage } from '../../utils/image';

export default defineComponent({
  components: {
    SectionHeader,
    WrapCard
  },
  setup() {
     const banners = ref([]);
     const hotWraps = ref([]);
     const loading = ref(true);
     const showSkeleton = ref(true);

     const swiperIndicatorColor = {
        active: '#B83B3F',
        inactive: 'rgba(255, 255, 255, 0.15)'
    };

    const fetchBanners = async () => {
        if (!supabase) return;
        try {
            const { data } = await supabase
                .from('banners')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            if (data && data.length > 0) {
                banners.value = data.map(b => ({
                    id: b.id,
                    title: b.title,
                    image: b.image_url,
                    target: b.target_path
                }));
            }
        } catch (err) {
            console.error('Error fetching banners:', err);
        }
    };

    const fetchHotWraps = async () => {
        const { data } = await wrapsService.fetchWraps({ pageSize: 6 });
        if (data) {
            hotWraps.value = data;
        }
    };
    
    const handleBannerClick = (banner) => {
        if (banner.target) {
            uni.navigateTo({ url: banner.target });
        }
    };

    const goToWraps = () => {
         uni.switchTab({ url: '/pages/wraps/index' });
      };

     onMounted(async () => {
         loading.value = true;
         showSkeleton.value = true;

         await Promise.all([
             fetchBanners(),
             fetchHotWraps()
         ]);

         loading.value = false;
         showSkeleton.value = false;
     });

      return {
          banners,
          hotWraps,
          loading,
          showSkeleton,
          getOptimizedImage,
          swiperIndicatorColor,
          handleBannerClick,
          goToWraps
      };
  },
  onShareAppMessage() {
    return {
        title: '特玩',
        path: '/pages/index/index'
    };
  },
  onShareTimeline() {
    return {
        title: '特玩'
    };
  }
});
</script>

<style>
page {
    background-color: #0B0B0C;
}
</style>
