import { useState } from "react";
import type { Attachment } from "@concord/shared";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImage = attachment.contentType.startsWith("image/");

  if (isImage) {
    return (
      <>
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="max-h-[300px] max-w-[400px] cursor-pointer rounded-lg object-contain"
          onClick={() => setLightboxOpen(true)}
        />
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-bg-elevated text-text-primary hover:bg-bg-content"
              onClick={() => setLightboxOpen(false)}
            >
              <CloseIcon />
            </button>
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2">
      <FileIcon />
      <div className="min-w-0 flex-1">
        <a
          href={attachment.url}
          download={attachment.filename}
          className="block truncate text-sm text-primary hover:underline"
        >
          {attachment.filename}
        </a>
        <span className="text-xs text-text-muted">
          {formatFileSize(attachment.size)}
        </span>
      </div>
      <a
        href={attachment.url}
        download={attachment.filename}
        className="shrink-0 text-text-muted hover:text-text-secondary"
        title="Download"
      >
        <DownloadIcon />
      </a>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
