// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "../error";

describe("GlobalError", () => {
  it("renders error message and try again button", () => {
    const error = new Error("test error");
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("calls reset on button click", () => {
    const error = new Error("test error");
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
