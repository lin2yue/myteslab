<template>
  <div class="min-h-screen bg-gradient-to-b from-[#1F1F1F] to-[#0B0B0C] pb-32 text-white/70">
    <div class="sticky top-0 z-10 bg-[#1A1A1A]/80 backdrop-blur-lg border-b border-white/10">
      <div class="flex">
        <div
          @click="switchTab(0)"
          class="flex-1 py-3.5 text-center relative transition-colors"
        >
          <text :class="['text-base font-semibold', currentTab === 0 ? 'text-white/90' : 'text-white/50']">专辑</text>
          <div v-if="currentTab === 0" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#E82127] rounded-full"></div>
        </div>
        <div
          @click="switchTab(1)"
          class="flex-1 py-3.5 text-center relative transition-colors"
        >
          <text :class="['text-base font-semibold', currentTab === 1 ? 'text-white/90' : 'text-white/50']">音效</text>
          <div v-if="currentTab === 1" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#E82127] rounded-full"></div>
        </div>
      </div>
    </div>

    <!-- Albums Tab -->
    <div v-show="currentTab === 0" class="px-4 pt-6 pb-8">
      <div v-if="albumsLoading" class="grid grid-cols-2 gap-x-4 gap-y-6">
        <div v-for="n in 6" :key="n" class="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl overflow-hidden">
          <div class="relative w-full h-0 pb-[100%]">
            <div class="absolute inset-0 bg-white/10"></div>
          </div>
          <div class="p-3">
            <div class="h-4 w-24 rounded bg-white/10"></div>
          </div>
        </div>
      </div>

      <div v-else-if="albums.length > 0">
        <div class="grid grid-cols-2 gap-x-4 gap-y-6">
          <AlbumCard
            v-for="album in albums"
            :key="album.name"
            :album="album"
            @click="goToDetail(album.name)"
          />
        </div>
        <div class="py-8 text-center">
          <text class="text-white/30 text-sm">没有更多内容了</text>
        </div>
      </div>

      <div v-else class="text-center py-16">
        <text class="text-white/40 text-sm">暂无数据 (No Data)</text>
      </div>
    </div>

    <!-- Library Tab -->
    <div v-show="currentTab === 1" class="px-4 py-6">
      <div class="flex gap-3 mb-4">
        <div class="flex-1 bg-white/5 border border-white/10 rounded-xl flex items-center px-4 h-12">
           <UiIcon name="search" class="mr-3" size="4.5" color="rgba(255,255,255,0.4)" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索..."
            class="flex-1 bg-transparent text-white/90 text-sm h-full"
            placeholder-class="text-white/40"
          />
           <div v-if="searchQuery" @click="searchQuery = ''" class="p-2 -mr-2 active:opacity-60">
              <UiIcon name="clear" size="4.5" color="rgba(255,255,255,0.4)" />
           </div>
        </div>
        <div @click="toggleSort" class="h-12 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center active:bg-white/10 transition-colors">
           <UiIcon :name="sortBy === 'newest' ? 'sort-descending' : 'equalizer'" size="5" class="mr-1.5" color="rgba(255,255,255,0.7)" />
          <text class="text-xs text-white/70 font-medium">{{ sortBy === 'newest' ? '最新' : '最热' }}</text>
        </div>
      </div>

      <div v-if="audiosLoading" class="space-y-4">
        <div v-for="n in 6" :key="n" class="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-3 flex items-center">
          <div class="w-16 h-16 rounded-lg bg-white/10 mr-4 shrink-0"></div>
          <div class="flex-1 min-w-0">
            <div class="h-4 w-44 rounded bg-white/10 mb-2"></div>
            <div class="h-3 w-28 rounded bg-white/10"></div>
          </div>
        </div>
      </div>

      <div v-else>
        <AudioCard
          v-for="audio in audios"
          :key="audio.id"
          :audio="audio"
          :is-playing="currentAudio?.id === audio.id && isPlaying"
          @play="handlePlay(audio)"
          @download="handleDownload(audio)"
        />

        <div v-if="audios.length === 0" class="text-center py-16">
          <text class="text-white/40 text-sm">{{ searchQuery ? '无搜索结果' : '暂无数据' }}</text>
        </div>
      </div>

      <div v-if="!audiosHasMore && audios.length > 0" class="py-8 text-center">
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
import GlobalPlayer from '../../components/GlobalPlayer.vue';
import InstructionsModal from '../../components/InstructionsModal.vue';
import AudioCard from '../../components/AudioCard.vue';
import { getOptimizedImage } from '../../utils/image';
import UiIcon from '../../components/UiIcon.vue';

