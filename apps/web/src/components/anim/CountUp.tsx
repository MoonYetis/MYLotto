"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring, animate } from "framer-motion";

/**
 * Cuenta de 0 a `value` con animación suave cuando entra en el viewport.
 * Respeta prefers-reduced-motion (muestra el valor final inmediatamente).
 */
export function CountUp({
  value,
  duration = 2,
  decimals = 0,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });

  useEffect(() => {
    if (inView) {
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        motionValue.set(value);
      } else {
        animate(motionValue, value, { duration, ease: "easeOut" });
      }
    }
  }, [inView, value, duration, motionValue]);

  useEffect(() => {
    return spring.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = latest.toLocaleString("es", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      }
    });
  }, [spring, decimals]);

  return <span ref={ref} className={className}>0</span>;
}
