import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PowerballGrid } from "@/components/wizard/PowerballGrid";

describe("PowerballGrid", () => {
  it("renderiza 26 botones", () => {
    render(<PowerballGrid selected={null} onSelect={vi.fn()} />);
    for (let i = 1; i <= 26; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("llama onSelect al click", () => {
    const onSelect = vi.fn();
    render(<PowerballGrid selected={null} onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(26);
    fireEvent.click(buttons[12]!); // botón del número 13 (índice 12)
    expect(onSelect).toHaveBeenCalledWith(13);
  });
});
