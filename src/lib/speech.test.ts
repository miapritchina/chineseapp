import { describe, expect, it } from "vitest";
import { pickVoice, firstReading, youdaoUrl } from "./speech";

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService });

describe("pickVoice", () => {
  it("prefers the Enhanced variant over the compact one listed first", () => {
    const voices = [v("Tingting", "zh-CN"), v("Tingting (Enhanced)", "zh-CN")];
    expect(pickVoice(voices)?.name).toBe("Tingting (Enhanced)");
  });

  it("prefers zh-CN over other Chinese regions when quality is equal", () => {
    const voices = [v("Meijia", "zh-TW"), v("Sinji", "zh-HK"), v("Tingting", "zh-CN")];
    expect(pickVoice(voices)?.name).toBe("Tingting");
  });

  it("an Enhanced regional voice still beats a compact zh-CN voice", () => {
    const voices = [v("Tingting", "zh-CN"), v("Meijia (Enhanced)", "zh-TW")];
    expect(pickVoice(voices)?.name).toBe("Meijia (Enhanced)");
  });

  it("normalizes underscore lang tags (zh_CN)", () => {
    const voices = [v("Ting-Ting", "zh_CN")];
    expect(pickVoice(voices)?.name).toBe("Ting-Ting");
  });

  it("ignores non-Chinese voices and returns null when none match", () => {
    expect(pickVoice([v("Samantha", "en-US"), v("Kyoko", "ja-JP")])).toBeNull();
  });

  it("prefers on-device voices as a tiebreaker", () => {
    const voices = [v("Cloud Voice", "zh-CN", false), v("Local Voice", "zh-CN", true)];
    expect(pickVoice(voices)?.name).toBe("Local Voice");
  });
});

describe("youdaoUrl", () => {
  it("URL-encodes the text and pins the language", () => {
    expect(youdaoUrl("你好")).toBe(
      "https://dict.youdao.com/dictvoice?audio=%E4%BD%A0%E5%A5%BD&le=zh",
    );
  });
});

describe("firstReading", () => {
  it("takes the first of multiple readings", () => {
    expect(firstReading("lǐng;lìng")).toBe("lǐng");
  });
  it("passes plain input through", () => {
    expect(firstReading("hǎo")).toBe("hǎo");
  });
});
