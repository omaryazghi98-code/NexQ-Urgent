import { create } from "zustand";
import { load, Store } from "@tauri-apps/plugin-store";
import type {
  ThemeMode,
  LLMProviderType,
  STTProviderType,
  HotkeyConfig,
  MeetingAudioConfig,
  ContextStrategy,
  WhisperDualPassConfig,
  DeepgramConfig,
  GroqConfig,
  AudioMode,
  AIScenario,
} from "../lib/types";

const DEFAULT_DEEPGRAM_CONFIG: DeepgramConfig = {
  model: "nova-3",
  smart_format: false,
  interim_results: true,
  endpointing: 300,
  punctuate: true,
  diarize: false,
  profanity_filter: false,
  numerals: false,
  dictation: false,
  vad_events: true,
  keyterms: [],
};

const DEFAULT_GROQ_CONFIG: GroqConfig = {
  model: "whisper-large-v3-turbo",
  language: "en",
  temperature: 0,
  response_format: "json",
  timestamp_granularities: [],
  prompt: "",
  segment_duration_secs: 5.0,
};

const STORE_FILE = "config.json";

const DEFAULT_HOTKEYS: HotkeyConfig = {
  toggle_assist: "Space",
  start_end_meeting: "Ctrl+M",
  show_hide: "Ctrl+B",
  open_settings: "Ctrl+,",
  escape: "Escape",
  mode_assist: "Space",
  mode_say: "1",
  mode_shorten: "2",
  mode_followup: "3",
  mode_recap: "4",
  mode_ask: "5",
};

// Singleton store instance, lazily initialized
let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return storeInstance;
}

/**
 * Persist a key-value pair to the Tauri plugin-store.
 * Errors are logged and re-thrown so callers that need deterministic persistence
 * can await the write before continuing.
 */
async function persistValue(key: string, value: unknown): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
  } catch (err) {
    console.error(`[configStore] Failed to persist "${key}":`, err);
    throw err;
  }
}

interface ConfigState {
  // Appearance
  theme: ThemeMode;

  // Providers
  sttProvider: STTProviderType;
  sttLanguage: string;
  llmProvider: LLMProviderType;
  llmModel: string;

  // Audio (legacy — kept for backward compat, new code uses meetingAudioConfig)
  micDeviceId: string | null;
  systemDeviceId: string | null;
  recordingEnabled: boolean;

  // Two-Party Audio Config (new)
  meetingAudioConfig: MeetingAudioConfig | null;

  // User-saved custom presets (persisted)
  customPresets: MeetingAudioConfig[];

  // Local STT — globally active whisper model (e.g., "base", "small")
  activeWhisperModel: string | null;

  // Per-engine active models — each engine independently selects its own model
  // Keys are engine IDs (e.g., "sherpa_onnx", "ort_streaming", "whisper_cpp")
  activeModelPerEngine: Record<string, string>;

  // Cloud providers that have been tested and verified (persisted)
  verifiedCloudProviders: string[];

  // Whisper dual-pass config
  whisperDualPass: WhisperDualPassConfig;

  // Deepgram model/feature config
  deepgramConfig: DeepgramConfig;

  // Groq Whisper config
  groqConfig: GroqConfig;

  // Universal pause threshold for transcript line-breaking (ms)
  pauseThresholdMs: number;

  // Intelligence
  autoTrigger: boolean;
  autoSummary: boolean;
  contextWindowSeconds: number;

  // System
  startOnLogin: boolean;
  dataDirectory: string;
  firstRunCompleted: boolean;

  // Hotkeys
  hotkeys: HotkeyConfig;

  // Context Strategy
  contextStrategy: ContextStrategy;

  // In-person meeting mode settings
  rememberedMeetingSetup: { audioMode: AudioMode; scenario: AIScenario } | null;
  diarizationEnabled: boolean;
  noisePreset: string | null;
  confidenceThreshold: number;
  confidenceHighlightEnabled: boolean;

  // Typeset settings
  transcriptFontSize: number;
  translationFontSize: number;
  transcriptTextColor: string;
  translationTextColor: string;
  aiResponseTextColor: string;
  aiResponseFontSize: number;
  aiResponseLineHeight: number;
  aiResponseHPad: number;
  aiResponseAlign: "left" | "center" | "right";

  // Overlay appearance
  overlayOpacity: number;

  // Post-meeting translation
  showPostMeetingTranslation: boolean;

  // OpenRouter catalog
  openrouterFavorites: string[];
  openrouterRecentlyUsed: string[];

  // Tray settings
  trayNotifications: boolean;
  trayAutoStart: boolean;
  trayStartMinimized: boolean;
  trayAutoDetectMeeting: boolean;
  trayStealthEnabled: boolean;
  stealthShortcut: string;

  // Loading state
  _loaded: boolean;

