"use strict";
const common_vendor = require("../../common/vendor.js");
const services_audio = require("../../services/audio.js");
const services_wraps = require("../../services/wraps.js");
const store_player = require("../../store/player.js");
const utils_image = require("../../utils/image.js");
const common_assets = require("../../common/assets.js");
const AudioCard = () => "../../components/AudioCard.js";
const GlobalPlayer = () => "../../components/GlobalPlayer.js";
const Modal = () => "../../components/InstructionsModal.js";
const SectionHeader = () => "../../components/SectionHeader.js";
const UiCard = () => "../../components/UiCard.js";
const UiIcon = () => "../../components/UiIcon.js";
const WrapCard = () => "../../components/WrapCard.js";
const _sfc_main = common_vendor.defineComponent({
  components: {
    AudioCard,
    GlobalPlayer,
    Modal,
    SectionHeader,
    UiCard,
    UiIcon,
    WrapCard
  },
  setup() {
    const banners = common_vendor.ref([]);
    const hotAudios = common_vendor.ref([]);
    const hotWraps = common_vendor.ref([]);
    const loading = common_vendor.ref(true);
    const showModal = common_vendor.ref(false);
    const showSkeleton = common_vendor.ref(true);
    const swiperIndicatorColor = {
      active: "#B83B3F",
      inactive: "rgba(255, 255, 255, 0.15)"
    };
    const playerStore = store_player.usePlayerStore();
    const { currentAudio, isPlaying } = common_vendor.storeToRefs(playerStore);
    const fetchBanners = async () => {
      const { data } = await services_audio.audioService.fetchBanners();
      if (data && data.length > 0) {
        banners.value = data.map((b) => ({
          id: b.id,
          title: b.title,
          image: b.image_url,
          target: b.target_path
        }));
      } else {
        banners.value = [];
      }
    };
    const fetchHotAudios = async () => {
      const { data } = await services_audio.audioService.fetchAudios("hot", 1, 10);
      if (data) {
        hotAudios.value = data;
      }
    };
    const fetchHotWraps = async () => {
      const { data } = await services_wraps.wrapsService.fetchWraps({ pageSize: 6 });
      if (data) {
        hotWraps.value = data;
      }
    };
    const handleBannerClick = (banner) => {
      if (banner.target) {
        common_vendor.index.navigateTo({ url: banner.target });
      }
    };
    const handlePlay = (audio) => {
      playerStore.play(audio);
    };
    const handleDownload = (audio) => {
      const downloadUrl = services_audio.audioService.getDownloadUrl(audio.file_url, audio.id);
      if (downloadUrl) {
        common_vendor.index.setClipboardData({
          data: downloadUrl,
          success: () => {
            showModal.value = true;
          }
        });
      }
    };
    const goToLibrary = () => {
      common_vendor.index.switchTab({ url: "/pages/library/index" });
    };
    const goToAlbums = () => {
      common_vendor.index.switchTab({ url: "/pages/albums/index" });
    };
    const goToWraps = () => {
      common_vendor.index.switchTab({ url: "/pages/wraps/index" });
    };
    common_vendor.onMounted(async () => {
      loading.value = true;
      showSkeleton.value = true;
      await Promise.all([
        fetchBanners(),
        fetchHotAudios(),
        fetchHotWraps()
      ]);
      loading.value = false;
      showSkeleton.value = false;
    });
    return {
      banners,
      hotAudios,
      hotWraps,
      loading,
      showModal,
      showSkeleton,
      getOptimizedImage: utils_image.getOptimizedImage,
      currentAudio,
      isPlaying,
      swiperIndicatorColor,
      handleBannerClick,
      handlePlay,
      handleDownload,
      goToLibrary,
      goToAlbums,
      goToWraps
    };
  },
  onShareAppMessage() {
    return {
      title: "特玩-锁车音效库",
      path: "/pages/index/index"
    };
  },
  onShareTimeline() {
    return {
      title: "特玩-锁车音效库"
    };
  }
});
if (!Array) {
  const _component_SectionHeader = common_vendor.resolveComponent("SectionHeader");
  const _component_AudioCard = common_vendor.resolveComponent("AudioCard");
  const _component_WrapCard = common_vendor.resolveComponent("WrapCard");
  const _component_GlobalPlayer = common_vendor.resolveComponent("GlobalPlayer");
  const _component_Modal = common_vendor.resolveComponent("Modal");
  (_component_SectionHeader + _component_AudioCard + _component_WrapCard + _component_GlobalPlayer + _component_Modal)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: _ctx.showSkeleton
  }, _ctx.showSkeleton ? {
    b: common_vendor.f(4, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    c: common_assets._imports_0,
    d: common_vendor.f(_ctx.banners, (item, index, i0) => {
      return {
        a: _ctx.getOptimizedImage(item.image),
        b: common_vendor.t(item.title),
        c: index,
        d: common_vendor.o(($event) => _ctx.handleBannerClick(item), index)
      };
    }),
    e: _ctx.swiperIndicatorColor.active,
    f: _ctx.swiperIndicatorColor.inactive,
    g: common_vendor.o(_ctx.goToLibrary),
    h: common_vendor.p({
      ["show-more"]: true
    }),
    i: common_vendor.f(_ctx.hotAudios, (audio, k0, i0) => {
      var _a;
      return {
        a: audio.id,
        b: common_vendor.o(($event) => _ctx.handlePlay(audio), audio.id),
        c: common_vendor.o(($event) => _ctx.handleDownload(audio), audio.id),
        d: "7ba313eb-1-" + i0,
        e: common_vendor.p({
          audio,
          ["is-playing"]: ((_a = _ctx.currentAudio) == null ? void 0 : _a.id) === audio.id && _ctx.isPlaying
        })
      };
    }),
    j: _ctx.loading
  }, _ctx.loading ? {} : {}, {
    k: common_vendor.o((...args) => _ctx.goToLibrary && _ctx.goToLibrary(...args)),
    l: common_vendor.o(_ctx.goToWraps),
    m: common_vendor.p({
      ["show-more"]: true
    }),
    n: _ctx.hotWraps.length > 0
  }, _ctx.hotWraps.length > 0 ? {
    o: common_vendor.f(_ctx.hotWraps, (wrap, k0, i0) => {
      return {
        a: wrap.id,
        b: "7ba313eb-3-" + i0,
        c: common_vendor.p({
          wrap
        })
      };
    })
  } : {}, {
    p: common_vendor.o((...args) => _ctx.goToWraps && _ctx.goToWraps(...args)),
    q: common_vendor.o(($event) => _ctx.showModal = false),
    r: common_vendor.p({
      visible: _ctx.showModal
    })
  }));
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
