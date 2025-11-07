import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "../components/Breadcrumb";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("Breadcrumb Component", () => {
  it("should render breadcrumb items", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Drama", href: "/drama" },
      { label: "Episode 1", isActive: true },
    ];

    render(<Breadcrumb items={items} />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("Episode 1")).toBeInTheDocument();
  });

  it("should render links for non-active items", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Current", isActive: true },
    ];

    render(<Breadcrumb items={items} />);

    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("should not render link for active item", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Active", isActive: true },
    ];

    render(<Breadcrumb items={items} />);

    const activeItem = screen.getByText("Active");
    expect(activeItem.tagName).not.toBe("A");
  });
});
