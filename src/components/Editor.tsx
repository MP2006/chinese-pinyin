"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { JSONContent } from "@tiptap/react";

interface EditorProps {
  onUpdate: (data: { text: string; json: JSONContent }) => void;
}

function ToolbarButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

export default function Editor({ onUpdate }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[120px] px-4 py-3 text-lg text-gray-900 dark:text-gray-100 outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate({
        text: editor.getText(),
        json: editor.getJSON(),
      });
    },
  });

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors dark:border-gray-700 dark:bg-gray-800">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-700">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
        >
          S
        </ToolbarButton>

        <div className="mx-1 w-px bg-gray-200 dark:bg-gray-700" />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
        >
          H
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
        >
          &ldquo; Quote
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
