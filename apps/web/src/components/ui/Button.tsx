import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: "bg-gold text-background hover:brightness-110 font-bold",
  secondary: "bg-background-card text-muted-light hover:bg-border",
  danger: "bg-red text-white hover:brightness-110 font-bold",
  ghost: "bg-transparent text-muted-light hover:text-gold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = "Button";
