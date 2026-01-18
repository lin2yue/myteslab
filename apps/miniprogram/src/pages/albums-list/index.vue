<template>
  <div class="min-h-screen bg-gradient-to-b from-[#1F1F1F] to-[#0B0B0C] px-4 pt-6 pb-32 text-white/70">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white/95 tracking-wider">专辑</h1>
      <p class="text-white/60 text-base mt-2">精选合集 ({{ albums.length }})</p>
    </div>

    <div v-if="!loading && albums.length > 0">
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

    <div v-if="!loading && albums.length === 0" class="text-center py-16">
        <text class="text-white/40 text-sm">暂无数据</text>
    </div>

    <div v-if="loading" class="text-center py-16">
         <text class="text-white/40">加载中...</text>
    </div>

    <GlobalPlayer />
   </div>
</template>

<script>

import { defineComponent, ref, onMounted } from 'vue';
import { audioService } from '../../services/audio';
import GlobalPlayer from '../../components/GlobalPlayer.vue';
import { getOptimizedImage } from '../../utils/image';

import AlbumCard from '../../components/AlbumCard.vue';

export default defineComponent({
  components: {
    GlobalPlayer,
    AlbumCard
  },
  setup() {
    const albums = ref([]);
    const loading = ref(true);

    onMounted(async () => {
        await fetchAlbums();
    });

    const fetchAlbums = async () => {
      loading.value = true;
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
      loading.value = false;
    };

    const goToDetail = (name) => {
        uni.navigateTo({
            url: `/pages/album-detail/index?album=${encodeURIComponent(name)}`
        });
    };

    return {
        albums,
        loading,
        getOptimizedImage,
        goToDetail
    };
  },
  onShareAppMessage() {
    return {
        title: '精选专辑 - 特玩音效库',
        path: '/pages/albums-list/index'
    };
  },
  onShareTimeline() {
    return {
        title: '精选专辑 - 特玩音效库'
    };
  }
});
</script>

<style>
page {
    background-color: #0B0B0C;
}
</style>
