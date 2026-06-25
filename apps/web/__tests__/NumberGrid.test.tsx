import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberGrid } from "@/components/wizard/NumberGrid";

describe("NumberGrid", () => {
  it("renderiza 69 botones de números", () => {
    render(<NumberGrid selected={[]} onToggle={vi.fn()} />);
    for (let i = 1; i <= 69; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("llama onToggle al click", () => {
    const onToggle = vi.fn();
    render(<NumberGrid selected={[]} onToggle={onToggle} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(69);
    fireEvent.click(buttons[4]!); // botón del número 5 (índice 4)
    expect(onToggle).toHaveBeenCalledWith(5);
  });

  it("deshabilita números cuando ya hay 5 seleccionados", () => {
    render(<NumberGrid selected={[1, 2, 3, 4, 5]} onToggle={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(69);
    expect(buttons[5]!).toBeDisabled(); // botón del número 6 (índice 5)
  });
});
