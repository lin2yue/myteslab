<template>
  <div class="min-h-screen bg-[#111111] pt-4 pb-32">
    <div class="mb-6 px-4">
      <h1 class="text-2xl font-bold text-white tracking-tight">教程</h1>
      <p class="text-gray-400 text-sm mt-1">特斯拉自定义锁车音更换教程</p>
    </div>

    <div class="space-y-4">
      <image
        v-for="(img, index) in tutorialImages"
        :key="index"
        :src="img"
        class="w-full"
        mode="widthFix"
      />
    </div>
    <div class="py-8 text-center">
        <text class="text-white/30 text-sm">没有更多内容了</text>
    </div>
  </div>
</template>

<script>
export default {
  setup() {
    const assetBase = 'https://cdn.tewan.club';
    const tutorialFilenames = [
      '锁车音教程1.jpg',
      '锁车音教程2.jpg',
      '锁车音教程3.jpg',
      '锁车音教程4.jpg',
      '锁车音教程5.jpg',
      '锁车音教程6.jpg'
    ];

    const tutorialImages = tutorialFilenames.map((name) => `${assetBase}/tutorial/${encodeURIComponent(name)}`);

    return {
      tutorialImages
    };
  },
  onShareAppMessage() {
    return {
      title: '特斯拉自定义锁车音更换教程',
      path: '/pages/tutorial/index'
    };
  },
  onShareTimeline() {
    return {
      title: '特斯拉自定义锁车音更换教程'
    };
  }
};
</script>

<style>
page {
  background-color: #111111;
}
</style>
