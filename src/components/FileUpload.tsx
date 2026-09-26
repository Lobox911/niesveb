"use client";
import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

/**
 * Picks a file, uploads it straight to Vercel Blob from the browser, and puts
 * the resulting URL in a hidden field for the surrounding form to submit.
 *
 * The file never passes through a server action, so Vercel's 4.5MB request
 * limit does not apply. That limit is what made a phone photo of a flyer fail
 * with a 413 before any of our size checks ran.
 */
export default function FileUpload({
  name,
  label,
  accept,
  folder,
  maxMb = 10,
  help,
  currentUrl,
  onUploaded,
}: {
  /** Hidden field the URL lands in, e.g. "flyerUrl". */
  name: string;
  label: string;
  accept: string;
  /** Blob path prefix, e.g. "flyers". */
  folder: string;
  maxMb?: number;
  help?: string;
  currentUrl?: string | null;
  onUploaded?: (url: string) => void;
}) {
  const [url, setUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File) => {
    setError(null);

    if (file.size > maxMb * 1024 * 1024) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB, over the ${maxMb}MB limit. Export it at a smaller size and try again.`);
      if (input.current) input.current.value = "";
      return;
    }

    setFileName(file.name);
    setProgress(0);

    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
      const blob = await upload(`${folder}/${safe}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      setUrl(blob.url);
      setProgress(100);
      onUploaded?.(blob.url);
    } catch (e) {
      setProgress(null);
      setFileName(null);
      if (input.current) input.current.value = "";
      setError(
        e instanceof Error && e.message
          ? e.message
          : "The upload did not complete. Check your connection and try again.",
      );
    }
  };

  return (
    <div>
      {/* What the form actually submits. */}
      <input type="hidden" name={name} value={url} />

      <label className="label" htmlFor={`${name}-file`}>{label}</label>
      <input
        ref={input}
        id={`${name}-file`}
        type="file"
        accept={accept}
        className="field py-2.5"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />
      {help && <p className="help">{help}</p>}

      {fileName && progress !== null && (
        <div className="mt-3">
          <p className="mono text-[13px] text-ink">
            {fileName} {progress < 100 ? `— ${Math.round(progress)}%` : "— uploaded"}
          </p>
          <div className="mt-1.5 h-1 w-full max-w-[320px] rounded bg-line">
            <div
              className="h-1 rounded bg-green transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}

      {!fileName && currentUrl && (
        <p className="help mt-2">A file is already saved. Choosing one replaces it.</p>
      )}
    </div>
  );
}