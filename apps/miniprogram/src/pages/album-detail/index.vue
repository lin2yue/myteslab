<template>
  <div
    class="min-h-screen bg-[#111111] px-4 pb-32"
    :style="{ paddingTop: `${safeTopPadding}px` }"
  >
    <div class="mb-4 flex items-center">
      <div @click="goBack" class="mr-4 p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/20">
        <UiIcon name="arrow-left" size="6" color="rgba(255,255,255,0.95)" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">{{ albumName }}</h1>
        <p class="text-gray-400 text-xs mt-1">{{ audios.length }} Audios</p>
      </div>
    </div>
    <!-- Audio List -->
    <div>
        <AudioCard 
            v-for="audio in audios" 
            :key="audio.id" 
            :audio="audio"
            :is-playing="currentAudio?.id === audio.id && isPlaying"
            @play="handlePlay(audio)"
            @download="handleDownload(audio)"
        />
        
        <div v-if="!loading && audios.length > 0" class="py-8 text-center">
            <text class="text-white/30 text-sm">没有更多内容了</text>
        </div>

        <!-- Empty State -->
        <div v-if="!loading && audios.length === 0" class="text-center py-16">
            <text class="text-gray-500 text-sm">该专辑暂无内容</text>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="text-center py-10">
            <text class="text-gray-500">加载中...</text>
        </div>
    </div>
    
    <GlobalPlayer />
    <InstructionsModal :visible="showModal" @close="showModal = false" />
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { audioService } from '../../services/audio';
import { usePlayerStore } from '../../store/player';
import { storeToRefs } from 'pinia';
import AudioCard from '../../components/AudioCard.vue';
import GlobalPlayer from '../../components/GlobalPlayer.vue';
import InstructionsModal from '../../components/InstructionsModal.vue';
import UiIcon from '../../components/UiIcon.vue';
import { getOptimizedImage } from '../../utils/image';

export default defineComponent({
  components: {
    AudioCard,
    GlobalPlayer,
    InstructionsModal,
    UiIcon
  },
  setup() {
    const albumName = ref('');
    const coverUrl = ref('');
    const audios = ref([]);
    const loading = ref(true);
    const showModal = ref(false);

    const safeTopPadding = ref(12);
    try {
      const sys = uni.getSystemInfoSync();
      const statusBarHeight = Number(sys && sys.statusBarHeight) || 0;
      safeTopPadding.value = statusBarHeight + 12;
    } catch (err) {
      safeTopPadding.value = 44 + 12;
    }

    const playerStore = usePlayerStore();
    const { currentAudio, isPlaying } = storeToRefs(playerStore);

    onLoad((options) => {
        if (options.album) {
            try {
                albumName.value = decodeURIComponent(decodeURIComponent(options.album));
            } catch(e) {
                albumName.value = decodeURIComponent(options.album);
            }
            fetchAlbumAudios(albumName.value);
        }
    });

    const fetchAlbumAudios = async (album) => {
        loading.value = true;
        const { data } = await audioService.fetchAudiosByAlbum(album);
        if (data) {
            audios.value = data;
            // Extract cover from first item
            if (data.length > 0 && data[0].cover_url) {
                coverUrl.value = getOptimizedImage(data[0].cover_url);
            }
        }
        loading.value = false;
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

    const goBack = () => {
        uni.navigateBack();
    };

    return {
        safeTopPadding,
        albumName,
        coverUrl,
        audios,
        loading,
        showModal,
        currentAudio,
        isPlaying,
        handlePlay,
        handleDownload,
        goBack
    };
  },
  onShareAppMessage() {
    // Access setup state via this
    return {
        title: `专辑：${this.albumName}`,
        path: `/pages/album-detail/index?album=${encodeURIComponent(this.albumName)}`,
        imageUrl: this.coverUrl || undefined // Use default snapshot if undefined
    };
  },
  onShareTimeline() {
    return {
        title: `专辑：${this.albumName}`,
        imageUrl: this.coverUrl || undefined
    };
  }
});
</script>

<style>
page {
    background-color: #111111;
}
</style>
