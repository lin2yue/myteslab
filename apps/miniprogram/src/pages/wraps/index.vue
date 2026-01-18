<template>
  <view class="min-h-screen bg-gradient-to-b from-[#1F1F1F] to-[#0B0B0C] px-4 pb-4 text-white/70 pt-2">
    <!-- Header -->
    <SectionHeader class="mb-2">车身涂装</SectionHeader>
    <text class="text-white/60 mt-1 text-sm mb-4 block">Find your next wrap</text>

    <!-- Search Bar -->
    <view class="mb-4">
      <view class="flex items-center bg-white/5 border border-white/10 rounded-full px-4 h-12 transition-colors focus-within:border-white/20 focus-within:bg-white/10">
        <UiIcon name="search" class="mr-2" size="4.5" color="rgba(255,255,255,0.35)" />
        <input
          v-model="searchQuery"
          class="flex-1 bg-transparent text-white/90 text-sm h-full"
          placeholder="搜索涂装..."
          placeholder-class="text-white/30"
          @confirm="handleSearch"
        />
        <view v-if="searchQuery" class="p-2 -mr-2 active:opacity-70" @click="searchQuery = ''; handleSearch()">
          <UiIcon name="clear" size="4.5" color="rgba(255,255,255,0.45)" />
        </view>
      </view>
    </view>

    <!-- Model Filter (Sticky) -->
    <view class="sticky top-0 z-10 bg-[#1F1F1F]/80 backdrop-blur-lg -mx-4 px-4 py-4 mb-4 border-b border-white/10">
      <scroll-view scroll-x class="whitespace-nowrap w-full" :show-scrollbar="false">
        <view class="flex items-center gap-3 pr-4">
          <!-- Removed '全部' option, Model 3 is now default -->

          <view
            v-for="model in models"
            :key="model.id"
            class="px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ease-out active:scale-95 flex items-center justify-center whitespace-nowrap"
            :class="[
              selectedModelId === model.id
                ? 'bg-white text-black shadow-lg shadow-white/10'
                : 'bg-white/10 text-white/60 border border-white/5'
            ]"
            @click="selectModel(model.id)"
          >
            {{ model.name }}
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- Loading State (Skeleton) -->
    <view v-if="loading" class="grid grid-cols-2 gap-3">
      <view v-for="n in 6" :key="n" class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <view class="relative w-full pt-[75%] bg-white/10"></view>
        <view class="p-3">
          <view class="h-4 w-24 rounded bg-white/10 mb-2"></view>
          <view class="h-3 w-16 rounded bg-white/10"></view>
        </view>
      </view>
    </view>

    <!-- Empty State -->
    <view v-else-if="wraps.length === 0" class="text-center py-16">
      <text class="text-white/40">暂无相关涂装</text>
    </view>

    <!-- Wraps Grid -->
    <view v-else>
      <view class="grid grid-cols-2 gap-3 pb-safe">
        <WrapCard v-for="wrap in wraps" :key="wrap.id" :wrap="wrap" :model-id="selectedModelId" class="w-full" />
      </view>
      <view class="py-8 text-center pb-safe">
        <text class="text-white/30 text-sm">没有更多内容了</text>
      </view>
    </view>
  </view>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue';
import { wrapsService } from '../../services/wraps.js';
import SectionHeader from '../../components/SectionHeader.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiIcon from '../../components/UiIcon.vue';
import WrapCard from '../../components/WrapCard.vue';

export default defineComponent({
  components: {
    SectionHeader,
    UiBadge,
    UiIcon,
    WrapCard,
  },
  setup() {
    const models = ref([]);
    const wraps = ref([]);
    const loading = ref(true);
    const searchQuery = ref('');
    const selectedModelId = ref('');

    const fetchModels = async () => {
      const { data } = await wrapsService.fetchModels();
      const MODEL_DISPLAY_NAMES = {
        'model-3': 'Model 3',
        'model-3-2024-plus': 'Model 3(焕新版)',
        'cybertruck': 'Cybertruck',
        'model-y-pre-2025': 'Model Y',
        'model-y-2025-plus': 'Model Y(2025+)'
      };

      models.value = data.sort((a, b) => {
            // Custom sort order: Model 3 -> Cybertruck -> Model Y
            const order = ['model-3', 'model-3-2024-plus', 'cybertruck', 'model-y-pre-2025', 'model-y-2025-plus'];
            const indexA = order.indexOf(a.slug);
            const indexB = order.indexOf(b.slug);
            
            // Prioritize items in the order list
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            
            return 0;
        }).map(m => ({
          ...m,
          name: MODEL_DISPLAY_NAMES[m.slug] || m.name // Use mapped name or fallback to DB name
        }));
    };

    const fetchWraps = async () => {
      loading.value = true;
      const { data } = await wrapsService.fetchWraps({
        modelId: selectedModelId.value,
        search: searchQuery.value,
      });
      wraps.value = data;
      loading.value = false;
    };

    const handleSearch = () => {
      fetchWraps();
    };

    const selectModel = (modelId) => {
      selectedModelId.value = modelId;
      fetchWraps();
    };

    onMounted(async () => {
      await fetchModels();
      // Set Model 3 as default
      if (models.value.length > 0) {
        const model3 = models.value.find(m => m.slug === 'model-3');
        if (model3) {
          selectedModelId.value = model3.id;
        } else {
          selectedModelId.value = models.value[0].id;
        }
      }
      await fetchWraps();
    });

    return {
      models,
      wraps,
      loading,
      searchQuery,
      selectedModelId,
      handleSearch,
      selectModel,
    };
  },
});
</script>
