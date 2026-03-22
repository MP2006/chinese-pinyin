// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  SpeakerIcon,
  SpeakerWaveIcon,
  CloseIcon,
  CheckIcon,
  CheckCircleIcon,
  TrashIcon,
  PlusIcon,
} from "../Icons";

describe("Icons", () => {
  const icons = [
    { name: "SpeakerIcon", Component: SpeakerIcon, defaultClass: "h-3.5 w-3.5" },
    { name: "SpeakerWaveIcon", Component: SpeakerWaveIcon, defaultClass: "h-3.5 w-3.5" },
    { name: "CloseIcon", Component: CloseIcon, defaultClass: "h-4 w-4" },
    { name: "CheckIcon", Component: CheckIcon, defaultClass: "h-4 w-4" },
    { name: "CheckCircleIcon", Component: CheckCircleIcon, defaultClass: "h-12 w-12" },
    { name: "TrashIcon", Component: TrashIcon, defaultClass: "h-4 w-4" },
    { name: "PlusIcon", Component: PlusIcon, defaultClass: "h-4 w-4" },
  ];

  for (const { name, Component, defaultClass } of icons) {
    it(`${name} renders an SVG with default className`, () => {
      const { container } = render(<Component />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass(...defaultClass.split(" "));
    });
  }

  it("accepts custom className", () => {
    const { container } = render(<SpeakerIcon className="h-8 w-8 text-red-500" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-8", "w-8", "text-red-500");
  });
});
