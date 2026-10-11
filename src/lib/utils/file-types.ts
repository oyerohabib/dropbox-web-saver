import type { AssetType } from "../types";

export interface FileTypeGroup {
  label: string;
  assetType: Exclude<AssetType, "unknown">;
  extensions: readonly string[];
}

export const SUPPORTED_FILE_TYPES: readonly FileTypeGroup[] = [
  {
    label: "Images",
    assetType: "image",
    extensions: ["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "svg", "bmp", "tif", "tiff"],
  },
  {
    label: "Video",
    assetType: "video",
    extensions: ["mp4", "webm", "mov", "m4v", "mkv", "avi", "mpeg", "mpg", "ogv", "3gp"],
  },
  {
    label: "Audio",
    assetType: "audio",
    extensions: ["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac"],
  },
  {
    label: "Documents",
    assetType: "link",
    extensions: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "txt", "csv", "epub"],
  },
  {
    label: "Archives",
    assetType: "link",
    extensions: ["zip", "rar", "7z", "tar", "gz"],
  },
  {
    label: "Design files",
    assetType: "link",
    extensions: ["psd", "ai", "eps", "fig", "sketch", "xd"],
  },
];

const TYPE_BY_EXTENSION = new Map<string, FileTypeGroup["assetType"]>(
  SUPPORTED_FILE_TYPES.flatMap((group) => group.extensions.map((extension) => [extension, group.assetType] as const)),
);

export function getFileTypeForPath(pathname: string): FileTypeGroup["assetType"] | null {
  const match = /\.([a-z0-9]+)$/i.exec(pathname);
  return (match && TYPE_BY_EXTENSION.get(match[1].toLowerCase())) || null;
}
