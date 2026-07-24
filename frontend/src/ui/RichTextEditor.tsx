import { Extension, mergeAttributes, type Editor } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import FileHandler from "@tiptap/extension-file-handler";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Paperclip,
  Quote,
  Redo2,
  Smile,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import type { NewsUploadPublic } from "../api/types";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  allowUploads?: boolean;
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const emojiOptions = [
  "😀", "😊", "😂", "😍", "👍", "👏", "🎉", "⭐",
  "❤️", "💡", "✅", "📌", "📣", "🚀", "🤝", "💼",
  "📚", "🏆", "🔥", "⚡", "🎯", "📅", "📎", "🔔",
];

const fontOptions = [
  { label: "Основной", value: "" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Verdana", value: "Verdana" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Courier New", value: "Courier New" },
];

const fontSizeOptions = [
  { label: "Размер", value: "" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "24", value: "24px" },
  { label: "32", value: "32px" },
];

const lineHeightOptions = [
  { label: "Интервал", value: "" },
  { label: "1", value: "1" },
  { label: "1,25", value: "1.25" },
  { label: "1,5", value: "1.5" },
  { label: "1,75", value: "1.75" },
  { label: "2", value: "2" },
];

const Indent = Extension.create({
  name: "indent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => Number(element.getAttribute("data-indent") || 0),
            renderHTML: (attributes) =>
              attributes.indent
                ? { "data-indent": String(Math.min(4, Math.max(0, Number(attributes.indent)))) }
                : {},
          },
        },
      },
    ];
  },
});

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align || "center" }),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },
}).configure({
  allowBase64: false,
  resize: {
    enabled: true,
    directions: ["bottom-left", "bottom-right", "top-left", "top-right"],
    minWidth: 80,
    minHeight: 60,
    alwaysPreserveAspectRatio: true,
  },
});

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`tiptapToolButton ${active ? "tiptapToolButtonActive" : ""}`}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Начните вводить текст публикации...",
  maxLength,
  allowUploads = true,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function uploadFiles(editor: Editor, files: File[], position?: number) {
    const accepted = files.filter((file) => allowedImageTypes.includes(file.type));
    if (!accepted.length) {
      setUploadError("Поддерживаются изображения JPEG, PNG, WebP и GIF.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      for (const file of accepted) {
        const form = new FormData();
        form.append("file", file);
        const uploaded = await apiFetch<NewsUploadPublic>("/news/uploads", {
          method: "POST",
          body: form,
        });
        const imageNode = {
          type: "image",
          attrs: {
            src: uploaded.url,
            alt: uploaded.name,
            title: uploaded.name,
            align: "center",
          },
        };
        if (position === undefined) {
          editor.chain().focus().insertContent(imageNode).run();
        } else {
          editor.chain().focus().insertContentAt(position, imageNode).run();
          position += 1;
        }
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Не удалось загрузить изображение.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadAttachment(editor: Editor, file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await apiFetch<NewsUploadPublic>("/news/uploads", {
        method: "POST",
        body: form,
      });
      if (uploaded.is_image) {
        editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name, title: uploaded.name }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent(`<p><a href="${escapeAttribute(uploaded.url)}" target="_blank" rel="noopener noreferrer">Файл: ${escapeHtml(uploaded.name)}</a></p>`)
          .run();
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          autolink: true,
          defaultProtocol: "https",
          openOnClick: false,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      ResizableImage,
      Placeholder.configure({ placeholder }),
      CharacterCount.configure(maxLength ? { limit: maxLength } : {}),
      Typography,
      Indent,
      ...(allowUploads
        ? [
            FileHandler.configure({
              allowedMimeTypes: allowedImageTypes,
              consumePasteEvent: true,
              onPaste: (currentEditor, files) => {
                void uploadFiles(currentEditor, files);
              },
              onDrop: (currentEditor, files, position) => {
                void uploadFiles(currentEditor, files, position);
              },
            }),
          ]
        : []),
    ],
    content: normalizeEditorContent(value),
    editorProps: {
      attributes: {
        class: "tiptapEditorSurface",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEditorState({
    editor,
    selector: ({ transactionNumber }) => transactionNumber,
  });

  useEffect(() => {
    const normalizedValue = normalizeEditorContent(value);
    if (!editor || editor.getHTML() === normalizedValue) return;
    editor.commands.setContent(normalizedValue, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("tiptapFullscreenOpen");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("tiptapFullscreenOpen");
    };
  }, [isFullscreen]);

  if (!editor) {
    return <div className="tiptapEditorLoading">Загружаем редактор...</div>;
  }

  const setLink = () => {
    const currentHref = editor.getAttributes("link").href as string | undefined;
    const rawUrl = window.prompt("Введите адрес ссылки", currentHref || "https://");
    if (rawUrl === null) return;
    const url = normalizeUrl(rawUrl);
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const updateIndent = (delta: number) => {
    if (editor.isActive("listItem")) {
      if (delta > 0) editor.chain().focus().sinkListItem("listItem").run();
      else editor.chain().focus().liftListItem("listItem").run();
      return;
    }
    const nodeName = editor.isActive("heading") ? "heading" : "paragraph";
    const currentIndent = Number(editor.getAttributes(nodeName).indent || 0);
    editor.chain().focus().updateAttributes(nodeName, { indent: Math.min(4, Math.max(0, currentIndent + delta)) }).run();
  };

  const updateImageAlt = () => {
    const currentAlt = String(editor.getAttributes("image").alt || "");
    const alt = window.prompt("Альтернативный текст изображения", currentAlt);
    if (alt !== null) editor.chain().focus().updateAttributes("image", { alt: alt.trim() }).run();
  };

  const textStyle = editor.getAttributes("textStyle");
  const characters = editor.storage.characterCount.characters();

  return (
    <div className={`tiptapEditor ${isFullscreen ? "tiptapEditorFullscreen" : ""}`}>
      <div className="tiptapToolbar" role="toolbar" aria-label="Инструменты визуального редактора">
        <div className="tiptapToolbarGroup">
          <select
            className="tiptapSelect tiptapBlockSelect"
            aria-label="Тип текста"
            value={
              editor.isActive("heading", { level: 1 }) ? "h1"
                : editor.isActive("heading", { level: 2 }) ? "h2"
                  : editor.isActive("heading", { level: 3 }) ? "h3"
                    : "paragraph"
            }
            onChange={(event) => {
              const block = event.target.value;
              if (block === "paragraph") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: Number(block.slice(1)) as 1 | 2 | 3 }).run();
            }}
          >
            <option value="paragraph">Обычный текст</option>
            <option value="h1">Заголовок 1</option>
            <option value="h2">Заголовок 2</option>
            <option value="h3">Заголовок 3</option>
          </select>
          <select
            className="tiptapSelect"
            aria-label="Шрифт"
            value={String(textStyle.fontFamily || "")}
            onChange={(event) => {
              if (event.target.value) editor.chain().focus().setFontFamily(event.target.value).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
          >
            {fontOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
          <select
            className="tiptapSelect tiptapSmallSelect"
            aria-label="Размер шрифта"
            value={String(textStyle.fontSize || "")}
            onChange={(event) => {
              if (event.target.value) editor.chain().focus().setFontSize(event.target.value).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
          >
            {fontSizeOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="tiptapToolbarGroup">
          <ToolbarButton label="Полужирный (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></ToolbarButton>
          <ToolbarButton label="Курсив (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></ToolbarButton>
          <ToolbarButton label="Подчеркнуть (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline /></ToolbarButton>
          <ToolbarButton label="Зачеркнуть" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></ToolbarButton>
          <label className="tiptapColorControl" title="Цвет текста">
            <span className="tiptapColorGlyph">A</span>
            <input
              type="color"
              aria-label="Цвет текста"
              value={String(textStyle.color || "#071f3d")}
              onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            />
          </label>
          <label className="tiptapColorControl" title="Цвет выделения">
            <Highlighter />
            <input
              type="color"
              aria-label="Цвет выделения"
              value={String(textStyle.backgroundColor || "#fff2a8")}
              onChange={(event) => editor.chain().focus().setBackgroundColor(event.target.value).run()}
            />
          </label>
          <ToolbarButton label="Очистить форматирование" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser /></ToolbarButton>
        </div>

        <div className="tiptapToolbarGroup">
          <ToolbarButton label="Маркированный список" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolbarButton>
          <ToolbarButton label="Нумерованный список" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
          <ToolbarButton label="Цитата" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></ToolbarButton>
          <ToolbarButton label="Горизонтальная линия" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></ToolbarButton>
          <ToolbarButton label="Уменьшить отступ" onClick={() => updateIndent(-1)}><IndentDecrease /></ToolbarButton>
          <ToolbarButton label="Увеличить отступ" onClick={() => updateIndent(1)}><IndentIncrease /></ToolbarButton>
        </div>

        <div className="tiptapToolbarGroup">
          <ToolbarButton label="По левому краю" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft /></ToolbarButton>
          <ToolbarButton label="По центру" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter /></ToolbarButton>
          <ToolbarButton label="По правому краю" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight /></ToolbarButton>
          <ToolbarButton label="По ширине" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify /></ToolbarButton>
          <select
            className="tiptapSelect tiptapSmallSelect"
            aria-label="Межстрочный интервал"
            value={String(textStyle.lineHeight || "")}
            onChange={(event) => {
              if (event.target.value) editor.chain().focus().setLineHeight(event.target.value).run();
              else editor.chain().focus().unsetLineHeight().run();
            }}
          >
            {lineHeightOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="tiptapToolbarGroup">
          <ToolbarButton label="Добавить или изменить ссылку" active={editor.isActive("link")} onClick={setLink}><Link2 /></ToolbarButton>
          <ToolbarButton label="Удалить ссылку" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}><Unlink /></ToolbarButton>
          {allowUploads && (
            <>
              <ToolbarButton label="Добавить изображение" disabled={uploading} onClick={() => imageInputRef.current?.click()}><ImagePlus /></ToolbarButton>
              <ToolbarButton label="Прикрепить файл" disabled={uploading} onClick={() => fileInputRef.current?.click()}><Paperclip /></ToolbarButton>
            </>
          )}
          <div className="tiptapEmojiWrap">
            <ToolbarButton label="Добавить смайлик" active={showEmoji} onClick={() => setShowEmoji((current) => !current)}><Smile /></ToolbarButton>
            {showEmoji && (
              <div className="tiptapEmojiPicker">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Добавить ${emoji}`}
                    onClick={() => {
                      editor.chain().focus().insertContent(emoji).run();
                      setShowEmoji(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="tiptapToolbarGroup tiptapToolbarEnd">
          <ToolbarButton label="Отменить (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></ToolbarButton>
          <ToolbarButton label="Повторить (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></ToolbarButton>
          <ToolbarButton label={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"} onClick={() => setIsFullscreen((current) => !current)}>
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </ToolbarButton>
        </div>
      </div>

      {allowUploads && editor.isActive("image") && (
        <div className="tiptapImageToolbar">
          <span>Изображение</span>
          <button type="button" onClick={updateImageAlt}>Альтернативный текст</button>
          <button type="button" onClick={() => editor.chain().focus().updateAttributes("image", { align: "left" }).run()}>Слева</button>
          <button type="button" onClick={() => editor.chain().focus().updateAttributes("image", { align: "center" }).run()}>По центру</button>
          <button type="button" onClick={() => editor.chain().focus().updateAttributes("image", { align: "right" }).run()}>Справа</button>
          <button type="button" className="tiptapImageDelete" onClick={() => editor.chain().focus().deleteSelection().run()}><Trash2 /> Удалить</button>
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="tiptapEditorFooter">
        <span>{allowUploads && uploading ? "Загружаем файл..." : uploadError || "Форматирование отображается сразу"}</span>
        <span className={maxLength && characters >= maxLength ? "tiptapCountLimit" : ""}>
          {characters}{maxLength ? ` / ${maxLength}` : ""} символов
        </span>
      </div>

      {allowUploads && (
        <>
          <input
            ref={imageInputRef}
            type="file"
            accept={allowedImageTypes.join(",")}
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = "";
              if (files.length) void uploadFiles(editor, files);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadAttachment(editor, file);
            }}
          />
        </>
      )}
    </div>
  );
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEditorContent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return trimmed;

  const blocks: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listType || !listItems.length) return;
    blocks.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join("")}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push(`<h${heading[1].length}>${formatLegacyInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushList();
      blocks.push(`<blockquote><p>${formatLegacyInline(quote[1])}</p></blockquote>`);
      continue;
    }

    const listItem = line.match(/^(\d+[.)]|[•●▪◦\-–—])\s*(.+)$/);
    if (listItem) {
      const nextType = /^\d/.test(listItem[1]) ? "ol" : "ul";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push(formatLegacyInline(listItem[2]));
      continue;
    }

    flushList();
    blocks.push(`<p>${formatLegacyInline(line)}</p>`);
  }

  flushList();
  return blocks.join("");
}

function formatLegacyInline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