  // Mute state (non-persisted, session-only — resets on app restart)
  mutedYou: boolean;
  mutedThem: boolean;
  toggleMuteYou: () => void;
  toggleMuteThem: () => void;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  setContextStrategy: (strategy: ContextStrategy) => void;
  setSTTProvider: (provider: STTProviderType) => void;
  setSTTLanguage: (language: string) => Promise<void>;
  setLLMProvider: (provider: LLMProviderType) => void;
  setLLMModel: (model: string) => void;
  setMicDeviceId: (id: string | null) => void;
  setSystemDeviceId: (id: string | null) => void;
  setRecordingEnabled: (enabled: boolean) => void;
  setMeetingAudioConfig: (config: MeetingAudioConfig) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (name: string) => void;
  setActiveWhisperModel: (modelId: string | null) => void;
  setActiveModelForEngine: (engineId: string, modelId: string | null) => void;
  getActiveModelForEngine: (engineId: string) => string | null;
  setWhisperDualPass: (config: WhisperDualPassConfig) => void;
  setDeepgramConfig: (config: DeepgramConfig) => void;
  setGroqConfig: (config: GroqConfig) => void;
  setPauseThresholdMs: (ms: number) => void;
  setAutoTrigger: (enabled: boolean) => void;
  setAutoSummary: (enabled: boolean) => void;
  setContextWindowSeconds: (seconds: number) => void;
  setStartOnLogin: (enabled: boolean) => void;
  setDataDirectory: (dir: string) => void;
  setFirstRunCompleted: (completed: boolean) => void;
  setHotkeys: (hotkeys: HotkeyConfig) => void;
  setVerifiedCloudProviders: (providers: string[]) => void;
  setRememberedMeetingSetup: (setup: { audioMode: AudioMode; scenario: AIScenario } | null) => void;
  setDiarizationEnabled: (enabled: boolean) => void;
  setNoisePreset: (preset: string | null) => void;
  setConfidenceThreshold: (threshold: number) => void;
  setConfidenceHighlightEnabled: (enabled: boolean) => void;
  setTranscriptFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setTranscriptTextColor: (color: string) => void;
  setTranslationTextColor: (color: string) => void;
  setAiResponseTextColor: (color: string) => void;
  setAiResponseFontSize: (size: number) => void;
  setAiResponseLineHeight: (v: number) => void;
  setAiResponseHPad: (v: number) => void;
  setAiResponseAlign: (align: "left" | "center" | "right") => void;
  setOverlayOpacity: (opacity: number) => void;
  setShowPostMeetingTranslation: (enabled: boolean) => void;
  toggleOpenRouterFavorite: (id: string) => void;
  addOpenRouterRecentlyUsed: (id: string) => void;
  removeOpenRouterRecentlyUsed: (id: string) => void;
  clearOpenRouterRecentlyUsed: () => void;
  setTrayNotifications: (enabled: boolean) => void;
  setTrayAutoStart: (enabled: boolean) => void;
  setTrayStartMinimized: (enabled: boolean) => void;
  setTrayAutoDetectMeeting: (enabled: boolean) => void;
  setTrayStealthEnabled: (enabled: boolean) => void;
  setStealthShortcut: (shortcut: string) => void;
  loadConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  theme: "dark",
  sttProvider: "windows_native",
  sttLanguage: "en-US",
  llmProvider: "ollama",
  llmModel: "",
  micDeviceId: null,
  systemDeviceId: null,
  recordingEnabled: false,
  meetingAudioConfig: null,
  customPresets: [],
  activeWhisperModel: null,
  activeModelPerEngine: {},
  verifiedCloudProviders: [],
  whisperDualPass: { shortChunkSecs: 1.0, longChunkSecs: 3.0, pauseSecs: 1.5 },
  deepgramConfig: DEFAULT_DEEPGRAM_CONFIG,
  groqConfig: DEFAULT_GROQ_CONFIG,
  pauseThresholdMs: 3000,
  autoTrigger: true,
  autoSummary: true,
  contextWindowSeconds: 120,
  startOnLogin: false,
  dataDirectory: "",
  firstRunCompleted: false,
  contextStrategy: "stuffing",
  hotkeys: DEFAULT_HOTKEYS,
  rememberedMeetingSetup: null,
  diarizationEnabled: true,
  noisePreset: null,
  confidenceThreshold: 0.7,
  confidenceHighlightEnabled: true,
  transcriptFontSize: 13,
  translationFontSize: 12,
  transcriptTextColor: "#e4e4e7",
  translationTextColor: "#fbbf24",
  aiResponseTextColor: "#d4d4d8",
  aiResponseFontSize: 12,
  aiResponseLineHeight: 1.6,
  aiResponseHPad: 0,
  aiResponseAlign: "left" as const,
  overlayOpacity: 0.65,
  showPostMeetingTranslation: true,
  openrouterFavorites: [],
  openrouterRecentlyUsed: [],
  trayNotifications: true,
  trayAutoStart: false,
  trayStartMinimized: true,
  trayAutoDetectMeeting: false,
  trayStealthEnabled: true,
  stealthShortcut: "Ctrl+Shift+H",
  _loaded: false,
  mutedYou: false,
  mutedThem: false,
  toggleMuteYou: () => {
    const next = !useConfigStore.getState().mutedYou;
    set({ mutedYou: next });
    import("../lib/ipc").then(({ setSourceMuted }) =>
      setSourceMuted("you", next)
        .catch((e) => console.warn("[configStore] Failed to set You muted:", e))
    );
  },
  toggleMuteThem: () => {
    const next = !useConfigStore.getState().mutedThem;
    set({ mutedThem: next });
    import("../lib/ipc").then(({ setSourceMuted }) =>
      setSourceMuted("them", next)
        .catch((e) => console.warn("[configStore] Failed to set Them muted:", e))
    );
  },

