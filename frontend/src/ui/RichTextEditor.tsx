import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import type { NewsUploadPublic } from "../api/types";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);

  function rememberSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (selectionRef.current) {
      selection.addRange(selectionRef.current);
    }
  }

  function syncValue() {
    const editor = editorRef.current;
    if (!editor) return;
    rememberSelection();
    onChange(editor.innerHTML);
  }

  function runCommand(command: string, argument?: string) {
    restoreSelection();
    document.execCommand(command, false, argument);
    syncValue();
  }

  function insertHtml(html: string) {
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    syncValue();
  }

  function addLink() {
    rememberSelection();
    const rawUrl = window.prompt("Введите ссылку");
    if (!rawUrl) return;
    const url = normalizeUrl(rawUrl);
    const selectedText = window.getSelection()?.toString().trim() || url;
    insertHtml(`<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(selectedText)}</a>`);
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const uploaded = await apiFetch<NewsUploadPublic>("/news/uploads", {
        method: "POST",
        body: form,
      });
      if (uploaded.is_image) {
        insertHtml(
          `<figure><img src="${escapeAttribute(uploaded.url)}" alt="${escapeAttribute(uploaded.name)}"><figcaption>${escapeHtml(uploaded.name)}</figcaption></figure>`,
        );
      } else {
        insertHtml(
          `<p><a href="${escapeAttribute(uploaded.url)}" target="_blank" rel="noopener noreferrer">Файл: ${escapeHtml(uploaded.name)}</a></p>`,
        );
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="richEditor">
      <div className="richEditorToolbar" onMouseDown={(event) => event.preventDefault()}>
        <button className="richEditorButton" type="button" onClick={() => runCommand("bold")}>
          B
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("italic")}>
          I
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("underline")}>
          U
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("strikeThrough")}>
          S
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("formatBlock", "h2")}>
          H2
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("formatBlock", "h3")}>
          H3
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("insertUnorderedList")}>
          Список
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("insertOrderedList")}>
          1.2.
        </button>
        <button className="richEditorButton" type="button" onClick={() => runCommand("formatBlock", "blockquote")}>
          Цитата
        </button>
        <button className="richEditorButton" type="button" onClick={addLink}>
          Ссылка
        </button>
        <button className="richEditorButton" type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
          Картинка
        </button>
        <button className="richEditorButton" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          Файл
        </button>
      </div>

      <div
        ref={editorRef}
        className="richEditorSurface"
        contentEditable
        data-placeholder={placeholder}
        onInput={syncValue}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onFocus={rememberSelection}
        suppressContentEditableWarning
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadFile(file);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadFile(file);
        }}
      />
      {uploading && <div className="richEditorStatus">Загрузка файла...</div>}
    </div>
  );
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
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

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
