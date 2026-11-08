"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

export interface RoundCarouselImage {
  src: string;
  eyebrow: string;
  title: string;
  metric: string;
  tone: string;
}

interface RoundCarouselProps {
  images?: RoundCarouselImage[];
  imageWidth?: number;
  imageHeight?: number;
  spacing?: number;
  speed?: number;
  direction?: "right" | "left";
  drag?: boolean;
  sensitivity?: number;
  tilt?: number;
  perspective?: number;
  cornerRadius?: number;
  innerDim?: number;
  background?: string;
  style?: CSSProperties;
}

function makeArtwork(tone: string, index: number) {
  const scenes = [
    `<path d="M110 435h380v110H110z" fill="#fffaf3" stroke="${tone}" stroke-width="7"/><path d="M150 435v-98h180v98M330 385h112l48 50M206 337v-57h75v57M245 280v-58" stroke="${tone}" stroke-width="8" stroke-linejoin="round"/><path d="M172 479h250M172 510h190" stroke="${tone}" stroke-opacity=".45" stroke-width="5" stroke-dasharray="3 12"/><circle cx="450" cy="503" r="12" fill="${tone}"/>`,
    `<path d="M120 365h360" stroke="${tone}" stroke-width="7" stroke-linecap="round"/><path d="M180 365v105M300 365v105M420 365v105" stroke="${tone}" stroke-width="5"/><g fill="#fffaf3" stroke="${tone}" stroke-width="6"><rect x="130" y="286" width="100" height="72" rx="14"/><rect x="250" y="286" width="100" height="72" rx="14"/><rect x="370" y="286" width="100" height="72" rx="14"/></g><g fill="${tone}"><circle cx="180" cy="322" r="9"/><circle cx="300" cy="322" r="9"/><circle cx="420" cy="322" r="9"/></g><path d="m215 322h36m99 0h36" stroke="${tone}" stroke-width="5" stroke-linecap="round"/><path d="M125 490h350" stroke="${tone}" stroke-opacity=".4" stroke-width="5" stroke-dasharray="8 14"/>`,
    `<rect x="185" y="220" width="230" height="330" rx="20" fill="#fffaf3" stroke="${tone}" stroke-width="7"/><path d="M250 220v-28h100v28M230 290h140M230 345h140M230 400h140" stroke="${tone}" stroke-width="6" stroke-linecap="round"/><g fill="${tone}"><circle cx="210" cy="290" r="8"/><circle cx="210" cy="345" r="8"/><circle cx="210" cy="400" r="8"/></g><path d="m230 470 48 42 91-94" stroke="${tone}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M140 270h260v250H140z" fill="#fffaf3" stroke="${tone}" stroke-width="7"/><path d="M165 310h210M165 350h210M165 390h210M165 430h210M165 470h210" stroke="${tone}" stroke-opacity=".45" stroke-width="4" stroke-dasharray="4 10"/><circle cx="365" cy="420" r="90" fill="#fffaf3" fill-opacity=".9" stroke="${tone}" stroke-width="10"/><path d="m428 485 58 58" stroke="${tone}" stroke-width="16" stroke-linecap="round"/><path d="m325 420 25 25 48-54" stroke="${tone}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M130 435h300v90H130zM170 435V330h135v105M305 380h83l42 55M202 330v-54h65v54" fill="#fffaf3" stroke="${tone}" stroke-width="8" stroke-linejoin="round"/><path d="M245 276v-62M150 575h300" stroke="${tone}" stroke-width="7" stroke-linecap="round"/><path d="m350 270 28-28 25 25 34-45" stroke="${tone}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="437" cy="222" r="12" fill="${tone}"/>`,
    `<rect x="155" y="205" width="290" height="350" rx="18" fill="#fffaf3" stroke="${tone}" stroke-width="7"/><path d="M205 270h180M205 305h115" stroke="${tone}" stroke-width="6" stroke-linecap="round"/><path d="M205 490v-78h42v78M275 490V365h42v125M345 490v-98h42v98" fill="${tone}" fill-opacity=".72"/><path d="M205 520h182" stroke="${tone}" stroke-width="5" stroke-linecap="round"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760" fill="none"><rect width="600" height="760" fill="#f3eee7"/><path d="M0 570 600 410v350H0z" fill="#e8ded2"/><circle cx="440" cy="180" r="122" fill="${tone}" fill-opacity=".12"/><circle cx="440" cy="180" r="88" stroke="${tone}" stroke-opacity=".28" stroke-width="2" stroke-dasharray="3 10"/>${scenes[index % scenes.length]}<path d="M72 644h456" stroke="${tone}" stroke-opacity=".28" stroke-width="2"/><circle cx="96" cy="644" r="6" fill="${tone}"/><circle cx="504" cy="644" r="6" fill="${tone}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const DEFAULT_IMAGES: RoundCarouselImage[] = [
  { eyebrow: "01 / PRODUCTION", title: "Every piece\naccounted for.", metric: "2,840 pcs", tone: "#c85a3a", src: makeArtwork("#c85a3a", 0) },
  { eyebrow: "02 / LINE OUTPUT", title: "A clear view\nof every line.", metric: "08 lines live", tone: "#70856d", src: makeArtwork("#70856d", 1) },
  { eyebrow: "03 / WORK ORDERS", title: "The next job,\nready to run.", metric: "12 active", tone: "#bd8b55", src: makeArtwork("#bd8b55", 2) },
  { eyebrow: "04 / QUALITY", title: "Catch small\nissues early.", metric: "98.4% pass", tone: "#657b92", src: makeArtwork("#657b92", 3) },
  { eyebrow: "05 / MACHINE HEALTH", title: "Know when\na machine stops.", metric: "03 alerts", tone: "#b66b62", src: makeArtwork("#b66b62", 4) },
  { eyebrow: "06 / SHIFT REPORTS", title: "A finished shift,\nclearly told.", metric: "Live report", tone: "#8577a0", src: makeArtwork("#8577a0", 5) },
];

export default function RoundCarousel({
  images = DEFAULT_IMAGES,
  imageWidth = 260,
  imageHeight = 330,
  spacing = 2.4,
  speed = 2.6,
  direction = "right",
  drag = true,
  sensitivity = 5,
  tilt = -7,
  perspective = 1800,
  cornerRadius = 18,
  innerDim = 3.5,
  background = "transparent",
  style = {},
}: RoundCarouselProps) {
  const items = images.length ? images : DEFAULT_IMAGES;
  const ringRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const lastTimeRef = useRef(0);
  const pointerRef = useRef({ active: false, x: 0 });
  const [cardSize, setCardSize] = useState({ width: imageWidth, height: imageHeight });
  const radius = (cardSize.width * (1 + spacing * 0.15)) / (2 * Math.tan(Math.PI / items.length));
  const angle = 360 / items.length;
  const angularSpeed = speed * 6 * (direction === "left" ? -1 : 1);

  useEffect(() => {
    const updateSize = () => {
      const scale = window.innerWidth < 520 ? 0.72 : window.innerWidth < 768 ? 0.86 : 1;
      setCardSize({ width: Math.round(imageWidth * scale), height: Math.round(imageHeight * scale) });
    };
    updateSize();
    window.addEventListener("resize", updateSize, { passive: true });
    return () => window.removeEventListener("resize", updateSize);
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const apply = () => { ring.style.transform = `translateZ(${-radius}px) rotateY(${rotationRef.current}deg)`; };
    const draw = (now: number) => {
      const elapsed = lastTimeRef.current ? Math.min((now - lastTimeRef.current) / 1000, 0.1) : 0;
      lastTimeRef.current = now;
      if (!pointerRef.current.active) {
        if (Math.abs(velocityRef.current) > 0.01) {
          rotationRef.current += velocityRef.current * elapsed;
          velocityRef.current *= 0.94;
        } else {
          rotationRef.current += angularSpeed * elapsed;
        }
      }
      apply();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [radius, angularSpeed]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { active: true, x: event.clientX };
    velocityRef.current = 0;
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current.active) return;
    const dx = event.clientX - pointerRef.current.x;
    pointerRef.current.x = event.clientX;
    const movement = dx * 0.3 * sensitivity;
    rotationRef.current += movement;
    velocityRef.current = movement * 60;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerRef.current.active = false;
  };

  const face: CSSProperties = {
    position: "absolute", inset: 0, overflow: "hidden", borderRadius: cornerRadius,
    backfaceVisibility: "hidden", backgroundSize: "cover", backgroundPosition: "center",
  };

  return (
    <div
      role="group"
      aria-label="Interactive carousel of SewOps production views. Drag to spin."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ ...style, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background, perspective: `${perspective}px`, cursor: drag ? "grab" : "default", touchAction: drag ? "pan-y" : "auto" }}
    >
      <div style={{ transformStyle: "preserve-3d", transform: `rotateX(${tilt}deg)` }}>
        <div ref={ringRef} style={{ position: "relative", width: cardSize.width, height: cardSize.height, transformStyle: "preserve-3d" }}>
          {items.map((item, index) => (
            <article key={`${item.eyebrow}-${index}`} aria-label={`${item.eyebrow}: ${item.title.replace("\n", " ")}`} style={{ position: "absolute", inset: 0, transform: `rotateY(${index * angle}deg) translateZ(${radius}px)`, transformStyle: "preserve-3d" }}>
              <div style={{ ...face, backgroundImage: `url("${item.src}")`, boxShadow: "0 18px 44px rgba(33,25,18,.16)", border: "1px solid rgba(79,61,47,.16)" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(246,244,240,.05) 38%,rgba(246,244,240,.94) 100%)" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: cardSize.width < 200 ? 16 : 20, color: "#1b201f" }}>
                  <span style={{ fontFamily: "var(--font-geist-mono),monospace", fontSize: 9, letterSpacing: ".14em", color: item.tone, fontWeight: 600 }}>{item.eyebrow}</span>
                  <div>
                    <p style={{ whiteSpace: "pre-line", fontSize: cardSize.width < 200 ? 20 : 24, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-.04em" }}>{item.title}</p>
                    <div style={{ marginTop: 14, paddingTop: 11, borderTop: "1px solid rgba(40,36,32,.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-geist-mono),monospace", fontSize: 10, color: "#5f625d" }}>{item.metric}</span>
                      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: item.tone, boxShadow: `0 0 0 4px ${item.tone}20` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div aria-hidden="true" style={{ ...face, transform: "rotateY(180deg)", backgroundImage: `url("${item.src}")`, filter: `brightness(${innerDim / 10})`, border: "1px solid rgba(79,61,47,.12)" }} />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
