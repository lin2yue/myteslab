"use strict";
const common_vendor = require("../../common/vendor.js");
const services_audio = require("../../services/audio.js");
const store_player = require("../../store/player.js");
const utils_image = require("../../utils/image.js");
const GlobalPlayer = () => "../../components/GlobalPlayer.js";
const InstructionsModal = () => "../../components/InstructionsModal.js";
const AudioCard = () => "../../components/AudioCard.js";
const UiIcon = () => "../../components/UiIcon.js";
const AlbumCard = () => "../../components/AlbumCard.js";
const _sfc_main = common_vendor.defineComponent({
  components: {
    GlobalPlayer,
    InstructionsModal,
    AudioCard,
    AlbumCard,
    UiIcon
  },
  setup() {
    const currentTab = common_vendor.ref(0);
    const albums = common_vendor.ref([]);
    const albumsLoading = common_vendor.ref(true);
    const audios = common_vendor.ref([]);
    const audiosLoading = common_vendor.ref(true);
    const showModal = common_vendor.ref(false);
    const searchQuery = common_vendor.ref("");
    const sortBy = common_vendor.ref("newest");
    const audiosPage = common_vendor.ref(1);
    const audiosHasMore = common_vendor.ref(true);
    const audiosLoadingMore = common_vendor.ref(false);
    const audiosPageSize = 20;
    const playerStore = store_player.usePlayerStore();
    const { currentAudio, isPlaying } = common_vendor.storeToRefs(playerStore);
    common_vendor.onMounted(async () => {
      await fetchAlbums();
      await fetchAudios(true);
    });
    const fetchAlbums = async () => {
      albumsLoading.value = true;
      const { data } = await services_audio.audioService.fetchAlbumsData();
      if (data) {
        const map = {};
        data.forEach((audio) => {
          const name = audio.album || "Unknown";
          if (!map[name]) {
            map[name] = {
              name,
              cover_url: audio.cover_url,
              count: 0
            };
          }
          map[name].count++;
        });
        albums.value = Object.values(map);
      }
      albumsLoading.value = false;
    };
    const fetchAudios = async (reset = false) => {
      if (reset) {
        audiosPage.value = 1;
        audiosHasMore.value = true;
        audios.value = [];
      }
      if (!audiosHasMore.value)
        return;
      if (audiosPage.value > 1) {
        audiosLoadingMore.value = true;
      } else {
        audiosLoading.value = true;
      }
      const sortKey = sortBy.value === "hot" ? "hot" : "created_at";
      const { data } = await services_audio.audioService.fetchAudios(
        sortKey,
        audiosPage.value,
        audiosPageSize,
        searchQuery.value
      );
      if (data) {
        if (data.length < audiosPageSize) {
          audiosHasMore.value = false;
        }
        audios.value = [...audios.value, ...data];
        audiosPage.value++;
      } else {
        audiosHasMore.value = false;
      }
      audiosLoading.value = false;
      audiosLoadingMore.value = false;
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
    const switchTab = (index) => {
      currentTab.value = index;
    };
    const toggleSort = () => {
      sortBy.value = sortBy.value === "newest" ? "hot" : "newest";
      fetchAudios(true);
    };
    const goToDetail = (name) => {
      common_vendor.index.navigateTo({
        url: `/pages/album-detail/index?album=${encodeURIComponent(name)}`
      });
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
      currentTab,
      albums,
      albumsLoading,
      audios,
      audiosLoading,
      audiosHasMore,
      showModal,
      searchQuery,
      sortBy,
      currentAudio,
      isPlaying,
      switchTab,
      toggleSort,
      getOptimizedImage: utils_image.getOptimizedImage,
      goToDetail,
      handlePlay,
      handleDownload,
      fetchAudios
    };
  },
  onReachBottom() {
    if (this.currentTab === 1) {
      this.fetchAudios();
    }
  },
  onShareAppMessage() {
    return {
      title: "锁车音 - 特玩音效库",
      path: "/pages/albums/index"
    };
  },
  onShareTimeline() {
    return {
      title: "锁车音 - 特玩音效库"
    };
  }
});
if (!Array) {
  const _component_AlbumCard = common_vendor.resolveComponent("AlbumCard");
  const _component_UiIcon = common_vendor.resolveComponent("UiIcon");
  const _component_AudioCard = common_vendor.resolveComponent("AudioCard");
  const _component_GlobalPlayer = common_vendor.resolveComponent("GlobalPlayer");
  const _component_InstructionsModal = common_vendor.resolveComponent("InstructionsModal");
  (_component_AlbumCard + _component_UiIcon + _component_AudioCard + _component_GlobalPlayer + _component_InstructionsModal)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.n(_ctx.currentTab === 0 ? "text-whites90" : "text-whites50"),
    b: _ctx.currentTab === 0
  }, _ctx.currentTab === 0 ? {} : {}, {
    c: common_vendor.o(($event) => _ctx.switchTab(0)),
    d: common_vendor.n(_ctx.currentTab === 1 ? "text-whites90" : "text-whites50"),
    e: _ctx.currentTab === 1
  }, _ctx.currentTab === 1 ? {} : {}, {
    f: common_vendor.o(($event) => _ctx.switchTab(1)),
    g: _ctx.albumsLoading
  }, _ctx.albumsLoading ? {
    h: common_vendor.f(6, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : _ctx.albums.length > 0 ? {
    j: common_vendor.f(_ctx.albums, (album, k0, i0) => {
      return {
        a: album.name,
        b: common_vendor.o(($event) => _ctx.goToDetail(album.name), album.name),
        c: "147d9741-0-" + i0,
        d: common_vendor.p({
          album
        })
      };
    })
  } : {}, {
    i: _ctx.albums.length > 0,
    k: _ctx.currentTab === 0,
    l: common_vendor.p({
      name: "search",
      size: "4.5",
      color: "rgba(255,255,255,0.4)"
    }),
    m: _ctx.searchQuery,
    n: common_vendor.o(($event) => _ctx.searchQuery = $event.detail.value),
    o: _ctx.searchQuery
  }, _ctx.searchQuery ? {
    p: common_vendor.p({
      name: "clear",
      size: "4.5",
      color: "rgba(255,255,255,0.4)"
    }),
    q: common_vendor.o(($event) => _ctx.searchQuery = "")
  } : {}, {
    r: common_vendor.p({
      name: _ctx.sortBy === "newest" ? "sort-descending" : "equalizer",
      size: "5",
      color: "rgba(255,255,255,0.7)"
    }),
    s: common_vendor.t(_ctx.sortBy === "newest" ? "最新" : "最热"),
    t: common_vendor.o((...args) => _ctx.toggleSort && _ctx.toggleSort(...args)),
    v: _ctx.audiosLoading
  }, _ctx.audiosLoading ? {
    w: common_vendor.f(6, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    x: common_vendor.f(_ctx.audios, (audio, k0, i0) => {
      var _a;
      return {
        a: audio.id,
        b: common_vendor.o(($event) => _ctx.handlePlay(audio), audio.id),
        c: common_vendor.o(($event) => _ctx.handleDownload(audio), audio.id),
        d: "147d9741-4-" + i0,
        e: common_vendor.p({
          audio,
          ["is-playing"]: ((_a = _ctx.currentAudio) == null ? void 0 : _a.id) === audio.id && _ctx.isPlaying
        })
      };
    }),
    y: _ctx.audios.length === 0
  }, _ctx.audios.length === 0 ? {
    z: common_vendor.t(_ctx.searchQuery ? "无搜索结果" : "暂无数据")
  } : {}), {
    A: !_ctx.audiosHasMore && _ctx.audios.length > 0
  }, !_ctx.audiosHasMore && _ctx.audios.length > 0 ? {} : {}, {
    B: _ctx.currentTab === 1,
    C: common_vendor.o(($event) => _ctx.showModal = false),
    D: common_vendor.p({
      visible: _ctx.showModal
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
