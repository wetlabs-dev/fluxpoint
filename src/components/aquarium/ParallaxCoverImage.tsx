"use client";

import { useEffect, useRef } from "react";

export function ParallaxCoverImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let frame = 0;
    function update() {
      frame = 0;
      const image = ref.current;
      if (!image) return;
      const rect = image.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const cardCenter = rect.top + rect.height / 2;
      const offset = Math.max(-12, Math.min(12, (viewportCenter - cardCenter) / 18));
      image.style.transform = `translate3d(0, ${offset}px, 0) scale(1.06)`;
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

  return <img ref={ref} src={src} alt={alt} loading="lazy" className={className} />;
}
