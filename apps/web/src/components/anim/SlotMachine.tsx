"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

/**
 * Muestra un número con efecto tragamonedas: cicla números rápidamente
 * y se detiene en el valor final cuando entra en viewport.
 */
export function SlotMachine({
  value,
  delay = 0,
  className,
}: {
  value: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplay(Math.floor(Math.random() * 69) + 1);
      }, 60);
      const stopTimer = setTimeout(() => {
        clearInterval(interval);
        setDisplay(value);
      }, 800 + delay);
      return () => {
        clearInterval(interval);
        clearTimeout(stopTimer);
      };
    }, delay);

    return () => clearTimeout(startTimer);
  }, [inView, value, delay]);

  return <span ref={ref} className={className}>{display}</span>;
}
