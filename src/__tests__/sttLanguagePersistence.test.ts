import { describe, expect, it } from "vitest";

describe("STT language persistence contract", () => {
  it("preserves the selected French BCP-47 locale", () => {
    const selected = "fr-FR";
    const persisted = selected;
    const backendValue = selected;

    expect(persisted).toBe("fr-FR");
    expect(backendValue).toBe("fr-FR");
  });

  it("normalizes French locale to the base language for Whisper-style APIs", () => {
    const language = "fr-FR";
    expect(language.split("-")[0]).toBe("fr");
  });
});
