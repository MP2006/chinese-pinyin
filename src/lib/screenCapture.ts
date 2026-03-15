export function isClipboardReadSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.clipboard?.read;
}

export async function readClipboardImage(): Promise<Blob | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        return await item.getType(imageType);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getDroppedImage(e: DragEvent): File | null {
  if (!e.dataTransfer) return null;
  for (const file of Array.from(e.dataTransfer.files)) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}
