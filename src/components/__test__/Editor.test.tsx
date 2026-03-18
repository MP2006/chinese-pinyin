// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Use vi.hoisted so the variables are available before vi.mock runs
const { mockEditor, mockSpeechSupported, mockClipboardSupported, mockOcrStatus } =
  vi.hoisted(() => ({
    mockEditor: { value: null as object | null },
    mockSpeechSupported: { value: false },
    mockClipboardSupported: { value: false },
    mockOcrStatus: { value: "idle" as string },
  }));

const mockRun = vi.fn();

function createEditorMock() {
  return {
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: mockRun }),
        toggleItalic: () => ({ run: mockRun }),
        toggleStrike: () => ({ run: mockRun }),
        toggleHeading: () => ({ run: mockRun }),
        toggleBulletList: () => ({ run: mockRun }),
        toggleOrderedList: () => ({ run: mockRun }),
        toggleBlockquote: () => ({ run: mockRun }),
        insertContent: () => ({ run: mockRun }),
      }),
    }),
    isActive: vi.fn().mockReturnValue(false),
    getText: vi.fn().mockReturnValue(""),
    getJSON: vi.fn().mockReturnValue({ type: "doc", content: [] }),
  };
}

vi.mock("@tiptap/react", () => ({
  useEditor: () => mockEditor.value,
  EditorContent: ({ editor }: { editor: unknown }) =>
    editor ? <div data-testid="editor-content">Editor</div> : null,
  JSONContent: {},
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: {},
}));

vi.mock("../SpeechPractice", () => ({
  isSpeechRecognitionSupported: () => mockSpeechSupported.value,
  default: () => <div>SpeechPractice</div>,
}));

const mockReadClipboardImage = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/screenCapture", () => ({
  isClipboardReadSupported: () => mockClipboardSupported.value,
  readClipboardImage: (...args: unknown[]) => mockReadClipboardImage(...args),
  getDroppedImage: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/apiUsage", () => ({
  logApiCall: vi.fn(),
}));

vi.mock("@/hooks/useOCR", () => ({
  useOCR: () => ({
    recognize: vi.fn().mockResolvedValue([]),
    status: mockOcrStatus.value,
  }),
  extractChineseLines: vi.fn().mockReturnValue([]),
}));

import Editor from "../Editor";

describe("Editor", () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    mockEditor.value = createEditorMock();
    mockSpeechSupported.value = false;
    mockClipboardSupported.value = false;
    mockOcrStatus.value = "idle";
    mockRun.mockClear();
    mockReadClipboardImage.mockReset().mockResolvedValue(null);
    onUpdate.mockClear();
  });

  it("returns null when useEditor returns null", () => {
    mockEditor.value = null;
    const { container } = render(<Editor onUpdate={onUpdate} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders toolbar buttons (B, I, S, H, lists, quote)", () => {
    render(<Editor onUpdate={onUpdate} />);

    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("I")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("• List")).toBeInTheDocument();
    expect(screen.getByText("1. List")).toBeInTheDocument();
  });

  it("mic button visible when SpeechRecognition supported", () => {
    mockSpeechSupported.value = true;
    render(<Editor onUpdate={onUpdate} />);

    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();
  });

  it("mic button hidden when SpeechRecognition not supported", () => {
    mockSpeechSupported.value = false;
    render(<Editor onUpdate={onUpdate} />);

    expect(screen.queryByLabelText("Start voice input")).not.toBeInTheDocument();
  });

  it("paste button visible when clipboard supported", () => {
    mockClipboardSupported.value = true;
    render(<Editor onUpdate={onUpdate} />);

    expect(
      screen.getByLabelText("Paste image from clipboard for OCR")
    ).toBeInTheDocument();
  });

  it("paste button hidden when clipboard not supported", () => {
    mockClipboardSupported.value = false;
    render(<Editor onUpdate={onUpdate} />);

    expect(
      screen.queryByLabelText("Paste image from clipboard for OCR")
    ).not.toBeInTheDocument();
  });

  it("OCR error shows message", async () => {
    mockClipboardSupported.value = true;
    render(<Editor onUpdate={onUpdate} />);

    const pasteBtn = screen.getByLabelText(
      "Paste image from clipboard for OCR"
    );
    fireEvent.mouseDown(pasteBtn);

    await screen.findByText("No image found in clipboard");
  });

  it("OCR loading state shows spinner text", () => {
    mockOcrStatus.value = "recognizing";
    render(<Editor onUpdate={onUpdate} />);

    expect(screen.getByText("Reading text from image...")).toBeInTheDocument();
  });

  it("drag overlay appears on dragEnter and disappears on dragLeave", () => {
    const { container } = render(<Editor onUpdate={onUpdate} />);

    // The outermost div with onDragEnter is the one with overflow-hidden class
    const editorWrapper = container.querySelector(".overflow-hidden")!;

    fireEvent.dragEnter(editorWrapper);

    expect(
      screen.getByText("Drop screenshot to extract Chinese text")
    ).toBeInTheDocument();

    fireEvent.dragLeave(editorWrapper);

    expect(
      screen.queryByText("Drop screenshot to extract Chinese text")
    ).not.toBeInTheDocument();
  });

  it("dismiss button clears OCR panel", async () => {
    mockClipboardSupported.value = true;
    render(<Editor onUpdate={onUpdate} />);

    // Trigger error to show panel
    const pasteBtn = screen.getByLabelText(
      "Paste image from clipboard for OCR"
    );
    fireEvent.mouseDown(pasteBtn);
    await screen.findByText("No image found in clipboard");

    // Click dismiss
    const dismissBtn = screen.getByLabelText("Dismiss");
    const user = userEvent.setup();
    await user.click(dismissBtn);

    expect(
      screen.queryByText("No image found in clipboard")
    ).not.toBeInTheDocument();
  });
});