  setContextStrategy: (strategy) => {
    set({ contextStrategy: strategy });
    persistValue("contextStrategy", strategy).catch(() => {});
  },
  setTheme: (theme) => {
    set({ theme });
    persistValue("theme", theme).catch(() => {});
  },
  setSTTProvider: (provider) => {
    set({ sttProvider: provider });
    persistValue("sttProvider", provider).catch(() => {});
  },
  setSTTLanguage: async (language) => {
    set({ sttLanguage: language });

    try {
      // Persist the user's choice before returning so a rapid app restart
      // cannot race the plugin-store write.
      await persistValue("sttLanguage", language);

      // Then apply the same exact BCP-47 value to the live Rust router.
      const { setSTTLanguage: setBackendSTTLanguage } = await import("../lib/ipc");
      await setBackendSTTLanguage(language);
    } catch (e) {
      console.warn("[configStore] Failed to persist/apply STT language:", e);
    }
  },
  setLLMProvider: (provider) => {
    set({ llmProvider: provider });
    persistValue("llmProvider", provider).catch(() => {});
  },
  setLLMModel: (model) => {
    set({ llmModel: model });
    persistValue("llmModel", model).catch(() => {});
  },
  setMicDeviceId: (id) => {
    set({ micDeviceId: id });
    persistValue("micDeviceId", id).catch(() => {});
  },
  setSystemDeviceId: (id) => {
    set({ systemDeviceId: id });
    persistValue("systemDeviceId", id).catch(() => {});
  },
  setRecordingEnabled: (enabled) => {
    set({ recordingEnabled: enabled });
    persistValue("recordingEnabled", enabled).catch(() => {});
  },
  setMeetingAudioConfig: (config) => {
    set({ meetingAudioConfig: config });
    persistValue("meetingAudioConfig", config).catch(() => {});
    // Keep legacy fields in sync for backward compatibility
    set({
      micDeviceId: config.you.device_id || null,
      systemDeviceId: config.them.device_id || null,
      recordingEnabled: config.recording_enabled,
    });
    persistValue("micDeviceId", config.you.device_id || null).catch(() => {});
    persistValue("systemDeviceId", config.them.device_id || null).catch(() => {});
    persistValue("recordingEnabled", config.recording_enabled).catch(() => {});
  },
  saveCustomPreset: (name) => {
    const state = useConfigStore.getState();
    if (!state.meetingAudioConfig) return;
    const preset: MeetingAudioConfig = {
      ...state.meetingAudioConfig,
      preset_name: name,
    };
    const existing = state.customPresets.filter((p) => p.preset_name !== name);
    const updated = [...existing, preset];
    set({ customPresets: updated });
    persistValue("customPresets", updated).catch(() => {});
  },
  deleteCustomPreset: (name) => {
    const state = useConfigStore.getState();
    const updated = state.customPresets.filter((p) => p.preset_name !== name);
    set({ customPresets: updated });
    persistValue("customPresets", updated).catch(() => {});
  },
  setActiveWhisperModel: (modelId) => {
    set({ activeWhisperModel: modelId });
    persistValue("activeWhisperModel", modelId).catch(() => {});
    const state = useConfigStore.getState();
    if (state.meetingAudioConfig && modelId) {
      const cfg = { ...state.meetingAudioConfig };
      let changed = false;
      if (cfg.you.stt_provider === "whisper_cpp") {
        cfg.you = { ...cfg.you, local_model_id: modelId };
        changed = true;
      }
      if (cfg.them.stt_provider === "whisper_cpp") {
        cfg.them = { ...cfg.them, local_model_id: modelId };
        changed = true;
      }
      if (changed) {
        set({ meetingAudioConfig: cfg });
        persistValue("meetingAudioConfig", cfg).catch(() => {});
      }
    }
  },
  setActiveModelForEngine: (engineId, modelId) => {
    const state = useConfigStore.getState();
    const updated = { ...state.activeModelPerEngine };
    if (modelId) {
      updated[engineId] = modelId;
    } else {
      delete updated[engineId];
    }
    set({ activeModelPerEngine: updated });
    persistValue("activeModelPerEngine", updated).catch(() => {});
    import("../stores/devLogStore").then(({ useDevLogStore }) => {
      useDevLogStore.getState().addEntry(
        "info", "config",
        `Model activated: ${engineId} → ${modelId ?? "none"}`
      );
    });
    if (state.meetingAudioConfig && modelId) {
      const cfg = { ...state.meetingAudioConfig };
      let changed = false;
      if (cfg.you.stt_provider === engineId) {
        cfg.you = { ...cfg.you, local_model_id: modelId };
        changed = true;
      }
      if (cfg.them.stt_provider === engineId) {
        cfg.them = { ...cfg.them, local_model_id: modelId };
        changed = true;
      }
      if (changed) {
        set({ meetingAudioConfig: cfg });
        persistValue("meetingAudioConfig", cfg).catch(() => {});
        import("../stores/devLogStore").then(({ useDevLogStore }) => {
          useDevLogStore.getState().addEntry(
            "info", "config",
            `Model change propagated to audio config`
            + (cfg.you.stt_provider === engineId ? ` (You → ${modelId})` : "")
            + (cfg.them.stt_provider === engineId ? ` (Them → ${modelId})` : "")
          );
        });
      }
    }
  },
  getActiveModelForEngine: (engineId: string): string | null => {
    const state = useConfigStore.getState();
    return state.activeModelPerEngine[engineId] ?? null;
  },
  setWhisperDualPass: (config) => {
    set({ whisperDualPass: config });
    persistValue("whisperDualPass", config).catch(() => {});
    import("../lib/ipc").then(({ updateWhisperDualPassConfig }) =>
      updateWhisperDualPassConfig(config.shortChunkSecs, config.longChunkSecs, config.pauseSecs)
        .catch((e) => console.warn("[configStore] Failed to update whisper dual-pass config:", e))
    );
  },
  setDeepgramConfig: (config) => {
    set({ deepgramConfig: config });
    persistValue("deepgramConfig", config).catch(() => {});
    import("../lib/ipc").then(({ updateDeepgramConfig }) =>
      updateDeepgramConfig(config)
        .catch((e) => console.warn("[configStore] Failed to update Deepgram config:", e))
    );
  },
  setGroqConfig: (config) => {
    set({ groqConfig: config });
    persistValue("groqConfig", config).catch(() => {});
    import("../lib/ipc").then(({ updateGroqConfig }) =>
      updateGroqConfig(config)
        .catch((e) => console.warn("[configStore] Failed to update Groq config:", e))
    );
  },
  setPauseThresholdMs: (ms) => {
    set({ pauseThresholdMs: ms });
    persistValue("pauseThresholdMs", ms).catch(() => {});
    import("../lib/ipc").then(({ setPauseThreshold }) =>
      setPauseThreshold(ms)
        .catch((e) => console.warn("[configStore] Failed to update pause threshold:", e))
    );
  },
  setAutoTrigger: (enabled) => {
    set({ autoTrigger: enabled });
    persistValue("autoTrigger", enabled).catch(() => {});
  },
  setAutoSummary: (enabled) => {
    set({ autoSummary: enabled });
    persistValue("autoSummary", enabled).catch(() => {});
  },
  setContextWindowSeconds: (seconds) => {
    set({ contextWindowSeconds: seconds });
    persistValue("contextWindowSeconds", seconds).catch(() => {});
  },
  setStartOnLogin: (enabled) => {
    set({ startOnLogin: enabled });
    persistValue("startOnLogin", enabled).catch(() => {});
  },
  setDataDirectory: (dir) => {
    set({ dataDirectory: dir });
    persistValue("dataDirectory", dir).catch(() => {});
  },
  setFirstRunCompleted: (completed) => {
    set({ firstRunCompleted: completed });
    persistValue("firstRunCompleted", completed).catch(() => {});
  },
  setHotkeys: (hotkeys) => {
    set({ hotkeys });
    persistValue("hotkeys", hotkeys).catch(() => {});
  },
  setVerifiedCloudProviders: (providers) => {
    set({ verifiedCloudProviders: providers });
    persistValue("verifiedCloudProviders", providers).catch(() => {});
  },
  setRememberedMeetingSetup: (setup) => {
    set({ rememberedMeetingSetup: setup });
    persistValue("rememberedMeetingSetup", setup).catch(() => {});
  },
  setDiarizationEnabled: (enabled) => {
    set({ diarizationEnabled: enabled });
    persistValue("diarizationEnabled", enabled).catch(() => {});
  },
  setNoisePreset: (preset) => {
    set({ noisePreset: preset });
    persistValue("noisePreset", preset).catch(() => {});
  },
  setConfidenceThreshold: (threshold) => {
    set({ confidenceThreshold: threshold });
    persistValue("confidenceThreshold", threshold).catch(() => {});
  },
  setConfidenceHighlightEnabled: (enabled) => {
    set({ confidenceHighlightEnabled: enabled });
    persistValue("confidenceHighlightEnabled", enabled).catch(() => {});
  },
  setTranscriptFontSize: (size) => {
    set({ transcriptFontSize: size });
    persistValue("transcriptFontSize", size).catch(() => {});
  },
  setTranslationFontSize: (size) => {
    set({ translationFontSize: size });
    persistValue("translationFontSize", size).catch(() => {});
  },
  setTranscriptTextColor: (color) => {
    set({ transcriptTextColor: color });
    persistValue("transcriptTextColor", color).catch(() => {});
  },
  setTranslationTextColor: (color) => {
    set({ translationTextColor: color });
    persistValue("translationTextColor", color).catch(() => {});
  },
  setAiResponseTextColor: (color) => {
    set({ aiResponseTextColor: color });
    persistValue("aiResponseTextColor", color).catch(() => {});
  },
  setAiResponseFontSize: (size) => {
    set({ aiResponseFontSize: size });
    persistValue("aiResponseFontSize", size).catch(() => {});
  },
  setAiResponseLineHeight: (v) => {
    set({ aiResponseLineHeight: v });
    persistValue("aiResponseLineHeight", v).catch(() => {});
  },
  setAiResponseHPad: (v) => {
    set({ aiResponseHPad: v });
    persistValue("aiResponseHPad", v).catch(() => {});
  },
  setAiResponseAlign: (align) => {
    set({ aiResponseAlign: align });
    persistValue("aiResponseAlign", align).catch(() => {});
  },
  setOverlayOpacity: (opacity) => {
    set({ overlayOpacity: opacity });
    persistValue("overlayOpacity", opacity).catch(() => {});
  },
  setShowPostMeetingTranslation: (enabled) => {
    set({ showPostMeetingTranslation: enabled });
    persistValue("showPostMeetingTranslation", enabled).catch(() => {});
  },
  toggleOpenRouterFavorite: (id) => {
    const { openrouterFavorites } = useConfigStore.getState();
    const next = openrouterFavorites.includes(id)
      ? openrouterFavorites.filter((fav) => fav !== id)
      : [...openrouterFavorites, id];
    set({ openrouterFavorites: next });
    persistValue("openrouterFavorites", next).catch(() => {});
  },
  addOpenRouterRecentlyUsed: (id) => {
    const { openrouterRecentlyUsed } = useConfigStore.getState();
    const next = [id, ...openrouterRecentlyUsed.filter((r) => r !== id)].slice(0, 5);
    set({ openrouterRecentlyUsed: next });
    persistValue("openrouterRecentlyUsed", next).catch(() => {});
  },
  removeOpenRouterRecentlyUsed: (id) => {
    const { openrouterRecentlyUsed } = useConfigStore.getState();
    const next = openrouterRecentlyUsed.filter((r) => r !== id);
    set({ openrouterRecentlyUsed: next });
    persistValue("openrouterRecentlyUsed", next).catch(() => {});
  },
  clearOpenRouterRecentlyUsed: () => {
    set({ openrouterRecentlyUsed: [] });
    persistValue("openrouterRecentlyUsed", []).catch(() => {});
  },
  setTrayNotifications: (enabled) => {
    set({ trayNotifications: enabled });
    persistValue("trayNotifications", enabled).catch(() => {});
  },
  setTrayAutoStart: (enabled) => {
    set({ trayAutoStart: enabled });
    persistValue("trayAutoStart", enabled).catch(() => {});
  },
  setTrayStartMinimized: (enabled) => {
    set({ trayStartMinimized: enabled });
    persistValue("trayStartMinimized", enabled).catch(() => {});
  },
  setTrayAutoDetectMeeting: (enabled) => {
    set({ trayAutoDetectMeeting: enabled });
    persistValue("trayAutoDetectMeeting", enabled).catch(() => {});
  },
  setTrayStealthEnabled: (enabled) => {
    set({ trayStealthEnabled: enabled });
    persistValue("trayStealthEnabled", enabled).catch(() => {});
  },
  setStealthShortcut: (shortcut) => {
    set({ stealthShortcut: shortcut });
    persistValue("stealthShortcut", shortcut).catch(() => {});
  },

