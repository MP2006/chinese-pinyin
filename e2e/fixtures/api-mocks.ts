import { Page } from "@playwright/test";
import { MOCK_TRANSLATION, MOCK_DEFINITION } from "./test-data";

/** Intercept /api/translate and return mock translation */
export async function mockTranslateAPI(page: Page) {
  await page.route("**/api/translate", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ translation: MOCK_TRANSLATION }),
    });
  });
}

/** Intercept /api/define and return mock definition */
export async function mockDefineAPI(page: Page) {
  await page.route("**/api/define", async (route) => {
    const request = route.request();
    let word = "";
    try {
      const body = request.postDataJSON();
      word = body?.word || "";
    } catch {}

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        word: word || MOCK_DEFINITION.word,
        pinyin: MOCK_DEFINITION.pinyin,
        definitions: MOCK_DEFINITION.definitions,
      }),
    });
  });
}

/** Intercept /cedict.json and return a small test dictionary */
export async function mockCedictJSON(page: Page) {
  await page.route("**/cedict.json", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        你好: "hello; hi",
        你: "you",
        好: "good; well",
        世界: "world",
        谢谢: "thank you; thanks",
      }),
    });
  });
}

/** Intercept Lingva API and return mock Vietnamese translation */
export async function mockLingvaAPI(page: Page) {
  await page.route("**/lingva.ml/api/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ translation: "xin chào" }),
    });
  });
}

/** Intercept /api/tts and return a minimal WAV buffer */
export async function mockTTSAPI(page: Page) {
  await page.route("**/api/tts", (route) => {
    // Minimal valid WAV: 44-byte header + 0 data bytes
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    // "RIFF"
    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, 36, true); // file size - 8
    // "WAVE"
    view.setUint32(8, 0x57415645, false);
    // "fmt "
    view.setUint32(12, 0x666d7420, false);
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, 22050, true); // sample rate
    view.setUint32(28, 22050, true); // byte rate
    view.setUint16(32, 1, true); // block align
    view.setUint16(34, 8, true); // bits per sample
    // "data"
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, 0, true); // data size

    route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: Buffer.from(header),
    });
  });
}

/** Mock all API routes */
export async function mockAllAPIs(page: Page) {
  await Promise.all([
    mockTranslateAPI(page),
    mockDefineAPI(page),
    mockTTSAPI(page),
    mockCedictJSON(page),
    mockLingvaAPI(page),
  ]);
}
