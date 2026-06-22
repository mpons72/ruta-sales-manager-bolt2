import { useEffect, useState } from "react";
import logoSalsa from "@/assets/logo-salsa.png";
import jalapenoMascot from "@/assets/jalapeno-mascot.png";

const TOTAL_MS = 2800;

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<"logo" | "pop" | "wave" | "out">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("pop"), 700);
    const t2 = setTimeout(() => setPhase("wave"), 1100);
    const t3 = setTimeout(() => setPhase("out"), TOTAL_MS - 400);
    const t4 = setTimeout(() => setVisible(false), TOTAL_MS);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  if (!visible) return null;

  const sparks = Array.from({ length: 16 });

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-400 ${
        phase === "out" ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: "var(--gradient-hero)" }}
      aria-hidden
    >
      {/* Logo de la marca — siempre visible */}
      <img
        src={logoSalsa}
        alt="Salsa Casera La Salsoa"
        className={`absolute w-[82%] max-w-md select-none drop-shadow-2xl transition-all duration-500 ease-out ${
          phase === "logo" ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        style={{ top: "22%" }}
        draggable={false}
      />

      {/* Origen del chile: lado derecho del logo (donde está el chile del logo) */}
      <div
        className="pointer-events-none absolute"
        style={{ top: "30%", right: "12%", width: 0, height: 0 }}
      >
        {/* Destello de explosión al salir */}
        <div
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-100 transition-all ${
            phase === "pop"
              ? "h-40 w-40 opacity-90 duration-200"
              : phase === "wave" || phase === "out"
              ? "h-64 w-64 opacity-0 duration-500"
              : "h-0 w-0 opacity-0 duration-100"
          }`}
          style={{ filter: "blur(10px)" }}
        />

        {/* Chispas */}
        {(phase === "pop" || phase === "wave") &&
          sparks.map((_, i) => {
            const angle = (i / sparks.length) * Math.PI * 2;
            const dist = 140 + (i % 3) * 40;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            const color = i % 2 ? "#fde047" : "#fb923c";
            return (
              <span
                key={i}
                className="absolute block h-2 w-2 rounded-full"
                style={{
                  background: color,
                  boxShadow: `0 0 10px ${color}`,
                  transform: `translate(${
                    phase === "pop" ? 0 : x
                  }px, ${phase === "pop" ? 0 : y}px) scale(${
                    phase === "wave" ? 0 : 1
                  })`,
                  opacity: phase === "wave" ? 0 : 1,
                  transition:
                    "transform 600ms cubic-bezier(.2,.7,.3,1), opacity 600ms ease-out",
                }}
              />
            );
          })}
      </div>

      {/* Chile mascota saliendo del logo */}
      <img
        src={jalapenoMascot}
        alt=""
        className="absolute select-none drop-shadow-2xl"
        style={{
          width: "55%",
          maxWidth: 280,
          top: "42%",
          left: "50%",
          transformOrigin: "bottom center",
          transform:
            phase === "logo"
              ? "translate(20%, -10%) scale(0) rotate(-30deg)"
              : phase === "pop"
              ? "translate(-50%, 0%) scale(1.1) rotate(-6deg)"
              : phase === "wave"
              ? "translate(-50%, 0%) scale(1) rotate(0deg)"
              : "translate(-50%, -4%) scale(1.05) rotate(0deg)",
          opacity: phase === "logo" ? 0 : 1,
          transition:
            "transform 500ms cubic-bezier(.34,1.56,.64,1), opacity 300ms ease-out",
          animation:
            phase === "wave" ? "salsoaWave 700ms ease-in-out 200ms" : undefined,
        }}
        draggable={false}
      />

      <style>{`
        @keyframes salsoaWave {
          0%, 100% { transform: translate(-50%, 0%) scale(1) rotate(0deg); }
          25% { transform: translate(-50%, -2%) scale(1.03) rotate(-5deg); }
          75% { transform: translate(-50%, -2%) scale(1.03) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
