<template>
  <div class="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-3 flex items-center justify-between transition-all duration-200 active:scale-[0.98] active:bg-white/10 mb-4">
    <div class="flex items-center flex-1 min-w-0" @click="$emit('play')">
      <div class="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center mr-4 shrink-0 overflow-hidden relative group">
        <image v-if="audio.cover_url && !imageError" :src="getOptimizedImage(audio.cover_url, 200)" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" mode="aspectFill" @error="handleImageError" />
        <div v-else class="w-full h-full flex items-center justify-center bg-black/20">
            <UiIcon name="music-note" size="8" color="rgba(255,255,255,0.2)" />
        </div>

        <div class="absolute inset-0 flex items-center justify-center">
             <div class="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
                 <UiIcon name="play" size="4" color="rgba(255,255,255,0.9)" class="ml-0.5" />
             </div>
        </div>
      </div>

      <div class="overflow-hidden flex-1 min-w-0">
         <h3 class="text-white/90 font-semibold text-base leading-tight truncate mb-2">{{ audio.title }}</h3>

         <div class="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                <div class="flex items-center">
                    <UiIcon name="play-solid" size="3" class="mr-1" opacity="0.8" />
                    <text>{{ formatCount(audio.play_count || 0) }}</text>
                </div>
               <div class="flex items-center">
                   <UiIcon name="clock" size="3" class="mr-1" opacity="0.8" />
                   <text>{{ audio.duration ? formatDuration(audio.duration) : '--:--' }}</text>
               </div>
            <text v-if="audio.album" class="text-white/70 truncate max-w-[8em] bg-white/10 px-1.5 py-0.5 rounded-sm">{{ audio.album }}</text>
         </div>
      </div>
    </div>

    <div @click.stop="handleDownloadClick" class="p-2 ml-2">
       <button class="text-[#E82127]/90 text-xs font-bold bg-[#E82127]/10 border border-[#E82127]/30 px-3 py-2 rounded-full transition-all active:bg-[#E82127]/20 active:scale-90">获取</button>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue';
import { getOptimizedImage } from '../utils/image';
import UiIcon from './UiIcon.vue';

defineProps({
  audio: Object,
  isPlaying: Boolean
});

const emit = defineEmits(['play', 'download']);

const imageError = ref(false);

const handleImageError = () => {
  imageError.value = true;
};

const formatCount = (count) => {
  if (count > 10000) {
    return `${(count / 10000).toFixed(1)}万`;
  }
  return `${count}`;
};

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const handleDownloadClick = () => {
  emit('download');
};
</script>
