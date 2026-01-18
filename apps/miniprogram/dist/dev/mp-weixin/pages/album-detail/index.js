"use strict";
const common_vendor = require("../../common/vendor.js");
const services_audio = require("../../services/audio.js");
const store_player = require("../../store/player.js");
const utils_image = require("../../utils/image.js");
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
    const albumName = common_vendor.ref("");
    const coverUrl = common_vendor.ref("");
    const audios = common_vendor.ref([]);
    const loading = common_vendor.ref(true);
    const showModal = common_vendor.ref(false);
    const safeTopPadding = common_vendor.ref(12);
    try {
      const sys = common_vendor.index.getSystemInfoSync();
      const statusBarHeight = Number(sys && sys.statusBarHeight) || 0;
      safeTopPadding.value = statusBarHeight + 12;
    } catch (err) {
      safeTopPadding.value = 44 + 12;
    }
    const playerStore = store_player.usePlayerStore();
    const { currentAudio, isPlaying } = common_vendor.storeToRefs(playerStore);
    common_vendor.onLoad((options) => {
      if (options.album) {
        try {
          albumName.value = decodeURIComponent(decodeURIComponent(options.album));
        } catch (e) {
          albumName.value = decodeURIComponent(options.album);
        }
        fetchAlbumAudios(albumName.value);
      }
    });
    const fetchAlbumAudios = async (album) => {
      loading.value = true;
      const { data } = await services_audio.audioService.fetchAudiosByAlbum(album);
      if (data) {
        audios.value = data;
        if (data.length > 0 && data[0].cover_url) {
          coverUrl.value = utils_image.getOptimizedImage(data[0].cover_url);
        }
      }
      loading.value = false;
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
    const goBack = () => {
      common_vendor.index.navigateBack();
    };
    return {
      safeTopPadding,
      albumName,
      coverUrl,
      audios,
      loading,
      showModal,
      currentAudio,
      isPlaying,
      handlePlay,
      handleDownload,
      goBack
    };
  },
  onShareAppMessage() {
    return {
      title: `专辑：${this.albumName}`,
      path: `/pages/album-detail/index?album=${encodeURIComponent(this.albumName)}`,
      imageUrl: this.coverUrl || void 0
      // Use default snapshot if undefined
    };
  },
  onShareTimeline() {
    return {
      title: `专辑：${this.albumName}`,
      imageUrl: this.coverUrl || void 0
    };
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
      name: "arrow-left",
      size: "6",
      color: "rgba(255,255,255,0.95)"
    }),
    b: common_vendor.o((...args) => _ctx.goBack && _ctx.goBack(...args)),
    c: common_vendor.t(_ctx.albumName),
    d: common_vendor.t(_ctx.audios.length),
    e: common_vendor.f(_ctx.audios, (audio, k0, i0) => {
      var _a;
      return {
        a: audio.id,
        b: common_vendor.o(($event) => _ctx.handlePlay(audio), audio.id),
        c: common_vendor.o(($event) => _ctx.handleDownload(audio), audio.id),
        d: "32fc558c-1-" + i0,
        e: common_vendor.p({
          audio,
          ["is-playing"]: ((_a = _ctx.currentAudio) == null ? void 0 : _a.id) === audio.id && _ctx.isPlaying
        })
      };
    }),
    f: !_ctx.loading && _ctx.audios.length > 0
  }, !_ctx.loading && _ctx.audios.length > 0 ? {} : {}, {
    g: !_ctx.loading && _ctx.audios.length === 0
  }, !_ctx.loading && _ctx.audios.length === 0 ? {} : {}, {
    h: _ctx.loading
  }, _ctx.loading ? {} : {}, {
    i: common_vendor.o(($event) => _ctx.showModal = false),
    j: common_vendor.p({
      visible: _ctx.showModal
    }),
    k: `${_ctx.safeTopPadding}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
