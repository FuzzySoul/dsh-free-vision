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
  const inject = ["slots", "conversation"];

  const PROVIDERS = [
    { key: "qwen",        name: "Qwen / 千问", free: true,  tag: "限免 50万 token", desc: "Qwen3-VL-Flash",   env: "DASHSCOPE_API_KEY",  url: "https://bailian.console.aliyun.com/", urlText: "阿里云百炼申请", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
    { key: "volcengine",  name: "Doubao / 豆包", free: true, tag: "免费 20万起",     desc: "豆包视觉模型",     env: "VOLCENGINE_API_KEY", url: "https://console.volcengine.com/ark/", urlText: "火山方舟申请", baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
    { key: "siliconflow", name: "DeepSeek-OCR", free: true,  tag: "免费 OCR",       desc: "硅基流动",         env: "SILICONFLOW_API_KEY", url: "https://cloud.siliconflow.cn/", urlText: "硅基流动申请", baseUrl: "https://api.siliconflow.cn/v1" },
    { key: "zhipu",       name: "GLM / 智谱",    free: false, tag: "按量",           desc: "GLM-4.6V",        env: "ZHIPU_API_KEY",  url: "https://open.bigmodel.cn/", urlText: "智谱开放平台", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
    { key: "hunyuan",     name: "Hunyuan / 混元", free: false, tag: "按量",          desc: "HY-Vision",       env: "HUNYUAN_API_KEY", url: "https://cloud.tencent.com/product/tokenhub", urlText: "腾讯云 TokenHub", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1" },
    { key: "custom",      name: "Custom / 自定义", free: false, tag: "OpenAI 兼容",  desc: "自建端点",        env: "CUSTOM_API_KEY", url: "", urlText: "", baseUrl: "" },
  ];

  const ADVANCED_LABELS = {
    apiKey: "API Key",
    modelName: "Model Name / 模型名",
    toolName: "Tool Name / 工具名",
    maxTokens: "Max Tokens / 最大 token",
    temperature: "Temperature / 温度",
    multiCrop: "Multi-crop / 大图多裁剪",
    toolCallTimeoutMs: "Timeout (ms) / 超时",
    allowedDirs: "Allowed Dirs / 允许读取的图片目录",
    lumaEnv: "Extra Env / 额外环境变量 (JSON)",
  };

  function Section() {
    const [state, setState] = react.useState({
      loading: true, schema: null, value: {}, hasKey: false, keySource: "none",
      allowedDirs: null, saving: false, saved: false, error: "",
    });
    react.useEffect(() => {
      fetch("/dsh-free-vision/config", { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => setState((s) => ({ ...s, loading: false, schema: body.schema, value: body.value || {}, hasKey: !!body.hasKey, keySource: body.keySource || "none", allowedDirs: body.allowedDirs || null })))
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
          if (body.ok) setState((s) => ({ ...s, saving: false, saved: true, value: body.value || s.value, hasKey: !!body.value?.apiKey, allowedDirs: body.allowedDirs || s.allowedDirs }));
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

    // Active provider linkage: its own key slot + base URL override + signup link
    const activeProv = PROVIDERS.find((p) => p.key === provider) || PROVIDERS[0];
    const provKey = (state.value.keys && state.value.keys[provider]) || "";
    const setProvKey = (v) => set("keys", { ...(state.value.keys || {}), [provider]: v });
    const defaultBaseUrl = activeProv.baseUrl || "";
    const provBaseUrl = (state.value.baseURLs && state.value.baseURLs[provider]) || defaultBaseUrl;
    const setProvBaseUrl = (v) => set("baseURLs", { ...(state.value.baseURLs || {}), [provider]: v });
    const linkageBlock = react.createElement("div", { style: st.linkage },
      react.createElement("div", { style: st.linkageRow },
        react.createElement("label", { style: st.linkageLabel },
          "API Key (" + activeProv.name + ")",
          react.createElement("span", { style: st.required }, " *"),
        ),
        react.createElement("input", {
          type: "password",
          value: provKey,
          placeholder: activeProv.env,
          style: st.input,
          onChange: (e) => setProvKey(e.target.value),
        }),
      ),
      react.createElement("div", { style: st.linkageRow },
        react.createElement("label", { style: st.linkageLabel },
          "Base URL / API 地址",
          activeProv.baseUrl ? null : react.createElement("span", { style: st.hint, title: "Custom provider needs a Base URL to work" }, " *"),
        ),
        react.createElement("input", {
          type: "text",
          value: provBaseUrl,
          placeholder: activeProv.baseUrl || "https://your-proxy.example.com/v1",
          style: st.input,
          onChange: (e) => setProvBaseUrl(e.target.value),
        }),
      ),
      react.createElement("div", { style: st.linkageHint },
        "留空使用官方默认地址；可填写代理 / API Gateway / 本地 OpenAI-compatible 服务。留空自动回退默认值。",
      ),
      react.createElement("div", { style: st.linkageMeta },
        react.createElement("span", { style: st.cardTag },
          activeProv.free ? "免费额度：" + activeProv.tag : activeProv.tag),
        activeProv.url
          ? react.createElement("a", { href: activeProv.url, target: "_blank", rel: "noreferrer", style: st.link },
              "↗ " + activeProv.urlText + "（注册后复制 " + activeProv.env + "）")
          : null,
      ),
    );

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
        "⚙ " + "Advanced settings / 高级设置",
      ),
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
      adv(ADVANCED_LABELS.allowedDirs, false, input("allowedDirs")),
      (function () {
        const ad = state.allowedDirs;
        if (!ad || !Array.isArray(ad.all)) return null;
        return react.createElement("div", { style: st.cardDesc },
          react.createElement("div", { style: st.label }, "当前生效白名单 / Effective whitelist"),
          ad.defaults.map((p) => react.createElement("div", { style: st.mono }, "• " + p + "  (default 默认)")),
          ad.extra.map((p) => react.createElement("div", { style: st.mono }, "• " + p + "  (added 你添加的)")),
          react.createElement("p", { style: st.hint },
            "引擎默认只能读工作区目录和用户主目录；要读取其他位置的图片文件，请在上面 " + ADVANCED_LABELS.allowedDirs + " 里用 ; 或 , 分隔添加。"),
        );
      })(),
      react.createElement("div", { style: st.warn },
        "⚠ " + "图片读取被拒（Access denied: image path is outside the allowed directory）时，请回到「设置 → Free Vision → 高级设置」在“允许读取的图片目录”里加上对应路径。若一直无法分析图片，先确认已配置 API Key。"),
    );

    return react.createElement("div", { style: st.card },
      react.createElement("h3", { style: st.title }, "Free Vision / 免费视觉"),
      react.createElement("p", { style: st.hint },
        "Pick a free-tier provider; the API key and fine-tuning live under advanced settings. / 选择免费模型提供商；API Key 与高级参数在下方高级设置中。"),
      status,
      warning,
      react.createElement("div", { style: st.grid }, ...cards),
      linkageBlock,
      advanced,
      react.createElement("div", { style: st.row },
        react.createElement("button", { style: { ...st.button, ...(state.saving ? { opacity: 0.6 } : {}) }, disabled: state.saving, onClick: save },
          state.saving ? "Saving… / 保存中…" : "Save / 保存"),
        state.saved ? react.createElement("span", { style: st.ok }, "✓ Saved / 已保存，下次调用立即生效") : null,
        state.error ? react.createElement("span", { style: st.error }, state.error) : null,
      ),
    );
  }

  // ── Pasted-image bridge (send rewrite) ─────────────────────────────
  // Text-only models reject image blocks at submit. This wraps the
  // conversation send so pasted images are uploaded to the free-vision attach
  // route and turned into `![图片](/dsh-free-vision/raw/...)` references that
  // the vision tool can read. Idempotent: a marker prevents double install,
  // so it coexists with describe-image without re-hooking.
  const SEND_HOOK_MARKER = "__dshFreeVisionSendHooked";

  function readFileAsBase64(file) {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onerror = () => resolve({ ok: false });
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          const comma = result.indexOf(",");
          if (comma < 0) return resolve({ ok: false });
          resolve({ ok: true, base64: result.slice(comma + 1) });
        };
        reader.readAsDataURL(file);
      } catch {
        resolve({ ok: false });
      }
    });
  }

  async function uploadForFreeVision(base64, mediaType, name) {
    try {
      const response = await fetch("/dsh-free-vision/attach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          base64,
          mediaType,
          ...(name == null || name === "" ? {} : { name }),
        }),
      });
      const body = await response.json().catch(() => null);
      if (body && body.ok === true && typeof body.markdown === "string" && body.markdown !== "") {
        return { ok: true, markdown: body.markdown };
      }
      return { ok: false, message: (body && body.error) || "attach failed" };
    } catch {
      return { ok: false, message: "network failed" };
    }
  }

  // Wrap the conversation send so image-bearing sends become text prompts
  // carrying free-vision image references (skipped when the send has no images).
  function installSendHook(conversation) {
    const face = conversation;
    if (!face || typeof face !== "object") return;
    if (typeof face.sendSession !== "function") return;
    if (typeof face.draftImages !== "function" || typeof face.releaseDraftImage !== "function") return;
    if (face[SEND_HOOK_MARKER]) return;

    const original = face.sendSession;
    face.sendSession = async (session, text, imageIds, mode) => {
      if (!imageIds || imageIds.length === 0) {
        return original.call(face, session, text, imageIds, mode);
      }
      const attachments = face.draftImages(imageIds);
      if (!attachments || attachments.length !== imageIds.length) {
        return original.call(face, session, text, imageIds, mode);
      }
      const refs = [];
      for (const attachment of attachments) {
        const file = attachment && attachment.file;
        if (!file) { refs.length = 0; break; }
        const read = await readFileAsBase64(file);
        if (!read.ok) { refs.length = 0; break; }
        const uploaded = await uploadForFreeVision(read.base64, file.type || "", file.name || "");
        if (!uploaded.ok) { refs.length = 0; break; }
        refs.push(uploaded.markdown);
      }
      if (refs.length !== attachments.length) {
        // Upload failed; fall back to the default send so we don't lose the message.
        return original.call(face, session, text, imageIds, mode);
      }
      const fullText = [text && text.trim ? text.trim() : "", ...refs].filter((part) => part !== "").join("\n");
      const result = await session.prompt([{ type: "text", text: fullText }], mode);
      if (!result || !result.ok) {
        throw new Error(`conversation.send failed: ${(result && result.error && result.error.code) || "unknown"}`);
      }
      for (const id of imageIds) face.releaseDraftImage(id);
    };
    face[SEND_HOOK_MARKER] = true;
  }

  function apply(ctx) {
    // Best-effort pasted-image bridge: never let a failure here break the
    // settings UI. If the host doesn't expose a 'conversation' service, or the
    // service surface differs, installSendHook no-ops and pasting stays native.
    if (typeof ctx.inject === "function") {
      try {
        ctx.inject(["slots", "conversation"], (scope) => {
          try {
            installSendHook(scope.conversation);
          } catch { /* ignore: hooking is best-effort */ }
        });
      } catch { /* ignore: conversation service unavailable */ }
    }
    ctx.slots.inject("settings.section", () => ctx.slots.register({
      name: "settings.section",
      id: "free-vision",
      order: 50,
      label: () => "Free Vision",
      locale: NS,
      inject: () => ({})
    }, () => react.createElement(Section)));
  }

  // Dark theme throughout: some vision models / screenshot pipelines cannot
  // read light-on-dark mixed panels, so every surface stays dark and text
  // stays light regardless of the host theme variables.
  const st = {
    card: { padding: "16px", maxWidth: 720, color: "#e6edf3" },
    title: { margin: "0 0 6px", fontSize: 16, fontWeight: 600, color: "#f0f6fc" },
    hint: { fontSize: 12, color: "#9da7b3", margin: "0 0 10px" },
    statusOk: {
      margin: "0 0 12px", padding: "6px 12px", borderRadius: 8, fontSize: 13,
      background: "#12291d", color: "#3fb950",
      border: "1px solid #238636",
    },
    statusWarn: {
      margin: "0 0 12px", padding: "6px 12px", borderRadius: 8, fontSize: 13,
      background: "#2d2410", color: "#d29922",
      border: "1px solid #9e6a03",
    },
    warn: {
      margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, fontSize: 13,
      background: "#2d2410", color: "#d29922",
      border: "1px solid #9e6a03",
    },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 14 },
    cardBtn: {
      textAlign: "left", padding: "10px", borderRadius: 8, cursor: "pointer",
      border: "1px solid #30363d",
      background: "#161b22", color: "#e6edf3",
    },
    cardBtnOn: {
      borderColor: "#58a6ff",
      outline: "2px solid #1f6feb",
    },
    cardTop: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 },
    cardName: { fontSize: 13, fontWeight: 600, color: "#f0f6fc" },
    badge: {
      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
      background: "#12291d", color: "#3fb950",
      border: "1px solid #238636",
      whiteSpace: "nowrap",
    },
    cardTag: { fontSize: 11, fontWeight: 500, color: "#3fb950", marginBottom: 2 },
    cardDesc: { fontSize: 11, color: "#9da7b3" },
    cardEnv: { fontSize: 10, fontFamily: "monospace", color: "#768390", marginTop: 4 },
    linkage: {
      margin: "0 0 12px", padding: "10px 12px", borderRadius: 8,
      border: "1px solid #30363d", background: "#0d1117",
    },
    linkageRow: { display: "flex", alignItems: "center", gap: 10 },
    linkageLabel: { flex: "0 0 auto", fontSize: 12, fontWeight: 500, color: "#c9d1d9", whiteSpace: "nowrap" },
    linkageMeta: { display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" },
    linkageHint: { fontSize: 11, color: "#768390", marginTop: 6 },
    link: { fontSize: 12, color: "#58a6ff", textDecoration: "none" },
    details: { margin: "4px 0 10px", padding: "8px 10px", borderRadius: 8, border: "1px solid #30363d", background: "#0d1117" },
    summary: { cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#e6edf3" },
    field: { margin: "8px 0" },
    label: { display: "block", fontSize: 12, fontWeight: 500, marginBottom: 3, color: "#c9d1d9" },
    required: { color: "#f85149" },
    input: {
      width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: 13,
      borderRadius: 6, border: "1px solid #30363d",
      background: "#0d1117", color: "#e6edf3",
    },
    textarea: {
      width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: 12,
      fontFamily: "monospace", borderRadius: 6, border: "1px solid #30363d",
      background: "#0d1117", color: "#e6edf3",
    },
    row: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
    button: {
      padding: "6px 16px", fontSize: 13, borderRadius: 6, cursor: "pointer",
      border: "1px solid #1f6feb",
      background: "#1f6feb", color: "#ffffff",
    },
    ok: { fontSize: 12, color: "#3fb950" },
    error: { fontSize: 12, color: "#f85149" },
    mono: { fontSize: 11, fontFamily: "monospace", color: "#9da7b3", margin: "1px 0" },
  };

  exports.name = name;
  exports.inject = inject;
  exports.apply = apply;
  return module.exports;
}});
