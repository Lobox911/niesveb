"use client";
import { useEffect, useRef, useState } from "react";
import PasscodeGate, { type Verified } from "@/components/PasscodeGate";

const OUTPUT = 600;   // square photo sent to the server, in pixels
const BOX = 260;      // the cropping window on screen

/**
 * Passcode, photograph, card.
 *
 * The cropping happens here rather than on the server, for two reasons. A
 * phone photograph is three to eight megabytes and Vercel refuses a request
 * body over 4.5MB, so something has to shrink it before it is sent. And a
 * square crop chosen by the participant is the only way a portrait
 * photograph, a group shot and a selfie all end up looking like passport
 * photographs on the badge.
 *
 * The photograph never reaches storage. It is drawn into the PDF and
 * discarded — which matters, because the alternative is a public bucket full
 * of members' faces.
 */
export default function PhotoCardGate({ help }: { help?: string }) {
  const [r, setR] = useState<Verified | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState<"png" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Revoke the object URL when it is replaced or the component goes away;
  // without this each retry leaks the previous photograph.
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const pick = (file: File) => {
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("That image is over 12MB. Most phones can export a smaller copy.");
      return;
    }
    if (src) URL.revokeObjectURL(src);
    setSrc(URL.createObjectURL(file));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  /** Draws the visible square to an off-screen canvas at output resolution. */
  const crop = (): string | null => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = OUTPUT;
    canvas.height = OUTPUT;

    // White rather than transparent: a transparent PNG prints as a black
    // square on some office printers.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);

    const scale = OUTPUT / BOX;
    // cover: the shorter side fills the box, the longer overflows and is
    // panned by the participant.
    const base = Math.max(BOX / img.naturalWidth, BOX / img.naturalHeight);
    const drawW = img.naturalWidth * base * zoom * scale;
    const drawH = img.naturalHeight * base * zoom * scale;
    const dx = (OUTPUT - drawW) / 2 + offset.x * scale;
    const dy = (OUTPUT - drawH) / 2 + offset.y * scale;

    ctx.drawImage(img, dx, dy, drawW, drawH);
    return canvas.toDataURL("image/jpeg", 0.88);
  };

  const download = async (print: boolean) => {
    if (!r?.passcode) return;
    setBusy(print ? "print" : "png");
    setError(null);
    try {
      const res = await fetch("/api/photo-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: r.passcode, photo: src ? crop() : null, print }),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(b?.error ?? "The card could not be produced. Try again shortly.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = print ? `Participant-card-print-${r.passcode}.pdf` : `Participant-card-${r.passcode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("The download did not start. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!r) return <PasscodeGate cta="Make my card" onVerified={setR} />;

  if (r.status !== "confirmed") {
    return (
      <div className="max-w-[560px] rounded border border-line bg-paper p-5">
        <p className="text-[15px] leading-relaxed text-ink">
          {r.name}, your payment is still being confirmed by the branch. Your
          participant card becomes available once it is.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[560px]">
      <p className="text-[15px] text-muted">
        {r.name} — {r.category}
      </p>

      <div className="mt-6">
        <label className="label" htmlFor="photo">Your photograph</label>
        <input
          ref={fileInput}
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="field py-2.5"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />
        {help && <p className="help">{help}</p>}
      </div>

      {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}

      {src && (
        <div className="mt-6">
          <p className="label">Position your photograph</p>

          <div
            className="relative cursor-move touch-none overflow-hidden rounded border border-line bg-paper"
            style={{ width: BOX, height: BOX }}
            onPointerDown={(e) => {
              dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              setOffset({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
            }}
            onPointerUp={() => { dragging.current = null; }}
            onPointerCancel={() => { dragging.current = null; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                width: imgRef.current
                  ? imgRef.current.naturalWidth *
                    Math.max(BOX / imgRef.current.naturalWidth, BOX / imgRef.current.naturalHeight)
                  : BOX,
              }}
              onLoad={() => setZoom((z) => z)}
            />
          </div>

          <div className="mt-4 max-w-[260px]">
            <label className="label" htmlFor="zoom">Zoom</label>
            <input
              id="zoom" type="range" min={1} max={3} step={0.01}
              value={zoom} className="w-full"
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>

          <p className="help mt-2">
            Drag the photograph to move it. Head and shoulders, centred, as you
            would for a passport.
          </p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" aria-hidden />

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button" disabled={busy !== null}
          className="btn-primary min-h-[50px] px-7 disabled:opacity-60"
          onClick={() => void download(true)}
        >
          {busy === "print" ? "Preparing" : "Download to print (A4)"}
        </button>
        <button
          type="button" disabled={busy !== null}
          className="btn-secondary min-h-[50px] px-7 disabled:opacity-60"
          onClick={() => void download(false)}
        >
          {busy === "png" ? "Preparing" : "Card only (for a badge printer)"}
        </button>
      </div>

      <p className="help mt-4">
        The card carries a QR code the attendance desk scans, so bring it with
        you. Without a photograph it still prints and still works.
      </p>
    </div>
  );
}