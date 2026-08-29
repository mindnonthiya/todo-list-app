import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Edit2,
  Flame,
  Folder,
  Flag,
  GripVertical,
  ImageIcon,
  LayoutDashboard,
  ListTodo,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Palette,
  Paperclip,
  Pencil,
  Plus,
  Search,
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
type CalendarViewMode = "month" | "week" | "day" | "agenda";
type TaskColor = "green" | "blue" | "yellow" | "orange" | "purple" | "red";
type Priority = "normal" | "important" | "urgent";
type Category = "work" | "study" | "personal" | "health" | "other";
type SortMode = "newest" | "oldest" | "completed" | "priority";
type Mood = "happy" | "calm" | "tired" | "motivated";
type DialogMode = "edit" | "delete" | "deleteList" | "create" | "createBoard" | null;

interface Board {
  id: number;
  title: string;
  color?: string;
  created_at?: string;
}

interface BoardList {
  id: number;
  board_id?: number;
  title: string;
  position: number;
  color?: string;
  created_at?: string;
}

interface Todo {
  id: number;
  boardId?: number;
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
  images?: string[];
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
  updatedAt?: string;
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
  boardId: number | null;
  listId: number | null;
  imageUrl: string;
  images: string[];
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api";
const todayKey = toDateInputValue(new Date());

const COLOR_OPTIONS: Array<{ value: TaskColor; key: "green" | "blue" | "yellow" | "orange" | "purple" | "red"; hex: string }> = [
  { value: "red", key: "red", hex: "#ef4444" },
  { value: "blue", key: "blue", hex: "#3b82f6" },
  { value: "green", key: "green", hex: "#10b981" },
  { value: "yellow", key: "yellow", hex: "#f59e0b" },
  { value: "orange", key: "orange", hex: "#f97316" },
  { value: "purple", key: "purple", hex: "#8b5cf6" },
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

const createDefaultFormState = (boardId: number | null = null, listId: number | null = null, defaultDate: string = todayKey): TaskFormState => ({
  title: "",
  note: "",
  color: "red",
  priority: "important",
  category: "work",
  dueDate: defaultDate,
  dueTime: "09:00",
  alarmEnabled: false,
  alarmDate: defaultDate,
  alarmTime: "09:00",
  boardId,
  listId,
  imageUrl: "",
  images: [],
});

/* ============================================================ */
/*  Main Component                                               */
/* ============================================================ */

export default function TodoList() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // Multi-Board States
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");

  const [todos, setTodos] = useState<Todo[]>([]);
  const [lists, setLists] = useState<BoardList[]>([]);
  const [form, setForm] = useState<TaskFormState>(() => createDefaultFormState());
  const [filter, setFilter] = useState<Filter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<PlannerView>("board");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>("month");
  const [calendarViewMenuOpen, setCalendarViewMenuOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood>("calm");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingTodo, setDeletingTodo] = useState<Todo | null>(null);
  const [deletingList, setDeletingList] = useState<BoardList | null>(null);
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  const dateLocale = language === "th" ? "th-TH" : "en-US";

  /* ---- Fetch Boards ---- */

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/boards`);
      if (!res.ok) throw new Error("Unable to load boards");
      const data = (await res.json()) as Board[];
      setBoards(data);
      if (data.length > 0 && !activeBoardId) {
        setActiveBoardId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeBoardId]);

  /* ---- Fetch Lists & Todos for Active Board ---- */

  const fetchListsAndTodos = useCallback(async (boardId: number | null) => {
    setIsLoading(true);
    setError("");

    try {
      const queryParam = boardId ? `?boardId=${boardId}` : "";
      const [listRes, todoRes] = await Promise.all([
        fetch(`${API_BASE}/lists${queryParam}`),
        fetch(`${API_BASE}/todos${queryParam}`),
      ]);

      if (!listRes.ok || !todoRes.ok) throw new Error("Unable to load board data");

      const listData = (await listRes.json()) as BoardList[];
      const todoData = (await todoRes.json()) as Todo[];

      setLists(listData);
      setTodos(todoData.map(normalizeTodo));
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("apiError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (activeBoardId) {
      void fetchListsAndTodos(activeBoardId);
    }
  }, [activeBoardId, fetchListsAndTodos]);

  // Click outside menus
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (boardDropdownOpen && !boardDropdownRef.current?.contains(target)) {
        setBoardDropdownOpen(false);
      }
      if (moreMenuOpen && !moreMenuRef.current?.contains(target)) {
        setMoreMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [boardDropdownOpen, moreMenuOpen]);

  /* ---- Derived data ---- */

  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0] || { id: 1, title: "Main Board" };
  }, [boards, activeBoardId]);

  const today = useMemo(() => new Date(), []);
  const stats = useMemo(() => buildStats(todos, today), [today, todos]);
  const calendarDays = useMemo(() => buildCalendarDays(currentDate, selectedDate), [currentDate, selectedDate]);

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
        return (a.position ?? 0) - (b.position ?? 0) || timestamp(b.created_at) - timestamp(a.created_at);
      });
  }, [filter, search, sortMode, todos]);

  const viewLabels = useMemo<Record<PlannerView, string>>(() => ({
    board: t("board"),
    calendar: t("calendar"),
    tasks: t("tasks"),
    progress: t("analytics"),
  }), [t]);

  /* ---- CRUD: Boards ---- */

  const handleCreateBoard = async () => {
    const title = newBoardTitle.trim();
    if (!title) return;

    try {
      const res = await fetch(`${API_BASE}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (res.ok) {
        const created = (await res.json()) as Board;
        setBoards((prev) => [...prev, created]);
        setActiveBoardId(created.id);
        setNewBoardTitle("");
        setDialogMode(null);
        setBoardDropdownOpen(false);
      }
    } catch (err) {
      console.error("Failed to create board", err);
    }
  };

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
      const res = await fetch(`${API_BASE}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: activeBoardId,
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
          images: form.images,
        }),
      });

      if (!res.ok) throw new Error("Unable to create todo");
      const newTodo = normalizeTodo(await res.json());
      setTodos((currentTodos) => [newTodo, ...currentTodos]);
      setForm(createDefaultFormState(activeBoardId, form.listId));
      setDialogMode(null);
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("addError"));
    }
  }, [activeBoardId, form, t]);

  const updateTodo = useCallback(async (id: number, updates: Partial<Todo>) => {
    setError("");

    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, {
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
      const res = await fetch(`${API_BASE}/todos/${deletingTodo.id}`, { method: "DELETE" });
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

  // Smooth Optimistic Drag & Drop with Zero Flickering / No Reload
  const moveTodo = useCallback((todoId: number, targetListId: number, targetPos?: number) => {
    setTodos((currentTodos) => {
      const todoToMove = currentTodos.find((t) => t.id === todoId);
      if (!todoToMove) return currentTodos;

      const remaining = currentTodos.filter((t) => t.id !== todoId);
      const targetListItems = remaining
        .filter((t) => t.listId === targetListId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      const insertIndex = typeof targetPos === "number" ? Math.max(0, Math.min(targetPos, targetListItems.length)) : targetListItems.length;

      targetListItems.splice(insertIndex, 0, {
        ...todoToMove,
        listId: targetListId,
        position: insertIndex,
      });

      const reindexedTarget = targetListItems.map((t, idx) => ({ ...t, position: idx }));
      const otherListsItems = remaining.filter((t) => t.listId !== targetListId);

      return [...otherListsItems, ...reindexedTarget];
    });

    if (detailTodo && detailTodo.id === todoId) {
      setDetailTodo((prev) => prev ? { ...prev, listId: targetListId, position: targetPos ?? prev.position } : null);
    }

    // Silent background sync with server
    fetch(`${API_BASE}/todos/${todoId}/move`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: targetListId, position: targetPos }),
    }).catch((err) => {
      console.error("Move error:", err);
    });
  }, [detailTodo]);

  /* ---- CRUD: Lists ---- */

  const createList = useCallback(async (title: string) => {
    try {
      const res = await fetch(`${API_BASE}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, boardId: activeBoardId }),
      });
      if (!res.ok) throw new Error("Unable to create list");
      const newList = (await res.json()) as BoardList;
      setLists((cur) => [...cur, newList]);
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, [activeBoardId]);

  const updateListTitle = useCallback(async (id: number, title: string) => {
    try {
      const res = await fetch(`${API_BASE}/lists/${id}`, {
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
      const res = await fetch(`${API_BASE}/lists/${deletingList.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete list");
      setLists((cur) => cur.filter((l) => l.id !== deletingList.id));
      setDialogMode(null);
      setDeletingList(null);
      if (activeBoardId) void fetchListsAndTodos(activeBoardId);
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, [activeBoardId, deletingList, fetchListsAndTodos]);

  /* ---- Modal / Action Handlers ---- */

  const openCreateDialog = useCallback((targetListId?: number, defaultDate?: string) => {
    setForm(createDefaultFormState(activeBoardId, targetListId ?? (lists[0]?.id || null), defaultDate || todayKey));
    setDialogMode("create");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [activeBoardId, lists]);

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

  // Navigation handlers for calendar view
  const handleCalendarPrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (calendarViewMode === "day") {
        d.setDate(d.getDate() - 1);
        setSelectedDate(toDateInputValue(d));
      } else if (calendarViewMode === "week") {
        d.setDate(d.getDate() - 7);
        setSelectedDate(toDateInputValue(d));
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleCalendarNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (calendarViewMode === "day") {
        d.setDate(d.getDate() + 1);
        setSelectedDate(toDateInputValue(d));
      } else if (calendarViewMode === "week") {
        d.setDate(d.getDate() + 7);
        setSelectedDate(toDateInputValue(d));
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleCalendarToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(todayKey);
  };

  const handleMonthPickerChange = (yearMonth: string) => {
    if (!yearMonth) return;
    const [year, month] = yearMonth.split("-").map(Number);
    if (year && month) {
      const nextDate = new Date(year, month - 1, 1);
      setCurrentDate(nextDate);
      setSelectedDate(toDateInputValue(nextDate));
    }
  };

  const monthLabel = currentDate.toLocaleDateString(dateLocale, { month: "short", year: "numeric" });

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
          {/* Trello-Style Clean Multi-Board Topbar */}
          <header className="topbar trello-topbar">
            <div className="topbar-left-group">
              {/* Board Selector Dropdown (Like Trello topbar) */}
              <div className="topbar-board-switcher" ref={boardDropdownRef}>
                <button
                  type="button"
                  className="board-switcher-btn"
                  onClick={() => setBoardDropdownOpen((prev) => !prev)}
                  aria-expanded={boardDropdownOpen}
                  title="Switch board"
                >
                  <LayoutDashboard size={16} className="board-icon" />
                  <strong className="board-title-truncate">{currentBoard.title}</strong>
                  <ChevronDown size={14} className={`dropdown-arrow ${boardDropdownOpen ? "open" : ""}`} />
                </button>

                {boardDropdownOpen && (
                  <div className="board-dropdown-menu">
                    <div className="dropdown-section-title">{t("boards")}</div>
                    <div className="boards-list-scroll">
                      {boards.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={b.id === activeBoardId ? "is-active" : ""}
                          onClick={() => {
                            setActiveBoardId(b.id);
                            setBoardDropdownOpen(false);
                          }}
                        >
                          <LayoutDashboard size={14} />
                          <span>{b.title}</span>
                          {b.id === activeBoardId && <Check size={14} className="check-active" />}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="create-new-board-btn"
                      onClick={() => {
                        setDialogMode("createBoard");
                        setBoardDropdownOpen(false);
                      }}
                    >
                      <Plus size={15} />
                      <span>{t("createBoard")}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* "+ สร้างบอร์ดใหม่" Button right next to Board selector */}
              <button
                type="button"
                className="topbar-create-board-btn"
                onClick={() => setDialogMode("createBoard")}
                title={t("createBoard")}
              >
                <Plus size={15} />
                <span className="create-board-btn-text">{t("createBoard")}</span>
              </button>
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

              {/* Desktop Theme Toggle */}
              <button
                type="button"
                className="theme-quick-button desktop-only-btn"
                aria-label={t("theme")}
                onClick={toggleTheme}
                title={theme === "dark" ? t("light") : t("dark")}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Desktop Language Switcher */}
              <div className="desktop-only-btn">
                <LanguageToggle language={language} onChange={setLanguage} />
              </div>

              {/* Desktop User Profile Badge (Clean info, no unnecessary menu) */}
              <div className="user-profile-badge desktop-only-btn">
                <User size={14} className="user-badge-icon" />
                <span>Nonthiya (mj.)</span>
              </div>

              {/* Desktop More Menu */}
              <div className="more-menu-container desktop-only-btn" ref={moreMenuRef}>
                <button
                  type="button"
                  className="icon-btn more-btn"
                  onClick={() => setMoreMenuOpen((prev) => !prev)}
                  aria-label="More options"
                >
                  <MoreHorizontal size={17} />
                </button>
                {moreMenuOpen && (
                  <div className="more-dropdown-menu">
                    <button type="button" onClick={() => { if (activeBoardId) void fetchListsAndTodos(activeBoardId); setMoreMenuOpen(false); }}>
                      <CheckCircle2 size={15} /> <span>รีเฟรชข้อมูล</span>
                    </button>
                    <button type="button" onClick={() => { setActiveView("progress"); setMoreMenuOpen(false); }}>
                      <BarChart3 size={15} /> <span>{t("analytics")}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Hamburger Menu (☰) */}
              <button
                type="button"
                className="mobile-hamburger-btn"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </header>

          {/* Mobile Drawer (Hamburger Menu Sheet) */}
          {mobileDrawerOpen && (
            <div className="mobile-drawer-layer" onClick={() => setMobileDrawerOpen(false)}>
              <aside className="mobile-drawer" ref={mobileDrawerRef} onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                  <div className="drawer-user-info">
                    <div className="drawer-avatar"><User size={18} /></div>
                    <div>
                      <strong>Nonthiya (mj.)</strong>
                      <small>{currentBoard.title}</small>
                    </div>
                  </div>
                  <button type="button" className="icon-btn" onClick={() => setMobileDrawerOpen(false)}><X size={18} /></button>
                </div>

                <div className="drawer-menu-list">
                  {/* Theme Switcher Row */}
                  <div className="drawer-item" onClick={toggleTheme}>
                    <div className="drawer-item-left">
                      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                      <span>{t("theme")}</span>
                    </div>
                    <span className="drawer-badge">{theme === "dark" ? t("light") : t("dark")}</span>
                  </div>

                  {/* Language Switcher Row */}
                  <div className="drawer-item">
                    <div className="drawer-item-left">
                      <Palette size={17} />
                      <span>{t("language")}</span>
                    </div>
                    <LanguageToggle language={language} onChange={setLanguage} />
                  </div>

                  {/* Switch to Analytics */}
                  <div className="drawer-item" onClick={() => { setActiveView("progress"); setMobileDrawerOpen(false); }}>
                    <div className="drawer-item-left">
                      <BarChart3 size={17} />
                      <span>{t("analytics")}</span>
                    </div>
                  </div>

                  {/* Refresh Board */}
                  <div className="drawer-item" onClick={() => { if (activeBoardId) void fetchListsAndTodos(activeBoardId); setMobileDrawerOpen(false); }}>
                    <div className="drawer-item-left">
                      <CheckCircle2 size={17} />
                      <span>รีเฟรชบอร์ด</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}

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
              onToggle={(todo: Todo) => void updateTodo(todo.id, { completed: !todo.completed })}
              onEdit={openEditDialog}
              onDelete={requestDelete}
              onOpenDetail={openDetailModal}
              onCreateList={createList}
              onUpdateList={updateListTitle}
              onDeleteList={requestDeleteList}
            />
          )}

          {/* Calendar View (100% Functional Multi-View: Month, Week, Day, Agenda) */}
          {activeView === "calendar" && (
            <CalendarPlannerView
              boardTitle={currentBoard.title}
              todos={todos}
              currentDate={currentDate}
              selectedDate={selectedDate}
              calendarDays={calendarDays}
              viewMode={calendarViewMode}
              viewMenuOpen={calendarViewMenuOpen}
              monthLabel={monthLabel}
              dateLocale={dateLocale}
              t={t}
              isLoading={isLoading}
              onSelectDate={(dateStr) => setSelectedDate(dateStr)}
              onPrev={handleCalendarPrev}
              onNext={handleCalendarNext}
              onToday={handleCalendarToday}
              onMonthPickerChange={handleMonthPickerChange}
              onSetViewMode={(mode) => { setCalendarViewMode(mode); setCalendarViewMenuOpen(false); }}
              onToggleViewMenu={() => setCalendarViewMenuOpen((prev) => !prev)}
              onOpenDetail={openDetailModal}
              onAddCard={(dateStr) => openCreateDialog(undefined, dateStr)}
              onToggleTodo={(todo) => void updateTodo(todo.id, { completed: !todo.completed })}
            />
          )}

          {/* Tasks List View */}
          {activeView === "tasks" && (
            <section className="tasks-view" aria-label={t("taskList")}>
              <div className="task-toolbar-compact">
                <FilterTabs filter={filter} onChange={setFilter} t={t} />
                <div className="task-toolbar-right">
                  <select aria-label={t("priority")} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                    <option value="newest">{t("newest")}</option>
                    <option value="oldest">{t("oldest")}</option>
                    <option value="completed">{t("completed")}</option>
                    <option value="priority">{t("priority")}</option>
                  </select>
                  <button type="button" className="primary-button" onClick={() => openCreateDialog()}><Plus size={16} /> <span>{t("addTask")}</span></button>
                </div>
              </div>
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

      {/* Mobile Bottom Navigation Bar (Always Visible & Pinned) */}
      <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} variant="bottom" onCreateClick={() => openCreateDialog()} />

      {/* Task Detail Modal (Trello Wide Card Details with Real-time Images & Comments) */}
      {detailTodo && (
        <TaskDetailModal
          todo={detailTodo}
          allTodos={todos}
          lists={lists}
          t={t}
          dateLocale={dateLocale}
          onClose={closeDetailModal}
          onUpdate={updateTodo}
          onDelete={requestDelete}
          onMove={moveTodo}
        />
      )}

      {/* Create Board Modal */}
      {dialogMode === "createBoard" && (
        <Modal title={t("createBoard")} onClose={closeDialog}>
          <form className="task-form card" onSubmit={(e) => { e.preventDefault(); void handleCreateBoard(); }}>
            <label>
              {t("boardName")}
              <input
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Business Development / Developer"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button>
              <button type="submit" className="save-button" disabled={!newBoardTitle.trim()}><Check size={16} /> {t("create")}</button>
            </div>
          </form>
        </Modal>
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
          <LayoutDashboard size={17} />
          <span>{labels.board}</span>
        </button>
        <button type="button" className={activeView === "calendar" ? "is-active" : ""} onClick={() => onChange("calendar")}>
          <CalendarDays size={17} />
          <span>{labels.calendar}</span>
        </button>
        {onCreateClick && (
          <button type="button" className="add-nav-item" onClick={onCreateClick} aria-label="Create Task">
            <Plus size={18} />
            <span>สร้าง</span>
          </button>
        )}
        <button type="button" className={activeView === "tasks" ? "is-active" : ""} onClick={() => onChange("tasks")}>
          <ListTodo size={17} />
          <span>{labels.tasks}</span>
        </button>
        <button type="button" className={activeView === "progress" ? "is-active" : ""} onClick={() => onChange("progress")}>
          <BarChart3 size={17} />
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
/*  Board View — Kanban (Touch & Mouse Drag + 1-Click Mobile Move) */
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
  onMoveCard: (todoId: number, listId: number, position?: number) => void;
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
  const [overCardId, setOverCardId] = useState<number | null>(null);
  const [newListMode, setNewListMode] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [editListId, setEditListId] = useState<number | null>(null);
  const [editListTitle, setEditListTitle] = useState("");

  // Touch Drag-and-Drop state for Mobile
  const touchActiveRef = useRef<{ id: number; startX: number; startY: number } | null>(null);

  const handleTouchStart = (todoId: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchActiveRef.current = { id: todoId, startX: touch.clientX, startY: touch.clientY };
    setDragId(todoId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchActiveRef.current) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetEl) return;

    const columnEl = targetEl.closest<HTMLElement>("[data-column-id]");
    if (columnEl) {
      const colId = Number(columnEl.getAttribute("data-column-id"));
      if (colId) setOverListId(colId);
    }
  };

  const handleTouchEnd = () => {
    if (touchActiveRef.current && overListId !== null) {
      onMoveCard(touchActiveRef.current.id, overListId);
    }
    touchActiveRef.current = null;
    setDragId(null);
    setOverListId(null);
    setOverCardId(null);
  };

  if (isLoading) return <div className="board-view"><SkeletonList /><SkeletonList /><SkeletonList /></div>;

  return (
    <section className="board-view" aria-label={t("board")}>
      {lists.map((list, listIndex) => {
        const cards = todos
          .filter((td) => td.listId === list.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const isDragOver = overListId === list.id;

        return (
          <div
            key={list.id}
            data-column-id={list.id}
            className={`board-column ${isDragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDragEnter={() => setOverListId(list.id)}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverListId(null); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId !== null) {
                onMoveCard(dragId, list.id, cards.length);
                setDragId(null);
                setOverListId(null);
                setOverCardId(null);
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
                    <button type="button" className="icon-btn" onClick={() => { setEditListId(list.id); setEditListTitle(list.title); }} aria-label={t("editList")}><Pencil size={13} /></button>
                    <button type="button" className="icon-btn" onClick={() => onDeleteList(list)} aria-label={t("deleteList")}><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>

            <div className="board-column-body">
              {cards.map((todo, cardIndex) => (
                <div
                  key={todo.id}
                  className={`board-card color-${normalizeColor(todo.color)} ${todo.completed ? "is-completed" : ""} ${dragId === todo.id ? "is-dragging" : ""} ${overCardId === todo.id && dragId !== todo.id ? "card-drag-target" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(todo.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverListId(null);
                    setOverCardId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (overCardId !== todo.id) setOverCardId(todo.id);
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    if (overCardId === todo.id) setOverCardId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragId !== null && dragId !== todo.id) {
                      onMoveCard(dragId, list.id, cardIndex);
                      setDragId(null);
                      setOverListId(null);
                      setOverCardId(null);
                    }
                  }}
                  onTouchStart={(e) => handleTouchStart(todo.id, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={() => onOpenDetail(todo)}
                >
                  {/* Compact Card Cover Thumbnail if attached */}
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
                        {todo.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                      </button>
                      <h4 className={todo.completed ? "is-completed-text" : ""}>{todo.title}</h4>
                      <GripVertical size={13} className="drag-handle" aria-hidden="true" />
                    </div>

                    {todo.note && <p className="board-card-note">{todo.note}</p>}

                    <div className="board-card-meta">
                      <span className={`priority-badge ${normalizePriority(todo.priority)}`}>
                        <Flag size={10} />
                        {t(normalizePriority(todo.priority))}
                      </span>
                      <span><Folder size={10} />{t(normalizeCategory(todo.category))}</span>
                      {todo.dueDate && <span><CalendarDays size={10} />{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</span>}
                      {Boolean(todo.images && todo.images.length > 0) && (
                        <span><Paperclip size={10} />{todo.images ? todo.images.length : 0}</span>
                      )}
                      {Boolean(todo.commentsCount && todo.commentsCount > 0) && (
                        <span className="comment-badge"><MessageSquare size={10} />{todo.commentsCount}</span>
                      )}
                    </div>

                    <div className="board-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="icon-btn" onClick={() => onEdit(todo)} aria-label="Edit title"><Pencil size={12} /></button>
                      <button type="button" className="icon-btn" onClick={() => onDelete(todo)} aria-label="Delete"><Trash2 size={12} /></button>

                      {/* Quick Move Previous / Next Column Buttons for Mobile */}
                      <div className="mobile-column-quick-shift">
                        {listIndex > 0 && (
                          <button
                            type="button"
                            className="shift-btn"
                            title="Move left"
                            onClick={() => onMoveCard(todo.id, lists[listIndex - 1].id)}
                          >
                            <ChevronLeft size={13} />
                          </button>
                        )}
                        {listIndex < lists.length - 1 && (
                          <button
                            type="button"
                            className="shift-btn"
                            title="Move right"
                            onClick={() => onMoveCard(todo.id, lists[listIndex + 1].id)}
                          >
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </div>

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
                <Plus size={14} /> <span>{t("addCard")}</span>
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
              <button type="submit" className="save-button"><Check size={15} /> {t("add")}</button>
              <button type="button" className="secondary-button" onClick={() => { setNewListMode(false); setNewListTitle(""); }}><X size={15} /></button>
            </div>
          </form>
        </div>
      ) : (
        <button type="button" className="board-add-list" onClick={() => setNewListMode(true)}>
          <Plus size={15} /> <span>{t("addList")}</span>
        </button>
      )}
    </section>
  );
}

/* ============================================================ */
/*  Calendar Planner Multi-View (Month, Week, Day, Agenda)       */
/* ============================================================ */

function CalendarPlannerView({
  boardTitle,
  todos,
  currentDate,
  selectedDate,
  calendarDays,
  viewMode,
  viewMenuOpen,
  monthLabel,
  dateLocale,
  t,
  isLoading,
  onSelectDate,
  onPrev,
  onNext,
  onToday,
  onMonthPickerChange,
  onSetViewMode,
  onToggleViewMenu,
  onOpenDetail,
  onAddCard,
  onToggleTodo,
}: {
  boardTitle: string;
  todos: Todo[];
  currentDate: Date;
  selectedDate: string;
  calendarDays: CalendarDay[];
  viewMode: CalendarViewMode;
  viewMenuOpen: boolean;
  monthLabel: string;
  dateLocale: string;
  t: (key: TranslationKey) => string;
  isLoading: boolean;
  onSelectDate: (dateStr: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onMonthPickerChange: (yearMonth: string) => void;
  onSetViewMode: (mode: CalendarViewMode) => void;
  onToggleViewMenu: () => void;
  onOpenDetail: (todo: Todo) => void;
  onAddCard: (dateStr?: string) => void;
  onToggleTodo: (todo: Todo) => void;
}) {
  const monthInputRef = useRef<HTMLInputElement>(null);
  const selectedDateTasks = todos.filter((todo) => getTodoDueDate(todo) === selectedDate);

  // Group tasks by date for fast lookup
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const todo of todos) {
      const dateKey = getTodoDueDate(todo);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)?.push(todo);
    }
    return map;
  }, [todos]);

  // Week days for Week View
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const dayOfWeek = d.getDay(); // 0 is Sunday
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const key = toDateInputValue(date);
      return {
        key,
        date,
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        isToday: key === todayKey,
        isSelected: key === selectedDate,
      };
    });
  }, [currentDate, selectedDate]);

  // Group all tasks for Agenda View
  const agendaList = useMemo(() => {
    const sorted = [...todos].sort((a, b) => getTodoDueDate(a).localeCompare(getTodoDueDate(b)));
    const groups: Array<{ dateKey: string; dateFormatted: string; items: Todo[] }> = [];

    for (const todo of sorted) {
      const dateKey = getTodoDueDate(todo);
      const existing = groups.find((g) => g.dateKey === dateKey);
      if (existing) {
        existing.items.push(todo);
      } else {
        groups.push({
          dateKey,
          dateFormatted: formatDateHeading(dateKey, dateLocale),
          items: [todo],
        });
      }
    }
    return groups;
  }, [todos, dateLocale]);

  // Dynamic View Label
  const headerViewTitle = useMemo(() => {
    if (viewMode === "day") {
      return formatDateHeading(selectedDate, dateLocale);
    }
    if (viewMode === "week") {
      const start = weekDays[0].date.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
      const end = weekDays[6].date.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
      return `${start} - ${end}`;
    }
    return monthLabel;
  }, [viewMode, selectedDate, dateLocale, weekDays, monthLabel]);

  return (
    <section className="calendar-planner-wrapper" aria-label="Calendar Planner">
      {/* Top Toolbar Matching Screenshot 2 */}
      <div className="cal-planner-topbar">
        <div className="cal-topbar-left">
          {/* Month / Period Picker Button */}
          <div className="cal-month-badge-wrap">
            <button
              type="button"
              className="cal-month-badge"
              onClick={() => monthInputRef.current?.showPicker?.() || monthInputRef.current?.click()}
              title="Select Month / Year"
            >
              <Calendar size={14} />
              <span>{headerViewTitle}</span>
              <ChevronDown size={12} className="cal-badge-chevron" />
            </button>
            <input
              type="month"
              ref={monthInputRef}
              className="cal-hidden-month-input"
              value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`}
              onChange={(e) => onMonthPickerChange(e.target.value)}
            />
          </div>

          {/* Navigation Buttons: < Today > */}
          <div className="cal-nav-btn-group">
            <button type="button" className="cal-nav-btn" onClick={onPrev} aria-label="Previous">
              <ChevronLeft size={15} />
            </button>
            <button type="button" className="cal-today-btn" onClick={onToday}>
              Today
            </button>
            <button type="button" className="cal-nav-btn" onClick={onNext} aria-label="Next">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* View Mode Dropdown: Day, Week, Month, Agenda */}
          <div className="cal-view-selector-wrap">
            <button type="button" className="cal-view-btn" onClick={onToggleViewMenu} aria-label="Change View">
              <CalendarDays size={14} />
              <span className="cal-active-view-text">{viewMode.toUpperCase()}</span>
              <ChevronDown size={12} />
            </button>

            {viewMenuOpen && (
              <div className="cal-view-menu-dropdown">
                <div className="cal-menu-header">Change view</div>
                <button type="button" className={viewMode === "day" ? "is-selected-view" : ""} onClick={() => onSetViewMode("day")}>
                  <Calendar size={13} /> <span>Day</span>
                  {viewMode === "day" && <Check size={13} className="check-active" />}
                </button>
                <button type="button" className={viewMode === "week" ? "is-selected-view" : ""} onClick={() => onSetViewMode("week")}>
                  <CalendarDays size={13} /> <span>Week</span>
                  {viewMode === "week" && <Check size={13} className="check-active" />}
                </button>
                <button type="button" className={viewMode === "month" ? "is-selected-view" : ""} onClick={() => onSetViewMode("month")}>
                  <Calendar size={13} /> <span>Month</span>
                  {viewMode === "month" && <Check size={13} className="check-active" />}
                </button>
                <button type="button" className={viewMode === "agenda" ? "is-selected-view" : ""} onClick={() => onSetViewMode("agenda")}>
                  <ListTodo size={13} /> <span>Agenda</span>
                  {viewMode === "agenda" && <Check size={13} className="check-active" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Board Title Label on Topbar Right */}
        <div className="cal-topbar-right">
          <div className="cal-board-title-pill">
            <LayoutDashboard size={13} />
            <strong>{boardTitle}</strong>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. MONTH VIEW                                                */}
      {/* ============================================================ */}
      {viewMode === "month" && (
        <div className="cal-planner-layout">
          {/* Month Grid */}
          <div className="cal-grid-card card">
            <div className="cal-weekday-header">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="cal-weekday-col">{day}</div>
              ))}
            </div>

            <div className="cal-month-days-grid">
              {calendarDays.map((day) => {
                const dayStr = toDateInputValue(day.date);
                const dayTasks = tasksByDate.get(dayStr) || [];

                return (
                  <div
                    key={day.key}
                    className={`cal-day-cell ${day.isOutside ? "is-outside" : ""} ${day.isToday ? "is-today" : ""} ${day.isSelected ? "is-selected" : ""}`}
                    onClick={() => onSelectDate(dayStr)}
                  >
                    <div className="cal-day-num-row">
                      <span className="cal-day-number">{day.date.getDate()}</span>
                      {dayTasks.length > 0 && <span className="cal-day-task-count">{dayTasks.length}</span>}
                    </div>

                    {/* Task color dots (mobile & compact view, uniform square cells) */}
                    {dayTasks.length > 0 && (
                      <div className="cal-task-dots-row">
                        {dayTasks.slice(0, 4).map((td) => (
                          <span
                            key={td.id}
                            className={`cal-task-dot color-${normalizeColor(td.color)} ${td.completed ? "is-done" : ""}`}
                            title={td.title}
                          />
                        ))}
                        {dayTasks.length > 4 && <span className="cal-task-dot-more">+{dayTasks.length - 4}</span>}
                      </div>
                    )}

                    {/* Desktop wide pills */}
                    <div className="cal-cell-tasks-list desktop-only-cal-pills">
                      {dayTasks.slice(0, 2).map((td) => (
                        <div
                          key={td.id}
                          className={`cal-task-pill color-${normalizeColor(td.color)} ${td.completed ? "is-done" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetail(td);
                          }}
                          title={td.title}
                        >
                          {td.completed ? <CheckCircle2 size={10} className="chip-icon check" /> : <Circle size={10} className="chip-icon" />}
                          <span className="chip-title">{td.title}</span>
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="cal-more-pill">+{dayTasks.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Inspector */}
          <div className="cal-inspector-column">
            <div className="cal-planner-hero-card">
              <h3>Planner</h3>
              <p>งานในบอร์ด <strong>{boardTitle}</strong></p>
              <button type="button" className="cal-add-task-btn" onClick={() => onAddCard(selectedDate)}>
                <Plus size={14} /> <span>{t("addTask")}</span>
              </button>
            </div>

            <div className="cal-selected-day-card card">
              <div className="cal-selected-day-header">
                <div>
                  <span className="eyebrow">{t("selectedDay")}</span>
                  <h4>{formatDateHeading(selectedDate, dateLocale)}</h4>
                </div>
                <span className="count-pill">{selectedDateTasks.length}</span>
              </div>

              <div className="cal-day-tasks-stream">
                {isLoading ? (
                  <SkeletonList compact />
                ) : selectedDateTasks.length === 0 ? (
                  <p className="muted-empty">{t("noTasksDate")}</p>
                ) : (
                  selectedDateTasks.map((td) => (
                    <div
                      key={td.id}
                      className={`cal-inspector-card color-${normalizeColor(td.color)} ${td.completed ? "is-completed" : ""}`}
                      onClick={() => onOpenDetail(td)}
                    >
                      <div className="cal-card-row">
                        <button
                          type="button"
                          className="complete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTodo(td);
                          }}
                        >
                          {td.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                        </button>
                        <strong className={td.completed ? "is-completed-text" : ""}>{td.title}</strong>
                      </div>
                      {td.note && <p className="cal-card-note">{td.note}</p>}
                      <div className="cal-card-meta">
                        <span className={`priority-badge ${normalizePriority(td.priority)}`}><Flag size={10} /> {t(normalizePriority(td.priority))}</span>
                        {td.dueTime && <span><Clock size={10} /> {td.dueTime}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. WEEK VIEW                                                 */}
      {/* ============================================================ */}
      {viewMode === "week" && (
        <div className="cal-week-view-wrapper card">
          <div className="cal-week-grid">
            {weekDays.map((wDay) => {
              const dayTasks = tasksByDate.get(wDay.key) || [];
              return (
                <div key={wDay.key} className={`cal-week-col ${wDay.isToday ? "is-today" : ""}`}>
                  <div className="cal-week-col-header">
                    <span className="cal-week-day-name">{wDay.dayName}</span>
                    <strong className="cal-week-day-num">{wDay.date.getDate()}</strong>
                    {wDay.isToday && <span className="cal-today-badge">TODAY</span>}
                  </div>

                  <div className="cal-week-col-tasks">
                    {dayTasks.map((td) => (
                      <div
                        key={td.id}
                        className={`cal-week-task-card color-${normalizeColor(td.color)} ${td.completed ? "is-done" : ""}`}
                        onClick={() => onOpenDetail(td)}
                      >
                        <div className="cal-week-task-top">
                          <button
                            type="button"
                            className="complete-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTodo(td);
                            }}
                          >
                            {td.completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          </button>
                          <span className="cal-week-task-title">{td.title}</span>
                        </div>
                        {td.dueTime && <small className="cal-week-time"><Clock size={10} /> {td.dueTime}</small>}
                      </div>
                    ))}

                    <button
                      type="button"
                      className="cal-week-add-btn"
                      onClick={() => onAddCard(wDay.key)}
                      title="Add task on this day"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. DAY VIEW                                                  */}
      {/* ============================================================ */}
      {viewMode === "day" && (
        <div className="cal-day-view-wrapper card">
          <div className="cal-day-view-header">
            <div>
              <span className="eyebrow">{t("selectedDay")}</span>
              <h2>{formatDateHeading(selectedDate, dateLocale)}</h2>
            </div>
            <button type="button" className="primary-button" onClick={() => onAddCard(selectedDate)}>
              <Plus size={15} /> {t("addTask")}
            </button>
          </div>

          <div className="cal-day-timeline">
            {selectedDateTasks.length === 0 ? (
              <div className="empty-state">
                <Calendar size={32} />
                <h3>{t("noTasksDate")}</h3>
                <button type="button" onClick={() => onAddCard(selectedDate)}>{t("addTask")}</button>
              </div>
            ) : (
              selectedDateTasks.map((td) => (
                <div
                  key={td.id}
                  className={`cal-day-timeline-card color-${normalizeColor(td.color)} ${td.completed ? "is-completed" : ""}`}
                  onClick={() => onOpenDetail(td)}
                >
                  <button
                    type="button"
                    className="complete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTodo(td);
                    }}
                  >
                    {td.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>

                  <div className="cal-day-card-body">
                    <h4>{td.title}</h4>
                    {td.note && <p>{td.note}</p>}
                    <div className="cal-card-meta">
                      <span className={`priority-badge ${normalizePriority(td.priority)}`}><Flag size={11} /> {t(normalizePriority(td.priority))}</span>
                      <span><Folder size={11} /> {t(normalizeCategory(td.category))}</span>
                      {td.dueTime && <span><Clock size={11} /> {td.dueTime}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. AGENDA VIEW                                               */}
      {/* ============================================================ */}
      {viewMode === "agenda" && (
        <div className="cal-agenda-wrapper card">
          <div className="cal-agenda-header">
            <h3>Agenda & Upcoming Tasks</h3>
            <button type="button" className="primary-button" onClick={() => onAddCard(selectedDate)}>
              <Plus size={15} /> {t("addTask")}
            </button>
          </div>

          <div className="cal-agenda-timeline">
            {agendaList.length === 0 ? (
              <div className="empty-state">
                <ListTodo size={32} />
                <h3>{t("noTasksFound")}</h3>
              </div>
            ) : (
              agendaList.map((group) => (
                <div key={group.dateKey} className="cal-agenda-group">
                  <div className="cal-agenda-date-divider">
                    <Calendar size={14} />
                    <strong>{group.dateFormatted}</strong>
                    <span className="count-pill">{group.items.length}</span>
                  </div>

                  <div className="cal-agenda-items-list">
                    {group.items.map((td) => (
                      <div
                        key={td.id}
                        className={`cal-agenda-item-card color-${normalizeColor(td.color)} ${td.completed ? "is-completed" : ""}`}
                        onClick={() => onOpenDetail(td)}
                      >
                        <button
                          type="button"
                          className="complete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTodo(td);
                          }}
                        >
                          {td.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>

                        <div className="cal-agenda-item-content">
                          <strong className={td.completed ? "is-completed-text" : ""}>{td.title}</strong>
                          {td.note && <p>{td.note}</p>}
                        </div>

                        <div className="cal-agenda-item-badges">
                          <span className={`priority-badge ${normalizePriority(td.priority)}`}><Flag size={10} /> {t(normalizePriority(td.priority))}</span>
                          {td.dueTime && <span><Clock size={10} /> {td.dueTime}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================ */
/*  Task Detail Modal (Trello Wide Card Details & Comments)      */
/* ============================================================ */

function TaskDetailModal({
  todo,
  allTodos,
  lists,
  t,
  dateLocale,
  onClose,
  onUpdate,
  onDelete,
  onMove,
}: {
  todo: Todo;
  allTodos: Todo[];
  lists: BoardList[];
  t: (key: TranslationKey) => string;
  dateLocale: string;
  onClose: () => void;
  onUpdate: (id: number, updates: Partial<Todo>) => Promise<Todo | null>;
  onDelete: (todo: Todo) => void;
  onMove: (todoId: number, listId: number, position?: number) => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [note, setNote] = useState(todo.note || "");
  const [editNoteDraft, setEditNoteDraft] = useState(todo.note || "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [color, setColor] = useState<TaskColor>(normalizeColor(todo.color));
  const [priority, setPriority] = useState<Priority>(normalizePriority(todo.priority));
  const [category, setCategory] = useState<Category>(normalizeCategory(todo.category));
  const [dueDate, setDueDate] = useState(getTodoDueDate(todo));
  const [imageUrl, setImageUrl] = useState(todo.imageUrl || "");
  const [images, setImages] = useState<string[]>(Array.isArray(todo.images) ? todo.images : []);

  // Comments state
  const [comments, setComments] = useState<TodoComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);

  const dataImageFileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const currentListCards = useMemo(() => {
    return allTodos.filter((t) => t.listId === (todo.listId ?? lists[0]?.id));
  }, [allTodos, todo.listId, lists]);

  // Fetch comments
  useEffect(() => {
    let isMounted = true;
    setIsCommentsLoading(true);

    fetch(`${API_BASE}/todos/${todo.id}/comments`)
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

  // Support Ctrl+V anywhere in modal to paste image
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
                if (newComment.trim() || document.activeElement?.className?.includes("comment-textarea")) {
                  setCommentImage(base64Url);
                } else {
                  setImages((prev) => {
                    const next = [...prev, base64Url];
                    void onUpdate(todo.id, { images: next });
                    return next;
                  });
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

  const handleDataImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Url = uploadEvent.target?.result as string;
        if (base64Url) {
          setImages((prev) => {
            const next = [...prev, base64Url];
            void onUpdate(todo.id, { images: next });
            return next;
          });
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

  const handleSaveField = (key: keyof Todo, val: unknown) => {
    void onUpdate(todo.id, { [key]: val });
  };

  const handleSaveDescription = () => {
    setNote(editNoteDraft);
    handleSaveField("note", editNoteDraft);
    setIsEditingNote(false);
  };

  const handleDiscardDescription = () => {
    setEditNoteDraft(note);
    setIsEditingNote(false);
  };

  const handleToggleCover = (imgSrc: string) => {
    if (imageUrl === imgSrc) {
      setImageUrl("");
      void onUpdate(todo.id, { imageUrl: null });
    } else {
      setImageUrl(imgSrc);
      void onUpdate(todo.id, { imageUrl: imgSrc });
    }
  };

  const handleDeleteImage = (imgSrc: string) => {
    const nextImages = images.filter((img) => img !== imgSrc);
    setImages(nextImages);
    const nextCover = imageUrl === imgSrc ? null : imageUrl;
    if (imageUrl === imgSrc) setImageUrl("");
    void onUpdate(todo.id, { images: nextImages, imageUrl: nextCover });
  };

  const handlePostComment = async () => {
    const text = newComment.trim();
    if ((!text && !commentImage) || isPostingComment) return;

    setIsPostingComment(true);
    try {
      const res = await fetch(`${API_BASE}/todos/${todo.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, author: "Nonthiya (mj.)", imageUrl: commentImage }),
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

  const handleSaveEditedComment = async (commentId: number) => {
    const text = editingCommentText.trim();
    if (!text) return;

    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        const updated = (await res.json()) as TodoComment;
        setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
        setEditingCommentId(null);
        setEditingCommentText("");
      }
    } catch (err) {
      console.error("Failed to edit comment", err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}`, { method: "DELETE" });
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
        className="trello-wide-modal-card"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {imageUrl && (
          <div className="task-detail-cover">
            <img src={imageUrl} alt="Card Cover" />
            <div className="cover-actions-overlay">
              <button type="button" className="cover-action-btn" onClick={() => handleToggleCover(imageUrl)}>
                <Trash2 size={13} /> <span>{t("removeCover")}</span>
              </button>
              <button type="button" className="cover-action-btn close-btn-cover" onClick={onClose}>
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="trello-modal-top-bar">
          <div className="detail-list-badge-group">
            <div className="detail-list-badge">
              <span>{t("inList")}</span>
              <select
                value={todo.listId ?? ""}
                onChange={(e) => onMove(todo.id, Number(e.target.value))}
              >
                {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>

            <div className="detail-list-badge">
              <span>{t("position")}</span>
              <select
                value={todo.position ?? 0}
                onChange={(e) => onMove(todo.id, todo.listId ?? lists[0]?.id, Number(e.target.value))}
              >
                {Array.from({ length: Math.max(currentListCards.length, 1) }, (_, i) => (
                  <option key={i} value={i}>{i + 1}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="top-bar-right-controls">
            <button type="button" className="icon-btn close-modal-btn" onClick={onClose} aria-label={t("close")}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="detail-modal-header">
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

          <div className="detail-chips-bar">
            <div className="detail-chip-group">
              <span className="chip-label">{t("members")}</span>
              <div className="member-pill"><User size={13} /> <span>Nonthiya (mj.)</span></div>
            </div>

            <div className="detail-chip-group">
              <span className="chip-label">{t("labels")}</span>
              <select
                className={`label-badge-pill color-${color}`}
                style={{ backgroundColor: COLOR_OPTIONS.find((c) => c.value === color)?.hex, border: "none", color: "#fff", cursor: "pointer" }}
                value={category}
                onChange={(e) => {
                  const val = e.target.value as Category;
                  setCategory(val);
                  handleSaveField("category", val);
                }}
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value} style={{ color: "#000", background: "#fff" }}>{t(c.key)}</option>)}
              </select>

              <select
                className="color-pill-select"
                style={{ border: "none", borderRadius: "6px", padding: "2px 6px", background: "var(--panel)", color: "inherit", cursor: "pointer", fontSize: "0.74rem", fontWeight: 700 }}
                value={color}
                onChange={(e) => {
                  const val = e.target.value as TaskColor;
                  setColor(val);
                  handleSaveField("color", val);
                }}
              >
                {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.key)}</option>)}
              </select>

              <select
                className={`priority-badge-pill ${priority}`}
                style={{ border: "none", cursor: "pointer" }}
                value={priority}
                onChange={(e) => {
                  const val = e.target.value as Priority;
                  setPriority(val);
                  handleSaveField("priority", val);
                }}
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value} style={{ color: "#000", background: "#fff" }}>{t(p.key)}</option>)}
              </select>
            </div>

            <div className="detail-chip-group">
              <span className="chip-label">{t("dates")}</span>
              <div className="date-chip-pill">
                <CalendarDays size={13} />
                <input
                  type="date"
                  value={dueDate}
                  style={{ border: "none", background: "transparent", font: "inherit", fontWeight: 600, color: "inherit", cursor: "pointer" }}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    handleSaveField("dueDate", e.target.value);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="trello-modal-2col-layout">
          <div className="trello-col-left">
            <div className="trello-section">
              <div className="trello-section-header">
                <div className="trello-section-title">
                  <Folder size={16} /> <span>{t("description")}</span>
                </div>
                {!isEditingNote && (
                  <button type="button" className="trello-edit-btn" onClick={() => { setEditNoteDraft(note); setIsEditingNote(true); }}>
                    <Pencil size={13} /> {t("editTask")}
                  </button>
                )}
              </div>

              {isEditingNote ? (
                <div className="trello-description-editor">
                  <textarea
                    className="trello-desc-textarea"
                    value={editNoteDraft}
                    onChange={(e) => setEditNoteDraft(e.target.value)}
                    placeholder={t("notePlaceholder")}
                    rows={5}
                    autoFocus
                  />
                  <div className="trello-desc-editor-actions">
                    <button type="button" className="trello-btn-save" onClick={handleSaveDescription}>
                      {t("save")}
                    </button>
                    <button type="button" className="trello-btn-discard" onClick={handleDiscardDescription}>
                      {t("discardChanges")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="trello-description-display" onClick={() => { setEditNoteDraft(note); setIsEditingNote(true); }}>
                  {note ? <p>{note}</p> : <p className="placeholder-text">{t("notePlaceholder")}</p>}
                </div>
              )}
            </div>

            <div className="trello-section">
              <div className="trello-section-header">
                <div className="trello-section-title">
                  <Paperclip size={16} /> <span>{t("attachments")}</span>
                  <span className="count-pill">{images.length}</span>
                </div>
                <button type="button" className="trello-edit-btn" onClick={() => dataImageFileInputRef.current?.click()}>
                  <Upload size={13} /> {t("addAttachment")}
                </button>
                <input
                  type="file"
                  ref={dataImageFileInputRef}
                  style={{ display: "none" }}
                  accept="image/*"
                  onChange={handleDataImageUpload}
                />
              </div>

              <div className="trello-attachments-grid">
                {images.map((imgSrc, idx) => (
                  <div key={idx} className="trello-attachment-card">
                    <div className="attachment-image-wrap">
                      <img src={imgSrc} alt={`attachment-${idx}`} />
                    </div>
                    <div className="attachment-details-row">
                      <button
                        type="button"
                        className={`cover-pill-btn ${imageUrl === imgSrc ? "is-active-cover" : ""}`}
                        onClick={() => handleToggleCover(imgSrc)}
                      >
                        <ImageIcon size={12} /> {imageUrl === imgSrc ? t("removeCover") : t("makeCover")}
                      </button>
                      <button
                        type="button"
                        className="delete-attachment-btn"
                        onClick={() => handleDeleteImage(imgSrc)}
                        title="Delete image"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <small className="trello-paste-hint">{t("pasteImageTip")}</small>
            </div>
          </div>

          <div className="trello-col-right">
            <div className="trello-section-title">
              <MessageSquare size={16} /> <span>{t("comments")}</span>
            </div>

            <div className="trello-comment-box">
              <textarea
                className="comment-textarea"
                placeholder={t("writeComment")}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    void handlePostComment();
                  }
                }}
                rows={3}
              />

              {commentImage && (
                <div className="comment-img-preview-card">
                  <img src={commentImage} alt="preview" />
                  <button type="button" className="remove-comment-img" onClick={() => setCommentImage(null)}>
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="trello-comment-actions">
                <button
                  type="button"
                  className="icon-btn attach-comment-btn"
                  onClick={() => commentFileInputRef.current?.click()}
                  title="Attach screenshot/image"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  type="file"
                  ref={commentFileInputRef}
                  style={{ display: "none" }}
                  accept="image/*"
                  onChange={handleCommentImageUpload}
                />

                <button
                  type="button"
                  className="trello-btn-save"
                  disabled={(!newComment.trim() && !commentImage) || isPostingComment}
                  onClick={() => void handlePostComment()}
                >
                  {t("postComment")}
                </button>
              </div>
            </div>

            <div className="trello-comments-stream">
              {isCommentsLoading ? (
                <div className="skeleton-list compact"><span /><span /></div>
              ) : comments.length === 0 ? (
                <p className="no-comments-text">{t("noCommentsYet")}</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="trello-comment-item">
                    <div className="comment-user-avatar"><User size={16} /></div>
                    <div className="comment-body">
                      <div className="comment-header-row">
                        <strong>{c.author}</strong>
                        <small>{formatRelativeTime(c.createdAt, dateLocale)} {c.updatedAt && c.updatedAt !== c.createdAt ? `(${t("edited")})` : ""}</small>
                        <div className="comment-actions-right">
                          <button
                            type="button"
                            className="comment-inline-action-btn"
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentText(c.content);
                            }}
                            title={t("editComment")}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            className="comment-inline-action-btn"
                            onClick={() => void handleDeleteComment(c.id)}
                            title={t("deleteComment")}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {editingCommentId === c.id ? (
                        <div className="edit-comment-inline-wrap">
                          <textarea
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            rows={2}
                          />
                          <div className="edit-comment-actions">
                            <button
                              type="button"
                              className="trello-btn-save compact"
                              onClick={() => void handleSaveEditedComment(c.id)}
                            >
                              {t("saveComment")}
                            </button>
                            <button
                              type="button"
                              className="trello-btn-discard compact"
                              onClick={() => setEditingCommentId(null)}
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        c.content && <p className="comment-text-display">{c.content}</p>
                      )}

                      {c.imageUrl && (
                        <div className="comment-screenshot-preview">
                          <img src={c.imageUrl} alt="comment attachment" loading="lazy" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="trello-sidebar-bottom-actions">
              <button
                type="button"
                className="trello-btn-delete-card"
                onClick={() => {
                  onClose();
                  onDelete(todo);
                }}
              >
                <Trash2 size={14} /> <span>{t("delete")}</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

/* ============================================================ */
/*  Task Form (Create Modal with Toggle Switch & Live Preview)   */
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
  setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  t: (key: TranslationKey) => string;
  onSubmit: () => void;
  submitLabel: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onCancel?: () => void;
  compact?: boolean;
  lists?: BoardList[];
}) {
  const updateField = <Key extends keyof TaskFormState>(key: Key, value: TaskFormState[Key]) => setForm((prev) => ({ ...prev, [key]: value }));
  const filePickerRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        if (base64) {
          updateField("images", [...form.images, base64]);
          if (!form.imageUrl) updateField("imageUrl", base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

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
              if (base64) {
                setForm((prev) => ({
                  ...prev,
                  images: [...prev.images, base64],
                  imageUrl: prev.imageUrl || base64,
                }));
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
  }, [setForm]);

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

      {form.images.length > 0 && (
        <div className="form-images-preview-grid">
          {form.images.map((img, idx) => (
            <div key={idx} className="form-image-item-wrap">
              <img src={img} alt={`preview-${idx}`} />
              <button
                type="button"
                className="remove-preview-btn"
                onClick={() => updateField("images", form.images.filter((_, i) => i !== idx))}
                title="Remove image"
              >
                <X size={13} />
              </button>
            </div>
          ))}
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

      <div className="form-image-attachment">
        <label>{t("attachments")}</label>
        <div className="form-image-row">
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
        <div className="alarm-box-header">
          <div className="alarm-title-group">
            <Bell size={17} className="alarm-bell-icon" />
            <div>
              <strong>{t("reminder")}</strong>
              <span>{t("alarmDate")} / {t("alarmTime")}</span>
            </div>
          </div>
          <label className="toggle-switch-wrap" aria-label={t("reminder")}>
            <input
              type="checkbox"
              checked={form.alarmEnabled}
              onChange={(event) => updateField("alarmEnabled", event.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

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

function TaskCard({ todo, t, dateLocale, lists, onEdit, onToggle, onDelete, onMove, onOpenDetail }: { todo: Todo; t: (key: TranslationKey) => string; dateLocale: string; lists: BoardList[]; onEdit: () => void; onToggle: () => void; onDelete: () => void; onMove: (todoId: number, listId: number, position?: number) => void; onOpenDetail: (todo: Todo) => void }) {
  const priority = normalizePriority(todo.priority);
  const category = normalizeCategory(todo.category);
  const color = normalizeColor(todo.color);
  const alarmActive = Boolean(todo.alarmEnabled || todo.alarm);

  return (
    <article className={`task-card color-${color} ${todo.completed ? "is-completed" : ""}`} onClick={() => onOpenDetail(todo)}>
      <button type="button" className="complete-button" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={todo.completed ? t("pending") : t("completed")}>
        {todo.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      <div className="task-content">
        <h3>{todo.title}</h3>
        {todo.note && <p>{todo.note}</p>}
        <div className="task-meta">
          <span><Folder size={12} />{t(category)}</span>
          <span className={`priority-badge ${priority}`}><Flag size={12} />{t(priority)}</span>
          <span><CalendarDays size={12} />{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</span>
          {todo.dueTime && <span><Clock size={12} />{todo.dueTime}</span>}
          {alarmActive && <span className="reminder-badge"><Bell size={12} />{formatAlarm(todo.alarmDateTime, dateLocale)}</span>}
          {Boolean(todo.images && todo.images.length > 0) && (
            <span><Paperclip size={12} />{todo.images ? todo.images.length : 0}</span>
          )}
          {Boolean(todo.commentsCount && todo.commentsCount > 0) && (
            <span className="comment-badge"><MessageSquare size={12} />{todo.commentsCount}</span>
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
        <button type="button" onClick={onEdit} aria-label={t("editTask")}><Pencil size={14} /></button>
        <button type="button" onClick={onDelete} aria-label={t("delete")}><Trash2 size={14} /></button>
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
  const firstOfMonth = new Date(year, month, 1, 12, 0, 0);
  const sundayIndex = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDays = (sundayIndex + daysInMonth) > 35 ? 42 : 35;

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(year, month, 1 - sundayIndex + index, 12, 0, 0);
    const dayKey = toDateInputValue(date);
    return {
      key: dayKey,
      date,
      isOutside: date.getMonth() !== month,
      isToday: dayKey === todayKey,
      isSelected: dayKey === selectedDate,
    };
  });
}

function normalizeTodo(todo: Todo): Todo {
  let normalizedDueDate = todayKey;
  if (todo.dueDate) {
    if (typeof todo.dueDate === "string") {
      const match = todo.dueDate.match(/^(\d{4}-\d{2}-\d{2})/);
      normalizedDueDate = match ? match[1] : todo.dueDate.slice(0, 10);
    } else if ((todo.dueDate as unknown) instanceof Date) {
      normalizedDueDate = toDateInputValue(todo.dueDate as unknown as Date);
    }
  } else if (todo.created_at) {
    const match = String(todo.created_at).match(/^(\d{4}-\d{2}-\d{2})/);
    normalizedDueDate = match ? match[1] : String(todo.created_at).slice(0, 10);
  }

  return {
    ...todo,
    color: normalizeColor(todo.color),
    priority: normalizePriority(todo.priority),
    category: normalizeCategory(todo.category),
    dueDate: normalizedDueDate,
    dueTime: normalizeTime(todo.dueTime),
    alarmEnabled: Boolean(todo.alarmEnabled ?? todo.alarm),
    listId: todo.listId ?? undefined,
    imageUrl: todo.imageUrl ?? null,
    images: Array.isArray(todo.images) ? todo.images : [],
    commentsCount: Number(todo.commentsCount ?? 0),
  };
}

function normalizeColor(value?: string): TaskColor {
  return COLOR_OPTIONS.some((item) => item.value === value) ? (value as TaskColor) : "red";
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

function getTodoDueDate(todo: Todo): string {
  const raw = todo.dueDate || todo.created_at;
  if (!raw) return todayKey;
  if (typeof raw === "string") {
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return toDateInputValue(d);
  return todayKey;
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