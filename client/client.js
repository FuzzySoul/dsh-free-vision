// dsh-free-vision web settings section (v0.3.1).
// Provider quick-pick cards (free tiers highlighted with a badge), a
// warning banner when no API key is configured, and a collapsible
// "Advanced settings" block. Saved via POST /dsh-free-vision/config.
window.__ModuleLoader__.load({ id: "dsh-free-vision", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const react = require("react");

  const NS = "free-vision";
  const name = "free-vision";
  const inject = ["slots"];

  const PROVIDERS = [
    { key: "qwen",        name: "Qwen / 千问", free: true,  tag: "限免 50万 token",  desc: "Qwen3-VL-Flash",   env: "DASHSCOPE_API_KEY" },
    { key: "volcengine",  name: "Doubao / 豆包", free: true, tag: "免费 20万起",      desc: "豆包视觉模型",     env: "VOLCENGINE_API_KEY" },
    { key: "siliconflow", name: "DeepSeek-OCR", free: true,  tag: "免费 OCR",        desc: "硅基流动",         env: "SILICONFLOW_API_KEY" },
    { key: "zhipu",       name: "GLM / 智谱",    free: false, tag: "按量",            desc: "GLM-4.6V",        env: "ZHIPU_API_KEY" },
    { key: "hunyuan",     name: "Hunyuan / 混元", free: false, tag: "按量",           desc: "HY-Vision",       env: "HUNYUAN_API_KEY" },
    { key: "custom",      name: "Custom / 自定义", free: false, tag: "OpenAI 兼容",   desc: "自建端点",        env: "CUSTOM_API_KEY" },
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
      loading: true, schema: null, value: {}, hasKey: false, keySource: "none",
      saving: false, saved: false, error: "",
    });
    react.useEffect(() => {
      fetch("/dsh-free-vision/config", { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => setState((s) => ({ ...s, loading: false, schema: body.schema, value: body.value || {}, hasKey: !!body.hasKey, keySource: body.keySource || "none" })))
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
          if (body.ok) setState((s) => ({ ...s, saving: false, saved: true, value: body.value || s.value, hasKey: !!body.value?.apiKey }));
          else setState((s) => ({ ...s, saving: false, error: body.error || "save failed" }));
        })
        .catch((e) => setState((s) => ({ ...s, saving: false, error: String((e && e.message) || e) })));
    };

    const provider = state.value.modelProvider || "qwen";
    const keySet = !!(state.value.apiKey || state.hasKey);

    const statusText = keySet
      ? "● " + "当前生效：Qwen / 千问（" + (state.keySource === "env" ? "环境变量 DASHSCOPE_API_KEY" : "已保存的 API Key") + "）"
      : "○ " + "未配置 API Key";
    const status = react.createElement("div", {
      style: keySet ? st.statusOk : st.statusWarn,
    }, statusText);

    // Provider cards: free tiers get a highlighted badge
    const cards = PROVIDERS.map((p) => {
      const active = p.key === provider;
      const badge = p.free
        ? react.createElement("span", { style: st.badge }, "FREE 免费")
        : null;
      return react.createElement("button", {
        key: p.key,
        onClick: () => set("modelProvider", p.key),
        style: { ...st.cardBtn, ...(active ? st.cardBtnOn : {}) },
      },
        react.createElement("div", { style: st.cardTop },
          react.createElement("span", { style: st.cardName }, p.name + (active ? " ✓" : "")),
          badge,
        ),
        react.createElement("div", { style: st.cardTag }, p.tag),
        react.createElement("div", { style: st.cardDesc }, p.desc),
        react.createElement("div", { style: st.cardEnv }, p.env),
      );
    });

    // No-key warning banner
    const warning = keySet ? null : react.createElement("div", { style: st.warn },
      "⚠ " + "未配置 API Key：图片分析暂不可用，请在下方高级设置中填写（或设置环境变量后重启）。",
    );

    // Advanced fields
    const adv = (label, required, control) =>
      react.createElement("div", { style: st.field },
        react.createElement("label", { style: st.label },
          label,
          required ? react.createElement("span", { style: st.required }, " *") : null,
        ),
        control);

    const input = (k, type) => react.createElement("input", {
      type: type || "text",
      value: state.value[k] == null ? "" : String(state.value[k]),
      placeholder: type === "number" ? "" : (k === "apiKey" ? "sk-..." : ""),
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

    const advanced = react.createElement("details", { style: st.details, open: !keySet },
      react.createElement("summary", { style: st.summary },
        "⚙ " + "Advanced settings / 高级设置" + (keySet ? "" : " (需要配置 API Key)"),
      ),
      adv(ADVANCED_LABELS.apiKey, true, input("apiKey")),
      adv(ADVANCED_LABELS.modelName, false, input("modelName")),
      adv(ADVANCED_LABELS.toolName, false, input("toolName")),
      adv(ADVANCED_LABELS.maxTokens, false, input("maxTokens", "number")),
      adv(ADVANCED_LABELS.temperature, false, input("temperature", "number")),
      adv(ADVANCED_LABELS.multiCrop, false, toggle("multiCrop")),
      adv(ADVANCED_LABELS.toolCallTimeoutMs, false, input("toolCallTimeoutMs", "number")),
      adv(ADVANCED_LABELS.lumaEnv, false, react.createElement("textarea", {
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
      })),
    );

    return react.createElement("div", { style: st.card },
      react.createElement("h3", { style: st.title }, "Free Vision / 免费视觉"),
      react.createElement("p", { style: st.hint },
        "Pick a free-tier provider; the API key and fine-tuning live under advanced settings. / 选择免费模型提供商；API Key 与高级参数在下方高级设置中。"),
      status,
      warning,
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
    hint: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #57606a)", margin: "0 0 10px" },
    statusOk: {
      margin: "0 0 12px", padding: "6px 12px", borderRadius: 8, fontSize: 13,
      background: "var(--dsw-alias-success-bg, #dafbe1)", color: "var(--dsw-alias-success, #1a7f37)",
      border: "1px solid var(--dsw-alias-success-border, #4ac26b)",
    },
    statusWarn: {
      margin: "0 0 12px", padding: "6px 12px", borderRadius: 8, fontSize: 13,
      background: "var(--dsw-alias-warning-bg, #fff8c5)", color: "var(--dsw-alias-warning-fg, #7d4e00)",
      border: "1px solid var(--dsw-alias-warning-border, #d4a72c)",
    },
    warn: {
      margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, fontSize: 13,
      background: "var(--dsw-alias-warning-bg, #fff8c5)", color: "var(--dsw-alias-warning-fg, #7d4e00)",
      border: "1px solid var(--dsw-alias-warning-border, #d4a72c)",
    },
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
    cardTop: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 },
    cardName: { fontSize: 13, fontWeight: 600 },
    badge: {
      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
      background: "var(--dsw-alias-success-bg, #dafbe1)", color: "var(--dsw-alias-success, #1a7f37)",
      border: "1px solid var(--dsw-alias-success-border, #4ac26b)",
      whiteSpace: "nowrap",
    },
    cardTag: { fontSize: 11, fontWeight: 500, color: "var(--dsw-alias-success, #1a7f37)", marginBottom: 2 },
    cardDesc: { fontSize: 11, opacity: 0.85 },
    cardEnv: { fontSize: 10, fontFamily: "monospace", opacity: 0.65, marginTop: 4 },
    details: { margin: "4px 0 10px", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--dsw-alias-border, #d0d7de)" },
    summary: { cursor: "pointer", fontSize: 13, fontWeight: 500 },
    field: { margin: "8px 0" },
    label: { display: "block", fontSize: 12, fontWeight: 500, marginBottom: 3 },
    required: { color: "var(--dsw-alias-danger, #cf222e)" },
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
