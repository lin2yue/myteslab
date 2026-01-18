<template>
  <div class="min-h-screen bg-[#111111] px-4 pt-4 pb-32">
    <div class="mb-4">
      <h1 class="text-2xl font-bold text-white tracking-tight">所有音频</h1>
      <p class="text-gray-400 text-sm mt-1">Search & Sort</p>
    </div>

    <!-- Search & Sort Header -->
    <div class="sticky top-0 z-10 bg-[#111111]/95 backdrop-blur-sm pt-1 pb-3">
        <div class="flex gap-3">
            <!-- Search Input -->
            <div class="flex-1 bg-[#1c1c1c] rounded-lg border border-gray-800 flex items-center px-3 h-10">
                <UiIcon name="search" class="mr-2" size="4" color="#6B7280" />
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="搜索音频..." 
                    class="flex-1 bg-transparent text-white text-sm h-full"
                    placeholder-class="text-gray-600"
                />
                 <div v-if="searchQuery" @click="searchQuery = ''" class="p-2 -mr-2">
                      <UiIcon name="clear" size="4" color="#6B7280" />
                 </div>
            </div>
            
            <!-- Sort Button -->
            <div @click="toggleSort" class="h-10 px-3 bg-[#1c1c1c] rounded-lg border border-gray-800 flex items-center justify-center active:bg-gray-800 transition">
                <UiIcon :name="sortBy === 'newest' ? 'sort-descending' : 'music-note'" size="4.5" class="mr-1.5" color="#D1D5DB" />
                <text class="text-xs text-gray-300 font-medium">{{ sortBy === 'newest' ? '最新' : '最热' }}</text>
            </div>
        </div>
    </div>

    <!-- Audios List -->
    <div>
      <AudioCard 
        v-for="audio in audios" 
        :key="audio.id" 
        :audio="audio"
        :is-playing="currentAudio?.id === audio.id && isPlaying"
        @play="handlePlay(audio)"
        @download="handleDownload(audio)"
      />
      
      <!-- Empty State -->
      <div v-if="!loading && audios.length === 0" class="text-center py-16">
          <text class="text-gray-500 text-sm">{{ searchQuery ? '无搜索结果 (No Results)' : '暂无数据' }}</text>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-10">
         <text class="text-gray-500">加载中...</text>
      </div>

      <!-- Load More Spinner -->
      <div v-if="loadingMore" class="py-4 flex justify-center">
          <text class="text-gray-500 text-xs">加载更多...</text>
      </div>
      <div v-if="!hasMore && audios.length > 0" class="py-8 text-center">
          <text class="text-white/30 text-sm">没有更多内容了</text>
      </div>
    </div>

    <GlobalPlayer />
    <InstructionsModal :visible="showModal" @close="showModal = false" />
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, watch } from 'vue';
import { audioService } from '../../services/audio';
import { usePlayerStore } from '../../store/player';
import { storeToRefs } from 'pinia';
import AudioCard from '../../components/AudioCard.vue';
import GlobalPlayer from '../../components/GlobalPlayer.vue';
import InstructionsModal from '../../components/InstructionsModal.vue';
import UiIcon from '../../components/UiIcon.vue';

export default defineComponent({
  components: {
    AudioCard,
    GlobalPlayer,
    InstructionsModal,
    UiIcon
  },
  setup() {
    const audios = ref([]);
    const loading = ref(true);
    const showModal = ref(false);
    const searchQuery = ref('');
    const sortBy = ref('newest'); // 'newest' | 'hot'
    const page = ref(1);
    const hasMore = ref(true);
    const loadingMore = ref(false);
    const PAGE_SIZE = 20;

    const playerStore = usePlayerStore();
    const { currentAudio, isPlaying } = storeToRefs(playerStore);


    const toggleSort = () => {
        sortBy.value = sortBy.value === 'newest' ? 'hot' : 'newest';
        fetchAudios(true);
    };

    const fetchAudios = async (reset = false) => {
      if (reset) {
          page.value = 1;
          hasMore.value = true;
          audios.value = [];
      }

      if (!hasMore.value) return;

      if (page.value > 1) {
          loadingMore.value = true;
      } else {
          loading.value = true;
      }

      const sortKey = sortBy.value === 'hot' ? 'hot' : 'created_at';
      const { data } = await audioService.fetchAudios(
          sortKey,
          page.value,
          PAGE_SIZE,
          searchQuery.value
      );

      if (data) {
          if (data.length < PAGE_SIZE) {
              hasMore.value = false;
          }
          audios.value = [...audios.value, ...data];
          page.value++;
      } else {
          hasMore.value = false;
      }

      loading.value = false;
      loadingMore.value = false;
    };

    let searchTimer = null;
    watch(searchQuery, () => {
        if (searchTimer) {
            clearTimeout(searchTimer);
        }
        searchTimer = setTimeout(() => {
            fetchAudios(true);
        }, 300);
    });

    onMounted(async () => {
        await fetchAudios(true);
    });

    const loadMoreAudios = () => {
        if (!loading.value && !loadingMore.value && hasMore.value) {
            fetchAudios();
        }
    };

    const handlePlay = (audio) => {
      playerStore.play(audio);
    };

    const handleDownload = (audio) => {
        const downloadUrl = audioService.getDownloadUrl(audio.file_url, audio.id);
      if (downloadUrl) {
          uni.setClipboardData({
              data: downloadUrl,
              success: () => {
                  showModal.value = true;
              }
          });
      }
    };

    return {
        audios,
        loading,
        loadingMore,
        hasMore,
        showModal,
        searchQuery,
        sortBy,
        currentAudio,
        isPlaying,
        toggleSort,
        handlePlay,
        handleDownload,
        loadMoreAudios
    };
  },
  onShareAppMessage() {
    return {
        title: '所有音频 - 特玩音效库',
        path: '/pages/library/index'
    };
  },
  onShareTimeline() {
    return {
        title: '所有音频 - 特玩音效库'
    };
  },
  onReachBottom() {
      this.loadMoreAudios();
  }
});
</script>

<style>
page {
    background-color: #111111;
}
</style>
