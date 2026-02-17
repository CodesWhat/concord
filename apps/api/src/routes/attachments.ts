import type { FastifyInstance } from "fastify";
import { requireAuth, requireChannelPermission } from "../middleware/permissions.js";
import { Permissions } from "@concord/shared";
import { uploadFile, getFileUrl } from "../services/s3.js";
import { generateSnowflake } from "../utils/snowflake.js";
import type { Attachment } from "@concord/shared";

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/gzip",
  "application/x-tar",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_FILES = 10;

function isAllowedMimeType(mime: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    return true;
  }
  return ALLOWED_MIME_TYPES.has(mime);
}

export default async function attachmentRoutes(app: FastifyInstance) {
  // POST /channels/:channelId/attachments — Upload file attachments
  app.post<{ Params: { channelId: string } }>(
    "/channels/:channelId/attachments",
    {
      preHandler: [
        requireAuth,
        requireChannelPermission(Permissions.ATTACH_FILES),
      ],
    },
    async (request, reply) => {
      const parts = request.parts();
      const attachments: Attachment[] = [];
      let fileCount = 0;

      for await (const part of parts) {
        if (part.type !== "file") continue;

        fileCount++;
        if (fileCount > MAX_FILES) {
          return reply.code(400).send({
            error: { code: "BAD_REQUEST", message: `Maximum ${MAX_FILES} files per upload`, status: 400 },
          });
        }

        const mime = part.mimetype;
        if (!isAllowedMimeType(mime)) {
          return reply.code(400).send({
            error: { code: "BAD_REQUEST", message: `File type not allowed: ${mime}`, status: 400 },
          });
        }

        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > MAX_FILE_SIZE) {
            return reply.code(400).send({
              error: { code: "BAD_REQUEST", message: "File exceeds 25 MB limit", status: 400 },
            });
          }
          chunks.push(chunk);
        }

        // Check if the file was truncated by fastify/multipart limits
        if (part.file.truncated) {
          return reply.code(400).send({
            error: { code: "BAD_REQUEST", message: "File exceeds 25 MB limit", status: 400 },
          });
        }

        const buffer = Buffer.concat(chunks);
        const id = generateSnowflake();
        const ext = part.filename.includes(".") ? part.filename.slice(part.filename.lastIndexOf(".")) : "";
        const key = `attachments/${id}${ext}`;

        await uploadFile(key, buffer, mime, buffer.length);

        const url = await getFileUrl(key);

        attachments.push({
          id,
          filename: part.filename,
          contentType: mime,
          size: buffer.length,
          url,
        });
      }

      if (attachments.length === 0) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "No files provided", status: 400 },
        });
      }

      return reply.code(200).send(attachments);
    },
  );
}
