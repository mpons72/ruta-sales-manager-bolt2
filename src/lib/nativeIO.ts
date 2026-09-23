import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const isNative = () => Capacitor.isNativePlatform();

export async function shareText(
  title: string,
  text: string,
): Promise<"native" | "clipboard"> {
  if (isNative()) {
    await Share.share({ title, text, dialogTitle: title });
    return "native";
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return "native";
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return "clipboard";
  }
  throw new Error("no-share-available");
}

export async function saveAndShareFile(opts: {
  filename: string;
  data: string;
  mimeType: string;
  base64?: boolean;
}): Promise<void> {
  const { filename, data, mimeType, base64 } = opts;
  if (isNative()) {
    const written = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
      ...(base64 ? {} : { encoding: Encoding.UTF8 }),
    });
    await Share.share({
      title: filename,
      url: written.uri,
      dialogTitle: `Compartir ${filename}`,
    });
    return;
  }
  const blob = base64
    ? base64ToBlob(data, mimeType)
    : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

export { isNative };
