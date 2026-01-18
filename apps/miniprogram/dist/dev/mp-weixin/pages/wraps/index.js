"use strict";
const common_vendor = require("../../common/vendor.js");
const services_wraps = require("../../services/wraps.js");
const SectionHeader = () => "../../components/SectionHeader.js";
const UiBadge = () => "../../components/UiBadge.js";
const UiIcon = () => "../../components/UiIcon.js";
const WrapCard = () => "../../components/WrapCard.js";
const _sfc_main = common_vendor.defineComponent({
  components: {
    SectionHeader,
    UiBadge,
    UiIcon,
    WrapCard
  },
  setup() {
    const models = common_vendor.ref([]);
    const wraps = common_vendor.ref([]);
    const loading = common_vendor.ref(true);
    const searchQuery = common_vendor.ref("");
    const selectedModelId = common_vendor.ref("");
    const fetchModels = async () => {
      const { data } = await services_wraps.wrapsService.fetchModels();
      const MODEL_DISPLAY_NAMES = {
        "model-3": "Model 3",
        "model-3-2024-plus": "Model 3(焕新版)",
        "cybertruck": "Cybertruck",
        "model-y-pre-2025": "Model Y",
        "model-y-2025-plus": "Model Y(2025+)"
      };
      models.value = data.sort((a, b) => {
        const order = ["model-3", "model-3-2024-plus", "cybertruck", "model-y-pre-2025", "model-y-2025-plus"];
        const indexA = order.indexOf(a.slug);
        const indexB = order.indexOf(b.slug);
        if (indexA !== -1 && indexB !== -1)
          return indexA - indexB;
        if (indexA !== -1)
          return -1;
        if (indexB !== -1)
          return 1;
        return 0;
      }).map((m) => ({
        ...m,
        name: MODEL_DISPLAY_NAMES[m.slug] || m.name
        // Use mapped name or fallback to DB name
      }));
    };
    const fetchWraps = async () => {
      loading.value = true;
      const { data } = await services_wraps.wrapsService.fetchWraps({
        modelId: selectedModelId.value,
        search: searchQuery.value
      });
      wraps.value = data;
      loading.value = false;
    };
    const handleSearch = () => {
      fetchWraps();
    };
    const selectModel = (modelId) => {
      selectedModelId.value = modelId;
      fetchWraps();
    };
    common_vendor.onMounted(async () => {
      await fetchModels();
      if (models.value.length > 0) {
        const model3 = models.value.find((m) => m.slug === "model-3");
        if (model3) {
          selectedModelId.value = model3.id;
        } else {
          selectedModelId.value = models.value[0].id;
        }
      }
      await fetchWraps();
    });
    return {
      models,
      wraps,
      loading,
      searchQuery,
      selectedModelId,
      handleSearch,
      selectModel
    };
  }
});
if (!Array) {
  const _component_SectionHeader = common_vendor.resolveComponent("SectionHeader");
  const _component_UiIcon = common_vendor.resolveComponent("UiIcon");
  const _component_WrapCard = common_vendor.resolveComponent("WrapCard");
  (_component_SectionHeader + _component_UiIcon + _component_WrapCard)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.p({
      name: "search",
      size: "4.5",
      color: "rgba(255,255,255,0.35)"
    }),
    b: common_vendor.o((...args) => _ctx.handleSearch && _ctx.handleSearch(...args)),
    c: _ctx.searchQuery,
    d: common_vendor.o(($event) => _ctx.searchQuery = $event.detail.value),
    e: _ctx.searchQuery
  }, _ctx.searchQuery ? {
    f: common_vendor.p({
      name: "clear",
      size: "4.5",
      color: "rgba(255,255,255,0.45)"
    }),
    g: common_vendor.o(($event) => {
      _ctx.searchQuery = "";
      _ctx.handleSearch();
    })
  } : {}, {
    h: common_vendor.f(_ctx.models, (model, k0, i0) => {
      return {
        a: common_vendor.t(model.name),
        b: model.id,
        c: common_vendor.n(_ctx.selectedModelId === model.id ? "bg-white text-black shadow-lg shadow-whites10" : "bg-whites10 text-whites60 border border-whites5"),
        d: common_vendor.o(($event) => _ctx.selectModel(model.id), model.id)
      };
    }),
    i: _ctx.loading
  }, _ctx.loading ? {
    j: common_vendor.f(6, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : _ctx.wraps.length === 0 ? {} : {
    l: common_vendor.f(_ctx.wraps, (wrap, k0, i0) => {
      return {
        a: wrap.id,
        b: "e488d87c-3-" + i0,
        c: common_vendor.p({
          wrap,
          ["model-id"]: _ctx.selectedModelId
        })
      };
    })
  }, {
    k: _ctx.wraps.length === 0
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
