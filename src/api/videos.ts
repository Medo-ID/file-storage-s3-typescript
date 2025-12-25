import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import { type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { getAssetPath, getS3URL, getTmpAssetDiskPath } from "./assets";
import { getVideoAspectRatio, processVideoForFastStart } from "./utils";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }
  if (video.userID !== userID) {
    throw new UserForbiddenError("Unauthorized");
  }

  const MAX_UPLOAD_SIZE = 1 << 30;

  const formData = await req.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) {
    throw new BadRequestError("Video file missing");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError(
      "Video file exceeds the maximum allowed size of 1GB"
    );
  }

  const mediaType = file.type;
  if (mediaType !== "video/mp4") {
    throw new BadRequestError("Invalid file type. Only MP4 allowed.");
  }

  const assetPath = getAssetPath(mediaType);
  const tmpPath = getTmpAssetDiskPath(cfg, assetPath);
  await Bun.write(tmpPath, file);

  const ratio = await getVideoAspectRatio(tmpPath);
  if (!ratio) {
    throw Error("Failed to get aspect ration of video");
  }

  const s3File = cfg.s3Client.file(`${ratio}/${assetPath}`, {
    bucket: cfg.s3Bucket,
  });
  const fastStartVideo = await processVideoForFastStart(tmpPath);
  const videoFile = Bun.file(fastStartVideo);
  await s3File.write(videoFile, { type: mediaType });

  video.videoURL = getS3URL(cfg, assetPath, ratio);
  updateVideo(cfg.db, video);

  await Bun.file(tmpPath).delete();
  await Bun.file(fastStartVideo).delete();
  return respondWithJSON(200, null);
}
