// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PinyinDisplay from "../PinyinDisplay";
import type { JSONContent } from "@tiptap/react";

// Mock pinyin-pro: return simplified fake pinyin for each char
vi.mock("pinyin-pro", () => ({
  pinyin: (text: string, opts: { type: string }) => {
    if (opts.type === "array") {
      const map: Record<string, string> = {
        你: "nǐ",
        好: "hǎo",
        世: "shì",
        界: "jiè",
        中: "zhōng",
        国: "guó",
        人: "rén",
      };
      return Array.from(text).map((c) => map[c] || c);
    }
    return text;
  },
}));

function textDoc(text: string): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function markedDoc(text: string, marks: Array<{ type: string }>): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text, marks }],
      },
    ],
  };
}

describe("PinyinDisplay", () => {
  it("returns null for null doc", () => {
    const { container } = render(<PinyinDisplay doc={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows ruby pinyin annotations for Chinese text", () => {
    render(<PinyinDisplay doc={textDoc("你好")} />);

    const rubies = screen.getAllByText("nǐ");
    expect(rubies.length).toBeGreaterThanOrEqual(1);
    // The rt element should contain pinyin
    expect(document.querySelector("rt")?.textContent).toBeTruthy();
    // The ruby element should contain the character
    expect(document.querySelector("ruby")?.textContent).toContain("你");
  });

  it("renders non-Chinese text as plain span without ruby", () => {
    render(<PinyinDisplay doc={textDoc("Hello World")} />);

    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(document.querySelector("ruby")).toBeNull();
  });

  it("segments mixed Chinese/English correctly", () => {
    render(<PinyinDisplay doc={textDoc("你好world")} />);

    // Chinese part should have ruby
    expect(document.querySelector("ruby")).not.toBeNull();
    // English part should be plain
    expect(screen.getByText("world")).toBeInTheDocument();
  });

  it("word click fires onWordClick with word string", () => {
    const handleClick = vi.fn();
    render(<PinyinDisplay doc={textDoc("你好")} onWordClick={handleClick} />);

    // Click on the word span (has data-word attribute)
    const wordSpan = document.querySelector('[data-word="你好"]');
    expect(wordSpan).not.toBeNull();
    fireEvent.click(wordSpan!);

    expect(handleClick).toHaveBeenCalledWith("你好", expect.any(Object));
  });

  it("heading level 1 renders h1", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    render(<PinyinDisplay doc={doc} />);
    expect(document.querySelector("h1")).not.toBeNull();
    expect(document.querySelector("h1")?.textContent).toContain("Title");
  });

  it("heading level 2 renders h2", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Subtitle" }],
        },
      ],
    };
    render(<PinyinDisplay doc={doc} />);
    expect(document.querySelector("h2")).not.toBeNull();
  });

  it("heading level 3 renders h3", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Section" }],
        },
      ],
    };
    render(<PinyinDisplay doc={doc} />);
    expect(document.querySelector("h3")).not.toBeNull();
  });

  it("bullet list renders ul + li", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }],
                },
              ],
            },
          ],
        },
      ],
    };
    render(<PinyinDisplay doc={doc} />);
    expect(document.querySelector("ul")).not.toBeNull();
    expect(document.querySelector("li")).not.toBeNull();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
  });

  it("ordered list renders ol + li", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First" }],
                },
              ],
            },
          ],
        },
      ],
    };
    render(<PinyinDisplay doc={doc} />);
    expect(document.querySelector("ol")).not.toBeNull();
    expect(document.querySelector("li")).not.toBeNull();
  });

  it("bold mark wraps in strong", () => {
    render(<PinyinDisplay doc={markedDoc("bold text", [{ type: "bold" }])} />);
    expect(document.querySelector("strong")).not.toBeNull();
    expect(document.querySelector("strong")?.textContent).toContain(
      "bold text"
    );
  });

  it("italic mark wraps in em", () => {
    render(
      <PinyinDisplay doc={markedDoc("italic text", [{ type: "italic" }])} />
    );
    expect(document.querySelector("em")).not.toBeNull();
    expect(document.querySelector("em")?.textContent).toContain("italic text");
  });

  it("strike mark wraps in s", () => {
    render(
      <PinyinDisplay doc={markedDoc("struck text", [{ type: "strike" }])} />
    );
    expect(document.querySelector("s")).not.toBeNull();
    expect(document.querySelector("s")?.textContent).toContain("struck text");
  });

  it("blockquote renders blockquote", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quote text" }],
            },
          ],
        },
      ],
    };
    render(<PinyinDisplay doc={doc} />);
    expect(document.querySelector("blockquote")).not.toBeNull();
    expect(screen.getByText("Quote text")).toBeInTheDocument();
  });

  it("hard break renders br", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "before" },
            { type: "hardBreak" },
            { type: "text", text: "after" },
          ],
        },
      ],
    };
    render(<PinyinDisplay doc={doc} />);
    expect(document.querySelector("br")).not.toBeNull();
  });

  it("empty paragraph renders p with min-height", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
    render(<PinyinDisplay doc={doc} />);
    const p = document.querySelector("p");
    expect(p).not.toBeNull();
    expect(p?.className).toContain("min-h-[1em]");
  });

  it("multiple marks applied together (bold + italic)", () => {
    render(
      <PinyinDisplay
        doc={markedDoc("styled", [{ type: "bold" }, { type: "italic" }])}
      />
    );
    expect(document.querySelector("strong")).not.toBeNull();
    expect(document.querySelector("em")).not.toBeNull();
    // em should be inside strong (or vice versa)
    const strong = document.querySelector("strong")!;
    expect(strong.querySelector("em") || strong.closest("em")).not.toBeNull();
  });
});
