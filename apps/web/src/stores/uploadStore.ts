import { create } from "zustand";
import type { Attachment } from "@concord/shared";
import { uploadMultipart } from "../api/client.js";

interface PendingFile {
  id: string;
  file: File;
  preview?: string;
}

interface UploadState {
  pendingFiles: PendingFile[];
  uploadProgress: Record<string, number>;
  isUploading: boolean;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  uploadFiles: (channelId: string) => Promise<Attachment[]>;
}

let fileIdCounter = 0;

export const useUploadStore = create<UploadState>((set, get) => ({
  pendingFiles: [],
  uploadProgress: {},
  isUploading: false,

  addFiles: (files: File[]) => {
    const newPending: PendingFile[] = files.map((file) => {
      const id = `file-${++fileIdCounter}`;
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      return { id, file, preview };
    });
    set((s) => ({
      pendingFiles: [...s.pendingFiles, ...newPending],
    }));
  },

  removeFile: (id: string) => {
    const file = get().pendingFiles.find((f) => f.id === id);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    set((s) => ({
      pendingFiles: s.pendingFiles.filter((f) => f.id !== id),
    }));
  },

  clearFiles: () => {
    for (const f of get().pendingFiles) {
      if (f.preview) URL.revokeObjectURL(f.preview);
    }
    set({ pendingFiles: [], uploadProgress: {} });
  },

  uploadFiles: async (channelId: string) => {
    const { pendingFiles } = get();
    if (pendingFiles.length === 0) return [];

    set({ isUploading: true, uploadProgress: {} });

    const formData = new FormData();
    for (const pf of pendingFiles) {
      formData.append("files", pf.file);
    }

    try {
      const attachments = await uploadMultipart<Attachment[]>(
        `/api/v1/channels/${channelId}/attachments`,
        formData,
        (percent) => {
          const progress: Record<string, number> = {};
          for (const pf of get().pendingFiles) {
            progress[pf.id] = percent;
          }
          set({ uploadProgress: progress });
        },
      );

      // Revoke all preview URLs
      for (const pf of get().pendingFiles) {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      }
      set({ pendingFiles: [], uploadProgress: {}, isUploading: false });

      return attachments;
    } catch (err) {
      set({ isUploading: false });
      throw err;
    }
  },
}));
