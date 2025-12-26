import type { ApiConfig } from "../config";
import type { Video } from "../db/videos";
import { NotFoundError } from "./errors";

export async function getVideoAspectRatio(filePath: string) {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const stdoutText = await new Response(proc.stdout).text();
  const stderrText = await new Response(proc.stderr).text();
  const exitedCode = await proc.exited;

  if (exitedCode !== 0) {
    throw new Error(`ffprobe error: ${stderrText}`);
  }

  const output = JSON.parse(stdoutText);
  if (!output.streams || output.streams.length === 0) {
    throw new Error("No video streams found");
  }

  const { width, height } = output.streams[0];

  return width === Math.floor(16 * (height / 9))
    ? "landscape"
    : height === Math.floor(16 * (width / 9))
    ? "portrait"
    : "other";
}

export async function processVideoForFastStart(inputFilePath: string) {
  const fileParts = inputFilePath.split(".");
  const outputFilePath = `${fileParts[0]}.processed.${fileParts[1]}`;
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-i",
      inputFilePath,
      "-movflags",
      "faststart",
      "-map_metadata",
      "0",
      "-codec",
      "copy",
      "-f",
      "mp4",
      outputFilePath,
    ],
    {
      stdout: "ignore",
      stderr: "pipe",
    }
  );

  const stderrText = await new Response(proc.stderr).text();
  const exitedCode = await proc.exited;

  if (exitedCode !== 0) {
    throw new Error(`ffmpeg error: ${stderrText}`);
  }

  return outputFilePath;
}
