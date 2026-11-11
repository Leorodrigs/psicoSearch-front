import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryDropdown } from "./CategoryDropdown";

const categories = [
  { id: "psychology-clinic", label: "Clínica de Psicologia" },
  { id: "psychiatric-clinic", label: "Clínica Psiquiátrica" }
];

describe("CategoryDropdown", () => {
  it("keeps the menu open while selecting multiple categories and shows the selected count", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(
      <CategoryDropdown categories={categories} selectedIds={[]} onToggle={onToggle} />
    );

    await user.click(screen.getByRole("button", { name: "Categorias: Selecione" }));
    await user.click(screen.getByLabelText("Clínica de Psicologia"));
    expect(screen.getByRole("group", { name: "Categorias disponíveis" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Clínica Psiquiátrica"));

    expect(onToggle).toHaveBeenNthCalledWith(1, "psychology-clinic");
    expect(onToggle).toHaveBeenNthCalledWith(2, "psychiatric-clinic");
    rerender(
      <CategoryDropdown
        categories={categories}
        selectedIds={["psychology-clinic", "psychiatric-clinic"]}
        onToggle={onToggle}
      />
    );
    expect(screen.getByRole("button", { name: "Categorias: 2 selecionados" })).toBeInTheDocument();
  });

  it("closes on Escape and when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CategoryDropdown categories={categories} selectedIds={[]} onToggle={vi.fn()} />
        <button type="button">Fora</button>
      </>
    );
    const trigger = screen.getByRole("button", { name: "Categorias: Selecione" });
    await user.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("group", { name: "Categorias disponíveis" })).not.toBeInTheDocument());

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Fora" }));
    expect(screen.queryByRole("group", { name: "Categorias disponíveis" })).not.toBeInTheDocument();
  });
});
