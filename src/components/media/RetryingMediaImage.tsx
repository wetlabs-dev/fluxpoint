"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const RETRY_DELAYS_MS = [500, 1_200, 2_500, 5_000] as const;

function appendRetryParam(src: string, attempt: number) {
  if (!attempt) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}fp_retry=${attempt}`;
}

export function RetryingMediaImage({
  src,
  alt,
  className,
  loading = "lazy",
  fallbackLabel = "Image unavailable"
}: {
  src: string;
  alt: string;
  className: string;
  loading?: "eager" | "lazy";
  fallbackLabel?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [src]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (failed) {
    return (
      <div className={`${className} grid place-items-center bg-muted p-4 text-center text-muted-foreground`}>
        <div className="space-y-2">
          <ImageIcon className="mx-auto h-7 w-7" />
          <p className="text-xs font-semibold">{fallbackLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <img
      key={`${src}-${attempt}`}
      className={className}
      src={appendRetryParam(src, attempt)}
      alt={alt}
      loading={loading}
      onError={() => {
        if (timerRef.current) return;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) {
          setFailed(true);
          return;
        }
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setAttempt((current) => current + 1);
        }, delay);
      }}
      onLoad={() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }}
    />
  );
}
