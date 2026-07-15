'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, List } from 'lucide-react'

interface Props {
  value: string
  onChange?: (html: string) => void
  readOnly?: boolean
  placeholder?: string
}

const contentCls = [
  'min-h-[88px] px-3 py-2 text-sm text-foreground focus:outline-none',
  '[&_p]:mb-1.5 [&_p:last-child]:mb-0',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-1.5',
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-1.5',
  '[&_strong]:font-semibold',
].join(' ')

export function RichTextEditor({ value, onChange, readOnly = false, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: contentCls,
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. loading a saved draft, switching steps)
  // without clobbering the cursor while the user is actively typing.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || ''
    if (current === next) return
    if (editor.isFocused) return
    editor.commands.setContent(next)
  }, [value, editor])

  useEffect(() => {
    if (editor) editor.setEditable(!readOnly)
  }, [readOnly, editor])

  if (!editor) {
    return <div className="rounded-xl border border-border bg-input min-h-[88px] animate-pulse" />
  }

  return (
    <div className="rounded-xl border border-border bg-input overflow-hidden focus-within:ring-2 focus-within:ring-primary">
      {!readOnly && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('bold') ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
            title="Bold"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('bulletList') ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
            title="Bullet List"
          >
            <List size={13} />
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
