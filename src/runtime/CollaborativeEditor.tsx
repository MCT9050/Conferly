import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { useEffect, useMemo, useState } from 'react';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, CheckSquare,
  Highlighter, Heading1, Heading2, Undo2, Redo2, Users
} from 'lucide-react';

interface CollaborativeEditorProps {
  roomId: string;
}

export default function CollaborativeEditor({ roomId }: CollaborativeEditorProps) {
  const [connectedPeers, setConnectedPeers] = useState(0);

  const ydoc = useMemo(() => new Y.Doc(), []);

  const provider = useMemo(() => {
    const prov = new WebrtcProvider(`conferly-notes-${roomId}`, ydoc, {
      signaling: ['wss://signaling.yjs.dev'],
    });
    return prov;
  }, [ydoc, roomId]);

  useEffect(() => {
    const updatePeers = () => {
      setConnectedPeers(provider.awareness.getStates().size);
    };
    provider.awareness.on('change', updatePeers);
    updatePeers();
    return () => {
      provider.awareness.off('change', updatePeers);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs handles undo/redo via Collaboration extension
      }),
      Placeholder.configure({
        placeholder: 'Start typing collaborative notes…',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Typography,
      Collaboration.configure({
        document: ydoc,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between border-b border-slate-800/30 flex-wrap gap-1">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive('highlight')}
            title="Highlight"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Ordered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive('taskList')}
            title="Task List"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            active={false}
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            active={false}
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Users className="w-3 h-3" />
          <span>{connectedPeers} connected • Yjs sync</span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-blue-500/20 text-blue-400'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
      }`}
    >
      {children}
    </button>
  );
}
