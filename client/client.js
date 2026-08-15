// dsh-free-vision web settings section (v0.3).
// Provider quick-pick cards on top (free tiers highlighted), detailed
// parameters inside a collapsed "Advanced settings" block. Saved via
// POST /dsh-free-vision/config; the host drops the live engine so the
// change applies to the next tool call immediately.
window.__ModuleLoader__.load({ id: "dsh-free-vision", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const react = require("react");

  const NS = "free-vision";
  const name = "free-vision";
  const inject = ["slots"];

  const PROVIDERS = [
    { key: "qwen",        name: "Qwen / 千问", free: "百炼限免 50万 token", desc: "Qwen3-VL-Flash", env: "DASHSCOPE_API_KEY" },
    { key: "volcengine",  name: "Doubao / 豆包", free: "火山免费 20万起",   desc: "豆包视觉模型",     env: "VOLCENGINE_API_KEY" },
    { key: "siliconflow", name: "DeepSeek-OCR", free: "硅基流动免费",     desc: "OCR 专用",          env: "SILICONFLOW_API_KEY" },
    { key: "zhipu",       name: "GLM / 智谱",    free: "按量",            desc: "GLM-4.6V",          env: "ZHIPU_API_KEY" },
    { key: "hunyuan",     name: "Hunyuan / 混元", free: "按量",           desc: "HY-Vision",         env: "HUNYUAN_API_KEY" },
    { key: "custom",      name: "Custom / 自定义", free: "任意 OpenAI 兼容", desc: "自建端点",       env: "CUSTOM_API_KEY" },
  ];

  const ADVANCED_LABELS = {
    apiKey: "API Key",
    modelName: "Model Name / 模型名",
    toolName: "Tool Name / 工具名",
    maxTokens: "Max Tokens / 最大 token",
    temperature: "Temperature / 温度",
    multiCrop: "Multi-crop / 大图多裁剪",
    toolCallTimeoutMs: "Timeout (ms) / 超时",
    lumaEnv: "Extra Env / 额外环境变量 (JSON)",
  };

  function Section() {
    const [state, setState] = react.useState({
      loading: true, schema: null, value: {}, saving: false, saved: false, error: "",
    });
    react.useEffect(() => {
      fetch("/dsh-free-vision/config", { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => setState((s) => ({ ...s, loading: false, schema: body.schema, value: body.value || {} })))
        .catch((e) => setState((s) => ({ ...s, loading: false, error: String((e && e.message) || e) })));
    }, []);

    if (state.loading) return react.createElement("div", { style: st.card }, "Loading… / 加载中…");
    if (state.error) return react.createElement("div", { style: st.card }, react.createElement("p", { style: st.error }, "Failed to load: " + state.error));

    const set = (k, v) => setState((s) => ({ ...s, value: { ...s.value, [k]: v }, saved: false }));

    const save = () => {
      setState((s) => ({ ...s, saving: true, saved: false, error: "" }));
      fetch("/dsh-free-vision/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: state.value }),
      })
        .then((r) => r.json())
        .then((body) => {
          if (body.ok) setState((s) => ({ ...s, saving: false, saved: true, value: body.value || s.value }));
          else setState((s) => ({ ...s, saving: false, error: body.error || "save failed" }));
        })
        .catch((e) => setState((s) => ({ ...s, saving: false, error: String((e && e.message) || e) })));
    };

    const provider = state.value.modelProvider || "qwen";

    // Provider cards
    const cards = PROVIDERS.map((p) => {
      const active = p.key === provider;
      return react.createElement("button", {
        key: p.key,
        onClick: () => set("modelProvider", p.key),
        style: { ...st.cardBtn, ...(active ? st.cardBtnOn : {}) },
      },
        react.createElement("div", { style: st.cardName }, p.name + (active ? " ✓" : "")),
        react.createElement("div", { style: st.cardFree }, p.free),
        react.createElement("div", { style: st.cardDesc }, p.desc),
        react.createElement("div", { style: st.cardEnv }, p.env),
      );
    });

    // Advanced fields
    const adv = (label, control) =>
      react.createElement("div", { style: st.field },
        react.createElement("label", { style: st.label }, label),
        control);

    const input = (k, type) => react.createElement("input", {
      type: type || "text",
      value: state.value[k] == null ? "" : String(state.value[k]),
      style: st.input,
      onChange: (e) => {
        if (type === "number") set(k, e.target.value === "" ? undefined : Number(e.target.value));
        else set(k, e.target.value);
      },
    });
    const toggle = (k) => react.createElement("input", {
      type: "checkbox", checked: !!state.value[k], style: { width: 18, height: 18 },
      onChange: (e) => set(k, e.target.checked),
    });

    const apiKeyField = adv("API Key", input("apiKey"));
    const modelNameField = adv(ADVANCED_LABELS.modelName, input("modelName"));
    const toolNameField = adv(ADVANCED_LABELS.toolName, input("toolName"));
    const maxTokensField = adv(ADVANCED_LABELS.maxTokens, input("maxTokens", "number"));
    const tempField = adv(ADVANCED_LABELS.temperature, input("temperature", "number"));
    const cropField = adv(ADVANCED_LABELS.multiCrop, toggle("multiCrop"));
    const timeoutField = adv(ADVANCED_LABELS.toolCallTimeoutMs, input("toolCallTimeoutMs", "number"));
    const envField = adv(ADVANCED_LABELS.lumaEnv, react.createElement("textarea", {
      rows: 3, style: st.textarea,
      value: (() => {
        const v = state.value.lumaEnv;
        if (v == null || v === "") return "";
        if (typeof v === "string") return v;
        try { return JSON.stringify(v, null, 2); } catch { return ""; }
      })(),
      onChange: (e) => {
        const raw = e.target.value.trim();
        if (!raw) { set("lumaEnv", {}); return; }
        try { set("lumaEnv", JSON.parse(raw)); } catch { /* keep last valid */ }
      },
    }));

    const advanced = react.createElement("details", { style: st.details },
      react.createElement("summary", { style: st.summary }, "⚙ Advanced settings / 高级设置"),
      apiKeyField, modelNameField, toolNameField, maxTokensField, tempField, cropField, timeoutField, envField,
    );

    return react.createElement("div", { style: st.card },
      react.createElement("h3", { style: st.title }, "Free Vision / 免费视觉"),
      react.createElement("p", { style: st.hint },
        "Pick a free-tier provider, or open advanced settings for the API key and fine-tuning. / 选择免费模型提供商；API Key 与高级参数在下方高级设置中。"),
      react.createElement("div", { style: st.grid }, ...cards),
      advanced,
      react.createElement("div", { style: st.row },
        react.createElement("button", { style: { ...st.button, ...(state.saving ? { opacity: 0.6 } : {}) }, disabled: state.saving, onClick: save },
          state.saving ? "Saving… / 保存中…" : "Save / 保存"),
        state.saved ? react.createElement("span", { style: st.ok }, "✓ Saved / 已保存，下次调用立即生效") : null,
        state.error ? react.createElement("span", { style: st.error }, state.error) : null,
      ),
    );
  }

  function apply(ctx) {
    ctx.slots.inject("settings.section", () => ctx.slots.register({
      name: "settings.section",
      id: "free-vision",
      order: 50,
      label: () => "Free Vision",
      locale: NS,
      inject: () => ({})
    }, () => react.createElement(Section)));
  }

  const st = {
    card: { padding: "16px", maxWidth: 720 },
    title: { margin: "0 0 6px", fontSize: 16, fontWeight: 600 },
    hint: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #666)", margin: "0 0 12px" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 14 },
    cardBtn: {
      textAlign: "left", padding: "10px", borderRadius: 8, cursor: "pointer",
      border: "1px solid var(--dsw-alias-border, #d0d7de)",
      background: "var(--dsw-alias-surface-2, #f6f8fa)", color: "inherit",
    },
    cardBtnOn: {
      borderColor: "var(--dsw-alias-accent, #0969da)",
      outline: "2px solid var(--dsw-alias-accent, #0969da)",
    },
    cardName: { fontSize: 13, fontWeight: 600, marginBottom: 2 },
    cardFree: { fontSize: 11, color: "var(--dsw-alias-success, #1a7f37)", marginBottom: 2 },
    cardDesc: { fontSize: 11, opacity: 0.8 },
    cardEnv: { fontSize: 10, fontFamily: "monospace", opacity: 0.6, marginTop: 4 },
    details: { margin: "4px 0 10px", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--dsw-alias-border, #d0d7de)" },
    summary: { cursor: "pointer", fontSize: 13, fontWeight: 500 },
    field: { margin: "8px 0" },
    label: { display: "block", fontSize: 12, fontWeight: 500, marginBottom: 3 },
    input: {
      width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: 13,
      borderRadius: 6, border: "1px solid var(--dsw-alias-border, #d0d7de)",
      background: "var(--dsw-alias-surface-input, #fff)", color: "inherit",
    },
    textarea: {
      width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: 12,
      fontFamily: "monospace", borderRadius: 6, border: "1px solid var(--dsw-alias-border, #d0d7de)",
      background: "var(--dsw-alias-surface-input, #fff)", color: "inherit",
    },
    row: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
    button: {
      padding: "6px 16px", fontSize: 13, borderRadius: 6, cursor: "pointer",
      border: "1px solid var(--dsw-alias-border, #d0d7de)",
      background: "var(--dsw-alias-accent, #0969da)", color: "#fff",
    },
    ok: { fontSize: 12, color: "var(--dsw-alias-success, #1a7f37)" },
    error: { fontSize: 12, color: "var(--dsw-alias-danger, #cf222e)" },
  };

  exports.name = name;
  exports.inject = inject;
  exports.apply = apply;
  return module.exports;
}});
