// Watches meetingAudioConfig and STT language changes during an active meeting
// and restarts the Rust audio capture pipeline with the new settings.
// This enables "hot-swap" of STT provider, audio source, and recognition language mid-meeting.
//
// Key design: debounce (300ms) + sequential restart. Two separate refs:
// - appliedConfigRef: what Rust currently has running (only set after successful restart)
// - pendingConfigRef: set immediately to prevent duplicate debounce scheduling

import { useEffect, useRef } from "react";
import { useConfigStore } from "../stores/configStore";
import { useMeetingStore } from "../stores/meetingStore";
import { useDevLogStore } from "../stores/devLogStore";
import { useTranscriptStore } from "../stores/transcriptStore";
import { stopCapture, startCapturePerParty } from "../lib/ipc";

export function useAudioConfigSync() {
  const isRecording = useMeetingStore((s) => s.isRecording);
  const meetingAudioConfig = useConfigStore((s) => s.meetingAudioConfig);
  const sttLanguage = useConfigStore((s) => s.sttLanguage);

  // Include the persisted language in the runtime signature. Provider and device
  // hot-swaps already restart the pipeline; language changes must do the same so
  // existing per-party Rust providers are rebuilt with the new language.
  const runtimeKey = meetingAudioConfig
    ? JSON.stringify({ config: meetingAudioConfig, language: sttLanguage })
    : null;

  const appliedConfigRef = useRef<string | null>(null);
  const pendingConfigRef = useRef<string | null>(null);
  const restartingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isRecording || !meetingAudioConfig || runtimeKey === null) return;

    const configKey = runtimeKey;

    if (appliedConfigRef.current === null) {
      appliedConfigRef.current = configKey;
      pendingConfigRef.current = configKey;
      return;
    }

    if (appliedConfigRef.current === configKey) return;
    if (pendingConfigRef.current === configKey) return;

    pendingConfigRef.current = configKey;

    const log = useDevLogStore.getState().addEntry;
    const desc =
      `language=${sttLanguage}, you=${meetingAudioConfig.you.stt_provider}` +
      (meetingAudioConfig.you.local_model_id ? `(${meetingAudioConfig.you.local_model_id})` : "") +
      `, them=${meetingAudioConfig.them.stt_provider}` +
      (meetingAudioConfig.them.local_model_id ? `(${meetingAudioConfig.them.local_model_id})` : "");
    log("info", "config", `STT runtime changed → ${desc}`);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;

      if (restartingRef.current) {
        log("warn", "config", "Hot-swap already in progress — queued for retry");
        pendingConfigRef.current = null;
        return;
      }

      restartingRef.current = true;

      const latestConfig = useConfigStore.getState().meetingAudioConfig;
      if (!latestConfig) {
        restartingRef.current = false;
        return;
      }

      const latestLanguage = useConfigStore.getState().sttLanguage;
      const latestKey = JSON.stringify({
        config: latestConfig,
        language: latestLanguage,
      });

      if (appliedConfigRef.current === latestKey) {
        pendingConfigRef.current = latestKey;
        restartingRef.current = false;
        return;
      }

      log("info", "config", "Hot-swap: stopping current capture...");

      try {
        useTranscriptStore.getState().finalizeAllInterim();

        await stopCapture();
        log("info", "config", "Hot-swap: capture stopped, waiting for resource release...");

        await new Promise((r) => setTimeout(r, 200));

        const freshConfig = useConfigStore.getState().meetingAudioConfig;
        const freshLanguage = useConfigStore.getState().sttLanguage;
        if (!freshConfig) {
          log("warn", "config", "Hot-swap: no config available after stop");
          return;
        }

        log(
          "info",
          "config",
          `Hot-swap: starting new capture pipeline (language=${freshLanguage})...`
        );
        await startCapturePerParty(freshConfig.you, freshConfig.them);

        const freshKey = JSON.stringify({
          config: freshConfig,
          language: freshLanguage,
        });
        appliedConfigRef.current = freshKey;
        pendingConfigRef.current = freshKey;
        log("info", "config", "Hot-swap complete — new STT pipeline active");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("error", "config", `Hot-swap FAILED: ${msg}`);
        appliedConfigRef.current = null;
        pendingConfigRef.current = null;
      } finally {
        restartingRef.current = false;
      }
    }, 300);
  }, [isRecording, meetingAudioConfig, runtimeKey]);

  useEffect(() => {
    if (!isRecording) {
      appliedConfigRef.current = null;
      pendingConfigRef.current = null;
      restartingRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    }
  }, [isRecording]);
}
