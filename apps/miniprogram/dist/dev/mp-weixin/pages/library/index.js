"use strict";
const common_vendor = require("../../common/vendor.js");
const services_audio = require("../../services/audio.js");
const store_player = require("../../store/player.js");
const AudioCard = () => "../../components/AudioCard.js";
const GlobalPlayer = () => "../../components/GlobalPlayer.js";
const InstructionsModal = () => "../../components/InstructionsModal.js";
const UiIcon = () => "../../components/UiIcon.js";
const _sfc_main = common_vendor.defineComponent({
  components: {
    AudioCard,
    GlobalPlayer,
    InstructionsModal,
    UiIcon
  },
  setup() {
    const audios = common_vendor.ref([]);
    const loading = common_vendor.ref(true);
    const showModal = common_vendor.ref(false);
    const searchQuery = common_vendor.ref("");
    const sortBy = common_vendor.ref("newest");
    const page = common_vendor.ref(1);
    const hasMore = common_vendor.ref(true);
    const loadingMore = common_vendor.ref(false);
    const PAGE_SIZE = 20;
    const playerStore = store_player.usePlayerStore();
    const { currentAudio, isPlaying } = common_vendor.storeToRefs(playerStore);
    const toggleSort = () => {
      sortBy.value = sortBy.value === "newest" ? "hot" : "newest";
      fetchAudios(true);
    };
    const fetchAudios = async (reset = false) => {
      if (reset) {
        page.value = 1;
        hasMore.value = true;
        audios.value = [];
      }
      if (!hasMore.value)
        return;
      if (page.value > 1) {
        loadingMore.value = true;
      } else {
        loading.value = true;
      }
      const sortKey = sortBy.value === "hot" ? "hot" : "created_at";
      const { data } = await services_audio.audioService.fetchAudios(
        sortKey,
        page.value,
        PAGE_SIZE,
        searchQuery.value
      );
      if (data) {
        if (data.length < PAGE_SIZE) {
          hasMore.value = false;
        }
        audios.value = [...audios.value, ...data];
        page.value++;
      } else {
        hasMore.value = false;
      }
      loading.value = false;
      loadingMore.value = false;
    };
    let searchTimer = null;
    common_vendor.watch(searchQuery, () => {
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
      searchTimer = setTimeout(() => {
        fetchAudios(true);
      }, 300);
    });
    common_vendor.onMounted(async () => {
      await fetchAudios(true);
    });
    const loadMoreAudios = () => {
      if (!loading.value && !loadingMore.value && hasMore.value) {
        fetchAudios();
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
    return {
      audios,
      loading,
      loadingMore,
      hasMore,
      showModal,
      searchQuery,
      sortBy,
      currentAudio,
      isPlaying,
      toggleSort,
      handlePlay,
      handleDownload,
      loadMoreAudios
    };
  },
  onShareAppMessage() {
    return {
      title: "所有音频 - 特玩音效库",
      path: "/pages/library/index"
    };
  },
  onShareTimeline() {
    return {
      title: "所有音频 - 特玩音效库"
    };
  },
  onReachBottom() {
    this.loadMoreAudios();
  }
});
if (!Array) {
  const _component_UiIcon = common_vendor.resolveComponent("UiIcon");
  const _component_AudioCard = common_vendor.resolveComponent("AudioCard");
  const _component_GlobalPlayer = common_vendor.resolveComponent("GlobalPlayer");
  const _component_InstructionsModal = common_vendor.resolveComponent("InstructionsModal");
  (_component_UiIcon + _component_AudioCard + _component_GlobalPlayer + _component_InstructionsModal)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.p({
      name: "search",
      size: "4",
      color: "#6B7280"
    }),
    b: _ctx.searchQuery,
    c: common_vendor.o(($event) => _ctx.searchQuery = $event.detail.value),
    d: _ctx.searchQuery
  }, _ctx.searchQuery ? {
    e: common_vendor.p({
      name: "clear",
      size: "4",
      color: "#6B7280"
    }),
    f: common_vendor.o(($event) => _ctx.searchQuery = "")
  } : {}, {
    g: common_vendor.p({
      name: _ctx.sortBy === "newest" ? "sort-descending" : "music-note",
      size: "4.5",
      color: "#D1D5DB"
    }),
    h: common_vendor.t(_ctx.sortBy === "newest" ? "最新" : "最热"),
    i: common_vendor.o((...args) => _ctx.toggleSort && _ctx.toggleSort(...args)),
    j: common_vendor.f(_ctx.audios, (audio, k0, i0) => {
      var _a;
      return {
        a: audio.id,
        b: common_vendor.o(($event) => _ctx.handlePlay(audio), audio.id),
        c: common_vendor.o(($event) => _ctx.handleDownload(audio), audio.id),
        d: "082b4dd8-3-" + i0,
        e: common_vendor.p({
          audio,
          ["is-playing"]: ((_a = _ctx.currentAudio) == null ? void 0 : _a.id) === audio.id && _ctx.isPlaying
        })
      };
    }),
    k: !_ctx.loading && _ctx.audios.length === 0
  }, !_ctx.loading && _ctx.audios.length === 0 ? {
    l: common_vendor.t(_ctx.searchQuery ? "无搜索结果 (No Results)" : "暂无数据")
  } : {}, {
    m: _ctx.loading
  }, _ctx.loading ? {} : {}, {
    n: _ctx.loadingMore
  }, _ctx.loadingMore ? {} : {}, {
    o: !_ctx.hasMore && _ctx.audios.length > 0
  }, !_ctx.hasMore && _ctx.audios.length > 0 ? {} : {}, {
    p: common_vendor.o(($event) => _ctx.showModal = false),
    q: common_vendor.p({
      visible: _ctx.showModal
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
