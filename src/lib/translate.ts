const TIMEOUT = 8000;

export async function translateWithLingva(
  text: string,
  targetLang: string
): Promise<string> {
  const encoded = encodeURIComponent(text.trim());
  const res = await fetch(
    `https://lingva.ml/api/v1/zh/${targetLang}/${encoded}`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );

  if (!res.ok) throw new Error(`Lingva returned ${res.status}`);
  const data = await res.json();
  return data.translation;
}

export async function translateWithMyMemory(
  text: string,
  targetLang: string
): Promise<string> {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text.trim());
  url.searchParams.set("langpair", `zh|${targetLang}`);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!res.ok) throw new Error(`MyMemory returned ${res.status}`);
  const data = await res.json();
  const text_result = data?.responseData?.translatedText || "";
  if (text_result.startsWith("MYMEMORY WARNING"))
    throw new Error("MyMemory rate limited");
  return text_result;
}

export async function translateText(
  text: string,
  targetLang: string
): Promise<string> {
  return Promise.any([
    translateWithLingva(text, targetLang),
    translateWithMyMemory(text, targetLang),
  ]);
}
