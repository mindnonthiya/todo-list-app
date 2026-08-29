import { type CSSProperties, type ReactNode, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Flame,
  Folder,
  Flag,
  GripVertical,
  ImageIcon,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Palette,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Sun,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { type TranslationKey } from "../contexts/language-core";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import "./TodoList.css";

type Filter = "all" | "active" | "completed";
type PlannerView = "board" | "calendar" | "tasks" | "progress";
type TaskColor = "green" | "blue" | "yellow" | "orange" | "purple" | "red";
type Priority = "normal" | "important" | "urgent";
type Category = "work" | "study" | "personal" | "health" | "other";
type SortMode = "newest" | "oldest" | "completed" | "priority";
type Mood = "happy" | "calm" | "tired" | "motivated";
type DialogMode = "edit" | "delete" | "deleteList" | "create" | null;

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
  imageUrl?: string | null;
  commentsCount?: number;
  created_at?: string;
  updated_at?: string;
}

interface TodoComment {
  id: number;
  todoId: number;
  author: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
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
  imageUrl: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/todos";
const LIST_API_URL = import.meta.env.VITE_LIST_API_URL ?? "http://localhost:5000/api/lists";
const todayKey = toDateInputValue(new Date());

const COLOR_OPTIONS: Array<{ value: TaskColor; key: "green" | "blue" | "yellow" | "orange" | "purple" | "red"; hex: string }> = [
  { value: "green", key: "green", hex: "#16a34a" },
  { value: "blue", key: "blue", hex: "#2563eb" },
  { value: "yellow", key: "yellow", hex: "#d97706" },
  { value: "orange", key: "orange", hex: "#ea580c" },
  { value: "purple", key: "purple", hex: "#9333ea" },
  { value: "red", key: "red", hex: "#dc2626" },
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
  color: "blue",
  priority: "important",
  category: "work",
  dueDate: todayKey,
  dueTime: "09:00",
  alarmEnabled: false,
  alarmDate: todayKey,
  alarmTime: "09:00",
  listId,
  imageUrl: "",
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
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  // Handle clicking outside of menus
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (profileOpen && !avatarButtonRef.current?.contains(target) && !profileMenuRef.current?.contains(target)) {
        setProfileOpen(false);
      }
      if (viewDropdownOpen && !viewDropdownRef.current?.contains(target)) {
        setViewDropdownOpen(false);
      }
      if (moreMenuOpen && !moreMenuRef.current?.contains(target)) {
        setMoreMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [profileOpen, viewDropdownOpen, moreMenuOpen]);

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
          imageUrl: form.imageUrl.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Unable to create todo");
      const newTodo = normalizeTodo(await res.json());
      setTodos((currentTodos) => [newTodo, ...currentTodos]);
      setForm(createDefaultFormState(form.listId));
      setDialogMode(null);
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
      if (detailTodo && detailTodo.id === id) {
        setDetailTodo(updatedTodo);
      }
      return updatedTodo;
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("updateError"));
      return null;
    }
  }, [detailTodo, t]);

  const deleteTodo = useCallback(async () => {
    if (!deletingTodo) return;
    setError("");

    try {
      const res = await fetch(`${API_URL}/${deletingTodo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete todo");
      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== deletingTodo.id));
      if (detailTodo && detailTodo.id === deletingTodo.id) {
        setDetailTodo(null);
      }
      setDialogMode(null);
      setDeletingTodo(null);
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("deleteError"));
    }
  }, [deletingTodo, detailTodo, t]);

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
      if (detailTodo && detailTodo.id === todoId) {
        setDetailTodo(movedTodo);
      }
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("updateError"));
    }
  }, [detailTodo, t]);

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
      void fetchTodos();
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, [deletingList, fetchTodos]);

  /* ---- Modal / Action Handlers ---- */

  const openCreateDialog = useCallback((targetListId?: number) => {
    setForm(createDefaultFormState(targetListId ?? (lists[0]?.id || null)));
    setDialogMode("create");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [lists]);

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

  const openDetailModal = useCallback((todo: Todo) => {
    setDetailTodo(todo);
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailTodo(null);
  }, []);

  const monthLabel = currentMonth.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });

  /* ---- Render ---- */

  return (
    <main className="planner-app">
      <div className="planner-container">
        {/* Sidebar for Desktop */}
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="brand-mark">
            <div className="brand-glyph" aria-hidden="true"><LayoutDashboard size={20} /></div>
            <div><strong>{t("appName")}</strong><span>{t("workspace")}</span></div>
          </div>

          <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} variant="sidebar" />

          <div className="sidebar-create-section">
            <button type="button" className="sidebar-create-btn" onClick={() => openCreateDialog()}>
              <Plus size={18} />
              <span>{t("create")}</span>
            </button>
          </div>

          <div className="sidebar-summary">
            <span>{t("completion")}</span>
            <strong>{stats.progress}%</strong>
            <div className="progress-track"><i style={{ width: `${stats.progress}%` }} /></div>
          </div>
        </aside>

        {/* Workspace Main Area */}
        <section className="workspace">
          {/* Trello-Style Clean Topbar */}
          <header className="topbar trello-topbar">
            <div className="topbar-left-group">
              {/* View Switcher Dropdown */}
              <div className="topbar-view-switcher" ref={viewDropdownRef}>
                <button
                  type="button"
                  className="view-switcher-btn"
                  onClick={() => setViewDropdownOpen((prev) => !prev)}
                  aria-expanded={viewDropdownOpen}
                >
                  {activeView === "board" && <LayoutDashboard size={16} />}
                  {activeView === "calendar" && <CalendarDays size={16} />}
                  {activeView === "tasks" && <ListTodo size={16} />}
                  {activeView === "progress" && <BarChart3 size={16} />}
                  <span>{viewLabels[activeView]}</span>
                  <ChevronDown size={14} className={`dropdown-arrow ${viewDropdownOpen ? "open" : ""}`} />
                </button>

                {viewDropdownOpen && (
                  <div className="view-dropdown-menu">
                    <button type="button" className={activeView === "board" ? "is-active" : ""} onClick={() => { setActiveView("board"); setViewDropdownOpen(false); }}>
                      <LayoutDashboard size={16} /> <span>{t("board")}</span>
                    </button>
                    <button type="button" className={activeView === "calendar" ? "is-active" : ""} onClick={() => { setActiveView("calendar"); setViewDropdownOpen(false); }}>
                      <CalendarDays size={16} /> <span>{t("calendar")}</span>
                    </button>
                    <button type="button" className={activeView === "tasks" ? "is-active" : ""} onClick={() => { setActiveView("tasks"); setViewDropdownOpen(false); }}>
                      <ListTodo size={16} /> <span>{t("tasks")}</span>
                    </button>
                    <button type="button" className={activeView === "progress" ? "is-active" : ""} onClick={() => { setActiveView("progress"); setViewDropdownOpen(false); }}>
                      <BarChart3 size={16} /> <span>{t("analytics")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Action Tools */}
            <div className="header-actions">
              {/* Search Field */}
              <div className="topbar-search-box">
                <Search size={15} className="search-icon" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                />
                {search && <button type="button" className="clear-search-btn" onClick={() => setSearch("")}><X size={12} /></button>}
              </div>

              {/* Prominent Desktop "+ Create" Button */}
              <button
                type="button"
                className="trello-create-button desktop-only-btn"
                onClick={() => openCreateDialog()}
                aria-label={t("create")}
              >
                <Plus size={16} />
                <span>{t("create")}</span>
              </button>

              {/* Dark / Light Theme Toggle (Always visible) */}
              <button
                type="button"
                className="theme-quick-button"
                aria-label={t("theme")}
                onClick={toggleTheme}
                title={theme === "dark" ? t("light") : t("dark")}
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {/* Language Switcher */}
              <LanguageToggle language={language} onChange={setLanguage} />

              {/* User Profile Avatar */}
              <div className="user-area">
                <button
                  type="button"
                  className="avatar-button"
                  ref={avatarButtonRef}
                  aria-label={t("profile")}
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((isOpen) => !isOpen)}
                >
                  <User size={18} />
                </button>
              </div>

              {/* More Actions Menu */}
              <div className="more-menu-container desktop-only-btn" ref={moreMenuRef}>
                <button
                  type="button"
                  className="icon-btn more-btn"
                  onClick={() => setMoreMenuOpen((prev) => !prev)}
                  aria-label="More options"
                >
                  <MoreHorizontal size={18} />
                </button>
                {moreMenuOpen && (
                  <div className="more-dropdown-menu">
                    <button type="button" onClick={() => { void fetchTodos(); setMoreMenuOpen(false); }}>
                      <CheckCircle2 size={15} /> <span>รีเฟรชข้อมูล</span>
                    </button>
                    <button type="button" onClick={() => { setActiveView("progress"); setMoreMenuOpen(false); }}>
                      <BarChart3 size={15} /> <span>{t("analytics")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Popover */}
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

          {/* Board View */}
          {activeView === "board" && (
            <BoardView
              lists={lists}
              todos={visibleTodos}
              t={t}
              dateLocale={dateLocale}
              isLoading={isLoading}
              onAddCard={(listId) => openCreateDialog(listId)}
              onMoveCard={moveTodo}
              onToggle={(todo) => void updateTodo(todo.id, { completed: !todo.completed })}
              onEdit={openEditDialog}
              onDelete={requestDelete}
              onOpenDetail={openDetailModal}
              onCreateList={createList}
              onUpdateList={updateListTitle}
              onDeleteList={requestDeleteList}
            />
          )}

          {/* Calendar View */}
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
                <TaskPreview
                  title={formatDateHeading(selectedDate, dateLocale)}
                  todos={selectedDateTasks}
                  t={t}
                  dateLocale={dateLocale}
                  isLoading={isLoading}
                  onAdd={() => openCreateDialog()}
                  onToggle={(todo) => void updateTodo(todo.id, { completed: !todo.completed })}
                  onOpenDetail={openDetailModal}
                />
              </section>
            </section>
          )}

          {/* Tasks List View */}
          {activeView === "tasks" && (
            <section className="tasks-view" aria-label={t("taskList")}>
              <div className="task-toolbar">
                <label className="search-field" htmlFor="task-search">
                  <Search size={18} />
                  <input id="task-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} />
                </label>
                <select aria-label={t("priority")} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                  <option value="newest">{t("newest")}</option>
                  <option value="oldest">{t("oldest")}</option>
                  <option value="completed">{t("completed")}</option>
                  <option value="priority">{t("priority")}</option>
                </select>
                <button type="button" className="primary-button" onClick={() => openCreateDialog()}><Plus size={18} /> {t("addTask")}</button>
              </div>
              <FilterTabs filter={filter} onChange={setFilter} t={t} />
              <div className="task-board">
                {isLoading ? <SkeletonList /> : visibleTodos.length === 0 ? <EmptyState onAdd={() => openCreateDialog()} t={t} /> : visibleTodos.map((todo) => (
                  <TaskCard
                    key={todo.id}
                    todo={todo}
                    t={t}
                    dateLocale={dateLocale}
                    lists={lists}
                    onEdit={() => openEditDialog(todo)}
                    onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })}
                    onDelete={() => requestDelete(todo)}
                    onMove={moveTodo}
                    onOpenDetail={openDetailModal}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Analytics View */}
          {activeView === "progress" && (
            <AnalyticsView stats={stats} todos={todos} selectedMood={selectedMood} onMoodChange={setSelectedMood} t={t} />
          )}
        </section>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} variant="bottom" onCreateClick={() => openCreateDialog()} />

      {/* Task Detail Modal (Trello Card Details with Comments & Cover) */}
      {detailTodo && (
        <TaskDetailModal
          todo={detailTodo}
          lists={lists}
          t={t}
          dateLocale={dateLocale}
          onClose={closeDetailModal}
          onUpdate={updateTodo}
          onDelete={requestDelete}
          onMove={moveTodo}
        />
      )}

      {/* Create Task Modal */}
      {dialogMode === "create" && (
        <Modal title={t("createTask")} onClose={closeDialog}>
          <TaskForm
            form={form}
            setForm={setForm}
            t={t}
            inputRef={inputRef}
            onSubmit={addTodo}
            submitLabel={t("saveTask")}
            lists={lists}
            onCancel={closeDialog}
          />
        </Modal>
      )}

      {/* Quick Edit Title Modal */}
      {dialogMode === "edit" && editingTodo && (
        <Modal title={t("editTask")} onClose={closeDialog}>
          <form className="edit-title-form" onSubmit={(event) => { event.preventDefault(); void saveEditing(); }}>
            <label>{t("title")}<input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} autoFocus /></label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button>
              <button type="submit" className="save-button"><Check size={18} /> {t("save")}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Task Confirmation */}
      {dialogMode === "delete" && deletingTodo && (
        <Modal title={t("deleteTask")} onClose={closeDialog} destructive>
          <div className="delete-confirmation">
            <p>{t("deleteWarning")}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button>
              <button type="button" className="danger-button" onClick={() => void deleteTodo()}>{t("delete")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete List Confirmation */}
      {dialogMode === "deleteList" && deletingList && (
        <Modal title={t("deleteList")} onClose={closeDialog} destructive>
          <div className="delete-confirmation">
            <p>{t("deleteListWarning")}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button>
              <button type="button" className="danger-button" onClick={() => void confirmDeleteList()}>{t("delete")}</button>
            </div>
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
        <div className="profile-menu-header">
          <div className="profile-menu-avatar"><User size={20} /></div>
          <div>
            <strong>{t("userName")}</strong>
            <span>{t("userLevel")}</span>
          </div>
        </div>
        <button type="button" role="menuitem" onClick={onToggleTheme}><Palette size={16} /> {t("theme")} · {themeLabel}</button>
        <div className="menu-language" role="group" aria-label={t("language")}><span>{t("language")}</span><LanguageToggle language={language} onChange={setLanguage} /></div>
        <button type="button" role="menuitem" onClick={onClose}><LogOut size={16} /> {t("logout")}</button>
      </div>
    </div>
  );
});

function LanguageToggle({ language, onChange }: { language: "en" | "th"; onChange: (language: "en" | "th") => void }) {
  return <div className="language-toggle" role="group" aria-label="Language"><button type="button" className={language === "th" ? "is-active" : ""} onClick={() => onChange("th")}>TH</button><button type="button" className={language === "en" ? "is-active" : ""} onClick={() => onChange("en")}>EN</button></div>;
}

function Navigation({ activeView, labels, onChange, variant, onCreateClick }: { activeView: PlannerView; labels: Record<PlannerView, string>; onChange: (view: PlannerView) => void; variant: "sidebar" | "bottom"; onCreateClick?: () => void }) {
  const items: Array<{ view: PlannerView; icon: ReactNode }> = [
    { view: "board", icon: <LayoutDashboard size={19} /> },
    { view: "calendar", icon: <CalendarDays size={19} /> },
    { view: "tasks", icon: <ListTodo size={19} /> },
    { view: "progress", icon: <BarChart3 size={19} /> },
  ];

  if (variant === "bottom") {
    return (
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <button type="button" className={activeView === "board" ? "is-active" : ""} onClick={() => onChange("board")}>
          <LayoutDashboard size={19} />
          <span>{labels.board}</span>
        </button>
        <button type="button" className={activeView === "calendar" ? "is-active" : ""} onClick={() => onChange("calendar")}>
          <CalendarDays size={19} />
          <span>{labels.calendar}</span>
        </button>
        {onCreateClick && (
          <button type="button" className="add-nav-item" onClick={onCreateClick} aria-label="Create Task">
            <Plus size={22} />
            <span>สร้าง</span>
          </button>
        )}
        <button type="button" className={activeView === "tasks" ? "is-active" : ""} onClick={() => onChange("tasks")}>
          <ListTodo size={19} />
          <span>{labels.tasks}</span>
        </button>
        <button type="button" className={activeView === "progress" ? "is-active" : ""} onClick={() => onChange("progress")}>
          <BarChart3 size={19} />
          <span>{labels.progress}</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="nav-list" aria-label="Sidebar navigation">
      {items.map((item) => (
        <button
          key={item.view}
          type="button"
          className={activeView === item.view ? "is-active" : ""}
          onClick={() => onChange(item.view)}
          aria-current={activeView === item.view ? "page" : undefined}
        >
          {item.icon}
          <span>{labels[item.view]}</span>
        </button>
      ))}
    </nav>
  );
}

/* ============================================================ */
/*  Board View — Kanban                                          */
/* ============================================================ */

function BoardView({
  lists,
  todos,
  t,
  dateLocale,
  isLoading,
  onAddCard,
  onMoveCard,
  onToggle,
  onEdit,
  onDelete,
  onOpenDetail,
  onCreateList,
  onUpdateList,
  onDeleteList,
}: {
  lists: BoardList[];
  todos: Todo[];
  t: (key: TranslationKey) => string;
  dateLocale: string;
  isLoading: boolean;
  onAddCard: (listId: number) => void;
  onMoveCard: (todoId: number, listId: number) => void;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onOpenDetail: (todo: Todo) => void;
  onCreateList: (title: string) => void;
  onUpdateList: (id: number, title: string) => void;
  onDeleteList: (list: BoardList) => void;
}) {
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
          <div
            key={list.id}
            className={`board-column ${isDragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDragEnter={() => setOverListId(list.id)}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverListId(null); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId !== null) {
                onMoveCard(dragId, list.id);
                setDragId(null);
                setOverListId(null);
              }
            }}
          >
            <div className="board-column-header">
              {editListId === list.id ? (
                <form className="board-edit-form" onSubmit={(e) => { e.preventDefault(); if (editListTitle.trim()) { onUpdateList(list.id, editListTitle.trim()); } setEditListId(null); }}>
                  <input value={editListTitle} onChange={(e) => setEditListTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Escape") setEditListId(null); }} />
                  <button type="submit" className="icon-btn"><Check size={14} /></button>
                  <button type="button" className="icon-btn" onClick={() => setEditListId(null)}><X size={14} /></button>
                </form>
              ) : (
                <>
                  <div className="board-column-title">
                    <h3>{list.title}</h3>
                    <span className="board-column-count">{cards.length}</span>
                  </div>
                  <div className="board-column-actions">
                    <button type="button" className="icon-btn" onClick={() => { setEditListId(list.id); setEditListTitle(list.title); }} aria-label={t("editList")}><Pencil size={14} /></button>
                    <button type="button" className="icon-btn" onClick={() => onDeleteList(list)} aria-label={t("deleteList")}><Trash2 size={14} /></button>
                  </div>
                </>
              )}
            </div>

            <div className="board-column-body">
              {cards.map((todo) => (
                <div
                  key={todo.id}
                  className={`board-card color-${normalizeColor(todo.color)} ${todo.completed ? "is-completed" : ""} ${dragId === todo.id ? "is-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => { setDragId(todo.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDragId(null); setOverListId(null); }}
                  onClick={() => onOpenDetail(todo)}
                >
                  {/* Card Cover Image if attached */}
                  {todo.imageUrl && (
                    <div className="board-card-cover">
                      <img src={todo.imageUrl} alt="" loading="lazy" />
                    </div>
                  )}

                  {/* Vibrant Color Strip */}
                  <div className={`board-card-color color-${normalizeColor(todo.color)}`} />

                  <div className="board-card-content">
                    <div className="board-card-top">
                      <button
                        type="button"
                        className="complete-button"
                        onClick={(e) => { e.stopPropagation(); onToggle(todo); }}
                        aria-label={todo.completed ? "Pending" : "Completed"}
                      >
                        {todo.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      </button>
                      <h4 className={todo.completed ? "is-completed-text" : ""}>{todo.title}</h4>
                      <GripVertical size={14} className="drag-handle" aria-hidden="true" />
                    </div>

                    {todo.note && <p className="board-card-note">{todo.note}</p>}

                    <div className="board-card-meta">
                      <span className={`priority-badge ${normalizePriority(todo.priority)}`}>
                        <Flag size={11} />
                        {t(normalizePriority(todo.priority))}
                      </span>
                      <span><Folder size={11} />{t(normalizeCategory(todo.category))}</span>
                      {todo.dueDate && <span><CalendarDays size={11} />{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</span>}
                      {Boolean(todo.commentsCount && todo.commentsCount > 0) && (
                        <span className="comment-badge"><MessageSquare size={11} />{todo.commentsCount}</span>
                      )}
                    </div>

                    <div className="board-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="icon-btn" onClick={() => onEdit(todo)} aria-label="Edit title"><Pencil size={13} /></button>
                      <button type="button" className="icon-btn" onClick={() => onDelete(todo)} aria-label="Delete"><Trash2 size={13} /></button>
                      <select
                        className="board-card-move"
                        value={todo.listId ?? ""}
                        onChange={(e) => onMoveCard(todo.id, Number(e.target.value))}
                        aria-label={t("moveTask")}
                      >
                        {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" className="board-add-card" onClick={() => onAddCard(list.id)}>
                <Plus size={16} /> <span>{t("addCard")}</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* Add New List Column */}
      {newListMode ? (
        <div className="board-new-list card">
          <form onSubmit={(e) => { e.preventDefault(); if (newListTitle.trim()) { onCreateList(newListTitle.trim()); setNewListTitle(""); setNewListMode(false); } }}>
            <input
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              placeholder={t("listName")}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Escape") { setNewListMode(false); setNewListTitle(""); } }}
            />
            <div className="board-new-list-btns">
              <button type="submit" className="save-button"><Check size={16} /> {t("add")}</button>
              <button type="button" className="secondary-button" onClick={() => { setNewListMode(false); setNewListTitle(""); }}><X size={16} /></button>
            </div>
          </form>
        </div>
      ) : (
        <button type="button" className="board-add-list" onClick={() => setNewListMode(true)}>
          <Plus size={18} /> <span>{t("addList")}</span>
        </button>
      )}
    </section>
  );
}

/* ============================================================ */
/*  Task Detail Modal (Trello Card Details, Cover & Comments)    */
/* ============================================================ */

function TaskDetailModal({
  todo,
  lists,
  t,
  dateLocale,
  onClose,
  onUpdate,
  onDelete,
  onMove,
}: {
  todo: Todo;
  lists: BoardList[];
  t: (key: TranslationKey) => string;
  dateLocale: string;
  onClose: () => void;
  onUpdate: (id: number, updates: Partial<Todo>) => Promise<Todo | null>;
  onDelete: (todo: Todo) => void;
  onMove: (todoId: number, listId: number) => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [note, setNote] = useState(todo.note || "");
  const [isEditingNote, setIsEditingNote] = useState(!todo.note);
  const [color, setColor] = useState<TaskColor>(normalizeColor(todo.color));
  const [priority, setPriority] = useState<Priority>(normalizePriority(todo.priority));
  const [category, setCategory] = useState<Category>(normalizeCategory(todo.category));
  const [dueDate, setDueDate] = useState(getTodoDueDate(todo));
  const [dueTime, setDueTime] = useState(todo.dueTime || "09:00");
  const [imageUrl, setImageUrl] = useState(todo.imageUrl || "");
  const [comments, setComments] = useState<TodoComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageInputUrl, setImageInputUrl] = useState("");

  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch comments
  useEffect(() => {
    let isMounted = true;
    setIsCommentsLoading(true);

    fetch(`${API_URL}/${todo.id}/comments`)
      .then((res) => res.json())
      .then((data: TodoComment[]) => {
        if (isMounted) {
          setComments(Array.isArray(data) ? data : []);
          setIsCommentsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load comments", err);
        if (isMounted) setIsCommentsLoading(false);
      });

    return () => { isMounted = false; };
  }, [todo.id]);

  // Support Ctrl+V anywhere in the modal to paste image
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
              const base64Url = uploadEvent.target?.result as string;
              if (base64Url) {
                // If comment box is focused or has text, attach to comment; otherwise set cover!
                if (newComment.trim() || document.activeElement?.tagName === "TEXTAREA") {
                  setCommentImage(base64Url);
                } else {
                  setImageUrl(base64Url);
                  void onUpdate(todo.id, { imageUrl: base64Url });
                }
              }
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [newComment, onUpdate, todo.id]);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Url = uploadEvent.target?.result as string;
        if (base64Url) {
          setImageUrl(base64Url);
          void onUpdate(todo.id, { imageUrl: base64Url });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCommentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Url = uploadEvent.target?.result as string;
        if (base64Url) setCommentImage(base64Url);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyImageUrl = () => {
    if (imageInputUrl.trim()) {
      setImageUrl(imageInputUrl.trim());
      void onUpdate(todo.id, { imageUrl: imageInputUrl.trim() });
      setImageInputUrl("");
      setShowImageInput(false);
    }
  };

  const handleRemoveCover = () => {
    setImageUrl("");
    void onUpdate(todo.id, { imageUrl: null });
  };

  const handleSaveField = (key: keyof Todo, val: unknown) => {
    void onUpdate(todo.id, { [key]: val });
  };

  const handlePostComment = async () => {
    const text = newComment.trim();
    if ((!text && !commentImage) || isPostingComment) return;

    setIsPostingComment(true);
    try {
      const res = await fetch(`${API_URL}/${todo.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, author: "Maya", imageUrl: commentImage }),
      });

      if (res.ok) {
        const createdComment = (await res.json()) as TodoComment;
        setComments((prev) => [...prev, createdComment]);
        setNewComment("");
        setCommentImage(null);
      }
    } catch (err) {
      console.error("Failed to post comment", err);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  return (
    <div className="modal-layer detail-modal-layer" role="presentation" onMouseDown={onClose}>
      <article
        className="modal-card task-detail-card"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cover Header Banner (Trello style) */}
        {imageUrl ? (
          <div className="task-detail-cover">
            <img src={imageUrl} alt="Card Cover" />
            <div className="cover-actions-overlay">
              <button type="button" className="cover-action-btn" onClick={() => coverFileInputRef.current?.click()}>
                <ImageIcon size={14} /> <span>{t("uploadImage")}</span>
              </button>
              <button type="button" className="cover-action-btn destructive" onClick={handleRemoveCover}>
                <Trash2 size={14} /> <span>{t("removeImage")}</span>
              </button>
              <button type="button" className="cover-action-btn close-btn-cover" onClick={onClose}>
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="task-detail-header-bar">
            <div className="detail-top-tools">
              <button type="button" className="cover-add-btn" onClick={() => coverFileInputRef.current?.click()}>
                <ImageIcon size={15} /> <span>{t("coverImage")}</span>
              </button>
              <button type="button" className="cover-add-btn" onClick={() => setShowImageInput((prev) => !prev)}>
                <Plus size={15} /> <span>URL</span>
              </button>
              <span className="ctrl-v-hint">{t("pasteImageTip")}</span>
            </div>
            <button type="button" className="icon-btn close-modal-btn" onClick={onClose} aria-label={t("close")}>
              <X size={18} />
            </button>
          </div>
        )}

        <input
          type="file"
          ref={coverFileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleCoverUpload}
        />

        {showImageInput && (
          <div className="cover-url-box">
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={imageInputUrl}
              onChange={(e) => setImageInputUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApplyImageUrl(); }}
            />
            <button type="button" className="save-button" onClick={handleApplyImageUrl}><Check size={14} /> {t("save")}</button>
          </div>
        )}

        {/* Modal Header Row */}
        <div className="detail-modal-header">
          <div className="detail-list-badge">
            <span>{t("inList")}</span>
            <select
              value={todo.listId ?? ""}
              onChange={(e) => onMove(todo.id, Number(e.target.value))}
            >
              {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>

          <div className="detail-title-row">
            <button
              type="button"
              className={`detail-complete-checkmark ${todo.completed ? "is-done" : ""}`}
              onClick={() => {
                const next = !todo.completed;
                void onUpdate(todo.id, { completed: next });
              }}
              title={todo.completed ? "Mark incomplete" : "Mark complete"}
            >
              <CheckCircle2 size={24} />
            </button>

            <input
              className={`detail-title-input ${todo.completed ? "is-completed-text" : ""}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (title.trim() && title !== todo.title) handleSaveField("title", title.trim()); }}
              placeholder={t("title")}
            />
          </div>

          {/* Members & Labels Bar (Trello Style) */}
          <div className="detail-chips-bar">
            <div className="detail-chip-group">
              <span className="chip-label">{t("members")}</span>
              <div className="member-pill"><User size={13} /> <span>Maya</span></div>
            </div>

            <div className="detail-chip-group">
              <span className="chip-label">{t("labels")}</span>
              <div className={`label-badge-pill color-${color}`} style={{ backgroundColor: COLOR_OPTIONS.find((c) => c.value === color)?.hex }}>
                <span>{t(category)}</span>
              </div>
              <span className={`priority-badge-pill ${priority}`}>
                <Flag size={12} /> {t(priority)}
              </span>
            </div>

            <div className="detail-chip-group">
              <span className="chip-label">{t("dates")}</span>
              <div className="date-chip-pill">
                <CalendarDays size={13} />
                <span>{formatDateHeading(dueDate, dateLocale, true)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Content Grid */}
        <div className="task-detail-grid">
          {/* Main Left Column */}
          <div className="detail-main-col">
            {/* Description Section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <div className="detail-section-title">
                  <Folder size={16} /> <span>{t("description")}</span>
                </div>
                {!isEditingNote && (
                  <button type="button" className="edit-section-btn" onClick={() => setIsEditingNote(true)}>
                    <Pencil size={13} /> {t("editTask")}
                  </button>
                )}
              </div>

              {isEditingNote ? (
                <div className="note-editor-wrap">
                  <textarea
                    className="detail-note-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("notePlaceholder")}
                    rows={4}
                    autoFocus
                  />
                  <div className="note-editor-actions">
                    <button
                      type="button"
                      className="save-button"
                      onClick={() => {
                        handleSaveField("note", note);
                        setIsEditingNote(false);
                      }}
                    >
                      <Check size={14} /> {t("save")}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setIsEditingNote(false)}>
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="detail-note-display" onClick={() => setIsEditingNote(true)}>
                  {note ? <p>{note}</p> : <p className="placeholder-text">{t("notePlaceholder")}</p>}
                </div>
              )}
            </div>

            {/* Attachments Section (If card has cover/image) */}
            {imageUrl && (
              <div className="detail-section">
                <div className="detail-section-title">
                  <Paperclip size={16} /> <span>{t("coverImage")}</span>
                </div>
                <div className="attachment-card">
                  <img src={imageUrl} alt="attachment" className="attachment-thumb" />
                  <div className="attachment-info">
                    <strong>ภาพหน้าปกการ์ด</strong>
                    <small>แนบเรียบร้อยแล้ว</small>
                    <div className="attachment-actions">
                      <button type="button" className="attachment-action-btn" onClick={handleRemoveCover}>
                        <Trash2 size={12} /> {t("removeImage")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comments & Activity Timeline */}
            <div className="detail-section comments-section">
              <div className="detail-section-title">
                <MessageSquare size={16} />
                <span>{t("comments")}</span>
                <span className="comments-badge-count">{comments.length}</span>
              </div>

              {/* Add Comment Box */}
              <div className="comment-compose-box">
                <div className="comment-avatar"><User size={16} /></div>
                <div className="comment-compose-input-wrap">
                  <textarea
                    placeholder={t("writeComment")}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        void handlePostComment();
                      }
                    }}
                    rows={2}
                  />

                  {/* Real-time image preview in comment */}
                  {commentImage && (
                    <div className="comment-image-preview">
                      <img src={commentImage} alt="comment-attachment" />
                      <button type="button" className="remove-comment-img-btn" onClick={() => setCommentImage(null)}>
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <div className="comment-compose-actions">
                    <button
                      type="button"
                      className="attach-btn"
                      onClick={() => commentFileInputRef.current?.click()}
                      title="Attach image or paste with Ctrl+V"
                    >
                      <Paperclip size={15} /> <span>แนบรูป</span>
                    </button>
                    <input
                      type="file"
                      ref={commentFileInputRef}
                      style={{ display: "none" }}
                      accept="image/*"
                      onChange={handleCommentImageUpload}
                    />

                    <button
                      type="submit"
                      className="save-button"
                      disabled={(!newComment.trim() && !commentImage) || isPostingComment}
                      onClick={() => void handlePostComment()}
                    >
                      <Send size={14} /> <span>{t("postComment")}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Comment History List */}
              <div className="comments-history-list">
                {isCommentsLoading ? (
                  <div className="skeleton-list compact"><span /><span /></div>
                ) : comments.length === 0 ? (
                  <p className="no-comments-text">{t("noCommentsYet")}</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="comment-bubble-item">
                      <div className="comment-avatar"><User size={15} /></div>
                      <div className="comment-bubble-content">
                        <div className="comment-bubble-header">
                          <strong>{comment.author}</strong>
                          <small>{formatRelativeTime(comment.createdAt, dateLocale)}</small>
                          <button
                            type="button"
                            className="icon-btn delete-comment-btn"
                            onClick={() => void handleDeleteComment(comment.id)}
                            aria-label={t("deleteComment")}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {comment.content && <p className="comment-bubble-text">{comment.content}</p>}
                        {comment.imageUrl && (
                          <div className="comment-bubble-img-wrap">
                            <img src={comment.imageUrl} alt="attached screenshot" loading="lazy" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar Column: Properties */}
          <aside className="detail-sidebar-col">
            {/* Priority Selector */}
            <div className="detail-prop-card">
              <label><Flag size={14} /> <span>{t("priority")}</span></label>
              <select
                value={priority}
                onChange={(e) => {
                  const val = e.target.value as Priority;
                  setPriority(val);
                  handleSaveField("priority", val);
                }}
              >
                {PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}
              </select>
            </div>

            {/* Category Selector */}
            <div className="detail-prop-card">
              <label><Folder size={14} /> <span>{t("category")}</span></label>
              <select
                value={category}
                onChange={(e) => {
                  const val = e.target.value as Category;
                  setCategory(val);
                  handleSaveField("category", val);
                }}
              >
                {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}
              </select>
            </div>

            {/* Due Date & Time */}
            <div className="detail-prop-card">
              <label><CalendarDays size={14} /> <span>{t("dueDate")}</span></label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  handleSaveField("dueDate", e.target.value);
                }}
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => {
                  setDueTime(e.target.value);
                  handleSaveField("dueTime", e.target.value);
                }}
              />
            </div>

            {/* Vibrant Color Swatches */}
            <div className="detail-prop-card">
              <label><Palette size={14} /> <span>{t("color")}</span></label>
              <div className="detail-color-grid">
                {COLOR_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`detail-color-btn color-${item.value} ${color === item.value ? "is-selected" : ""}`}
                    onClick={() => {
                      setColor(item.value);
                      handleSaveField("color", item.value);
                    }}
                    style={{ backgroundColor: item.hex }}
                    aria-label={t(item.key)}
                  >
                    {color === item.value && <Check size={14} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="detail-actions-group">
              <button
                type="button"
                className="secondary-button detail-action-btn danger-text"
                onClick={() => {
                  onClose();
                  onDelete(todo);
                }}
              >
                <Trash2 size={15} /> <span>{t("delete")}</span>
              </button>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}

/* ============================================================ */
/*  Task Form (Modal Create with Instant Image Preview)          */
/* ============================================================ */

function TaskForm({
  form,
  setForm,
  t,
  onSubmit,
  submitLabel,
  inputRef,
  onCancel,
  compact = false,
  lists,
}: {
  form: TaskFormState;
  setForm: (form: TaskFormState) => void;
  t: (key: TranslationKey) => string;
  onSubmit: () => void;
  submitLabel: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onCancel?: () => void;
  compact?: boolean;
  lists?: BoardList[];
}) {
  const updateField = <Key extends keyof TaskFormState>(key: Key, value: TaskFormState[Key]) => setForm({ ...form, [key]: value });
  const filePickerRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        if (base64) updateField("imageUrl", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Support Ctrl+V paste directly on create form
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const base64 = ev.target?.result as string;
              if (base64) updateField("imageUrl", base64);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  return (
    <form className={compact ? "task-form compact cardless" : "task-form card"} onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      {lists && lists.length > 0 && (
        <label>
          {t("list")}
          <select value={form.listId ?? ""} onChange={(event) => updateField("listId", Number(event.target.value) || null)}>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </label>
      )}

      {/* Real-time Image Preview Banner if Image exists */}
      {form.imageUrl && (
        <div className="form-live-image-preview">
          <img src={form.imageUrl} alt="preview" />
          <button type="button" className="remove-preview-btn" onClick={() => updateField("imageUrl", "")} title="Remove image">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="form-grid two">
        <label>
          {t("title")}
          <input ref={inputRef} value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder={t("titlePlaceholder")} autoFocus />
        </label>
        <label>
          {t("category")}
          <select value={form.category} onChange={(event) => updateField("category", event.target.value as Category)}>
            {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}
          </select>
        </label>
      </div>

      <label>
        {t("note")}
        <textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder={t("notePlaceholder")} rows={3} />
      </label>

      {/* Image Cover Input & Upload */}
      <div className="form-image-attachment">
        <label>{t("coverImage")}</label>
        <div className="form-image-row">
          <input
            type="url"
            placeholder="https://..."
            value={form.imageUrl}
            onChange={(e) => updateField("imageUrl", e.target.value)}
          />
          <button type="button" className="secondary-button" onClick={() => filePickerRef.current?.click()}>
            <Upload size={14} /> <span>{t("uploadImage")}</span>
          </button>
          <input type="file" ref={filePickerRef} style={{ display: "none" }} accept="image/*" onChange={handleImageFile} />
        </div>
        <small className="form-paste-hint">{t("pasteImageTip")}</small>
      </div>

      <div className="form-grid two">
        <label>{t("dueDate")}<input type="date" value={form.dueDate} onChange={(event) => updateField("dueDate", event.target.value)} /></label>
        <label>{t("dueTime")}<input type="time" value={form.dueTime} onChange={(event) => updateField("dueTime", event.target.value)} /></label>
      </div>

      <div className="form-grid two">
        <label>
          {t("priority")}
          <select value={form.priority} onChange={(event) => updateField("priority", event.target.value as Priority)}>
            {PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}
          </select>
        </label>
        <fieldset className="color-picker">
          <legend>{t("color")}</legend>
          <div>
            {COLOR_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={form.color === item.value ? `color-swatch ${item.value} is-selected` : `color-swatch ${item.value}`}
                onClick={() => updateField("color", item.value)}
                aria-pressed={form.color === item.value}
              >
                <span style={{ backgroundColor: item.hex }} />
                {t(item.key)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <section className="alarm-box" aria-label={t("reminder")}>
        <div><strong>{t("reminder")}</strong><span>{t("alarmDate")} / {t("alarmTime")}</span></div>
        <label className="switch"><input type="checkbox" checked={form.alarmEnabled} onChange={(event) => updateField("alarmEnabled", event.target.checked)} /><span />{t("reminder")}</label>
        {form.alarmEnabled && (
          <div className="form-grid two alarm-inputs">
            <label>{t("alarmDate")}<input type="date" value={form.alarmDate} onChange={(event) => updateField("alarmDate", event.target.value)} /></label>
            <label>{t("alarmTime")}<input type="time" value={form.alarmTime} onChange={(event) => updateField("alarmTime", event.target.value)} /></label>
          </div>
        )}
      </section>

      <div className="form-actions">
        {onCancel && <button type="button" className="secondary-button" onClick={onCancel}>{t("cancel")}</button>}
        <button type="submit" className="save-button"><Check size={18} /> {submitLabel}</button>
      </div>
    </form>
  );
}

/* ============================================================ */
/*  Other Views & Shared Subcomponents                           */
/* ============================================================ */

function CalendarPanel({ days, monthLabel, taskDates, dateLocale, t, onPrevious, onNext, onSelect }: { days: CalendarDay[]; monthLabel: string; taskDates: Set<string>; dateLocale: string; t: (key: TranslationKey) => string; onPrevious: () => void; onNext: () => void; onSelect: (date: Date) => void }) {
  return <section className="calendar-card card"><div className="calendar-header"><div><span className="eyebrow">{t("monthPlanner")}</span><h2>{monthLabel}</h2></div><div className="month-actions"><button type="button" aria-label={t("previousMonth")} onClick={onPrevious}><ChevronLeft size={18} /></button><button type="button" aria-label={t("nextMonth")} onClick={onNext}><ChevronRight size={18} /></button></div></div><div className="weekday-grid" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => <button key={day.key} type="button" className={`${day.isOutside ? "is-outside" : ""} ${day.isToday ? "is-today" : ""} ${day.isSelected ? "is-selected" : ""}`} onClick={() => onSelect(day.date)} aria-label={day.date.toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}><span>{day.date.getDate()}</span>{taskDates.has(toDateInputValue(day.date)) && <i aria-hidden="true" />}<div className="day-number-label">{day.date.getDate()}</div></button>)}</div></section>;
}

function TaskPreview({ title, todos, t, dateLocale, isLoading, onAdd, onToggle, onOpenDetail }: { title: string; todos: Todo[]; t: (key: TranslationKey) => string; dateLocale: string; isLoading: boolean; onAdd: () => void; onToggle: (todo: Todo) => void; onOpenDetail: (todo: Todo) => void }) {
  return <section className="card task-preview"><div className="section-title"><div><span className="eyebrow">{t("selectedDay")}</span><h2>{title}</h2></div><button type="button" onClick={onAdd}>{t("add")}</button></div>{isLoading ? <SkeletonList compact /> : todos.length === 0 ? <p className="muted-empty">{t("noTasksDate")}</p> : todos.slice(0, 5).map((todo) => <button key={todo.id} type="button" className={`preview-row color-${normalizeColor(todo.color)}`} onClick={() => onOpenDetail(todo)}><span onClick={(e) => { e.stopPropagation(); onToggle(todo); }}>{todo.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span><span>{todo.title}</span><small>{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</small></button>)}</section>;
}

function TaskCard({ todo, t, dateLocale, lists, onEdit, onToggle, onDelete, onMove, onOpenDetail }: { todo: Todo; t: (key: TranslationKey) => string; dateLocale: string; lists: BoardList[]; onEdit: () => void; onToggle: () => void; onDelete: () => void; onMove: (todoId: number, listId: number) => void; onOpenDetail: (todo: Todo) => void }) {
  const priority = normalizePriority(todo.priority);
  const category = normalizeCategory(todo.category);
  const color = normalizeColor(todo.color);
  const alarmActive = Boolean(todo.alarmEnabled || todo.alarm);

  return (
    <article className={`task-card color-${color} ${todo.completed ? "is-completed" : ""}`} onClick={() => onOpenDetail(todo)}>
      <button type="button" className="complete-button" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={todo.completed ? t("pending") : t("completed")}>
        {todo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      <div className="task-content">
        <h3>{todo.title}</h3>
        {todo.note && <p>{todo.note}</p>}
        <div className="task-meta">
          <span><Folder size={14} />{t(category)}</span>
          <span className={`priority-badge ${priority}`}><Flag size={14} />{t(priority)}</span>
          <span><CalendarDays size={14} />{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</span>
          {todo.dueTime && <span><Clock size={14} />{todo.dueTime}</span>}
          {alarmActive && <span className="reminder-badge"><Bell size={14} />{formatAlarm(todo.alarmDateTime, dateLocale)}</span>}
          {Boolean(todo.commentsCount && todo.commentsCount > 0) && (
            <span className="comment-badge"><MessageSquare size={13} />{todo.commentsCount}</span>
          )}
          {lists.length > 0 && (
            <select
              className="task-move-select"
              value={todo.listId ?? ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onMove(todo.id, Number(e.target.value))}
              aria-label={t("moveTask")}
            >
              {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onEdit} aria-label={t("editTask")}><Pencil size={17} /></button>
        <button type="button" onClick={onDelete} aria-label={t("delete")}><Trash2 size={17} /></button>
      </div>
    </article>
  );
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
  return {
    ...todo,
    color: normalizeColor(todo.color),
    priority: normalizePriority(todo.priority),
    category: normalizeCategory(todo.category),
    dueDate: todo.dueDate ?? todo.created_at?.slice(0, 10) ?? todayKey,
    dueTime: normalizeTime(todo.dueTime),
    alarmEnabled: Boolean(todo.alarmEnabled ?? todo.alarm),
    listId: todo.listId ?? undefined,
    imageUrl: todo.imageUrl ?? null,
    commentsCount: Number(todo.commentsCount ?? 0),
  };
}

function normalizeColor(value?: string): TaskColor {
  return COLOR_OPTIONS.some((item) => item.value === value) ? (value as TaskColor) : "blue";
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

function formatRelativeTime(dateString: string, locale: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return locale.startsWith("th") ? "เมื่อสักครู่" : "Just now";
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return locale.startsWith("th") ? `${mins} นาทีที่แล้ว` : `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return locale.startsWith("th") ? `${hours} ชม. ที่แล้ว` : `${hours}h ago`;
  }
  return date.toLocaleDateString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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