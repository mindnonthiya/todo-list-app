import { type CSSProperties, type ReactNode, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Flame,
  Folder,
  Flag,
  GripVertical,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Moon,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  Trophy,
  User,
  UserCircle,
  X,
} from "lucide-react";
import { type TranslationKey } from "../contexts/language-core";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import "./TodoList.css";

type Filter = "all" | "active" | "completed";
type PlannerView = "board" | "calendar" | "tasks" | "add" | "progress";
type TaskColor = "green" | "blue" | "yellow" | "orange" | "purple" | "red";
type Priority = "normal" | "important" | "urgent";
type Category = "work" | "study" | "personal" | "health" | "other";
type SortMode = "newest" | "oldest" | "completed" | "priority";
type Mood = "happy" | "calm" | "tired" | "motivated";
type DialogMode = "edit" | "delete" | "deleteList" | null;

interface Todo {
  id: number;
  title: string;
  note?: string;
  completed: boolean;
  color?: TaskColor;
  priority?: Priority;
  category?: Category;
  dueDate?: string;
  dueTime?: string;
  alarm?: boolean;
  alarmEnabled?: boolean;
  alarmDateTime?: string | null;
  listId?: number;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

interface BoardList {
  id: number;
  title: string;
  position: number;
  color?: string;
  created_at?: string;
}

interface CalendarDay {
  key: string;
  date: Date;
  isOutside: boolean;
  isToday: boolean;
  isSelected: boolean;
}

interface TaskFormState {
  title: string;
  note: string;
  color: TaskColor;
  priority: Priority;
  category: Category;
  dueDate: string;
  dueTime: string;
  alarmEnabled: boolean;
  alarmDate: string;
  alarmTime: string;
  listId: number | null;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/todos";
const LIST_API_URL = import.meta.env.VITE_LIST_API_URL ?? "http://localhost:5000/api/lists";
const todayKey = toDateInputValue(new Date());

const COLOR_OPTIONS: Array<{ value: TaskColor; key: "green" | "blue" | "yellow" | "orange" | "purple" | "red" }> = [
  { value: "green", key: "green" },
  { value: "blue", key: "blue" },
  { value: "yellow", key: "yellow" },
  { value: "orange", key: "orange" },
  { value: "purple", key: "purple" },
  { value: "red", key: "red" },
];

const PRIORITY_OPTIONS: Array<{ value: Priority; key: "normal" | "important" | "urgent" }> = [
  { value: "normal", key: "normal" },
  { value: "important", key: "important" },
  { value: "urgent", key: "urgent" },
];

const CATEGORY_OPTIONS: Array<{ value: Category; key: "work" | "study" | "personal" | "health" | "other" }> = [
  { value: "work", key: "work" },
  { value: "study", key: "study" },
  { value: "personal", key: "personal" },
  { value: "health", key: "health" },
  { value: "other", key: "other" },
];

const MOOD_OPTIONS: Array<{ value: Mood; key: "happy" | "calm" | "tired" | "motivated" }> = [
  { value: "happy", key: "happy" },
  { value: "calm", key: "calm" },
  { value: "tired", key: "tired" },
  { value: "motivated", key: "motivated" },
];

const priorityRank: Record<Priority, number> = { normal: 1, important: 2, urgent: 3 };

const createDefaultFormState = (listId: number | null = null): TaskFormState => ({
  title: "",
  note: "",
  color: "green",
  priority: "important",
  category: "work",
  dueDate: todayKey,
  dueTime: "09:00",
  alarmEnabled: false,
  alarmDate: todayKey,
  alarmTime: "09:00",
  listId,
});

/* ============================================================ */
/*  Main Component                                               */
/* ============================================================ */

export default function TodoList() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [lists, setLists] = useState<BoardList[]>([]);
  const [form, setForm] = useState<TaskFormState>(() => createDefaultFormState());
  const [filter, setFilter] = useState<Filter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<PlannerView>("board");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedMood, setSelectedMood] = useState<Mood>("calm");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingTodo, setDeletingTodo] = useState<Todo | null>(null);
  const [deletingList, setDeletingList] = useState<BoardList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const dateLocale = language === "th" ? "th-TH" : "en-US";

  /* ---- Fetch helpers ---- */

  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Unable to load todos");
      const data = (await res.json()) as Todo[];
      setTodos(data.map(normalizeTodo));
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("apiError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch(LIST_API_URL);
      if (!res.ok) throw new Error("Unable to load lists");
      const data = (await res.json()) as BoardList[];
      setLists(data);
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTodos();
      void fetchLists();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTodos, fetchLists]);

  useEffect(() => {
    if (!profileOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (avatarButtonRef.current?.contains(target) || profileMenuRef.current?.contains(target)) {
        return;
      }
      setProfileOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [profileOpen]);

  /* ---- Derived data ---- */

  const today = useMemo(() => new Date(), []);
  const stats = useMemo(() => buildStats(todos, today), [today, todos]);
  const selectedDateTasks = useMemo(() => todos.filter((todo) => getTodoDueDate(todo) === selectedDate), [selectedDate, todos]);
  const taskDates = useMemo(() => new Set(todos.map(getTodoDueDate)), [todos]);
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth, selectedDate), [currentMonth, selectedDate]);

  const visibleTodos = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return todos
      .filter((todo) => {
        if (filter === "active" && todo.completed) return false;
        if (filter === "completed" && !todo.completed) return false;
        if (!normalizedQuery) return true;
        return todo.title.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortMode === "oldest") return timestamp(a.created_at) - timestamp(b.created_at);
        if (sortMode === "completed") return Number(a.completed) - Number(b.completed);
        if (sortMode === "priority") return priorityRank[normalizePriority(b.priority)] - priorityRank[normalizePriority(a.priority)];
        return timestamp(b.created_at) - timestamp(a.created_at);
      });
  }, [filter, search, sortMode, todos]);

  const viewLabels = useMemo<Record<PlannerView, string>>(() => ({
    board: t("board"),
    calendar: t("calendar"),
    tasks: t("tasks"),
    add: t("addTask"),
    progress: t("analytics"),
  }), [t]);

  /* ---- CRUD: Todos ---- */

  const addTodo = useCallback(async () => {
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      inputRef.current?.focus();
      return;
    }

    const alarmDateTime = form.alarmEnabled ? `${form.alarmDate}T${form.alarmTime}` : null;
    setError("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          note: form.note.trim(),
          color: form.color,
          priority: form.priority,
          category: form.category,
          dueDate: form.dueDate,
          dueTime: form.dueTime,
          alarm: form.alarmEnabled,
          alarmEnabled: form.alarmEnabled,
          alarmDateTime,
          listId: form.listId,
        }),
      });

      if (!res.ok) throw new Error("Unable to create todo");
      const newTodo = normalizeTodo(await res.json());
      setTodos((currentTodos) => [newTodo, ...currentTodos]);
      setForm(createDefaultFormState(form.listId));
      setFilter("all");
      setActiveView("board");
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("addError"));
    }
  }, [form, t]);

  const updateTodo = useCallback(async (id: number, updates: Partial<Todo>) => {
    setError("");

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Unable to update todo");
      const updatedTodo = normalizeTodo(await res.json());
      setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === id ? updatedTodo : todo)));
      return updatedTodo;
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("updateError"));
      return null;
    }
  }, [t]);

  const deleteTodo = useCallback(async () => {
    if (!deletingTodo) return;
    setError("");

    try {
      const res = await fetch(`${API_URL}/${deletingTodo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete todo");
      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== deletingTodo.id));
      setDialogMode(null);
      setDeletingTodo(null);
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("deleteError"));
    }
  }, [deletingTodo, t]);

  const moveTodo = useCallback(async (todoId: number, targetListId: number) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/${todoId}/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: targetListId }),
      });
      if (!res.ok) throw new Error("Unable to move todo");
      const movedTodo = normalizeTodo(await res.json());
      setTodos((cur) => cur.map((t) => (t.id === todoId ? movedTodo : t)));
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("updateError"));
    }
  }, [t]);

  /* ---- CRUD: Lists ---- */

  const createList = useCallback(async (title: string) => {
    try {
      const res = await fetch(LIST_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Unable to create list");
      const newList = (await res.json()) as BoardList;
      setLists((cur) => [...cur, newList]);
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, []);

  const updateListTitle = useCallback(async (id: number, title: string) => {
    try {
      const res = await fetch(`${LIST_API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Unable to update list");
      const updated = (await res.json()) as BoardList;
      setLists((cur) => cur.map((l) => (l.id === id ? updated : l)));
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, []);

  const confirmDeleteList = useCallback(async () => {
    if (!deletingList) return;
    try {
      const res = await fetch(`${LIST_API_URL}/${deletingList.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete list");
      setLists((cur) => cur.filter((l) => l.id !== deletingList.id));
      setDialogMode(null);
      setDeletingList(null);
      void fetchTodos(); // re-fetch to update moved todos
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, [deletingList, fetchTodos]);

  /* ---- View callbacks ---- */

  const openAddView = useCallback((targetListId?: number) => {
    if (targetListId) {
      setForm((prev) => ({ ...prev, listId: targetListId }));
    }
    setActiveView("add");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const openEditDialog = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setEditingTitle(todo.title);
    setDialogMode("edit");
  }, []);

  const saveEditing = useCallback(async () => {
    const trimmedTitle = editingTitle.trim();

    if (!editingTodo || !trimmedTitle) return;

    const updatedTodo = await updateTodo(editingTodo.id, { title: trimmedTitle });

    if (updatedTodo) {
      setDialogMode(null);
      setEditingTodo(null);
      setEditingTitle("");
    }
  }, [editingTitle, editingTodo, updateTodo]);

  const requestDelete = useCallback((todo: Todo) => {
    setDeletingTodo(todo);
    setDialogMode("delete");
  }, []);

  const requestDeleteList = useCallback((list: BoardList) => {
    setDeletingList(list);
    setDialogMode("deleteList");
  }, []);

  const closeDialog = useCallback(() => {
    setDialogMode(null);
    setEditingTodo(null);
    setEditingTitle("");
    setDeletingTodo(null);
    setDeletingList(null);
  }, []);

  const monthLabel = currentMonth.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });

  /* ---- Render ---- */

  return (
    <main className="planner-app">
      <div className="planner-container">
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="brand-mark">
            <div className="brand-glyph" aria-hidden="true"><LayoutDashboard size={20} /></div>
            <div><strong>{t("appName")}</strong><span>{t("workspace")}</span></div>
          </div>
          <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} onAdd={() => openAddView()} variant="sidebar" />
          <div className="sidebar-summary">
            <span>{t("completion")}</span>
            <strong>{stats.progress}%</strong>
            <div className="progress-track"><i style={{ width: `${stats.progress}%` }} /></div>
          </div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div className="topbar-left">
              <p className="topbar-date">{today.toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric" })}</p>
              <h1>{viewLabels[activeView]}</h1>
            </div>
            <div className="header-actions">
              <LanguageToggle language={language} onChange={setLanguage} />
              <button type="button" className="theme-quick-button" aria-label={t("theme")} onClick={toggleTheme}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
              <div className="user-area">
                <div className="user-copy"><strong>{t("userName")}</strong><span>{t("userLevel")}</span></div>
                <button type="button" className="avatar-button" ref={avatarButtonRef} aria-label={t("profile")} aria-expanded={profileOpen} onClick={() => setProfileOpen((isOpen) => !isOpen)}><User size={18} /></button>
              </div>
            </div>
            {profileOpen && (
              <UserMenu
                ref={profileMenuRef}
                onClose={() => setProfileOpen(false)}
                onToggleTheme={toggleTheme}
                themeLabel={theme === "dark" ? t("light") : t("dark")}
              />
            )}
          </header>

          {error && <div className="app-error" role="alert">{error}</div>}

          {activeView === "board" && (
            <BoardView
              lists={lists}
              todos={todos}
              t={t}
              dateLocale={dateLocale}
              isLoading={isLoading}
              onAddCard={(listId) => openAddView(listId)}
              onMoveCard={moveTodo}
              onToggle={(todo) => void updateTodo(todo.id, { completed: !todo.completed })}
              onEdit={openEditDialog}
              onDelete={requestDelete}
              onCreateList={createList}
              onUpdateList={updateListTitle}
              onDeleteList={requestDeleteList}
            />
          )}

          {activeView === "calendar" && (
            <section className="calendar-layout" aria-label={t("calendar")}>
              <CalendarPanel
                days={calendarDays}
                monthLabel={monthLabel}
                taskDates={taskDates}
                dateLocale={dateLocale}
                t={t}
                onPrevious={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
                onNext={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
                onSelect={(date) => setSelectedDate(toDateInputValue(date))}
              />
              <section className="day-column">
                <div className="stat-grid compact-stats">
                  <StatCard label={t("tasksToday")} value={stats.dueToday} icon={<CalendarDays size={18} />} />
                  <StatCard label={t("completedToday")} value={stats.completedToday} icon={<CheckCircle2 size={18} />} />
                  <StatCard label={t("pendingTasks")} value={stats.pending} icon={<Clock size={18} />} />
                </div>
                <TaskPreview title={formatDateHeading(selectedDate, dateLocale)} todos={selectedDateTasks} t={t} dateLocale={dateLocale} isLoading={isLoading} onAdd={() => openAddView()} onToggle={(todo) => void updateTodo(todo.id, { completed: !todo.completed })} />
              </section>
            </section>
          )}

          {activeView === "tasks" && (
            <section className="tasks-view" aria-label={t("taskList")}>
              <div className="task-toolbar">
                <label className="search-field" htmlFor="task-search"><Search size={18} /><input id="task-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} /></label>
                <select aria-label={t("priority")} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                  <option value="newest">{t("newest")}</option>
                  <option value="oldest">{t("oldest")}</option>
                  <option value="completed">{t("completed")}</option>
                  <option value="priority">{t("priority")}</option>
                </select>
                <button type="button" className="primary-button" onClick={() => openAddView()}><Plus size={18} /> {t("addTask")}</button>
              </div>
              <FilterTabs filter={filter} onChange={setFilter} t={t} />
              <div className="task-board">
                {isLoading ? <SkeletonList /> : visibleTodos.length === 0 ? <EmptyState onAdd={() => openAddView()} t={t} /> : visibleTodos.map((todo) => (
                  <TaskCard key={todo.id} todo={todo} t={t} dateLocale={dateLocale} lists={lists} onEdit={() => openEditDialog(todo)} onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })} onDelete={() => requestDelete(todo)} onMove={moveTodo} />
                ))}
              </div>
            </section>
          )}

          {activeView === "add" && (
            <section className="add-view" aria-label={t("addTask")}>
              <div className="form-intro card"><span className="eyebrow">{t("createTask")}</span><h2>{t("formIntroTitle")}</h2><p>{t("formIntroBody")}</p></div>
              <TaskForm form={form} setForm={setForm} t={t} inputRef={inputRef} onSubmit={addTodo} submitLabel={t("saveTask")} lists={lists} />
            </section>
          )}

          {activeView === "progress" && (
            <AnalyticsView stats={stats} todos={todos} selectedMood={selectedMood} onMoodChange={setSelectedMood} t={t} />
          )}
        </section>
      </div>

      <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} onAdd={() => openAddView()} variant="bottom" />

      {dialogMode === "edit" && editingTodo && (
        <Modal title={t("editTask")} onClose={closeDialog}>
          <form className="edit-title-form" onSubmit={(event) => { event.preventDefault(); void saveEditing(); }}>
            <label>{t("title")}<input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} autoFocus /></label>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button><button type="submit" className="save-button"><Check size={18} /> {t("save")}</button></div>
          </form>
        </Modal>
      )}

      {dialogMode === "delete" && deletingTodo && (
        <Modal title={t("deleteTask")} onClose={closeDialog} destructive>
          <div className="delete-confirmation">
            <p>{t("deleteWarning")}</p>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button><button type="button" className="danger-button" onClick={() => void deleteTodo()}>{t("delete")}</button></div>
          </div>
        </Modal>
      )}

      {dialogMode === "deleteList" && deletingList && (
        <Modal title={t("deleteList")} onClose={closeDialog} destructive>
          <div className="delete-confirmation">
            <p>{t("deleteListWarning")}</p>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button><button type="button" className="danger-button" onClick={() => void confirmDeleteList()}>{t("delete")}</button></div>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ============================================================ */
/*  Sub-components                                               */
/* ============================================================ */

const UserMenu = forwardRef<HTMLDivElement, { onClose: () => void; onToggleTheme: () => void; themeLabel: string }>(function UserMenu({ onClose, onToggleTheme, themeLabel }, ref) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="popover-layer" role="presentation" onClick={onClose}>
      <div ref={ref} className="profile-menu" role="menu" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-handle" aria-hidden="true" />
        <button type="button" role="menuitem"><Settings size={16} /> {t("settings")}</button>
        <button type="button" role="menuitem" onClick={onToggleTheme}><Palette size={16} /> {t("theme")} · {themeLabel}</button>
        <div className="menu-language" role="group" aria-label={t("language")}><span>{t("language")}</span><LanguageToggle language={language} onChange={setLanguage} /></div>
        <button type="button" role="menuitem"><LogOut size={16} /> {t("logout")}</button>
      </div>
    </div>
  );
});

function LanguageToggle({ language, onChange }: { language: "en" | "th"; onChange: (language: "en" | "th") => void }) {
  return <div className="language-toggle" role="group" aria-label="Language"><button type="button" className={language === "th" ? "is-active" : ""} onClick={() => onChange("th")}>TH</button><button type="button" className={language === "en" ? "is-active" : ""} onClick={() => onChange("en")}>EN</button></div>;
}

function Navigation({ activeView, labels, onChange, onAdd, variant }: { activeView: PlannerView; labels: Record<PlannerView, string>; onChange: (view: PlannerView) => void; onAdd: () => void; variant: "sidebar" | "bottom" }) {
  const items: Array<{ view: PlannerView; icon: ReactNode; action?: () => void }> = [
    { view: "board", icon: <LayoutDashboard size={19} /> },
    { view: "calendar", icon: <CalendarDays size={19} /> },
    { view: "tasks", icon: <ListTodo size={19} /> },
    { view: "add", icon: <Plus size={variant === "bottom" ? 22 : 19} />, action: onAdd },
    { view: "progress", icon: <BarChart3 size={19} /> },
  ];

  return <nav className={variant === "sidebar" ? "nav-list" : "bottom-nav"} aria-label={variant === "sidebar" ? "Sidebar navigation" : "Mobile navigation"}>{items.map((item) => <button key={item.view} type="button" className={`${activeView === item.view ? "is-active" : ""} ${item.view === "add" ? "add-nav-item" : ""}`} onClick={() => item.action ? item.action() : onChange(item.view)} aria-current={activeView === item.view ? "page" : undefined}>{item.icon}<span>{labels[item.view]}</span></button>)}</nav>;
}

/* ---- Board View ---- */

function BoardView({ lists, todos, t, dateLocale, isLoading, onAddCard, onMoveCard, onToggle, onEdit, onDelete, onCreateList, onUpdateList, onDeleteList }: { lists: BoardList[]; todos: Todo[]; t: (key: TranslationKey) => string; dateLocale: string; isLoading: boolean; onAddCard: (listId: number) => void; onMoveCard: (todoId: number, listId: number) => void; onToggle: (todo: Todo) => void; onEdit: (todo: Todo) => void; onDelete: (todo: Todo) => void; onCreateList: (title: string) => void; onUpdateList: (id: number, title: string) => void; onDeleteList: (list: BoardList) => void }) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overListId, setOverListId] = useState<number | null>(null);
  const [newListMode, setNewListMode] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [editListId, setEditListId] = useState<number | null>(null);
  const [editListTitle, setEditListTitle] = useState("");

  if (isLoading) return <div className="board-view"><SkeletonList /><SkeletonList /><SkeletonList /></div>;

  return (
    <section className="board-view" aria-label={t("board")}>
      {lists.map((list) => {
        const cards = todos.filter((td) => td.listId === list.id);
        const isDragOver = overListId === list.id;
        return (
          <div key={list.id} className={`board-column ${isDragOver ? "drag-over" : ""}`} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDragEnter={() => setOverListId(list.id)} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverListId(null); }} onDrop={(e) => { e.preventDefault(); if (dragId !== null) { onMoveCard(dragId, list.id); setDragId(null); setOverListId(null); } }}>
            <div className="board-column-header">
              {editListId === list.id ? (
                <form className="board-edit-form" onSubmit={(e) => { e.preventDefault(); if (editListTitle.trim()) { onUpdateList(list.id, editListTitle.trim()); } setEditListId(null); }}>
                  <input value={editListTitle} onChange={(e) => setEditListTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Escape") setEditListId(null); }} />
                  <button type="submit" className="icon-btn"><Check size={14} /></button>
                  <button type="button" className="icon-btn" onClick={() => setEditListId(null)}><X size={14} /></button>
                </form>
              ) : (
                <>
                  <div className="board-column-title"><h3>{list.title}</h3><span className="board-column-count">{cards.length}</span></div>
                  <div className="board-column-actions">
                    <button type="button" className="icon-btn" onClick={() => { setEditListId(list.id); setEditListTitle(list.title); }} aria-label={t("editList")}><Pencil size={14} /></button>
                    <button type="button" className="icon-btn" onClick={() => onDeleteList(list)} aria-label={t("deleteList")}><Trash2 size={14} /></button>
                  </div>
                </>
              )}
            </div>
            <div className="board-column-body">
              {cards.map((todo) => (
                <div key={todo.id} className={`board-card color-${normalizeColor(todo.color)} ${todo.completed ? "is-completed" : ""} ${dragId === todo.id ? "is-dragging" : ""}`} draggable onDragStart={(e) => { setDragId(todo.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragId(null); setOverListId(null); }}>
                  <div className="board-card-color" />
                  <div className="board-card-top">
                    <button type="button" className="complete-button" onClick={() => onToggle(todo)} aria-label={todo.completed ? "Pending" : "Completed"}>{todo.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button>
                    <h4 className={todo.completed ? "is-completed-text" : ""}>{todo.title}</h4>
                    <GripVertical size={14} className="drag-handle" />
                  </div>
                  {todo.note && <p className="board-card-note">{todo.note}</p>}
                  <div className="board-card-meta">
                    <span className={`priority-badge ${normalizePriority(todo.priority)}`}><Flag size={11} />{t(normalizePriority(todo.priority))}</span>
                    <span><Folder size={11} />{t(normalizeCategory(todo.category))}</span>
                    {todo.dueDate && <span><CalendarDays size={11} />{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</span>}
                  </div>
                  <div className="board-card-actions">
                    <button type="button" className="icon-btn" onClick={() => onEdit(todo)}><Pencil size={13} /></button>
                    <button type="button" className="icon-btn" onClick={() => onDelete(todo)}><Trash2 size={13} /></button>
                    <select className="board-card-move" value={todo.listId ?? ""} onChange={(e) => onMoveCard(todo.id, Number(e.target.value))} aria-label={t("moveTask")}>
                      {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <button type="button" className="board-add-card" onClick={() => onAddCard(list.id)}><Plus size={16} /> {t("addTask")}</button>
            </div>
          </div>
        );
      })}

      {newListMode ? (
        <div className="board-new-list card">
          <form onSubmit={(e) => { e.preventDefault(); if (newListTitle.trim()) { onCreateList(newListTitle.trim()); setNewListTitle(""); setNewListMode(false); } }}>
            <input value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} placeholder={t("listName")} autoFocus onKeyDown={(e) => { if (e.key === "Escape") { setNewListMode(false); setNewListTitle(""); } }} />
            <div className="board-new-list-btns">
              <button type="submit" className="save-button"><Check size={16} /> {t("add")}</button>
              <button type="button" className="secondary-button" onClick={() => { setNewListMode(false); setNewListTitle(""); }}><X size={16} /></button>
            </div>
          </form>
        </div>
      ) : (
        <button type="button" className="board-add-list" onClick={() => setNewListMode(true)}><Plus size={20} /> {t("addList")}</button>
      )}
    </section>
  );
}

/* ---- Shared Sub-Components ---- */

function CalendarPanel({ days, monthLabel, taskDates, dateLocale, t, onPrevious, onNext, onSelect }: { days: CalendarDay[]; monthLabel: string; taskDates: Set<string>; dateLocale: string; t: (key: TranslationKey) => string; onPrevious: () => void; onNext: () => void; onSelect: (date: Date) => void }) {
  return <section className="calendar-card card"><div className="calendar-header"><div><span className="eyebrow">{t("monthPlanner")}</span><h2>{monthLabel}</h2></div><div className="month-actions"><button type="button" aria-label={t("previousMonth")} onClick={onPrevious}><ChevronLeft size={18} /></button><button type="button" aria-label={t("nextMonth")} onClick={onNext}><ChevronRight size={18} /></button></div></div><div className="weekday-grid" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => <button key={day.key} type="button" className={`${day.isOutside ? "is-outside" : ""} ${day.isToday ? "is-today" : ""} ${day.isSelected ? "is-selected" : ""}`} onClick={() => onSelect(day.date)} aria-label={day.date.toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}><span>{day.date.getDate()}</span>{taskDates.has(toDateInputValue(day.date)) && <i aria-hidden="true" />}</button>)}</div></section>;
}

function TaskPreview({ title, todos, t, dateLocale, isLoading, onAdd, onToggle }: { title: string; todos: Todo[]; t: (key: TranslationKey) => string; dateLocale: string; isLoading: boolean; onAdd: () => void; onToggle: (todo: Todo) => void }) {
  return <section className="card task-preview"><div className="section-title"><div><span className="eyebrow">{t("selectedDay")}</span><h2>{title}</h2></div><button type="button" onClick={onAdd}>{t("add")}</button></div>{isLoading ? <SkeletonList compact /> : todos.length === 0 ? <p className="muted-empty">{t("noTasksDate")}</p> : todos.slice(0, 5).map((todo) => <button key={todo.id} type="button" className={`preview-row color-${normalizeColor(todo.color)}`} onClick={() => onToggle(todo)}>{todo.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}<span>{todo.title}</span><small>{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</small></button>)}</section>;
}

function TaskCard({ todo, t, dateLocale, lists, onEdit, onToggle, onDelete, onMove }: { todo: Todo; t: (key: TranslationKey) => string; dateLocale: string; lists: BoardList[]; onEdit: () => void; onToggle: () => void; onDelete: () => void; onMove: (todoId: number, listId: number) => void }) {
  const priority = normalizePriority(todo.priority);
  const category = normalizeCategory(todo.category);
  const color = normalizeColor(todo.color);
  const alarmActive = Boolean(todo.alarmEnabled || todo.alarm);

  return <article className={`task-card color-${color} ${todo.completed ? "is-completed" : ""}`}><button type="button" className="complete-button" onClick={onToggle} aria-label={todo.completed ? t("pending") : t("completed")}>{todo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button><div className="task-content"><h3>{todo.title}</h3>{todo.note && <p>{todo.note}</p>}<div className="task-meta"><span><Folder size={14} />{t(category)}</span><span className={`priority-badge ${priority}`}><Flag size={14} />{t(priority)}</span><span><CalendarDays size={14} />{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</span>{todo.dueTime && <span><Clock size={14} />{todo.dueTime}</span>}{alarmActive && <span className="reminder-badge"><Bell size={14} />{formatAlarm(todo.alarmDateTime, dateLocale)}</span>}{lists.length > 0 && <select className="task-move-select" value={todo.listId ?? ""} onChange={(e) => onMove(todo.id, Number(e.target.value))} aria-label={t("moveTask")}>{lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>}</div></div><div className="task-actions"><button type="button" onClick={onEdit} aria-label={t("editTask")}><Pencil size={17} /></button><button type="button" onClick={onDelete} aria-label={t("delete")}><Trash2 size={17} /></button></div></article>;
}

function TaskForm({ form, setForm, t, onSubmit, submitLabel, inputRef, onCancel, compact = false, lists }: { form: TaskFormState; setForm: (form: TaskFormState) => void; t: (key: TranslationKey) => string; onSubmit: () => void; submitLabel: string; inputRef?: React.RefObject<HTMLInputElement | null>; onCancel?: () => void; compact?: boolean; lists?: BoardList[] }) {
  const updateField = <Key extends keyof TaskFormState>(key: Key, value: TaskFormState[Key]) => setForm({ ...form, [key]: value });

  return <form className={compact ? "task-form compact cardless" : "task-form card"} onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>{lists && lists.length > 0 && <label>{t("list")}<select value={form.listId ?? ""} onChange={(event) => updateField("listId", Number(event.target.value) || null)}>{lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>}<div className="form-grid two"><label>{t("title")}<input ref={inputRef} value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder={t("titlePlaceholder")} /></label><label>{t("category")}<select value={form.category} onChange={(event) => updateField("category", event.target.value as Category)}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}</select></label></div><label>{t("note")}<textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder={t("notePlaceholder")} /></label><div className="form-grid two"><label>{t("dueDate")}<input type="date" value={form.dueDate} onChange={(event) => updateField("dueDate", event.target.value)} /></label><label>{t("dueTime")}<input type="time" value={form.dueTime} onChange={(event) => updateField("dueTime", event.target.value)} /></label></div><div className="form-grid two"><label>{t("priority")}<select value={form.priority} onChange={(event) => updateField("priority", event.target.value as Priority)}>{PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}</select></label><fieldset className="color-picker"><legend>{t("color")}</legend><div>{COLOR_OPTIONS.map((item) => <button key={item.value} type="button" className={form.color === item.value ? `color-swatch ${item.value} is-selected` : `color-swatch ${item.value}`} onClick={() => updateField("color", item.value)} aria-pressed={form.color === item.value}><span />{t(item.key)}</button>)}</div></fieldset></div><section className="alarm-box" aria-label={t("reminder")}><div><strong>{t("reminder")}</strong><span>{t("alarmDate")} / {t("alarmTime")}</span></div><label className="switch"><input type="checkbox" checked={form.alarmEnabled} onChange={(event) => updateField("alarmEnabled", event.target.checked)} /><span />{t("reminder")}</label>{form.alarmEnabled && <div className="form-grid two alarm-inputs"><label>{t("alarmDate")}<input type="date" value={form.alarmDate} onChange={(event) => updateField("alarmDate", event.target.value)} /></label><label>{t("alarmTime")}<input type="time" value={form.alarmTime} onChange={(event) => updateField("alarmTime", event.target.value)} /></label></div>}</section><div className="form-actions">{onCancel && <button type="button" className="secondary-button" onClick={onCancel}>{t("cancel")}</button>}<button type="submit" className="save-button"><Check size={18} /> {submitLabel}</button></div></form>;
}

function AnalyticsView({ stats, todos, selectedMood, onMoodChange, t }: { stats: ReturnType<typeof buildStats>; todos: Todo[]; selectedMood: Mood; onMoodChange: (mood: Mood) => void; t: (key: TranslationKey) => string }) {
  return <section className="analytics-view" aria-label={t("analytics")}><div className="analytics-hero card"><div><span className="eyebrow">{t("productivity")}</span><h2>{stats.progress}% {t("completionRate")}</h2><p>{stats.completed} / {stats.total} {t("tasksCompleted")}</p></div><div className="progress-ring" style={{ "--progress": `${stats.progress}%` } as CSSProperties}><span>{stats.progress}%</span></div></div><section className="card donut-card"><span className="eyebrow">{t("completedVsPending")}</span><div className="donut-chart" style={{ "--done": `${stats.progress}%` } as CSSProperties} /><div className="chart-legend"><span><i className="done" />{t("completed")}</span><span><i />{t("pending")}</span></div></section><WeeklyChart data={stats.weeklyCompleted} t={t} /><section className="card mood-card"><div><span className="eyebrow">{t("moodTracker")}</span><h2>{t("workingState")}</h2></div><div className="mood-grid">{MOOD_OPTIONS.map((item) => <button type="button" key={item.value} className={selectedMood === item.value ? "is-active" : ""} onClick={() => onMoodChange(item.value)}>{t(item.key)}</button>)}</div></section><div className="stat-grid analytics-stats"><StatCard label={t("currentStreak")} value={stats.streak} icon={<Flame size={18} />} /><StatCard label={t("tasksThisWeek")} value={stats.completedThisWeek} icon={<BarChart3 size={18} />} /><StatCard label={t("tasksThisMonth")} value={todos.filter((todo) => todo.completed && isThisMonth(todo.updated_at)).length} icon={<CheckCircle2 size={18} />} /></div></section>;
}

function WeeklyChart({ data, t }: { data: Array<{ label: string; count: number }>; t: (key: TranslationKey) => string }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return <section className="card weekly-card"><div><span className="eyebrow">{t("weeklyChart")}</span><h2>{t("tasksCompleted")}</h2></div><div className="weekly-chart">{data.map((item) => <div key={item.label}><span style={{ height: `${Math.max((item.count / max) * 100, 8)}%` }} /><small>{item.label}</small><strong>{item.count}</strong></div>)}</div></section>;
}

function FilterTabs({ filter, onChange, t }: { filter: Filter; onChange: (filter: Filter) => void; t: (key: TranslationKey) => string }) {
  const filters: Array<{ value: Filter; label: string }> = [{ value: "all", label: t("all") }, { value: "active", label: t("open") }, { value: "completed", label: t("done") }];
  return <div className="filter-tabs" role="tablist" aria-label={t("taskList")}>{filters.map((item) => <button key={item.value} type="button" className={filter === item.value ? "is-active" : ""} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

function Modal({ title, children, onClose, destructive = false }: { title: string; children: ReactNode; onClose: () => void; destructive?: boolean }) {
  const { t } = useLanguage();
  return <div className={destructive ? "modal-layer destructive" : "modal-layer"} role="presentation" onMouseDown={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h2 id="modal-title">{title}</h2><button type="button" onClick={onClose} aria-label={t("close")}><X size={18} /></button></div>{children}</section></div>;
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return <article className="stat-card card"><div>{icon}</div><strong>{value}</strong><span>{label}</span></article>;
}

function Badge({ icon, title, active }: { icon: ReactNode; title: string; active: boolean }) {
  return <div className={active ? "badge-item is-active" : "badge-item"}>{icon}<span>{title}</span></div>;
}

function EmptyState({ onAdd, t }: { onAdd: () => void; t: (key: TranslationKey) => string }) {
  return <div className="empty-state card"><ListTodo size={36} /><h3>{t("noTasksFound")}</h3><p>{t("noTasksHint")}</p><button type="button" onClick={onAdd}>{t("addTask")}</button></div>;
}

function SkeletonList({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "skeleton-list compact" : "skeleton-list"}>{Array.from({ length: compact ? 3 : 5 }, (_, index) => <span key={index} />)}</div>;
}

/* ============================================================ */
/*  Helper / Pure functions                                      */
/* ============================================================ */

function buildStats(todos: Todo[], today: Date) {
  const completed = todos.filter((todo) => todo.completed).length;
  const active = todos.length - completed;
  const progress = todos.length === 0 ? 0 : Math.round((completed / todos.length) * 100);
  const dueToday = todos.filter((todo) => getTodoDueDate(todo) === todayKey);
  const completedToday = dueToday.filter((todo) => todo.completed).length;
  const weeklyCompleted = getWeeklyCompleted(todos, today);
  const completedThisWeek = weeklyCompleted.reduce((sum, item) => sum + item.count, 0);
  const streak = calculateCurrentStreak(todos, today);

  return { total: todos.length, active, completed, progress, dueToday: dueToday.length, completedToday, pending: active, weeklyCompleted, completedThisWeek, streak, longestStreak: Math.max(streak + 3, streak, completed > 0 ? 1 : 0) };
}

function buildCalendarDays(baseDate: Date, selectedDate: string): CalendarDay[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayIndex = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { key: date.toISOString(), date, isOutside: date.getMonth() !== month, isToday: toDateInputValue(date) === todayKey, isSelected: toDateInputValue(date) === selectedDate };
  });
}

function normalizeTodo(todo: Todo): Todo {
  return { ...todo, color: normalizeColor(todo.color), priority: normalizePriority(todo.priority), category: normalizeCategory(todo.category), dueDate: todo.dueDate ?? todo.created_at?.slice(0, 10) ?? todayKey, dueTime: normalizeTime(todo.dueTime), alarmEnabled: Boolean(todo.alarmEnabled ?? todo.alarm), listId: todo.listId ?? undefined };
}

function normalizeColor(value?: string): TaskColor {
  return COLOR_OPTIONS.some((item) => item.value === value) ? (value as TaskColor) : "green";
}

function normalizePriority(value?: string): Priority {
  if (value === "low") return "normal";
  if (value === "medium") return "important";
  if (value === "high") return "urgent";
  return PRIORITY_OPTIONS.some((item) => item.value === value) ? (value as Priority) : "important";
}

function normalizeTime(value?: string) {
  return value ? value.slice(0, 5) : "09:00";
}

function normalizeCategory(value?: string): Category {
  return CATEGORY_OPTIONS.some((item) => item.value === value) ? (value as Category) : "other";
}

function getTodoDueDate(todo: Todo) {
  return todo.dueDate ?? todo.created_at?.slice(0, 10) ?? todayKey;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timestamp(value?: string) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function formatDateHeading(value: string, locale: string, short = false) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, short ? { month: "short", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" });
}

function formatAlarm(value: string | null | undefined, locale: string) {
  if (!value) return "Reminder";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Reminder";
  return date.toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}


function getWeeklyCompleted(todos: Todo[], today: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = toDateInputValue(date);
    return { label: date.toLocaleDateString("en-US", { weekday: "short" }), count: todos.filter((todo) => todo.completed && (todo.updated_at?.slice(0, 10) ?? getTodoDueDate(todo)) === key).length };
  });
}

function calculateCurrentStreak(todos: Todo[], today: Date) {
  let streak = 0;
  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = toDateInputValue(date);
    const hasCompletedTask = todos.some((todo) => todo.completed && (todo.updated_at?.slice(0, 10) ?? getTodoDueDate(todo)) === key);
    if (!hasCompletedTask) break;
    streak += 1;
  }
  return streak;
}

function isThisMonth(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}