import AlbumCard from '../../components/AlbumCard.vue';

export default defineComponent({
  components: {
    GlobalPlayer,
    InstructionsModal,
    AudioCard,
    AlbumCard,
    UiIcon
  },
  setup() {
    const currentTab = ref(0);
    const albums = ref([]);
    const albumsLoading = ref(true);
    const audios = ref([]);
    const audiosLoading = ref(true);
    const showModal = ref(false);
    const searchQuery = ref('');
    const sortBy = ref('newest');
    const audiosPage = ref(1);
    const audiosHasMore = ref(true);
    const audiosLoadingMore = ref(false);
    const audiosPageSize = 20;

    const playerStore = usePlayerStore();
    const { currentAudio, isPlaying } = storeToRefs(playerStore);

    onMounted(async () => {
      await fetchAlbums();
      await fetchAudios(true);
    });

    const fetchAlbums = async () => {
      albumsLoading.value = true;
      const { data } = await audioService.fetchAlbumsData();

      if (data) {
        const map = {};
        data.forEach(audio => {
          const name = audio.album || 'Unknown';
          if (!map[name]) {
            map[name] = {
              name: name,
              cover_url: audio.cover_url,
              count: 0
            };
          }
          map[name].count++;
        });
        albums.value = Object.values(map);
      }
      albumsLoading.value = false;
    };

    const fetchAudios = async (reset = false) => {
      if (reset) {
        audiosPage.value = 1;
        audiosHasMore.value = true;
        audios.value = [];
      }

      if (!audiosHasMore.value) return;

      if (audiosPage.value > 1) {
        audiosLoadingMore.value = true;
      } else {
        audiosLoading.value = true;
      }

      const sortKey = sortBy.value === 'hot' ? 'hot' : 'created_at';
      const { data } = await audioService.fetchAudios(
        sortKey,
        audiosPage.value,
        audiosPageSize,
        searchQuery.value
      );

      if (data) {
        if (data.length < audiosPageSize) {
          audiosHasMore.value = false;
        }
        audios.value = [...audios.value, ...data];
        audiosPage.value++;
      } else {
        audiosHasMore.value = false;
      }

      audiosLoading.value = false;
      audiosLoadingMore.value = false;
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

    const switchTab = (index) => {
      currentTab.value = index;
    };

    const toggleSort = () => {
      sortBy.value = sortBy.value === 'newest' ? 'hot' : 'newest';
      fetchAudios(true);
    };

    const goToDetail = (name) => {
      uni.navigateTo({
        url: `/pages/album-detail/index?album=${encodeURIComponent(name)}`
      });
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
      currentTab,
      albums,
      albumsLoading,
      audios,
      audiosLoading,
      audiosHasMore,
      showModal,
      searchQuery,
      sortBy,
      currentAudio,
      isPlaying,
      switchTab,
      toggleSort,
      getOptimizedImage,
      goToDetail,
      handlePlay,
      handleDownload,
      fetchAudios
    };
  },
  onReachBottom() {
    if (this.currentTab === 1) {
      this.fetchAudios();
    }
  },
  onShareAppMessage() {
    return {
      title: '锁车音 - 特玩音效库',
      path: '/pages/albums/index'
    };
  },
  onShareTimeline() {
    return {
      title: '锁车音 - 特玩音效库'
    };
  }
});
</script>

<style>
page {
  background-color: #0B0B0C;
}
</style>