  loadConfig: async () => {
    try {
      const alreadyLoaded = useConfigStore.getState()._loaded;
      const store = await getStore();

      const theme = await store.get<ThemeMode>("theme");
      const sttProvider = await store.get<STTProviderType>("sttProvider");
      const sttLanguage = await store.get<string>("sttLanguage");
      const llmProvider = await store.get<LLMProviderType>("llmProvider");
      const llmModel = await store.get<string>("llmModel");
      const micDeviceId = await store.get<string | null>("micDeviceId");
      const systemDeviceId = await store.get<string | null>("systemDeviceId");
      const recordingEnabled = await store.get<boolean>("recordingEnabled");
      const meetingAudioConfig = await store.get<MeetingAudioConfig>("meetingAudioConfig");
      const customPresets = await store.get<MeetingAudioConfig[]>("customPresets");
      const autoTrigger = await store.get<boolean>("autoTrigger");
      const autoSummary = await store.get<boolean>("autoSummary");
      const contextWindowSeconds = await store.get<number>("contextWindowSeconds");
      const startOnLogin = await store.get<boolean>("startOnLogin");
      const dataDirectory = await store.get<string>("dataDirectory");
      const firstRunCompleted = await store.get<boolean>("firstRunCompleted");
      const hotkeys = await store.get<HotkeyConfig>("hotkeys");
      const activeWhisperModel = await store.get<string | null>("activeWhisperModel");
      const whisperDualPass = await store.get<WhisperDualPassConfig>("whisperDualPass");
      const contextStrategy = await store.get<ContextStrategy>("contextStrategy");
      const verifiedCloudProviders = await store.get<string[]>("verifiedCloudProviders");
      const deepgramConfig = await store.get<DeepgramConfig>("deepgramConfig");
      const groqConfig = await store.get<GroqConfig>("groqConfig");
      const pauseThresholdMs = await store.get<number>("pauseThresholdMs");
      const activeModelPerEngine = await store.get<Record<string, string>>("activeModelPerEngine");
      const rememberedMeetingSetup = await store.get<{ audioMode: AudioMode; scenario: AIScenario } | null>("rememberedMeetingSetup");
      const diarizationEnabled = await store.get<boolean>("diarizationEnabled");
      const noisePreset = await store.get<string | null>("noisePreset");
      const confidenceThreshold = await store.get<number>("confidenceThreshold");
      const confidenceHighlightEnabled = await store.get<boolean>("confidenceHighlightEnabled");
      const openrouterFavorites = await store.get<string[]>("openrouterFavorites");
      const openrouterRecentlyUsed = await store.get<string[]>("openrouterRecentlyUsed");
      const transcriptFontSize = await store.get<number>("transcriptFontSize");
      const translationFontSize = await store.get<number>("translationFontSize");
      const transcriptTextColor = await store.get<string>("transcriptTextColor");
      const translationTextColor = await store.get<string>("translationTextColor");
      const aiResponseTextColor = await store.get<string>("aiResponseTextColor");
      const aiResponseFontSize = await store.get<number>("aiResponseFontSize");
      const aiResponseLineHeight = await store.get<number>("aiResponseLineHeight");
      const aiResponseHPad = await store.get<number>("aiResponseHPad");
      const aiResponseAlign = await store.get<string>("aiResponseAlign");
      const overlayOpacity = await store.get<number>("overlayOpacity");
      const showPostMeetingTranslation = await store.get<boolean>("showPostMeetingTranslation");
      const trayNotifications = await store.get<boolean>("trayNotifications");
      const trayAutoStart = await store.get<boolean>("trayAutoStart");
      const trayStartMinimized = await store.get<boolean>("trayStartMinimized");
      const trayAutoDetectMeeting = await store.get<boolean>("trayAutoDetectMeeting");
      const trayStealthEnabled = await store.get<boolean>("trayStealthEnabled");
      const stealthShortcut = await store.get<string>("stealthShortcut");

      let resolvedMeetingConfig = meetingAudioConfig ?? null;
      if (!alreadyLoaded && !resolvedMeetingConfig && (micDeviceId || systemDeviceId)) {
        resolvedMeetingConfig = {
          you: {
            role: "You",
            device_id: micDeviceId ?? "default",
            is_input_device: true,
            stt_provider: "web_speech",
          },
          them: {
            role: "Them",
            device_id: systemDeviceId ?? "default",
            is_input_device: false,
            stt_provider: "deepgram",
          },
          recording_enabled: recordingEnabled ?? false,
          preset_name: null,
        };
        await store.set("meetingAudioConfig", resolvedMeetingConfig);
        console.log("[configStore] Migrated legacy audio config to meetingAudioConfig");
      }

      if (!alreadyLoaded && resolvedMeetingConfig) {
        let migrated = false;
        if ((resolvedMeetingConfig.you.stt_provider as string) === "whisper_cpp") {
          resolvedMeetingConfig.you = { ...resolvedMeetingConfig.you, stt_provider: "web_speech", local_model_id: undefined };
          migrated = true;
        }
        if ((resolvedMeetingConfig.them.stt_provider as string) === "whisper_cpp") {
          resolvedMeetingConfig.them = { ...resolvedMeetingConfig.them, stt_provider: "deepgram", local_model_id: undefined };
          migrated = true;
        }
        if (
          (resolvedMeetingConfig.them.stt_provider as string) === "windows_native" &&
          !resolvedMeetingConfig.them.is_input_device
        ) {
          resolvedMeetingConfig.them = { ...resolvedMeetingConfig.them, stt_provider: "deepgram" };
          migrated = true;
        }
        const exclusiveProviders = ["web_speech", "windows_native"];
        if (
          exclusiveProviders.includes(resolvedMeetingConfig.you.stt_provider) &&
          exclusiveProviders.includes(resolvedMeetingConfig.them.stt_provider)
        ) {
          resolvedMeetingConfig.them = {
            ...resolvedMeetingConfig.them,
            stt_provider: "deepgram",
            local_model_id: undefined,
          };
          migrated = true;
          console.log("[configStore] Migrated dual-exclusive STT: kept You, fell back Them to deepgram");
        }
        if (migrated) {
          await store.set("meetingAudioConfig", resolvedMeetingConfig);
          console.log("[configStore] Migrated meetingAudioConfig providers");
        }
      }

      let resolvedSttProvider = sttProvider;
      if (!alreadyLoaded && (!resolvedSttProvider || (resolvedSttProvider as string) === "whisper_cpp")) {
        resolvedSttProvider = "windows_native" as STTProviderType;
        await store.set("sttProvider", resolvedSttProvider);
        console.log("[configStore] Migrated top-level sttProvider to windows_native");
      }

      if (!alreadyLoaded && !resolvedMeetingConfig) {
        resolvedMeetingConfig = {
          you: {
            role: "You",
            device_id: "default",
            is_input_device: true,
            stt_provider: "web_speech",
          },
          them: {
            role: "Them",
            device_id: "default",
            is_input_device: false,
            stt_provider: "deepgram",
          },
          recording_enabled: false,
          preset_name: null,
        };
        await store.set("meetingAudioConfig", resolvedMeetingConfig);
        console.log("[configStore] Created default meetingAudioConfig (Web Speech + Deepgram)");
      }

      set((state) => ({
        ...state,
        _loaded: true,
        ...(theme != null && { theme }),
        ...(sttProvider != null && { sttProvider }),
        ...(sttLanguage != null && { sttLanguage }),
        ...(llmProvider != null && { llmProvider }),
        ...(llmModel != null && { llmModel }),
        ...(micDeviceId !== undefined && { micDeviceId }),
        ...(systemDeviceId !== undefined && { systemDeviceId }),
        ...(recordingEnabled != null && { recordingEnabled }),
        ...(resolvedMeetingConfig != null && { meetingAudioConfig: resolvedMeetingConfig }),
        ...(customPresets != null && { customPresets }),
        ...(autoTrigger != null && { autoTrigger }),
        ...(autoSummary != null && { autoSummary }),
        ...(contextWindowSeconds != null && { contextWindowSeconds }),
        ...(startOnLogin != null && { startOnLogin }),
        ...(dataDirectory != null && { dataDirectory }),
        ...(firstRunCompleted != null && { firstRunCompleted }),
        ...(hotkeys != null && { hotkeys }),
        ...(activeWhisperModel !== undefined && { activeWhisperModel }),
        ...(activeModelPerEngine != null && { activeModelPerEngine }),
        ...(whisperDualPass != null && { whisperDualPass }),
        ...(contextStrategy != null && { contextStrategy }),
        ...(verifiedCloudProviders != null && { verifiedCloudProviders }),
        ...(deepgramConfig != null && { deepgramConfig }),
        ...(groqConfig != null && { groqConfig }),
        ...(pauseThresholdMs != null && { pauseThresholdMs }),
        ...(rememberedMeetingSetup !== undefined && { rememberedMeetingSetup: rememberedMeetingSetup ?? null }),
        ...(diarizationEnabled != null && { diarizationEnabled }),
        ...(noisePreset !== undefined && { noisePreset: noisePreset ?? null }),
        ...(confidenceThreshold != null && { confidenceThreshold }),
        ...(confidenceHighlightEnabled != null && { confidenceHighlightEnabled }),
        ...(openrouterFavorites != null && { openrouterFavorites }),
        ...(openrouterRecentlyUsed != null && { openrouterRecentlyUsed }),
        transcriptFontSize: transcriptFontSize ?? 13,
        translationFontSize: translationFontSize ?? 12,
        transcriptTextColor: transcriptTextColor ?? "#e4e4e7",
        translationTextColor: translationTextColor ?? "#fbbf24",
        aiResponseTextColor: aiResponseTextColor ?? "#d4d4d8",
        aiResponseFontSize: aiResponseFontSize ?? 12,
        aiResponseLineHeight: aiResponseLineHeight ?? 1.6,
        aiResponseHPad: aiResponseHPad ?? 0,
        aiResponseAlign: (aiResponseAlign as "left" | "center" | "right") ?? "left",
        overlayOpacity: overlayOpacity ?? 0.65,
        sttLanguage: sttLanguage ?? "en-US",
        showPostMeetingTranslation: showPostMeetingTranslation ?? true,
        ...(trayNotifications != null && { trayNotifications }),
        ...(trayAutoStart != null && { trayAutoStart }),
        ...(trayStartMinimized != null && { trayStartMinimized }),
        ...(trayAutoDetectMeeting != null && { trayAutoDetectMeeting }),
        ...(trayStealthEnabled != null && { trayStealthEnabled }),
        ...(stealthShortcut != null && { stealthShortcut }),
      }));

      // Post-load: ensure local providers have a local_model_id so footer/backend use the right model
      if (resolvedMeetingConfig) {
        const amp = activeModelPerEngine ?? {};
        const defaultModels: Record<string, string> = {
          sherpa_onnx: "streaming-zipformer-en-20M",
          ort_streaming: "zipformer-en-20M",
          parakeet_tdt: "parakeet-tdt-0.6b-v3-int8",
        };
        const localProviders = ["sherpa_onnx", "ort_streaming", "parakeet_tdt", "whisper_cpp"];
        let needsPersist = false;
        for (const party of ["you", "them"] as const) {
          const p = resolvedMeetingConfig[party];
          if (localProviders.includes(p.stt_provider) && !p.local_model_id) {
            resolvedMeetingConfig[party] = {
              ...p,
              local_model_id: amp[p.stt_provider] ?? defaultModels[p.stt_provider] ?? undefined,
            };
            needsPersist = true;
          }
        }
        if (needsPersist) {
          set({ meetingAudioConfig: resolvedMeetingConfig });
          persistValue("meetingAudioConfig", resolvedMeetingConfig).catch(() => {});
        }
      }

      store.onKeyChange<MeetingAudioConfig>("meetingAudioConfig", (val) => {
        if (val != null) set({ meetingAudioConfig: val });
      });
      store.onKeyChange<string>("activeWhisperModel", (val) => {
        if (val !== undefined) set({ activeWhisperModel: val ?? null });
      });
      store.onKeyChange<STTProviderType>("sttProvider", (val) => {
        if (val != null) set({ sttProvider: val });
      });
      store.onKeyChange<string>("sttLanguage", (val) => {
        if (val != null) set({ sttLanguage: val });
      });
      store.onKeyChange<LLMProviderType>("llmProvider", (val) => {
        if (val != null) set({ llmProvider: val });
      });
      store.onKeyChange<string>("llmModel", (val) => {
        if (val != null) set({ llmModel: val });
      });
      store.onKeyChange<ContextStrategy>("contextStrategy", (val) => {
        if (val != null) set({ contextStrategy: val });
      });
      store.onKeyChange<WhisperDualPassConfig>("whisperDualPass", (val) => {
        if (val != null) set({ whisperDualPass: val });
      });
      store.onKeyChange<number>("overlayOpacity", (val) => {
        if (val != null) set({ overlayOpacity: val });
      });

      // Synchronize the loaded language to the Rust backend before exposing
      // the app as fully loaded. This removes the startup race where a meeting
      // could begin while Rust still held its default en-US language.
      const loadedSttLanguage = sttLanguage ?? "en-US";
      try {
        const { setSTTLanguage: setBackendSTTLanguage } = await import("../lib/ipc");
        await setBackendSTTLanguage(loadedSttLanguage);
      } catch (e) {
        console.warn("[configStore] Failed to sync STT language on load:", e);
      }

      // Sync persisted dual-pass config to Rust backend on startup.
      const loadedDualPass = whisperDualPass ?? { shortChunkSecs: 1.0, longChunkSecs: 3.0, pauseSecs: 1.5 };
      import("../lib/ipc").then(({ updateWhisperDualPassConfig }) =>
        updateWhisperDualPassConfig(
          loadedDualPass.shortChunkSecs,
          loadedDualPass.longChunkSecs,
          loadedDualPass.pauseSecs,
        ).catch((e) => console.warn("[configStore] Failed to sync dual-pass config on load:", e))
      );

      const loadedDgConfig = deepgramConfig ?? DEFAULT_DEEPGRAM_CONFIG;
      import("../lib/ipc").then(({ updateDeepgramConfig }) =>
        updateDeepgramConfig(loadedDgConfig)
          .catch((e) => console.warn("[configStore] Failed to sync Deepgram config on load:", e))
      );

      const loadedGroqConfig = groqConfig ?? DEFAULT_GROQ_CONFIG;
      import("../lib/ipc").then(({ updateGroqConfig }) =>
        updateGroqConfig(loadedGroqConfig)
          .catch((e) => console.warn("[configStore] Failed to sync Groq config on load:", e))
      );

      const loadedPauseThreshold = pauseThresholdMs ?? 3000;
      import("../lib/ipc").then(({ setPauseThreshold }) =>
        setPauseThreshold(loadedPauseThreshold)
          .catch((e) => console.warn("[configStore] Failed to sync pause threshold on load:", e))
      );

      const loadedLLMProvider = llmProvider ?? "ollama";
      const loadedLLMModel = llmModel ?? "";
      if (loadedLLMProvider) {
        import("../lib/ipc").then(async ({ setLLMProvider: ipcSetLLM, setActiveModel: ipcSetModel, getApiKey: ipcGetKey }) => {
          try {
            const apiKey = await ipcGetKey(loadedLLMProvider).catch(() => null);
            const config = JSON.stringify({
              provider_type: loadedLLMProvider,
              ...(apiKey && { api_key: apiKey }),
            });
            await ipcSetLLM(config);
            if (loadedLLMModel) {
              await ipcSetModel(loadedLLMProvider, loadedLLMModel);
            }
            console.log(`[configStore] LLM synced to backend: ${loadedLLMProvider} / ${loadedLLMModel}`);
          } catch (e) {
            console.warn("[configStore] Failed to sync LLM to backend:", e);
          }
        });
      }

      console.log("[configStore] Config loaded from store (with cross-window sync)");
    } catch (err) {
      console.error("[configStore] Failed to load config:", err);
      set({ _loaded: true });
    }
  },
}));
