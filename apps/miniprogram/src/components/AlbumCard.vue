<template>
  <div class="active:opacity-80 transition-opacity" @click="$emit('click')">
    <UiCard>
      <div class="relative w-full h-0 pb-[100%]">
        <image
          :src="getOptimizedImage(album.cover_url, 600) || '/static/logo.png'"
          class="absolute inset-0 w-full h-full object-cover"
          mode="aspectFill"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
        <div class="absolute top-2 right-2">
            <UiBadge>{{ album.count }} 个</UiBadge>
        </div>
        <div class="absolute bottom-0 left-0 right-0 p-3">
            <text class="text-white/90 font-semibold text-base block truncate">{{ album.name }}</text>
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import { getOptimizedImage } from '../utils/image';
import UiCard from './UiCard.vue';
import UiBadge from './UiBadge.vue';

export default defineComponent({
  name: 'AlbumCard',
  components: { UiCard, UiBadge },
  props: {
    album: {
      type: Object,
      required: true,
    },
  },
  emits: ['click'],
  setup() {
    return {
      getOptimizedImage,
    };
  },
});
</script>
