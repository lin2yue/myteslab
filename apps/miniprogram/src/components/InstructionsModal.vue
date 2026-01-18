<template>
  <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300">
    <!-- Overlay -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <!-- Modal -->
    <div class="relative bg-[#222222] border border-[#3e3e3e] rounded-2xl p-6 w-full max-w-sm">
      <h3 class="text-xl font-bold text-white mb-6">下载指引</h3>
      
      <div class="space-y-5" v-if="type === 'audio'">
        <div class="flex items-start">
          <div class="w-6 h-6 rounded-full bg-[#E82127] flex items-center justify-center text-xs font-bold text-white mt-0.5 mr-3 shrink-0">1</div>
          <text class="text-gray-300 text-sm leading-relaxed">链接已复制！请在电脑浏览器打开。</text>
        </div>
         <div class="flex items-start">
          <div class="w-6 h-6 rounded-full bg-[#E82127] flex items-center justify-center text-xs font-bold text-white mt-0.5 mr-3 shrink-0">2</div>
          <text class="text-gray-300 text-sm leading-relaxed">粘贴链接下载音频文件 (WAV)。</text>
        </div>
         <div class="flex items-start">
          <div class="w-6 h-6 rounded-full bg-[#E82127] flex items-center justify-center text-xs font-bold text-white mt-0.5 mr-3 shrink-0">3</div>
          <text class="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">将文件存入车载U盘的根目录。</text>
        </div>
      </div>

      <div class="space-y-5" v-else-if="type === 'wrap'">
        <div class="flex items-start">
          <div class="w-6 h-6 rounded-full bg-[#E82127] flex items-center justify-center text-xs font-bold text-white mt-0.5 mr-3 shrink-0">1</div>
          <text class="text-gray-300 text-sm leading-relaxed">链接已复制！请在电脑浏览器打开。</text>
        </div>
         <div class="flex items-start">
          <div class="w-6 h-6 rounded-full bg-[#E82127] flex items-center justify-center text-xs font-bold text-white mt-0.5 mr-3 shrink-0">2</div>
          <text class="text-gray-300 text-sm leading-relaxed">下载涂装图片文件。</text>
        </div>
         <div class="flex items-start">
          <div class="w-6 h-6 rounded-full bg-[#E82127] flex items-center justify-center text-xs font-bold text-white mt-0.5 mr-3 shrink-0">3</div>
          <text class="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">在 U 盘创建 Toybox 文件夹，内部创建 Wraps 文件夹，将图片放入其中。</text>
        </div>
      </div>

      <button @click="$emit('close')" class="w-full mt-8 bg-white text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform flex items-center justify-center">
        知道了
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: Boolean,
  type: {
    type: String,
    default: 'audio' // 'audio' | 'wrap'
  }
});
</script>
