"use client";

import RoundCarousel from "@/components/marketing/RoundCarousel";

export default function FloorCarousel() {
  return (
    <section id="floor" className="overflow-hidden py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-4">
        <div className="max-w-lg">
          <p className="font-data text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
            One connected floor
          </p>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-tight md:text-5xl">
            Every shift has a clearer picture.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-[var(--muted)]">
            From the first piece to the final report, SewOps brings production, work orders, machine health and quality into one shared view.
          </p>
          <div className="mt-8 flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="flex -space-x-1.5" aria-hidden="true">
              {["#c85a3a", "#70856d", "#bd8b55", "#657b92"].map((tone) => (
                <span key={tone} className="h-3 w-3 rounded-full border-2 border-[var(--bg)]" style={{ background: tone }} />
              ))}
            </span>
            <span>Drag the collection to explore the floor</span>
          </div>
        </div>
        <div className="relative h-[360px] sm:h-[430px] lg:-mr-16">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[var(--bg)] to-transparent sm:w-20" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[var(--bg)] to-transparent sm:w-20" />
          <RoundCarousel
            imageWidth={260}
            imageHeight={330}
            spacing={2.4}
            speed={2.6}
            direction="right"
            tilt={-7}
            perspective={1800}
            drag
            sensitivity={5}
            cornerRadius={18}
            innerDim={3.5}
          />
        </div>
      </div>
    </section>
  );
}
