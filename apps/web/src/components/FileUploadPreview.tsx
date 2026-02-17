import { useUploadStore } from "../stores/uploadStore.js";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadPreview() {
  const pendingFiles = useUploadStore((s) => s.pendingFiles);
  const uploadProgress = useUploadStore((s) => s.uploadProgress);
  const isUploading = useUploadStore((s) => s.isUploading);
  const removeFile = useUploadStore((s) => s.removeFile);

  if (pendingFiles.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-2">
      {pendingFiles.map((pf) => {
        const progress = uploadProgress[pf.id];
        return (
          <div
            key={pf.id}
            className="relative flex w-20 shrink-0 flex-col items-center rounded-lg bg-bg-elevated p-2"
          >
            {/* Remove button */}
            {!isUploading && (
              <button
                onClick={() => removeFile(pf.id)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-bg-deepest text-xs text-text-muted hover:text-text-primary"
              >
                <XIcon />
              </button>
            )}

            {/* Thumbnail or icon */}
            <div className="flex h-12 w-full items-center justify-center overflow-hidden rounded">
              {pf.preview ? (
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="h-12 w-full rounded object-cover"
                />
              ) : (
                <FileTypeIcon contentType={pf.file.type} />
              )}
            </div>

            {/* Filename */}
            <span className="mt-1 w-full truncate text-center text-xs text-text-secondary">
              {pf.file.name}
            </span>

            {/* File size */}
            <span className="text-xs text-text-muted">
              {formatFileSize(pf.file.size)}
            </span>

            {/* Progress overlay */}
            {isUploading && progress !== undefined && (
              <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-lg bg-bg-deepest">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith("video/")) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  }
  if (contentType.startsWith("audio/")) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    );
  }
  // Generic document icon
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
