<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
        <div class="w-1.5 h-1.5 bg-[#E82127] rotate-45"></div>
        <h2 class="text-lg font-semibold text-white/85 tracking-wide">
            <slot />
        </h2>
    </div>
    <div v-if="showMore" @click="$emit('more')" class="text-white/40 text-sm flex items-center active:opacity-60 transition-opacity">
      <text class="leading-none">全部</text>
      <UiIcon name="chevron-right" size="4" class="ml-1" color="rgba(255,255,255,0.4)" />
    </div>
  </div>
</template>

<script>

import { defineComponent } from 'vue';
import UiIcon from './UiIcon.vue';

export default defineComponent({
  name: 'SectionHeader',
  components: { UiIcon },
  props: {
    showMore: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['more'],
});
</script>
