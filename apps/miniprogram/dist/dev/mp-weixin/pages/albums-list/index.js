"use strict";
const common_vendor = require("../../common/vendor.js");
const services_audio = require("../../services/audio.js");
const utils_image = require("../../utils/image.js");
const GlobalPlayer = () => "../../components/GlobalPlayer.js";
const AlbumCard = () => "../../components/AlbumCard.js";
const _sfc_main = common_vendor.defineComponent({
  components: {
    GlobalPlayer,
    AlbumCard
  },
  setup() {
    const albums = common_vendor.ref([]);
    const loading = common_vendor.ref(true);
    common_vendor.onMounted(async () => {
      await fetchAlbums();
    });
    const fetchAlbums = async () => {
      loading.value = true;
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
      loading.value = false;
    };
    const goToDetail = (name) => {
      common_vendor.index.navigateTo({
        url: `/pages/album-detail/index?album=${encodeURIComponent(name)}`
      });
    };
    return {
      albums,
      loading,
      getOptimizedImage: utils_image.getOptimizedImage,
      goToDetail
    };
  },
  onShareAppMessage() {
    return {
      title: "精选专辑 - 特玩音效库",
      path: "/pages/albums-list/index"
    };
  },
  onShareTimeline() {
    return {
      title: "精选专辑 - 特玩音效库"
    };
  }
});
if (!Array) {
  const _component_AlbumCard = common_vendor.resolveComponent("AlbumCard");
  const _component_GlobalPlayer = common_vendor.resolveComponent("GlobalPlayer");
  (_component_AlbumCard + _component_GlobalPlayer)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t(_ctx.albums.length),
    b: !_ctx.loading && _ctx.albums.length > 0
  }, !_ctx.loading && _ctx.albums.length > 0 ? {
    c: common_vendor.f(_ctx.albums, (album, k0, i0) => {
      return {
        a: album.name,
        b: common_vendor.o(($event) => _ctx.goToDetail(album.name), album.name),
        c: "ecade180-0-" + i0,
        d: common_vendor.p({
          album
        })
      };
    })
  } : {}, {
    d: !_ctx.loading && _ctx.albums.length === 0
  }, !_ctx.loading && _ctx.albums.length === 0 ? {} : {}, {
    e: _ctx.loading
  }, _ctx.loading ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
