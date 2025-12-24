import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import { type ApiConfig } from "../config";
import { type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getAssetDiskPath, getAssetPath, getAssetURL } from "./assets";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }
  if (video.userID !== userID) {
    throw new UserForbiddenError("Not authorized to update this video");
  }

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError(
      `Thumbnail file exceeds the maximum allowed size of 10MB`
    );
  }

  const mediaType = file.type;
  if (mediaType !== "image/jpeg" && mediaType !== "image/png") {
    throw new BadRequestError("Invalid file type. Only JPEG or PNG allowed.");
  }

  const assetPath = getAssetPath(mediaType);
  const assetDiskPath = getAssetDiskPath(cfg, assetPath);

  await Bun.write(assetDiskPath, file);

  const urlPath = getAssetURL(cfg, assetPath);
  video.thumbnailURL = urlPath;
  updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}
