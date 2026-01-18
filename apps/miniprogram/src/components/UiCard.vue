<template>
  <div class="bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-2xl overflow-hidden">
    <slot />
  </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'UiCard',
});
</script>
