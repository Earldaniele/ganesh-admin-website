export type UploadedMedia = { src: string; assetId: string; alt: string };

/** Send original bytes, reporting transfer progress and server-side validation errors. */
export function uploadMedia(file: File, alt: string, onProgress: (percent: number) => void): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/media");
    request.responseType = "json";
    request.timeout = 180000;
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => {
      const result = request.response;
      if (request.status >= 200 && request.status < 300 && result?.src && result?.assetId) resolve(result);
      else reject(new Error(result?.error || `Upload failed (${request.status}). Try again.`));
    };
    request.onerror = () => reject(new Error("Connection lost. Retry the upload."));
    request.ontimeout = () => reject(new Error("Upload timed out. Retry the upload."));
    const body = new FormData(); body.append("file", file); body.append("alt", alt);
    onProgress(0); request.send(body);
  });
}

export function imageUploadError(file: File): string | null {
  return !file.size || file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)
    ? "Choose a PNG, JPG, WebP or static SVG up to 5 MB." : null;
}
