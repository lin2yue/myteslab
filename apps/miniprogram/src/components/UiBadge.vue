<template>
  <view 
    class="bg-black/30 backdrop-blur-md text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20"
    @click="$emit('click')"
  >
    <slot />
  </view>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'UiBadge',
  emits: ['click']
});
</script>
