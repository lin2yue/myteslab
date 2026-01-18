<template>
  <div v-if="currentAudio" class="fixed bottom-0 left-0 right-0 bg-[#222222]/95 backdrop-blur-xl border-t border-[#3e3e3e] px-4 py-3 pb-safe z-50">
    <!-- Progress Bar -->
    <div class="absolute top-0 left-0 h-[2px] bg-[#E82127] transition-all duration-300" :style="{ width: progress + '%' }"></div>
    
    <div class="flex items-center justify-between h-14">
      <div class="flex flex-col flex-1 overflow-hidden mr-4 min-w-0">
        <text class="text-white font-medium text-sm truncate">{{ currentAudio.title }}</text>
        <text class="text-gray-400 text-xs mt-1">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</text>
      </div>
      
      <div class="flex items-center">
         <div @click="toggle" class="w-10 h-10 flex items-center justify-center rounded-full bg-white active:scale-90 transition-transform mr-3">
            <UiIcon :name="isPlaying ? 'pause' : 'play'" size="5" color="#000000" />
         </div>
         
         <div @click.stop="closePlayer" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20">
             <div class="flex items-center justify-center w-full h-full"> 
                <UiIcon name="close" size="4" color="#9CA3AF" />
             </div>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePlayerStore } from '../store/player';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import UiIcon from './UiIcon.vue';

const store = usePlayerStore();
const { currentAudio, isPlaying, duration, currentTime } = storeToRefs(store);

const toggle = () => {
    store.toggle();
}

const closePlayer = () => {
    store.close();
}

const progress = computed(() => {
    if(!duration.value) return 0;
    return (currentTime.value / duration.value) * 100;
});

const formatTime = (sec) => {
   if(!sec) return '0:00';
   const m = Math.floor(sec / 60);
   const s = Math.floor(sec % 60);
   return `${m}:${s < 10 ? '0'+s : s}`;
}
</script>

<style scoped>
.pb-safe {
  padding-bottom: constant(safe-area-inset-bottom); /* iOS 11.0 */
  padding-bottom: env(safe-area-inset-bottom); /* iOS 11.2+ */
}
</style>
