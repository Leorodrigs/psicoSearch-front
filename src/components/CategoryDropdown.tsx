import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SearchCategory } from "../types";

interface CategoryDropdownProps {
  categories: SearchCategory[];
  selectedIds: string[];
  disabled?: boolean;
  onToggle: (id: string) => void;
}

export function CategoryDropdown({ categories, selectedIds, disabled = false, onToggle }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const summary = selectedIds.length === 0
    ? "Selecione"
    : `${selectedIds.length} selecionado${selectedIds.length === 1 ? "" : "s"}`;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative min-w-0 flex-1" ref={rootRef}>
      <button
        type="button"
        className="category-trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Categorias: ${summary}`}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{summary}</span>
        <ChevronDown aria-hidden="true" size={22} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="category-menu" role="group" aria-label="Categorias disponíveis">
          {categories.map((category) => {
            const checked = selectedIds.includes(category.id);
            return (
              <label className="category-option" key={category.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(category.id)}
                />
                <span>{category.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
