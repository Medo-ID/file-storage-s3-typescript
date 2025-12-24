import { existsSync, mkdirSync } from "fs";
import path from "path";

import type { ApiConfig } from "../config";
import { randomBytes } from "crypto";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export function getAssetPath(mediaType: string) {
  const base = randomBytes(32);
  const id = base.toString("base64url");
  const ext = getFileExtention(mediaType);
  return id + ext;
}

export function getFileExtention(mediaType: string) {
  const parts = mediaType.split("/");
  if (parts.length !== 2) {
    return ".bin";
  }
  return "." + parts[1];
}

export function getAssetDiskPath(cfg: ApiConfig, assetPath: string) {
  return path.join(cfg.assetsRoot, assetPath);
}

export function getAssetURL(cfg: ApiConfig, assetPath: string) {
  return `http://localhost:${cfg.port}/assets/${assetPath}`;
}
