// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Hoisted mutable mocks for values that change between tests
const {
  mockEditor,
  mockSpeechSupported,
  mockClipboardSupported,
  mockOcrStatus,
} = vi.hoisted(() => ({
  mockEditor: { value: null as object | null },
  mockSpeechSupported: { value: false },
  mockClipboardSupported: { value: false },
  mockOcrStatus: { value: "idle" as string },
}));

const mockRun = vi.fn();
const mockRecognize = vi.fn().mockResolvedValue([]);
const mockExtractChineseLines = vi.fn().mockReturnValue([]);
const mockReadClipboardImage = vi.fn().mockResolvedValue(null);
const mockGetDroppedImage = vi.fn().mockReturnValue(null);
const mockOnCreate = vi.fn();

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
  useEditor: (config: Record<string, unknown>) => {
    // Capture onCreate for testing initialContent
    if (config?.onCreate) mockOnCreate.mockImplementation(config.onCreate);
    return mockEditor.value;
  },
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

vi.mock("@/lib/screenCapture", () => ({
  isClipboardReadSupported: () => mockClipboardSupported.value,
  readClipboardImage: (...args: unknown[]) => mockReadClipboardImage(...args),
  getDroppedImage: (...args: unknown[]) => mockGetDroppedImage(...args),
}));

vi.mock("@/lib/apiUsage", () => ({
  logApiCall: vi.fn(),
}));

