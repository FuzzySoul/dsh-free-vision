// dsh-free-vision web settings section.
// Registers a "Free Vision" entry in Settings via the settings.section slot
// and renders a form from the plugin's schemastery Config schema, saved via
// POST /dsh-free-vision/config (host route in dsh/index.js). Changes apply
// immediately to the next tool call (the host drops the live engine).
window.__ModuleLoader__.load({ id: "dsh-free-vision", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const react = require("react");

  const NS = "free-vision";
  const name = "free-vision";
  const inject = ["slots"];

  const FIELD_LABELS = {
    apiKey: "API Key",
    modelProvider: "Model Provider / 模型提供商",
    modelName: "Model Name / 模型名",
    toolName: "Tool Name / 工具名",
    maxTokens: "Max Tokens",
    temperature: "Temperature / 温度",
    multiCrop: "Multi-crop / 多裁剪",
    toolCallTimeoutMs: "Timeout (ms) / 超时",
    lumaEnv: "Extra Env / 额外环境变量",
  };

  // Render one field from the schemastery toJSON refs.
  function Field({ schema, keyName, ref, value, onChange }) {
    const label = FIELD_LABELS[keyName] || keyName;
    const desc = ref?.meta?.description || "";
    const t = ref?.type;
    let control = null;
    if (t === "string") {
      control = react.createElement("input", {
        type: "text",
        value: value == null ? "" : String(value),
        placeholder: ref?.meta?.default ?? "",
        style: styles.input,
        onChange: (e) => onChange(e.target.value),
      });
    } else if (t === "number") {
      control = react.createElement("input", {
        type: "number",
        value: value == null ? "" : String(value),
        style: styles.input,
        onChange: (e) => onChange(e.target.value === "" ? undefined : Number(e.target.value)),
      });
    } else if (t === "boolean") {
      control = react.createElement("input", {
        type: "checkbox",
        checked: !!value,
        style: { width: 18, height: 18 },
        onChange: (e) => onChange(e.target.checked),
      });
    } else if (t === "union" && Array.isArray(ref.list)) {
      const options = ref.list.map((uid) => schema.refs[String(uid)]).filter((r) => r && r.type === "const");
      control = react.createElement("select", {
        value: value == null ? "" : String(value),
        style: styles.input,
        onChange: (e) => onChange(e.target.value),
      }, options.map((o) => react.createElement("option", { key: o.value, value: o.value }, o.value)));
    } else if (t === "dict") {
      control = react.createElement("textarea", {
        rows: 3,
        value: value && typeof value === "object" ? JSON.stringify(value, null, 2) : "{}",
        style: styles.textarea,
        onChange: (e) => {
          try { onChange(JSON.parse(e.target.value || "{}")); } catch { /* keep last valid */ }
        },
      });
    } else {
      control = react.createElement("input", {
        type: "text",
        value: value == null ? "" : String(value),
        style: styles.input,
        onChange: (e) => onChange(e.target.value),
      });
    }
    return react.createElement("div", { style: styles.field },
      react.createElement("label", { style: styles.label }, label),
      control,
      desc ? react.createElement("div", { style: styles.hint }, desc) : null,
    );
  }

  function Section() {
    const [state, setState] = react.useState({
      loading: true, schema: null, value: {}, saving: false, saved: false, error: "",
    });
    react.useEffect(() => {
      fetch("/dsh-free-vision/config", { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => setState((s) => ({ ...s, loading: false, schema: body.schema, value: body.value || {} })))
        .catch((e) => setState((s) => ({ ...s, loading: false, error: String(e && e.message || e) })));
    }, []);

    if (state.loading) {
      return react.createElement("div", { style: styles.card }, "Loading… / 加载中…");
    }
    if (state.error) {
      return react.createElement("div", { style: styles.card },
        react.createElement("p", { style: styles.error }, "Failed to load config: " + state.error));
    }
    const schema = state.schema;
    const rootRef = schema && schema.refs && schema.refs[String(schema.uid)];
    const dict = rootRef && rootRef.dict ? rootRef.dict : {};
    const keys = Object.keys(dict);

    const setValue = (k, v) => setState((s) => ({ ...s, value: { ...s.value, [k]: v }, saved: false }));

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
        .catch((e) => setState((s) => ({ ...s, saving: false, error: String(e && e.message || e) })));
    };

    return react.createElement("div", { style: styles.card },
      react.createElement("h3", { style: styles.title }, "Free Vision / 免费视觉"),
      react.createElement("p", { style: styles.hint },
        "Image understanding for text-only models via free-tier providers. Settings apply immediately to the next tool call. / 免费视觉理解配置，保存后下一次调用立即生效。"),
      ...keys.map((k) => react.createElement(Field, {
        key: k, schema: schema, keyName: k,
        ref: dict[k] ? schema.refs[String(dict[k])] : null,
        value: state.value[k],
        onChange: (v) => setValue(k, v),
      })),
      react.createElement("div", { style: styles.row },
        react.createElement("button", {
          style: { ...styles.button, ...(state.saving ? { opacity: 0.6 } : {}) },
          disabled: state.saving,
          onClick: save,
        }, state.saving ? "Saving… / 保存中…" : "Save / 保存"),
        state.saved ? react.createElement("span", { style: styles.ok }, "✓ Saved / 已保存，立即生效") : null,
        state.error ? react.createElement("span", { style: styles.error }, state.error) : null,
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

  const styles = {
    card: { padding: "16px", maxWidth: 640 },
    title: { margin: "0 0 6px", fontSize: 16, fontWeight: 600 },
    field: { margin: "10px 0" },
    label: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 },
    hint: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #666)", margin: "2px 0 4px" },
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
    row: { display: "flex", alignItems: "center", gap: 10, marginTop: 14 },
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
