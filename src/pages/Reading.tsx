import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronRight, Folder as FolderIcon, FolderInput, Home, MoreHorizontal, Pencil, Plus, Search, Trash2, Undo2, CheckCheck } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { ReadingBook, ReadingFolder } from '../supabase'
import { Input } from '../components/ui/input'
import { Fab } from '../components/ui/fab'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select'
import { haptic } from '../lib/haptics'
import { cn } from '../utils'
import BookCard from '../features/reading/BookCard'
import AddSheet from '../features/reading/AddSheet'
import ActionsDrawer, { type DrawerAction } from '../features/reading/ActionsDrawer'
import BookSearchDrawer from '../features/reading/BookSearchDrawer'
import FolderDrawer from '../features/reading/FolderDrawer'
import MoveDialog from '../features/reading/MoveDialog'
import { buildChildrenMap, countBooksDeep, getDescendantIds, getPath, pathLabel, type FolderId } from '../features/reading/folderTree'

type ReadFilter = 'all' | 'unread' | 'read'
type Target = { type: 'book'; book: ReadingBook } | { type: 'folder'; folder: ReadingFolder }

export default function Reading() {
  const [user, setUser] = useState<User | null>(null)
  const [folders, setFolders] = useState<ReadingFolder[]>([])
  const [books, setBooks] = useState<ReadingBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [author, setAuthor] = useState('all')

  const [showAdd, setShowAdd] = useState(false)
  const [showBookSearch, setShowBookSearch] = useState(false)
  const [folderForm, setFolderForm] = useState<{ folder?: ReadingFolder } | null>(null)
  const [menuTarget, setMenuTarget] = useState<Target | null>(null)
  const [moveTarget, setMoveTarget] = useState<Target | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const [foldersRes, booksRes] = await Promise.all([
      supabase.from('reading_folders').select('*').order('name'),
      supabase.from('reading_books').select('*').order('created_at', { ascending: false }),
    ])
    if (foldersRes.error || booksRes.error) setError('Could not load your reading list.')
    setFolders(foldersRes.data ?? [])
    setBooks(booksRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const requestedFolder = searchParams.get('folder')
  const currentFolderId: FolderId = requestedFolder && folders.some(f => f.id === requestedFolder) ? requestedFolder : null
  const path = useMemo(() => getPath(folders, currentFolderId), [folders, currentFolderId])
  const childrenMap = useMemo(() => buildChildrenMap(folders), [folders])

  function openFolder(id: FolderId) {
    setSearchParams(id ? { folder: id } : {}, { replace: false })
  }

  const authors = useMemo(
    () => [...new Set(books.map(b => b.author).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b)),
    [books],
  )
  const savedKeys = useMemo(() => new Set(books.map(b => b.ol_key).filter((k): k is string => !!k)), [books])

  const term = search.trim().toLowerCase()
  const filtering = !!term || readFilter !== 'all' || author !== 'all'

  const matchesFilters = (b: ReadingBook) => {
    if (readFilter === 'read' && !b.is_read) return false
    if (readFilter === 'unread' && b.is_read) return false
    if (author !== 'all' && b.author !== author) return false
    if (term && !`${b.title} ${b.author ?? ''}`.toLowerCase().includes(term)) return false
    return true
  }

  const visibleBooks = filtering ? books.filter(matchesFilters) : books.filter(b => b.folder_id === currentFolderId)
  const visibleFolders = filtering
    ? (term && readFilter === 'all' && author === 'all' ? folders.filter(f => f.name.toLowerCase().includes(term)) : [])
    : childrenMap.get(currentFolderId) ?? []

  const readCount = books.filter(b => b.is_read).length

  const tabCount = (f: ReadFilter) =>
    books.filter(b => (f === 'all' || (f === 'read') === b.is_read) && (author === 'all' || b.author === author)).length

  async function toggleRead(book: ReadingBook) {
    const next = !book.is_read
    const read_at = next ? new Date().toISOString() : null
    haptic('selection')
    setBooks(prev => prev.map(b => (b.id === book.id ? { ...b, is_read: next, read_at } : b)))
    const { error } = await supabase.from('reading_books').update({ is_read: next, read_at }).eq('id', book.id)
    if (error) {
      setBooks(prev => prev.map(b => (b.id === book.id ? book : b)))
      setError(error.message)
    }
  }

  async function deleteBook(book: ReadingBook) {
    if (!confirm(`Remove "${book.title}" from your list?`)) return
    await supabase.from('reading_books').delete().eq('id', book.id)
    setBooks(prev => prev.filter(b => b.id !== book.id))
  }

  async function deleteFolder(folder: ReadingFolder) {
    const count = countBooksDeep(folders, books, folder.id)
    const sub = getDescendantIds(folders, folder.id).size
    const detail = [sub ? `${sub} subfolder${sub === 1 ? '' : 's'}` : '', count ? `${count} book${count === 1 ? '' : 's'}` : '']
      .filter(Boolean).join(' and ')
    if (!confirm(`Delete "${folder.name}"${detail ? ` and its ${detail}` : ''}? Use Move first to keep books.`)) return
    const { error } = await supabase.from('reading_folders').delete().eq('id', folder.id)
    if (error) { setError(error.message); return }
    if (path.some(f => f.id === folder.id)) openFolder(folder.parent_id)
    load()
  }

  async function moveTo(target: Target, targetId: FolderId) {
    const { error } = target.type === 'book'
      ? await supabase.from('reading_books').update({ folder_id: targetId }).eq('id', target.book.id)
      : await supabase.from('reading_folders').update({ parent_id: targetId }).eq('id', target.folder.id)
    if (error) { setError(error.message); return }
    haptic('success')
    setMoveTarget(null)
    load()
  }

  async function createFolder(parentId: FolderId, name: string) {
    if (!user) return
    const { error } = await supabase.from('reading_folders').insert({ name, parent_id: parentId, user_id: user.id })
    if (error) setError(error.message)
    await load()
  }

  const menuActions: DrawerAction[] = !menuTarget ? [] : menuTarget.type === 'book'
    ? [
        {
          label: menuTarget.book.is_read ? 'Mark as unread' : 'Mark as read',
          icon: menuTarget.book.is_read ? Undo2 : CheckCheck,
          onSelect: () => toggleRead((menuTarget as { book: ReadingBook }).book),
        },
        { label: 'Move', icon: FolderInput, onSelect: () => setMoveTarget(menuTarget) },
        { label: 'Remove from list', icon: Trash2, destructive: true, onSelect: () => deleteBook((menuTarget as { book: ReadingBook }).book) },
      ]
    : [
        { label: 'Rename', icon: Pencil, onSelect: () => setFolderForm({ folder: (menuTarget as { folder: ReadingFolder }).folder }) },
        { label: 'Move', icon: FolderInput, onSelect: () => setMoveTarget(menuTarget) },
        { label: 'Delete folder', icon: Trash2, destructive: true, onSelect: () => deleteFolder((menuTarget as { folder: ReadingFolder }).folder) },
      ]

  const moveTitle = !moveTarget ? '' : `Move "${moveTarget.type === 'book' ? moveTarget.book.title : moveTarget.folder.name}"`
  const moveDisabled = moveTarget?.type === 'folder'
    ? new Set([moveTarget.folder.id, ...getDescendantIds(folders, moveTarget.folder.id)])
    : undefined

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reading</h1>
        {books.length > 0 && <p className="text-sm text-muted-foreground">{readCount}/{books.length} read</p>}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your books…" className="pl-9" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={readFilter} onValueChange={v => setReadFilter(v as ReadFilter)} className="flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All ({tabCount('all')})</TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">To read ({tabCount('unread')})</TabsTrigger>
              <TabsTrigger value="read" className="flex-1">Read ({tabCount('read')})</TabsTrigger>
            </TabsList>
          </Tabs>
          {authors.length > 0 && (
            <Select value={author} onValueChange={setAuthor}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Author" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All authors</SelectItem>
                {authors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {filtering ? (
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{visibleBooks.length} result{visibleBooks.length === 1 ? '' : 's'} across all folders</span>
              <button
                onClick={() => { setSearch(''); setReadFilter('all'); setAuthor('all') }}
                className="font-medium text-primary"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Folder path">
              <button
                onClick={() => openFolder(null)}
                className={cn('flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent', path.length ? 'text-muted-foreground' : 'font-semibold')}
              >
                <Home className="h-3.5 w-3.5" /> Reading list
              </button>
              {path.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <button
                    onClick={() => openFolder(f.id)}
                    className={cn('rounded-md px-1.5 py-1 hover:bg-accent', i === path.length - 1 ? 'font-semibold' : 'text-muted-foreground')}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </nav>
          )}

          {visibleFolders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleFolders.map(folder => {
                const total = countBooksDeep(folders, books, folder.id)
                return (
                  <div key={folder.id} className="flex items-center rounded-xl border border-border bg-card transition-colors hover:bg-accent">
                    <button onClick={() => { setSearch(''); openFolder(folder.id) }} className="flex flex-1 min-w-0 items-center gap-3 p-4 text-left">
                      <FolderIcon className="h-6 w-6 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {filtering ? pathLabel(folders, folder.parent_id) : `${total} book${total === 1 ? '' : 's'}`}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => setMenuTarget({ type: 'folder', folder })}
                      aria-label={`Actions for ${folder.name}`}
                      className="p-3 mr-1 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {visibleBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visibleBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  location={filtering ? pathLabel(folders, book.folder_id) : undefined}
                  onToggleRead={() => toggleRead(book)}
                  onMenu={() => setMenuTarget({ type: 'book', book })}
                />
              ))}
            </div>
          ) : visibleFolders.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">{filtering ? '🔍' : '📚'}</div>
              <p className="font-medium">
                {filtering ? 'No books match your filters' : books.length === 0 && folders.length === 0 ? 'Your reading list is empty — tap + to add a book' : 'Nothing in this folder yet'}
              </p>
            </div>
          )}
        </>
      )}

      {user && (
        <Fab onClick={() => setShowAdd(true)} aria-label="Add">
          <Plus className="h-6 w-6" />
        </Fab>
      )}

      <AddSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSearchBook={() => setShowBookSearch(true)}
        onNewFolder={() => setFolderForm({})}
      />

      {user && showBookSearch && (
        <BookSearchDrawer
          open
          onClose={() => setShowBookSearch(false)}
          onSaved={load}
          userId={user.id}
          folders={folders}
          defaultFolderId={currentFolderId}
          savedKeys={savedKeys}
          onCreateFolder={createFolder}
        />
      )}

      {user && folderForm && (
        <FolderDrawer
          key={folderForm.folder?.id ?? 'new'}
          open
          onClose={() => setFolderForm(null)}
          onSave={load}
          folder={folderForm.folder}
          parentId={currentFolderId}
          userId={user.id}
        />
      )}

      <ActionsDrawer
        open={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        title={menuTarget ? (menuTarget.type === 'book' ? menuTarget.book.title : menuTarget.folder.name) : ''}
        actions={menuActions}
      />

      {moveTarget && (
        <MoveDialog
          open
          onClose={() => setMoveTarget(null)}
          title={moveTitle}
          folders={folders}
          currentFolderId={moveTarget.type === 'book' ? moveTarget.book.folder_id : moveTarget.folder.parent_id}
          disabledIds={moveDisabled}
          onCreateFolder={createFolder}
          onConfirm={id => moveTo(moveTarget, id)}
        />
      )}
    </div>
  )
}
