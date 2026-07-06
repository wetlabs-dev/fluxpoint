"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

export function ParallaxCoverImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let frame = 0;
    function update() {
      frame = 0;
      const frameElement = ref.current;
      if (!frameElement) return;
      const rect = frameElement.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const cardCenter = rect.top + rect.height / 2;
      const offset = Math.max(-18, Math.min(18, (viewportCenter - cardCenter) / 16));
      frameElement.style.setProperty("--fp-card-parallax-y", `${offset}px`);
    }
    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className={`${className ?? ""} block overflow-hidden`} style={{ "--fp-card-parallax-y": "0px" } as CSSProperties}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute left-0 top-1/2 h-[136%] w-full object-cover will-change-transform"
        style={{ transform: "translate3d(0, calc(-50% + var(--fp-card-parallax-y)), 0) scale(1.02)" }}
      />
    </div>
  );
}
