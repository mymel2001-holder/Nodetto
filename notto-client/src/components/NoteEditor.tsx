import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useEffect, useRef } from "react";

type Props = {
  noteId: string;
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
};

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors select-none ${
        active
          ? "bg-slate-600 text-white"
          : "text-slate-400 hover:text-white hover:bg-slate-700"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-slate-700 mx-0.5 shrink-0" />;
}

export default function NoteEditor({ noteId, content, onChange, disabled }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(editor.getMarkdown());
      }, 400);
    },
  });

  // Reset content when switching to a different note
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [noteId]);

  // Sync disabled state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isDisabled = disabled || !editor;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-slate-700 flex-wrap shrink-0">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive("bold")}
          disabled={isDisabled}
          title="Bold (Ctrl+B)"
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive("italic")}
          disabled={isDisabled}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          active={editor?.isActive("strike")}
          disabled={isDisabled}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCode().run()}
          active={editor?.isActive("code")}
          disabled={isDisabled}
          title="Inline code"
        >
          {"<>"}
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor?.isActive("heading", { level: 1 })}
          disabled={isDisabled}
          title="Heading 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor?.isActive("heading", { level: 2 })}
          disabled={isDisabled}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor?.isActive("heading", { level: 3 })}
          disabled={isDisabled}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive("bulletList")}
          disabled={isDisabled}
          title="Bullet list"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive("orderedList")}
          disabled={isDisabled}
          title="Ordered list"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          active={editor?.isActive("blockquote")}
          disabled={isDisabled}
          title="Blockquote"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          active={editor?.isActive("codeBlock")}
          disabled={isDisabled}
          title="Code block"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={isDisabled || !editor?.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={isDisabled || !editor?.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-6 py-5
          [&_.ProseMirror]:outline-none [&_.ProseMirror]:h-full [&_.ProseMirror]:text-slate-300 [&_.ProseMirror]:text-[0.9375rem] [&_.ProseMirror]:leading-relaxed
          [&_.ProseMirror_p]:mb-2.5
          [&_.ProseMirror_h1]:text-[1.75rem] [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-slate-100 [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:mt-5
          [&_.ProseMirror_h2]:text-[1.375rem] [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:text-slate-100 [&_.ProseMirror_h2]:mb-2.5 [&_.ProseMirror_h2]:mt-4
          [&_.ProseMirror_h3]:text-[1.125rem] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-slate-100 [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-3.5
          [&_.ProseMirror_h1:first-child]:mt-0 [&_.ProseMirror_h2:first-child]:mt-0 [&_.ProseMirror_h3:first-child]:mt-0
          [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_strong]:text-slate-200
          [&_.ProseMirror_em]:italic [&_.ProseMirror_em]:text-slate-400
          [&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-slate-500
          [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[0.85em] [&_.ProseMirror_code]:bg-slate-800 [&_.ProseMirror_code]:text-blue-300 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5
          [&_.ProseMirror_pre]:bg-slate-800 [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-slate-700 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:mb-3 [&_.ProseMirror_pre]:overflow-x-auto
          [&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:text-slate-200 [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre_code]:text-sm
          [&_.ProseMirror_blockquote]:border-l-[3px] [&_.ProseMirror_blockquote]:border-slate-600 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-slate-500 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:mb-3
          [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-3
          [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-3
          [&_.ProseMirror_li]:mb-1
          [&_.ProseMirror_li_p]:mb-0
          [&_.ProseMirror_hr]:border-none [&_.ProseMirror_hr]:border-t [&_.ProseMirror_hr]:border-slate-700 [&_.ProseMirror_hr]:my-5
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-600 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}