vi.mock("@/hooks/useOCR", () => ({
  useOCR: () => ({
    recognize: (...args: unknown[]) => mockRecognize(...args),
    status: mockOcrStatus.value,
  }),
  extractChineseLines: (...args: unknown[]) =>
    mockExtractChineseLines(...args),
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
    mockOnCreate.mockReset();
    mockReadClipboardImage.mockReset().mockResolvedValue(null);
    mockGetDroppedImage.mockReset().mockReturnValue(null);
    mockRecognize.mockReset().mockResolvedValue([]);
    mockExtractChineseLines.mockReset().mockReturnValue([]);
    onUpdate.mockClear();

    // Mock URL.createObjectURL / revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url") as never;
    globalThis.URL.revokeObjectURL = vi.fn() as never;

    // Mock Image constructor that auto-fires onload
    vi.stubGlobal(
      "Image",
      class MockImage {
        naturalWidth = 800;
        naturalHeight = 600;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src = "";
        get src() {
          return this._src;
        }
        set src(val: string) {
          this._src = val;
          Promise.resolve().then(() => this.onload?.());
        }
      }
    );
  });

  // --- Basic rendering ---

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

  // --- Toolbar button clicks ---

  it("Bold button triggers toggleBold", () => {
    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByText("B"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("Italic button triggers toggleItalic", () => {
    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByText("I"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("Strike button triggers toggleStrike", () => {
    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByText("S"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("Heading button triggers toggleHeading", () => {
    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByText("H"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("Bullet list button triggers toggleBulletList", () => {
    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByText("• List"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("Ordered list button triggers toggleOrderedList", () => {
    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByText("1. List"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("Quote button triggers toggleBlockquote", () => {
    render(<Editor onUpdate={onUpdate} />);
    // The quote button renders as \u201c Quote (left double quotation mark)
    const quoteBtn = screen.getByText(/Quote/);
    fireEvent.mouseDown(quoteBtn);
    expect(mockRun).toHaveBeenCalled();
  });

  it("toolbar button shows active state", () => {
    const editorMock = createEditorMock();
    editorMock.isActive.mockImplementation(
      (type: string) => type === "bold"
    );
    mockEditor.value = editorMock;

    render(<Editor onUpdate={onUpdate} />);
    const boldBtn = screen.getByText("B");
    expect(boldBtn).toHaveClass("bg-primary");
  });

  // --- Mic button ---

  it("mic button visible when SpeechRecognition supported", () => {
    mockSpeechSupported.value = true;
    render(<Editor onUpdate={onUpdate} />);
    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();
  });

  it("mic button hidden when SpeechRecognition not supported", () => {
    mockSpeechSupported.value = false;
    render(<Editor onUpdate={onUpdate} />);
    expect(
      screen.queryByLabelText("Start voice input")
    ).not.toBeInTheDocument();
  });

  it("speech recognition start and stop", () => {
    mockSpeechSupported.value = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let instance: any;
    const MockSR = class {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn(() => {
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.onend?.();
      });
      abort = vi.fn();
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        instance = this;
      }
    };
    vi.stubGlobal("SpeechRecognition", MockSR);

    render(<Editor onUpdate={onUpdate} />);

    // Start
    fireEvent.mouseDown(screen.getByLabelText("Start voice input"));
    expect(instance.start).toHaveBeenCalled();

    // Should now show "Stop voice input"
    expect(screen.getByLabelText("Stop voice input")).toBeInTheDocument();

    // Stop
    fireEvent.mouseDown(screen.getByLabelText("Stop voice input"));
    expect(instance.stop).toHaveBeenCalled();

    // Should show "Start voice input" again
    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();
  });

  it("speech recognition inserts Chinese transcript", () => {
    mockSpeechSupported.value = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let instance: any;
    const MockSR = class {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn(() => {
        this.onstart?.();
      });
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        instance = this;
      }
    };
    vi.stubGlobal("SpeechRecognition", MockSR);

    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByLabelText("Start voice input"));

    // Simulate a speech result with CJK text
    act(() => {
      instance.onresult?.({
        results: [
          {
            isFinal: true,
            0: { transcript: "你好世界" },
            length: 1,
          },
        ],
      });
    });

    expect(mockRun).toHaveBeenCalled();
  });

  it("speech recognition onerror resets state", () => {
    mockSpeechSupported.value = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let instance: any;
    const MockSR = class {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn(() => {
        this.onstart?.();
      });
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        instance = this;
      }
    };
    vi.stubGlobal("SpeechRecognition", MockSR);

    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(screen.getByLabelText("Start voice input"));
    expect(screen.getByLabelText("Stop voice input")).toBeInTheDocument();

    // Simulate error
    act(() => {
      instance.onerror?.();
    });

    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();
  });

  // --- Paste / Clipboard ---

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

  it("OCR error shows message when clipboard has no image", async () => {
    mockClipboardSupported.value = true;
    render(<Editor onUpdate={onUpdate} />);

    const pasteBtn = screen.getByLabelText(
      "Paste image from clipboard for OCR"
    );
    fireEvent.mouseDown(pasteBtn);

    await screen.findByText("No image found in clipboard");
  });

  it("OCR shows error when no text detected", async () => {
    mockClipboardSupported.value = true;
    const blob = new Blob(["fake"], { type: "image/png" });
    mockReadClipboardImage.mockResolvedValue(blob);
    mockRecognize.mockResolvedValue([]);

    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(
      screen.getByLabelText("Paste image from clipboard for OCR")
    );

    await screen.findByText("No text detected in image");
  });

  it("OCR shows error when no Chinese characters found", async () => {
    mockClipboardSupported.value = true;
    const blob = new Blob(["fake"], { type: "image/png" });
    mockReadClipboardImage.mockResolvedValue(blob);
    mockRecognize.mockResolvedValue([
      { text: "hello", confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 30 } },
    ]);
    mockExtractChineseLines.mockReturnValue([]);

    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(
      screen.getByLabelText("Paste image from clipboard for OCR")
    );

    await screen.findByText("No Chinese characters found in image");
  });

  it("OCR full flow: clipboard → preview → insert line", async () => {
    mockClipboardSupported.value = true;
    const blob = new Blob(["fake"], { type: "image/png" });
    mockReadClipboardImage.mockResolvedValue(blob);

    const ocrLines = [
      {
        text: "你好",
        confidence: 95,
        bbox: { x0: 10, y0: 20, x1: 100, y1: 50 },
      },
      {
        text: "世界",
        confidence: 90,
        bbox: { x0: 10, y0: 60, x1: 100, y1: 90 },
      },
    ];
    mockRecognize.mockResolvedValue(ocrLines);
    mockExtractChineseLines.mockReturnValue(ocrLines);

    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(
      screen.getByLabelText("Paste image from clipboard for OCR")
    );

    // Wait for preview to appear
    await screen.findByText("Click highlighted text to insert");

    // Overlay buttons with line text as title
    expect(screen.getByTitle("你好")).toBeInTheDocument();
    expect(screen.getByTitle("世界")).toBeInTheDocument();

    // Click to insert first line
    fireEvent.click(screen.getByTitle("你好"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("Insert all inserts remaining lines", async () => {
    mockClipboardSupported.value = true;
    const blob = new Blob(["fake"], { type: "image/png" });
    mockReadClipboardImage.mockResolvedValue(blob);

    const ocrLines = [
      {
        text: "你好",
        confidence: 95,
        bbox: { x0: 10, y0: 20, x1: 100, y1: 50 },
      },
      {
        text: "世界",
        confidence: 90,
        bbox: { x0: 10, y0: 60, x1: 100, y1: 90 },
      },
    ];
    mockRecognize.mockResolvedValue(ocrLines);
    mockExtractChineseLines.mockReturnValue(ocrLines);

    render(<Editor onUpdate={onUpdate} />);
    fireEvent.mouseDown(
      screen.getByLabelText("Paste image from clipboard for OCR")
    );

    await screen.findByText("Insert all");
    fireEvent.click(screen.getByText("Insert all"));
    expect(mockRun).toHaveBeenCalled();
  });

  // --- OCR loading states ---

  it("OCR loading state shows recognizing text", () => {
    mockOcrStatus.value = "recognizing";
    render(<Editor onUpdate={onUpdate} />);
    expect(
      screen.getByText("Reading text from image...")
    ).toBeInTheDocument();
  });

  it("OCR loading state shows recognizing text for any busy status", () => {
    mockOcrStatus.value = "recognizing";
    render(<Editor onUpdate={onUpdate} />);
    expect(
      screen.getByText("Reading text from image...")
    ).toBeInTheDocument();
  });

  // --- Drag & Drop ---

  it("drag overlay appears on dragEnter and disappears on dragLeave", () => {
    const { container } = render(<Editor onUpdate={onUpdate} />);
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

  it("dragOver prevents default", () => {
    const { container } = render(<Editor onUpdate={onUpdate} />);
    const editorWrapper = container.querySelector(".overflow-hidden")!;

    const event = new Event("dragover", { bubbles: true, cancelable: true });
    const prevented = !editorWrapper.dispatchEvent(event);
    expect(prevented).toBe(true);
  });

  it("drop triggers OCR when file is dropped", async () => {
    const blob = new Blob(["fake"], { type: "image/png" });
    mockGetDroppedImage.mockReturnValue(blob);

    const ocrLines = [
      {
        text: "测试",
        confidence: 95,
        bbox: { x0: 10, y0: 20, x1: 100, y1: 50 },
      },
    ];
    mockRecognize.mockResolvedValue(ocrLines);
    mockExtractChineseLines.mockReturnValue(ocrLines);

    const { container } = render(<Editor onUpdate={onUpdate} />);
    const editorWrapper = container.querySelector(".overflow-hidden")!;

    // Enter drag then drop
    fireEvent.dragEnter(editorWrapper);
    fireEvent.drop(editorWrapper);

    await screen.findByText("Click highlighted text to insert");
    expect(screen.getByTitle("测试")).toBeInTheDocument();
  });

  it("drop is ignored when OCR is busy", () => {
    mockOcrStatus.value = "recognizing";
    const blob = new Blob(["fake"], { type: "image/png" });
    mockGetDroppedImage.mockReturnValue(blob);

    const { container } = render(<Editor onUpdate={onUpdate} />);
    const editorWrapper = container.querySelector(".overflow-hidden")!;

    fireEvent.drop(editorWrapper);

    // recognize should not be called again
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  // --- Dismiss ---

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
