import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Database,
  Download,
  Edit2,
  Flame,
  Folder,
  Flag,
  GripVertical,
  HelpCircle,
  ImageIcon,
  LayoutDashboard,
  ListTodo,
  Menu,
  MessageSquare,
  Moon,
  Palette,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Volume2,
  X,
} from "lucide-react";
import { type TranslationKey } from "../contexts/language-core";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import "./TodoList.css";

type Filter = "all" | "active" | "completed";
type PlannerView = "board" | "calendar" | "tasks" | "progress" | "settings";
type CalendarViewMode = "month" | "week" | "day" | "agenda";
type TaskColor = "green" | "blue" | "yellow" | "orange" | "purple" | "red";
type AccentColor = "red" | "blue" | "purple" | "green" | "orange";
type Priority = "normal" | "important" | "urgent";
type Category = "work" | "study" | "personal" | "health" | "other";
type SortMode = "newest" | "oldest" | "completed" | "priority";
type Mood = "happy" | "calm" | "tired" | "motivated";
type DialogMode = "edit" | "delete" | "deleteList" | "create" | "createBoard" | "clearCompleted" | "resetWorkspace" | "guide" | null;

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

const todayKey = toDateInputValue(new Date());

const COLOR_OPTIONS: Array<{ value: TaskColor; key: "green" | "blue" | "yellow" | "orange" | "purple" | "red"; hex: string }> = [
  { value: "red", key: "red", hex: "#ef4444" },
  { value: "blue", key: "blue", hex: "#3b82f6" },
  { value: "green", key: "green", hex: "#10b981" },
  { value: "yellow", key: "yellow", hex: "#f59e0b" },
  { value: "orange", key: "orange", hex: "#f97316" },
  { value: "purple", key: "purple", hex: "#8b5cf6" },
];

const ACCENT_COLOR_OPTIONS: Array<{ value: AccentColor; label: string; hex: string; strong: string; soft: string }> = [
  { value: "red", label: "Crimson Red", hex: "#ef4444", strong: "#dc2626", soft: "rgba(239, 68, 68, 0.2)" },
  { value: "blue", label: "Ocean Blue", hex: "#3b82f6", strong: "#2563eb", soft: "rgba(59, 130, 246, 0.2)" },
  { value: "purple", label: "Royal Purple", hex: "#8b5cf6", strong: "#7c3aed", soft: "rgba(139, 92, 246, 0.2)" },
  { value: "green", label: "Emerald Green", hex: "#10b981", strong: "#059669", soft: "rgba(16, 185, 129, 0.2)" },
  { value: "orange", label: "Sunset Orange", hex: "#f97316", strong: "#ea580c", soft: "rgba(249, 115, 22, 0.2)" },
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

/* Web Audio API Chime Sound on completion */
function playCompletionSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (err) {
    console.error("Audio error", err);
  }
}

/* Default Initial Starter Data for Fresh Users */
const DEFAULT_INITIAL_BOARDS: Board[] = [
  { id: 1, title: "My Project Planner", color: "blue", created_at: new Date().toISOString() },
  { id: 2, title: "Personal & Learning", color: "purple", created_at: new Date().toISOString() },
];

const DEFAULT_INITIAL_LISTS: BoardList[] = [
  { id: 1, board_id: 1, title: "To Do", position: 0, color: "blue", created_at: new Date().toISOString() },
  { id: 2, board_id: 1, title: "In Progress", position: 1, color: "yellow", created_at: new Date().toISOString() },
  { id: 3, board_id: 1, title: "Done", position: 2, color: "green", created_at: new Date().toISOString() },
  { id: 4, board_id: 2, title: "Reading List", position: 0, color: "purple", created_at: new Date().toISOString() },
  { id: 5, board_id: 2, title: "Workout & Health", position: 1, color: "green", created_at: new Date().toISOString() },
];

const DEFAULT_INITIAL_TODOS: Todo[] = [
  {
    id: 1,
    boardId: 1,
    listId: 1,
    position: 0,
    title: "ยินดีต้อนรับสู่ Todo Planner",
    note: "คลิกเพื่อดูรายละเอียด แนบรูปภาพ หรือเขียนคอมเมนต์",
    completed: false,
    color: "red",
    priority: "urgent",
    category: "work",
    dueDate: todayKey,
    dueTime: "10:00",
    commentsCount: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    boardId: 1,
    listId: 2,
    position: 0,
    title: "ทดสอบลากและวางการ์ด (Drag & Drop)",
    note: "ลองลากไปวางในคอลัมน์ Done หรือกดปุ่มลูกศรเพื่อย้ายคอลัมน์",
    completed: false,
    color: "blue",
    priority: "important",
    category: "work",
    dueDate: todayKey,
    dueTime: "14:00",
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    boardId: 1,
    listId: 3,
    position: 0,
    title: "งานแรกที่ทำสำเร็จ",
    note: "ลองคลิกติ๊กถูกเพื่อฟังเสียง Chime เอฟเฟกต์",
    completed: true,
    color: "green",
    priority: "normal",
    category: "personal",
    dueDate: todayKey,
    dueTime: "09:00",
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_INITIAL_COMMENTS: TodoComment[] = [
  {
    id: 1,
    todoId: 1,
    author: "Workspace User",
    content: "ยินดีต้อนรับ สามารถกด Ctrl+V เพื่อวางรูปภาพในนี้ได้ทันที",
    createdAt: new Date().toISOString(),
  },
];

function stripEmojis(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/[\u{1F000}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}]/gu, "")
    .trim();
}

function localizeListTitle(title: string, t: (key: TranslationKey) => string): string {
  const clean = stripEmojis(title).trim().toLowerCase();
  if (clean === "to do" || clean === "todo" || clean === "สิ่งที่ต้องทำ") return t("columnToDo") || "To Do";
  if (clean === "in progress" || clean === "กำลังทำ" || clean === "กำลังดำเนินการ") return t("columnInProgress") || "In Progress";
  if (clean === "done" || clean === "เสร็จสิ้น" || clean === "เสร็จ") return t("columnDone") || "Done";
  return stripEmojis(title);
}

function localizeTaskTitle(todo: Todo, t: (key: TranslationKey) => string): string {
  const clean = stripEmojis(todo.title).trim();
  if (todo.id === 1 || clean === "ยินดีต้อนรับสู่ Todo Planner" || clean === "Welcome to Todo Planner") return t("defaultTodo1Title");
  if (todo.id === 2 || clean === "ทดสอบลากและวางการ์ด (Drag & Drop)" || clean === "Try dragging & dropping this card") return t("defaultTodo2Title");
  if (todo.id === 3 || clean === "งานแรกที่ทำสำเร็จ" || clean === "First completed task") return t("defaultTodo3Title");
  return clean;
}

function localizeTaskNote(todo: Todo, t: (key: TranslationKey) => string): string {
  if (!todo.note) return "";
  const clean = stripEmojis(todo.note).trim();
  if (todo.id === 1 || clean.includes("ยินดีต้อนรับ") || clean.includes("Welcome") || clean.includes("คลิกเพื่อดูรายละเอียด")) return t("defaultTodo1Note");
  if (todo.id === 2 || clean.includes("ลองลาก") || clean.includes("Drag to Done")) return t("defaultTodo2Note");
  if (todo.id === 3 || clean.includes("ลองคลิก") || clean.includes("completion chime")) return t("defaultTodo3Note");
  return clean;
}

/* ============================================================ */
/*  Main Component (Pure Client-Side Local Storage Architecture) */
/* ============================================================ */

export default function TodoList() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // User & Settings state (Individual & Isolated per device/browser)
  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem("todo_user_name");
    if (!saved || saved === "Nonthiya (mj.)") return "Workspace User";
    return stripEmojis(saved);
  });
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("todo_sound_enabled") !== "false");
  const [accentColor, setAccentColor] = useState<AccentColor>(() => (localStorage.getItem("todo_accent_color") as AccentColor) || "red");
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<"sun" | "mon">(() => (localStorage.getItem("todo_first_day") as "sun" | "mon") || "sun");

  // Local Storage Data States (Automatically sanitizes any legacy cached emojis)
  const [boards, setBoards] = useState<Board[]>(() => {
    const saved = localStorage.getItem("todo_planner_boards");
    const raw = saved ? (JSON.parse(saved) as Board[]) : DEFAULT_INITIAL_BOARDS;
    return raw.map((b) => ({ ...b, title: stripEmojis(b.title) }));
  });

  const [activeBoardId, setActiveBoardId] = useState<number>(() => {
    const saved = localStorage.getItem("todo_planner_active_board_id");
    if (saved) return Number(saved);
    const initialBoards = localStorage.getItem("todo_planner_boards");
    if (initialBoards) {
      const parsed = JSON.parse(initialBoards) as Board[];
      if (parsed.length > 0) return parsed[0].id;
    }
    return DEFAULT_INITIAL_BOARDS[0].id;
  });

  const [lists, setLists] = useState<BoardList[]>(() => {
    const saved = localStorage.getItem("todo_planner_lists");
    const raw = saved ? (JSON.parse(saved) as BoardList[]) : DEFAULT_INITIAL_LISTS;
    return raw.map((l) => ({ ...l, title: stripEmojis(l.title) }));
  });

  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem("todo_planner_todos");
    const raw = saved ? (JSON.parse(saved) as Todo[]) : DEFAULT_INITIAL_TODOS;
    return raw.map((t) => ({ ...normalizeTodo(t), title: stripEmojis(t.title), note: stripEmojis(t.note) }));
  });

  const [comments, setComments] = useState<TodoComment[]>(() => {
    const saved = localStorage.getItem("todo_planner_comments");
    const raw = saved ? (JSON.parse(saved) as TodoComment[]) : DEFAULT_INITIAL_COMMENTS;
    return raw.map((c) => ({ ...c, content: stripEmojis(c.content) }));
  });

  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
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
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState("");
  const [showMobileProgress, setShowMobileProgress] = useState<boolean>(() => {
    const saved = localStorage.getItem("todo_show_mobile_progress");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleMobileProgress = (enabled: boolean) => {
    setShowMobileProgress(enabled);
    localStorage.setItem("todo_show_mobile_progress", String(enabled));
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  const dateLocale = language === "th" ? "th-TH" : "en-US";

  // Persistent Local Storage Sync
  useEffect(() => {
    localStorage.setItem("todo_planner_boards", JSON.stringify(boards));
  }, [boards]);

  useEffect(() => {
    localStorage.setItem("todo_planner_lists", JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    localStorage.setItem("todo_planner_todos", JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem("todo_planner_comments", JSON.stringify(comments));
  }, [comments]);

  useEffect(() => {
    localStorage.setItem("todo_planner_active_board_id", String(activeBoardId));
  }, [activeBoardId]);

  // Apply accent color to document CSS variables
  useEffect(() => {
    const found = ACCENT_COLOR_OPTIONS.find((c) => c.value === accentColor) || ACCENT_COLOR_OPTIONS[0];
    document.documentElement.style.setProperty("--primary", found.hex);
    document.documentElement.style.setProperty("--primary-strong", found.strong);
    document.documentElement.style.setProperty("--primary-soft", found.soft);
    localStorage.setItem("todo_accent_color", accentColor);
  }, [accentColor]);

  // Click outside menus
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (boardDropdownOpen && !boardDropdownRef.current?.contains(target)) {
        setBoardDropdownOpen(false);
      }
      if (desktopMenuOpen && !desktopMenuRef.current?.contains(target)) {
        setDesktopMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [boardDropdownOpen, desktopMenuOpen]);

  /* ---- Derived data ---- */

  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0] || DEFAULT_INITIAL_BOARDS[0];
  }, [boards, activeBoardId]);

  const currentBoardLists = useMemo(() => {
    return lists.filter((l) => (l.board_id ?? 1) === activeBoardId).sort((a, b) => a.position - b.position);
  }, [lists, activeBoardId]);

  const currentBoardTodos = useMemo(() => {
    return todos.filter((t) => (t.boardId ?? 1) === activeBoardId);
  }, [todos, activeBoardId]);

  const today = useMemo(() => new Date(), []);
  const stats = useMemo(() => buildStats(currentBoardTodos, today), [today, currentBoardTodos]);
  const calendarDays = useMemo(() => buildCalendarDays(currentDate, selectedDate, firstDayOfWeek), [currentDate, selectedDate, firstDayOfWeek]);

  const visibleTodos = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return currentBoardTodos
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
  }, [filter, search, sortMode, currentBoardTodos]);

  const viewLabels = useMemo<Record<PlannerView, string>>(() => ({
    board: t("board"),
    calendar: t("calendar"),
    tasks: t("tasks"),
    progress: t("analytics"),
    settings: t("settings"),
  }), [t]);

  /* ---- LocalStorage CRUD: Boards ---- */

  const handleCreateBoard = () => {
    const title = newBoardTitle.trim();
    if (!title) return;

    const newId = Date.now();
    const newBoard: Board = {
      id: newId,
      title,
      color: "blue",
      created_at: new Date().toISOString(),
    };

    const defaultListsForBoard: BoardList[] = [
      { id: Date.now() + 1, board_id: newId, title: "To Do", position: 0, color: "blue", created_at: new Date().toISOString() },
      { id: Date.now() + 2, board_id: newId, title: "In Progress", position: 1, color: "yellow", created_at: new Date().toISOString() },
      { id: Date.now() + 3, board_id: newId, title: "Done", position: 2, color: "green", created_at: new Date().toISOString() },
    ];

    setBoards((prev) => [...prev, newBoard]);
    setLists((prev) => [...prev, ...defaultListsForBoard]);
    setActiveBoardId(newId);
    setNewBoardTitle("");
    setDialogMode(null);
    setBoardDropdownOpen(false);
  };

  /* ---- LocalStorage CRUD: Todos ---- */

  const addTodo = useCallback(() => {
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      inputRef.current?.focus();
      return;
    }

    const alarmDateTime = form.alarmEnabled ? `${form.alarmDate}T${form.alarmTime}` : null;
    const targetListId = form.listId ?? (currentBoardLists[0]?.id || 1);

    const newTodo: Todo = {
      id: Date.now(),
      boardId: activeBoardId,
      title: trimmedTitle,
      note: form.note.trim(),
      completed: false,
      color: form.color,
      priority: form.priority,
      category: form.category,
      dueDate: form.dueDate,
      dueTime: form.dueTime,
      alarm: form.alarmEnabled,
      alarmEnabled: form.alarmEnabled,
      alarmDateTime,
      listId: targetListId,
      position: currentBoardTodos.filter((t) => t.listId === targetListId).length,
      imageUrl: form.imageUrl.trim() || null,
      images: form.images,
      commentsCount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTodos((prev) => [newTodo, ...prev]);
    setForm(createDefaultFormState(activeBoardId, targetListId));
    setDialogMode(null);
  }, [activeBoardId, currentBoardLists, currentBoardTodos, form]);

  const updateTodo = useCallback((id: number, updates: Partial<Todo>) => {
    if (updates.completed === true && soundEnabled) {
      playCompletionSound();
    }

    setTodos((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...updates, updated_at: new Date().toISOString() };
          if (detailTodo && detailTodo.id === id) {
            setDetailTodo(updated);
          }
          return updated;
        }
        return t;
      })
    );
  }, [detailTodo, soundEnabled]);

  const deleteTodo = useCallback(() => {
    if (!deletingTodo) return;
    setTodos((prev) => prev.filter((t) => t.id !== deletingTodo.id));
    setComments((prev) => prev.filter((c) => c.todoId !== deletingTodo.id));
    if (detailTodo && detailTodo.id === deletingTodo.id) {
      setDetailTodo(null);
    }
    setDialogMode(null);
    setDeletingTodo(null);
  }, [deletingTodo, detailTodo]);

  // Smooth Optimistic Drag & Drop with Instant LocalStorage Update
  const moveTodo = useCallback((todoId: number, targetListId: number, targetPos?: number) => {
    setTodos((currentTodos) => {
      const todoToMove = currentTodos.find((t) => t.id === todoId);
      if (!todoToMove) return currentTodos;

      const remaining = currentTodos.filter((t) => t.id !== todoId);
      const targetListItems = remaining
        .filter((t) => t.listId === targetListId && (t.boardId ?? 1) === activeBoardId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      const insertIndex = typeof targetPos === "number" ? Math.max(0, Math.min(targetPos, targetListItems.length)) : targetListItems.length;

      targetListItems.splice(insertIndex, 0, {
        ...todoToMove,
        listId: targetListId,
        position: insertIndex,
      });

      const reindexedTarget = targetListItems.map((t, idx) => ({ ...t, position: idx }));
      const otherTodos = remaining.filter((t) => t.listId !== targetListId || (t.boardId ?? 1) !== activeBoardId);

      return [...otherTodos, ...reindexedTarget];
    });

    if (detailTodo && detailTodo.id === todoId) {
      setDetailTodo((prev) => prev ? { ...prev, listId: targetListId, position: targetPos ?? prev.position } : null);
    }
  }, [activeBoardId, detailTodo]);

  /* ---- LocalStorage CRUD: Lists ---- */

  const createList = useCallback((title: string) => {
    const newList: BoardList = {
      id: Date.now(),
      board_id: activeBoardId,
      title,
      position: currentBoardLists.length,
      color: "green",
      created_at: new Date().toISOString(),
    };
    setLists((prev) => [...prev, newList]);
  }, [activeBoardId, currentBoardLists.length]);

  const updateListTitle = useCallback((id: number, title: string) => {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, title } : l)));
  }, []);

  const confirmDeleteList = useCallback(() => {
    if (!deletingList) return;
    const remainingLists = currentBoardLists.filter((l) => l.id !== deletingList.id);
    const fallbackListId = remainingLists[0]?.id || 1;

    // Reassign orphan tasks to the first list
    setTodos((prev) =>
      prev.map((t) => (t.listId === deletingList.id && (t.boardId ?? 1) === activeBoardId ? { ...t, listId: fallbackListId } : t))
    );
    setLists((prev) => prev.filter((l) => l.id !== deletingList.id));
    setDialogMode(null);
    setDeletingList(null);
  }, [activeBoardId, currentBoardLists, deletingList]);

  /* ---- LocalStorage CRUD: Comments ---- */

  const addComment = useCallback((todoId: number, content: string, imageUrl?: string | null) => {
    const newComment: TodoComment = {
      id: Date.now(),
      todoId,
      author: userName,
      content,
      imageUrl: imageUrl || null,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, newComment]);
    setTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, commentsCount: (t.commentsCount ?? 0) + 1 } : t))
    );
  }, [userName]);

  const updateComment = useCallback((id: number, content: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, content, updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  const deleteComment = useCallback((id: number, todoId: number) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    setTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, commentsCount: Math.max((t.commentsCount ?? 1) - 1, 0) } : t))
    );
  }, []);

  /* ---- Clear Done & Reset ---- */

  const handleClearCompletedTasks = () => {
    setTodos((prev) => prev.filter((t) => !((t.boardId ?? 1) === activeBoardId && t.completed)));
    setDialogMode(null);
    setSettingsSaveMsg("ล้างงานที่ทำเสร็จแล้วเรียบร้อย!");
    setTimeout(() => setSettingsSaveMsg(""), 3000);
  };

  const handleExportBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      version: "2.5.0",
      boards,
      lists,
      todos,
      comments,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `todo-planner-backup-${todayKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.boards) && Array.isArray(parsed.todos)) {
          setBoards(parsed.boards);
          if (Array.isArray(parsed.lists)) setLists(parsed.lists);
          setTodos(parsed.todos.map(normalizeTodo));
          if (Array.isArray(parsed.comments)) setComments(parsed.comments);
          if (parsed.boards.length > 0) setActiveBoardId(parsed.boards[0].id);

          setSettingsSaveMsg("นำเข้าข้อมูลสำเร็จแล้ว!");
          setTimeout(() => setSettingsSaveMsg(""), 3000);
        }
      } catch (err) {
        console.error("Import error", err);
      }
    };
    reader.readAsText(file);
  };

  /* ---- Modal / Action Handlers ---- */

  const openCreateDialog = useCallback((targetListId?: number, defaultDate?: string) => {
    setForm(createDefaultFormState(activeBoardId, targetListId ?? (currentBoardLists[0]?.id || 1), defaultDate || todayKey));
    setDialogMode("create");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [activeBoardId, currentBoardLists]);

  const openEditDialog = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setEditingTitle(todo.title);
    setDialogMode("edit");
  }, []);

  const saveEditing = useCallback(() => {
    const trimmedTitle = editingTitle.trim();
    if (!editingTodo || !trimmedTitle) return;

    updateTodo(editingTodo.id, { title: trimmedTitle });
    setDialogMode(null);
    setEditingTodo(null);
    setEditingTitle("");
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
            <AppLogo size={42} />
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
          {/* Pinned Sticky Header Container (Topbar + Board Progress) */}
          <div className="sticky-header-container">
            {/* Trello-Style Clean Multi-Board Topbar */}
            <header className="topbar trello-topbar">
              <div className="topbar-left-group">
                {/* Board Selector Dropdown */}
                <div className="topbar-board-switcher" ref={boardDropdownRef}>
                  <button
                    type="button"
                    className="board-switcher-btn"
                    onClick={() => setBoardDropdownOpen((prev) => !prev)}
                    aria-expanded={boardDropdownOpen}
                    title="Switch board"
                  >
                    <LayoutDashboard size={16} className="board-icon" />
                    <strong className="board-title-truncate">{stripEmojis(currentBoard.title)}</strong>
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
                            <span>{stripEmojis(b.title)}</span>
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

                {/* "+ สร้างบอร์ดใหม่" Button */}
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

                {/* Desktop Language Switcher */}
                <div className="desktop-only-btn">
                  <LanguageToggle language={language} onChange={setLanguage} />
                </div>

                {/* Desktop User Profile Badge */}
                <button
                  type="button"
                  className="user-profile-badge desktop-only-btn"
                  onClick={() => setActiveView("settings")}
                  title={t("userProfile")}
                  style={{ cursor: "pointer", border: "1px solid var(--border)", background: "transparent" }}
                >
                  <User size={14} className="user-badge-icon" />
                  <span>{userName}</span>
                </button>

                {/* Theme Toggle Button (Mobile & Desktop - 1 tap switch directly on topbar) */}
                <button
                  type="button"
                  className="theme-quick-button"
                  aria-label={t("theme")}
                  onClick={toggleTheme}
                  title={theme === "dark" ? t("light") : t("dark")}
                >
                  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                {/* Desktop Hamburger Menu */}
                <div className="more-menu-container desktop-only-btn" ref={desktopMenuRef}>
                  <button
                    type="button"
                    className="icon-btn topbar-hamburger-btn"
                    onClick={() => setDesktopMenuOpen((prev) => !prev)}
                    aria-label="Menu"
                    title="Menu"
                  >
                    <Menu size={18} />
                  </button>
                  {desktopMenuOpen && (
                    <div className="more-dropdown-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setDialogMode("guide");
                          setDesktopMenuOpen(false);
                        }}
                      >
                        <HelpCircle size={15} /> <span>{t("userGuide")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView("settings");
                          setDesktopMenuOpen(false);
                        }}
                      >
                        <Settings size={15} /> <span>{t("settings")}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Hamburger Menu (3 lines) */}
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

            {/* Mobile Minimal Board Progress - Numbers Only (Shown on Board View only) */}
            {showMobileProgress && activeView === "board" && (
              <div className="mobile-board-progress-wrap" aria-label="Progress">
                <div className="mobile-board-progress-track">
                  <div
                    className="mobile-board-progress-fill"
                    style={{
                      width: `${stats.progress}%`,
                      background: stats.progress === 100
                        ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                        : "linear-gradient(90deg, var(--primary) 0%, #f43f5e 100%)",
                    }}
                  />
                </div>
                <div className="mobile-board-progress-info">
                  <strong>{stats.progress}%</strong>
                  <span>{stats.completed}/{stats.total}</span>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Drawer (Hamburger Menu Sheet with Settings) */}
          {mobileDrawerOpen && (
            <div className="mobile-drawer-layer" onClick={() => setMobileDrawerOpen(false)}>
              <aside className="mobile-drawer" ref={mobileDrawerRef} onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                  <div className="drawer-user-info">
                    <div className="drawer-avatar"><User size={18} /></div>
                    <div>
                      <strong>{userName}</strong>
                      <small>{currentBoard.title}</small>
                    </div>
                  </div>
                  <button type="button" className="icon-btn" onClick={() => setMobileDrawerOpen(false)}><X size={18} /></button>
                </div>

                <div className="drawer-menu-list">
                  {/* User Guide in Drawer */}
                  <div className="drawer-item" onClick={() => { setDialogMode("guide"); setMobileDrawerOpen(false); }}>
                    <div className="drawer-item-left">
                      <HelpCircle size={17} />
                      <span>{t("userGuide")}</span>
                    </div>
                  </div>

                  {/* Theme Switcher Row */}
                  <div className="drawer-item" onClick={toggleTheme}>
                    <div className="drawer-item-left">
                      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                      <span>{t("theme")}</span>
                    </div>
                    <span className="drawer-badge">{theme === "dark" ? t("light") : t("dark")}</span>
                  </div>

                  {/* Mobile Progress Bar Quick Toggle */}
                  <div className="drawer-item" onClick={() => handleToggleMobileProgress(!showMobileProgress)}>
                    <div className="drawer-item-left">
                      <CheckCircle2 size={17} />
                      <span>แถบความคืบหน้า</span>
                    </div>
                    <span className="drawer-badge">{showMobileProgress ? "เปิด" : "ปิด"}</span>
                  </div>

                  {/* Language Switcher Row */}
                  <div className="drawer-item">
                    <div className="drawer-item-left">
                      <Palette size={17} />
                      <span>{t("language")}</span>
                    </div>
                    <LanguageToggle language={language} onChange={setLanguage} />
                  </div>

                  {/* Settings Item in Mobile Drawer */}
                  <div className="drawer-item" onClick={() => { setActiveView("settings"); setMobileDrawerOpen(false); }}>
                    <div className="drawer-item-left">
                      <Settings size={17} />
                      <span>{t("settings")}</span>
                    </div>
                  </div>

                  {/* Switch to Analytics */}
                  <div className="drawer-item" onClick={() => { setActiveView("progress"); setMobileDrawerOpen(false); }}>
                    <div className="drawer-item-left">
                      <BarChart3 size={17} />
                      <span>{t("analytics")}</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* Board View */}
          {activeView === "board" && (
            <BoardView
              lists={currentBoardLists}
              todos={visibleTodos}
              t={t}
              dateLocale={dateLocale}
              onAddCard={(listId) => openCreateDialog(listId)}
              onMoveCard={moveTodo}
              onToggle={(todo: Todo) => updateTodo(todo.id, { completed: !todo.completed })}
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
            <CalendarPlannerView
              boardTitle={currentBoard.title}
              todos={currentBoardTodos}
              currentDate={currentDate}
              selectedDate={selectedDate}
              calendarDays={calendarDays}
              viewMode={calendarViewMode}
              viewMenuOpen={calendarViewMenuOpen}
              monthLabel={monthLabel}
              dateLocale={dateLocale}
              t={t}
              onSelectDate={(dateStr) => setSelectedDate(dateStr)}
              onPrev={handleCalendarPrev}
              onNext={handleCalendarNext}
              onToday={handleCalendarToday}
              onMonthPickerChange={handleMonthPickerChange}
              onSetViewMode={(mode) => { setCalendarViewMode(mode); setCalendarViewMenuOpen(false); }}
              onToggleViewMenu={() => setCalendarViewMenuOpen((prev) => !prev)}
              onOpenDetail={openDetailModal}
              onAddCard={(dateStr) => openCreateDialog(undefined, dateStr)}
              onToggleTodo={(todo) => updateTodo(todo.id, { completed: !todo.completed })}
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
                {visibleTodos.length === 0 ? <EmptyState onAdd={() => openCreateDialog()} t={t} /> : visibleTodos.map((todo) => (
                  <TaskCard
                    key={todo.id}
                    todo={todo}
                    t={t}
                    dateLocale={dateLocale}
                    onEdit={() => openEditDialog(todo)}
                    onToggle={() => updateTodo(todo.id, { completed: !todo.completed })}
                    onDelete={() => requestDelete(todo)}
                    onOpenDetail={openDetailModal}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Redesigned Analytics Dashboard */}
          {activeView === "progress" && (
            <AnalyticsDashboardView
              stats={stats}
              todos={currentBoardTodos}
              selectedMood={selectedMood}
              onMoodChange={setSelectedMood}
              t={t}
              onOpenDetail={openDetailModal}
            />
          )}

          {/* Full-Featured Settings Page */}
          {activeView === "settings" && (
            <SettingsView
              userName={userName}
              onUserNameChange={(val) => {
                setUserName(val);
                localStorage.setItem("todo_user_name", val);
              }}
              soundEnabled={soundEnabled}
              onSoundToggle={(enabled) => {
                setSoundEnabled(enabled);
                localStorage.setItem("todo_sound_enabled", String(enabled));
              }}
              accentColor={accentColor}
              onAccentChange={setAccentColor}
              firstDayOfWeek={firstDayOfWeek}
              onFirstDayChange={(val) => {
                setFirstDayOfWeek(val);
                localStorage.setItem("todo_first_day", val);
              }}
              boards={boards}
              activeBoardId={activeBoardId}
              onSelectDefaultBoard={(id) => setActiveBoardId(id)}
              showMobileProgress={showMobileProgress}
              onToggleMobileProgress={handleToggleMobileProgress}
              onClearCompletedRequest={() => setDialogMode("clearCompleted")}
              onResetWorkspaceRequest={() => setDialogMode("resetWorkspace")}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              saveMsg={settingsSaveMsg}
              t={t}
            />
          )}
        </section>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} variant="bottom" onCreateClick={() => openCreateDialog()} />

      {/* Floating User Guide Button (Bottom Right) */}
      <button
        type="button"
        className="floating-guide-widget"
        onClick={() => setDialogMode("guide")}
        title={t("userGuide")}
        aria-label={t("userGuide")}
      >
        <div className="floating-guide-icon-box">
          <BookOpen size={13} />
        </div>
        <span>{t("userGuide")}</span>
      </button>

      {/* Task Detail Modal */}
      {detailTodo && (
        <TaskDetailModal
          todo={detailTodo}
          allTodos={todos}
          comments={comments.filter((c) => c.todoId === detailTodo.id)}
          lists={currentBoardLists}
          userName={userName}
          t={t}
          dateLocale={dateLocale}
          onClose={closeDetailModal}
          onUpdate={updateTodo}
          onDelete={requestDelete}
          onMove={moveTodo}
          onAddComment={(text, img) => addComment(detailTodo.id, text, img)}
          onUpdateComment={updateComment}
          onDeleteComment={(commentId) => deleteComment(commentId, detailTodo.id)}
        />
      )}

      {/* User Guide Modal */}
      {dialogMode === "guide" && (
        <Modal title={t("howToUse")} onClose={closeDialog}>
          <div className="user-guide-modal-body">
            <p className="guide-intro-text">{t("guideIntro")}</p>

            <div className="guide-features-list">
              <div className="guide-feature-item">
                <strong>{t("guideDragDropTitle")}</strong>
                <p>{t("guideDragDropDesc")}</p>
              </div>

              <div className="guide-feature-item">
                <strong>{t("guideKeyboardTitle")}</strong>
                <p>{t("guideKeyboardDesc")}</p>
              </div>

              <div className="guide-feature-item">
                <strong>{t("guideAnalyticsTitle")}</strong>
                <p>{t("guideAnalyticsDesc")}</p>
              </div>

              <div className="guide-feature-item">
                <strong>{t("guideSettingsTitle")}</strong>
                <p>{t("guideSettingsDesc")}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="save-button" onClick={closeDialog}>
                <Check size={16} /> {t("gotIt")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Board Modal */}
      {dialogMode === "createBoard" && (
        <Modal title={t("createBoard")} onClose={closeDialog}>
          <form className="task-form card" onSubmit={(e) => { e.preventDefault(); handleCreateBoard(); }}>
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
            lists={currentBoardLists}
            onCancel={closeDialog}
          />
        </Modal>
      )}

      {/* Quick Edit Title Modal */}
      {dialogMode === "edit" && editingTodo && (
        <Modal title={t("editTask")} onClose={closeDialog}>
          <form className="edit-title-form" onSubmit={(event) => { event.preventDefault(); saveEditing(); }}>
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
              <button type="button" className="danger-button" onClick={deleteTodo}>{t("delete")}</button>
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
              <button type="button" className="danger-button" onClick={confirmDeleteList}>{t("delete")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear Completed Tasks Confirmation */}
      {dialogMode === "clearCompleted" && (
        <Modal title={t("clearCompleted")} onClose={closeDialog} destructive>
          <div className="delete-confirmation">
            <p>{t("clearCompletedWarning")}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button>
              <button type="button" className="danger-button" onClick={handleClearCompletedTasks}>{t("delete")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Workspace Confirmation */}
      {dialogMode === "resetWorkspace" && (
        <Modal title={t("resetWorkspace")} onClose={closeDialog} destructive>
          <div className="delete-confirmation">
            <p>{t("resetWorkspaceWarning")}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeDialog}>{t("cancel")}</button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function AppLogo({ size = 36, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="app-brand-logo-wrap" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {/* Precision Vector Monogram Checklist Icon */}
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="app-brand-icon-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="logoTileBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22242c" />
            <stop offset="100%" stopColor="#121318" />
          </linearGradient>
          <linearGradient id="logoRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4d4d" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Squircle Tile Base */}
        <rect width="48" height="48" rx="12" fill="url(#logoTileBg)" stroke="var(--border-strong, #2f3546)" strokeWidth="1" />

        {/* 3 Checklist Bullet Dots */}
        <circle cx="11" cy="14" r="2.5" fill="url(#logoRedGrad)" />
        <circle cx="11" cy="24" r="2.5" fill="#f4f5f7" />
        <circle cx="11" cy="34" r="2.5" fill="#f4f5f7" />

        {/* P Monogram Bars */}
        <rect x="17" y="12" width="15" height="3.5" rx="1.75" fill="url(#logoRedGrad)" />
        <rect x="17" y="22" width="17" height="3.5" rx="1.75" fill="#f4f5f7" />
        <rect x="17" y="14" width="3.5" height="22" rx="1.75" fill="#f4f5f7" />

        {/* Dynamic Red Checkmark Swoosh */}
        <path
          d="M20 29 L25 36 L39 17 L36 14 L24 30 L21 26 Z"
          fill="url(#logoRedGrad)"
        />
      </svg>

      {/* Dynamic HTML Typography */}
      {showText && (
        <div className="app-brand-text-block" style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            Todo-List
          </span>
          <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Planner
          </span>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/*  Main Component (Pure Client-Side Local Storage Architecture) */
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
    { view: "settings", icon: <Settings size={19} /> },
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
        <button type="button" className={activeView === "settings" ? "is-active" : ""} onClick={() => onChange("settings")}>
          <Settings size={17} />
          <span>{labels.settings}</span>
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

  // Continuous Auto-Scroll Engine for Mobile Drag & Drop
  const autoScrollTimerRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef<number>(0);
  const boardScrollRef = useRef<HTMLElement>(null);

  const startAutoScroll = () => {
    if (autoScrollTimerRef.current !== null) return;
    const step = () => {
      if (boardScrollRef.current && autoScrollSpeedRef.current !== 0) {
        boardScrollRef.current.scrollLeft += autoScrollSpeedRef.current;
        autoScrollTimerRef.current = requestAnimationFrame(step);
      } else {
        autoScrollTimerRef.current = null;
      }
    };
    autoScrollTimerRef.current = requestAnimationFrame(step);
  };

  const stopAutoScroll = () => {
    autoScrollSpeedRef.current = 0;
    if (autoScrollTimerRef.current !== null) {
      cancelAnimationFrame(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  const [touchDraggingId, setTouchDraggingId] = useState<number | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const overListIdRef = useRef<number | null>(null);
  const [dropEdge, setDropEdge] = useState<"top" | "bottom" | null>(null);

  const draggingTodo = useMemo(() => todos.find((t) => t.id === (touchDraggingId ?? dragId)), [todos, touchDraggingId, dragId]);

  // Global Window Touch Listeners for Seamless Multi-Column Drag & Auto-Scroll
  useEffect(() => {
    if (!touchDraggingId) return;

    const onWindowTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      setTouchPos({ x: touch.clientX, y: touch.clientY });

      // 1. Instant & High-Speed Continuous Auto-Scroll near viewport edges
      const edgeZone = 140;
      const winWidth = window.innerWidth;

      if (touch.clientX > winWidth - edgeZone) {
        const ratio = (touch.clientX - (winWidth - edgeZone)) / edgeZone;
        autoScrollSpeedRef.current = Math.round(20 + Math.pow(ratio, 1.5) * 42);
        startAutoScroll();
      } else if (touch.clientX < edgeZone) {
        const ratio = (edgeZone - touch.clientX) / edgeZone;
        autoScrollSpeedRef.current = -Math.round(20 + Math.pow(ratio, 1.5) * 42);
        startAutoScroll();
      } else {
        stopAutoScroll();
      }

      // 2. Identify target column and card under the touch point
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      if (targetEl) {
        const columnEl = targetEl.closest<HTMLElement>("[data-column-id]");
        if (columnEl) {
          const colId = Number(columnEl.getAttribute("data-column-id"));
          if (colId) {
            overListIdRef.current = colId;
            setOverListId(colId);
          }
        }
      }
    };

    const onWindowTouchEnd = () => {
      stopAutoScroll();
      const targetListId = overListIdRef.current;
      if (targetListId !== null && touchDraggingId !== null) {
        onMoveCard(touchDraggingId, targetListId);
      }
      overListIdRef.current = null;
      setOverListId(null);
      setTouchDraggingId(null);
      setTouchPos(null);
      setDragId(null);
      setOverCardId(null);
      setDropEdge(null);
    };

    window.addEventListener("touchmove", onWindowTouchMove, { passive: true });
    window.addEventListener("touchend", onWindowTouchEnd);
    window.addEventListener("touchcancel", onWindowTouchEnd);

    return () => {
      stopAutoScroll();
      window.removeEventListener("touchmove", onWindowTouchMove);
      window.removeEventListener("touchend", onWindowTouchEnd);
      window.removeEventListener("touchcancel", onWindowTouchEnd);
    };
  }, [touchDraggingId, onMoveCard]);

  // Effortless Desktop Mouse Wheel Horizontal Scrolling
  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const columnBody = target?.closest?.(".board-column-body");
      if (columnBody && columnBody.scrollHeight > columnBody.clientHeight) {
        const atTop = columnBody.scrollTop === 0 && e.deltaY < 0;
        const atBottom = columnBody.scrollTop + columnBody.clientHeight >= columnBody.scrollHeight - 1 && e.deltaY > 0;
        if (!atTop && !atBottom) {
          return;
        }
      }

      if (Math.abs(e.deltaY) > 0 || Math.abs(e.deltaX) > 0) {
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        el.scrollLeft += delta;
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", onNativeWheel);
  }, []);

  const handleTouchStart = (todoId: number, e: React.TouchEvent) => {
    setTouchDraggingId(todoId);
    setDragId(todoId);
    const touch = e.touches[0];
    if (touch) {
      setTouchPos({ x: touch.clientX, y: touch.clientY });
    }
  };

  return (
    <section ref={boardScrollRef} className={`board-view ${touchDraggingId ? "is-dragging-active" : ""}`} aria-label={t("board")}>
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
                setDropEdge(null);
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
                    <h3>{localizeListTitle(list.title, t)}</h3>
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
                  className={`board-card color-${normalizeColor(todo.color)} ${todo.completed ? "is-completed" : ""} ${dragId === todo.id ? "is-dragging" : ""} ${overCardId === todo.id && dragId !== todo.id ? (dropEdge === "top" ? "drop-top" : "drop-bottom") : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(todo.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverListId(null);
                    setOverCardId(null);
                    setDropEdge(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isTop = (e.clientY - rect.top) < (rect.height / 2);
                    const edge = isTop ? "top" : "bottom";
                    if (overCardId !== todo.id || dropEdge !== edge) {
                      setOverCardId(todo.id);
                      setDropEdge(edge);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    if (overCardId === todo.id) {
                      setOverCardId(null);
                      setDropEdge(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragId !== null && dragId !== todo.id) {
                      const insertIndex = dropEdge === "top" ? cardIndex : cardIndex + 1;
                      onMoveCard(dragId, list.id, insertIndex);
                      setDragId(null);
                      setOverListId(null);
                      setOverCardId(null);
                      setDropEdge(null);
                    }
                  }}
                  onTouchStart={(e) => handleTouchStart(todo.id, e)}
                  onClick={() => onOpenDetail(todo)}
                >
                  {/* Compact Card Cover Thumbnail */}
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
                      <h4 className={todo.completed ? "is-completed-text" : ""}>{localizeTaskTitle(todo, t)}</h4>
                      <GripVertical size={13} className="drag-handle" aria-hidden="true" />
                    </div>

                    {todo.note && <p className="board-card-note">{localizeTaskNote(todo, t)}</p>}

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
      {/* Floating Drag Preview Card Ghost following Finger/Cursor */}
      {draggingTodo && touchPos && (
        <div
          className="floating-drag-card-ghost"
          style={{
            position: "fixed",
            left: Math.max(10, Math.min(window.innerWidth - 240, touchPos.x - 110)),
            top: Math.max(10, touchPos.y - 48),
            width: "220px",
            pointerEvents: "none",
            zIndex: 99999,
            transform: "rotate(3.5deg) scale(1.05)",
            background: "var(--surface-raised)",
            border: "2px solid var(--primary)",
            borderRadius: "12px",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(239, 68, 68, 0.45)",
            padding: "9px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
              {t(normalizeCategory(draggingTodo.category))}
            </span>
            <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 999, background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 700 }}>
              ✋ {t("moveTask")}
            </span>
          </div>
          <strong style={{ fontSize: "0.86rem", color: "var(--ink)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {localizeTaskTitle(draggingTodo, t)}
          </strong>
        </div>
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
    const dayOfWeek = d.getDay();
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

  // Click outside to close view mode menu dropdown
  useEffect(() => {
    if (!viewMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".cal-view-selector-wrap")) {
        onToggleViewMenu();
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [viewMenuOpen, onToggleViewMenu]);

  return (
    <section className="calendar-planner-wrapper" aria-label="Calendar Planner">
      {/* Top Toolbar */}
      <div className="cal-planner-topbar">
        <div className="cal-topbar-left">
          {/* Month / Period Picker Button */}
          <div className="cal-month-badge-wrap">
            <button
              type="button"
              className="cal-month-badge"
              onClick={() => {
                if (monthInputRef.current) {
                  if (typeof monthInputRef.current.showPicker === "function") {
                    monthInputRef.current.showPicker();
                  } else {
                    monthInputRef.current.click();
                  }
                }
              }}
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

          {/* View Mode Dropdown */}
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

      {/* 1. MONTH VIEW */}
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

                    {/* Task color dots (Mobile & compact view) */}
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
                          title={localizeTaskTitle(td, t)}
                        >
                          {td.completed ? <CheckCircle2 size={10} className="chip-icon check" /> : <Circle size={10} className="chip-icon" />}
                          <span className="chip-title">{localizeTaskTitle(td, t)}</span>
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
                {selectedDateTasks.length === 0 ? (
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
                        <strong className={td.completed ? "is-completed-text" : ""}>{localizeTaskTitle(td, t)}</strong>
                      </div>
                      {td.note && <p className="cal-card-note">{localizeTaskNote(td, t)}</p>}
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

      {/* 2. WEEK VIEW */}
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
                          <span className="cal-week-task-title">{localizeTaskTitle(td, t)}</span>
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

      {/* 3. DAY VIEW */}
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
                    <h4>{localizeTaskTitle(td, t)}</h4>
                    {td.note && <p>{localizeTaskNote(td, t)}</p>}
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

      {/* 4. AGENDA VIEW */}
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
/*  Redesigned Analytics Dashboard View                          */
/* ============================================================ */

function AnalyticsDashboardView({
  stats,
  todos,
  selectedMood,
  onMoodChange,
  t,
  onOpenDetail,
}: {
  stats: ReturnType<typeof buildStats>;
  todos: Todo[];
  selectedMood: Mood;
  onMoodChange: (mood: Mood) => void;
  t: (key: TranslationKey) => string;
  onOpenDetail: (todo: Todo) => void;
}) {
  // Compute Tier Badge
  const tierInfo = useMemo(() => {
    if (stats.progress >= 90) return { title: "Master Achiever", desc: "ยอดเยี่ยม ไร้ที่ติ ทำงานสำเร็จเกือบครบทั้งหมด", color: "tier-gold" };
    if (stats.progress >= 75) return { title: "Productive Pro", desc: "กำลังติดสปีด เคลียร์งานได้อย่างมีประสิทธิภาพ", color: "tier-fire" };
    if (stats.progress >= 50) return { title: "Steady Mover", desc: "ทำงานต่อเนื่อง เดินหน้าไปได้ด้วยดี", color: "tier-blue" };
    return { title: "Getting Started", desc: "เริ่มต้นลุยงาน ก้าวแรกสู่ความสำเร็จ", color: "tier-green" };
  }, [stats.progress]);

  // Activity Heatmap 30 Days
  const heatmapDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (29 - index));
      const key = toDateInputValue(date);
      const count = todos.filter((todo) => todo.completed && (todo.updated_at?.slice(0, 10) ?? getTodoDueDate(todo)) === key).length;
      let level = 0;
      if (count === 1) level = 1;
      else if (count >= 2 && count <= 3) level = 2;
      else if (count >= 4) level = 3;

      return { key, date, count, level, label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    });
  }, [todos]);

  // Urgent Watchlist (Due today or overdue)
  const urgentTasks = useMemo(() => {
    return todos.filter((t) => !t.completed && (getTodoDueDate(t) <= todayKey || t.priority === "urgent")).slice(0, 4);
  }, [todos]);

  // Category breakdown
  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = { work: 0, study: 0, personal: 0, health: 0, other: 0 };
    for (const td of todos) {
      const cat = normalizeCategory(td.category);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [todos]);

  // Best productive day
  const bestDay = useMemo(() => {
    if (!stats.weeklyCompleted || stats.weeklyCompleted.length === 0) return null;
    let max = stats.weeklyCompleted[0];
    for (const item of stats.weeklyCompleted) {
      if (item.count > max.count) max = item;
    }
    return max.count > 0 ? max.label : null;
  }, [stats.weeklyCompleted]);

  return (
    <section className="analytics-dashboard-view" aria-label={t("analytics")}>
      {/* 1. Hero Productivity Score Card */}
      <div className="analytics-hero-banner card">
        <div className="hero-score-info">
          <div className="hero-score-badge">
            <Sparkles size={15} />
            <span>{tierInfo.title}</span>
          </div>
          <h2>{stats.progress}% {t("productivityScore")}</h2>
          <p>{tierInfo.desc}</p>

          <div className="hero-mini-stat-pills">
            <span><strong>{stats.completed}</strong> {t("tasksCompleted")}</span>
            <span>•</span>
            <span><strong>{stats.pending}</strong> {t("pendingTasks")}</span>
            <span>•</span>
            <span><strong>{stats.total}</strong> {t("totalTasks")}</span>
          </div>
        </div>

        <div className="hero-progress-ring-wrap">
          <div className="progress-ring-lg" style={{ "--progress": `${stats.progress}%` } as CSSProperties}>
            <div className="progress-ring-inner">
              <strong>{stats.progress}%</strong>
              <small>{t("completion")}</small>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4 Quick Stat Metric Cards */}
      <div className="analytics-metrics-grid">
        <div className="metric-card card done-card">
          <div className="metric-icon-wrap done"><CheckCircle2 size={20} /></div>
          <div>
            <strong>{stats.completed}</strong>
            <span>{t("completed")}</span>
          </div>
        </div>

        <div className="metric-card card in-progress-card">
          <div className="metric-icon-wrap in-progress"><Clock size={20} /></div>
          <div>
            <strong>{todos.filter((t) => !t.completed && t.position !== 0).length}</strong>
            <span>{t("inProgressTasks")}</span>
          </div>
        </div>

        <div className="metric-card card todo-card">
          <div className="metric-icon-wrap todo"><ListTodo size={20} /></div>
          <div>
            <strong>{stats.pending}</strong>
            <span>{t("toDoTasks")}</span>
          </div>
        </div>

        <div className="metric-card card overdue-card">
          <div className="metric-icon-wrap overdue"><AlertTriangle size={20} /></div>
          <div>
            <strong>{stats.overdue}</strong>
            <span>{t("overdueTasks")}</span>
          </div>
        </div>
      </div>

      {/* 3. 30-Day Activity Heatmap */}
      <div className="card heatmap-container-card">
        <div className="heatmap-card-header">
          <div>
            <span className="eyebrow">{t("activity")}</span>
            <h3>{t("activityHeatmap")}</h3>
          </div>
          <div className="heatmap-legend">
            <span>{t("less")}</span>
            <i className="lvl-0" />
            <i className="lvl-1" />
            <i className="lvl-2" />
            <i className="lvl-3" />
            <span>{t("more")}</span>
          </div>
        </div>

        <div className="heatmap-grid">
          {heatmapDays.map((d) => (
            <div
              key={d.key}
              className={`heatmap-cell lvl-${d.level}`}
              title={`${d.label}: ${d.count} tasks completed`}
            />
          ))}
        </div>
      </div>

      {/* 4. Weekly Velocity & Habit Streak 2-Col */}
      <div className="analytics-2col-layout">
        {/* Weekly Velocity Bar Chart */}
        <div className="card velocity-chart-card">
          <div className="velocity-header">
            <div>
              <span className="eyebrow">{t("weeklyChart")}</span>
              <h3>{t("tasksCompleted")}</h3>
            </div>
            {bestDay && (
              <span className="best-day-badge">
                <TrendingUp size={12} /> {t("mostProductiveDay")}: <strong>{bestDay}</strong>
              </span>
            )}
          </div>

          <div className="weekly-chart">
            {stats.weeklyCompleted.map((item) => {
              const maxVal = Math.max(...stats.weeklyCompleted.map((i) => i.count), 1);
              return (
                <div key={item.label} className="velocity-col">
                  <span style={{ height: `${Math.max((item.count / maxVal) * 100, 8)}%` }} />
                  <small>{item.label}</small>
                  <strong>{item.count}</strong>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak & Consistency Card */}
        <div className="card streak-card">
          <span className="eyebrow">{t("productivity")}</span>
          <h3>{t("currentStreak")}</h3>

          <div className="streak-hero-number">
            <Flame size={32} className="streak-flame" />
            <div>
              <strong>{stats.streak}</strong>
              <span>วันต่อเนื่อง</span>
            </div>
          </div>

          <div className="streak-meta-rows">
            <div className="streak-meta-item">
              <span>{t("longestStreak")}</span>
              <strong>{stats.longestStreak} วัน</strong>
            </div>
            <div className="streak-meta-item">
              <span>{t("tasksThisWeek")}</span>
              <strong>{stats.completedThisWeek} งาน</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Category Breakdown & Urgent Watchlist */}
      <div className="analytics-2col-layout">
        {/* Category Breakdown */}
        <div className="card category-breakdown-card">
          <div className="section-title-wrap">
            <Folder size={16} /> <h3>{t("category")}</h3>
          </div>

          <div className="category-bars-stream">
            {CATEGORY_OPTIONS.map((cat) => {
              const count = categoryCounts[cat.value] || 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={cat.value} className="category-bar-row">
                  <div className="cat-bar-header">
                    <span>{t(cat.key)}</span>
                    <strong>{count} ({pct}%)</strong>
                  </div>
                  <div className="cat-bar-track">
                    <i className={`cat-fill-${cat.value}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Urgent & Attention Watchlist */}
        <div className="card urgent-watchlist-card">
          <div className="section-title-wrap">
            <AlertTriangle size={16} /> <h3>{t("urgentWatchlist")}</h3>
          </div>

          <div className="urgent-stream">
            {urgentTasks.length === 0 ? (
              <p className="no-urgent-text">{t("noUrgentTasks")}</p>
            ) : (
              urgentTasks.map((td) => (
                <div
                  key={td.id}
                  className={`urgent-item-card color-${normalizeColor(td.color)}`}
                  onClick={() => onOpenDetail(td)}
                >
                  <div className="urgent-card-top">
                    <strong>{td.title}</strong>
                    <span className={`priority-badge ${normalizePriority(td.priority)}`}>
                      <Flag size={10} /> {t(normalizePriority(td.priority))}
                    </span>
                  </div>
                  <small><CalendarDays size={11} /> {formatDateHeading(getTodoDueDate(td), "th-TH", true)}</small>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. Mood & Working State Tracker */}
      <div className="card mood-card-container">
        <div>
          <span className="eyebrow">{t("moodTracker")}</span>
          <h3>{t("workingState")}</h3>
        </div>
        <div className="mood-grid">
          {MOOD_OPTIONS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={selectedMood === item.value ? "is-active" : ""}
              onClick={() => onMoodChange(item.value)}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Full-Featured Settings Page                                  */
/* ============================================================ */

function SettingsView({
  userName,
  onUserNameChange,
  soundEnabled,
  onSoundToggle,
  accentColor,
  onAccentChange,
  firstDayOfWeek,
  onFirstDayChange,
  boards,
  activeBoardId,
  onSelectDefaultBoard,
  showMobileProgress,
  onToggleMobileProgress,
  onClearCompletedRequest,
  onResetWorkspaceRequest,
  onExportBackup,
  onImportBackup,
  saveMsg,
  t,
}: {
  userName: string;
  onUserNameChange: (val: string) => void;
  soundEnabled: boolean;
  onSoundToggle: (enabled: boolean) => void;
  accentColor: AccentColor;
  onAccentChange: (val: AccentColor) => void;
  firstDayOfWeek: "sun" | "mon";
  onFirstDayChange: (val: "sun" | "mon") => void;
  boards: Board[];
  activeBoardId: number | null;
  onSelectDefaultBoard: (id: number) => void;
  showMobileProgress: boolean;
  onToggleMobileProgress: (enabled: boolean) => void;
  onClearCompletedRequest: () => void;
  onResetWorkspaceRequest: () => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  saveMsg: string;
  t: (key: TranslationKey) => string;
}) {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const importFileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="settings-page-wrapper" aria-label={t("settings")}>
      <div className="settings-header card">
        <div>
          <span className="eyebrow">{t("workspace")}</span>
          <h2>{t("workspaceSettings")}</h2>
        </div>
        {saveMsg && <div className="settings-toast-badge"><Check size={14} /> {saveMsg}</div>}
      </div>

      {/* 1. Profile & Workspace */}
      <div className="settings-section card">
        <div className="settings-section-title">
          <User size={18} />
          <h3>{t("userProfile")}</h3>
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("displayName")}</strong>
            <small>ชื่อที่แสดงในโปรไฟล์ การ์ด และความคิดเห็น</small>
          </div>
          <input
            type="text"
            className="settings-input"
            value={userName}
            onChange={(e) => onUserNameChange(e.target.value)}
          />
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("defaultBoard")}</strong>
            <small>บอร์ดที่เลือกใช้งานอยู่ในปัจจุบัน</small>
          </div>
          <select
            className="settings-select"
            value={activeBoardId ?? ""}
            onChange={(e) => onSelectDefaultBoard(Number(e.target.value))}
          >
            {boards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
      </div>

      {/* 2. Appearance & Interface */}
      <div className="settings-section card">
        <div className="settings-section-title">
          <Palette size={18} />
          <h3>{t("appearance")}</h3>
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("theme")}</strong>
            <small>สลับโหมดมืด (Dark) หรือโหมดสว่าง (Light)</small>
          </div>
          <button type="button" className="theme-toggle-settings-btn" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === "dark" ? t("light") : t("dark")}</span>
          </button>
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("accentColor")}</strong>
            <small>เลือกโทนสีหลักของระบบและปุ่มต่างๆ</small>
          </div>
          <div className="accent-color-picker">
            {ACCENT_COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`accent-color-circle ${accentColor === c.value ? "is-selected" : ""}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => onAccentChange(c.value)}
                title={c.label}
              >
                {accentColor === c.value && <Check size={12} color="#fff" />}
              </button>
            ))}
          </div>
        </div>

        {/* Show/Hide Mobile Progress Bar Setting */}
        <div className="settings-row">
          <div>
            <strong>แถบความคืบหน้าบนมือถือ</strong>
            <small>แสดงแถบวัดความคืบหน้ารวมแบบมินิมอลใต้แถบด้านบนในหน้าจอมือถือ</small>
          </div>
          <label className="toggle-switch-wrap">
            <input
              type="checkbox"
              checked={showMobileProgress}
              onChange={(e) => onToggleMobileProgress(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* 3. Sound & Alerts */}
      <div className="settings-section card">
        <div className="settings-section-title">
          <Volume2 size={18} />
          <h3>{t("soundAndAlerts")}</h3>
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("completionSound")}</strong>
            <small>เล่นเสียงเอฟเฟกต์ Chime เมื่อกดติ๊กถูกทำงานสำเร็จ</small>
          </div>
          <div className="sound-toggle-actions">
            <button
              type="button"
              className="test-sound-btn"
              onClick={() => playCompletionSound()}
              title="Test Sound FX"
            >
              ทดสอบเสียง
            </button>
            <label className="toggle-switch-wrap">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => onSoundToggle(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* 4. Language & Regional */}
      <div className="settings-section card">
        <div className="settings-section-title">
          <Calendar size={18} />
          <h3>ภาษาและปฏิทิน</h3>
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("language")}</strong>
            <small>สลับภาษาที่แสดงในระบบ</small>
          </div>
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>

        <div className="settings-row">
          <div>
            <strong>วันเริ่มต้นของสัปดาห์ในปฏิทิน</strong>
            <small>เลือกวันแรกในมุมมองปฏิทิน</small>
          </div>
          <select
            className="settings-select"
            value={firstDayOfWeek}
            onChange={(e) => onFirstDayChange(e.target.value as "sun" | "mon")}
          >
            <option value="sun">วันอาทิตย์ (Sunday)</option>
            <option value="mon">วันจันทร์ (Monday)</option>
          </select>
        </div>
      </div>

      {/* 5. Data Management & Backup */}
      <div className="settings-section card">
        <div className="settings-section-title">
          <Database size={18} />
          <h3>{t("dataManagement")}</h3>
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("exportBackup")}</strong>
            <small>ดาวน์โหลดไฟล์สำรองข้อมูลบอร์ดและงานทั้งหมด (.json)</small>
          </div>
          <button type="button" className="secondary-button" onClick={onExportBackup}>
            <Download size={14} /> <span>{t("exportBackup")}</span>
          </button>
        </div>

        <div className="settings-row">
          <div>
            <strong>{t("importBackup")}</strong>
            <small>นำเข้าข้อมูลงานจากไฟล์ JSON ที่เคยสำรองไว้</small>
          </div>
          <div>
            <button type="button" className="secondary-button" onClick={() => importFileRef.current?.click()}>
              <Upload size={14} /> <span>{t("importBackup")}</span>
            </button>
            <input
              type="file"
              ref={importFileRef}
              style={{ display: "none" }}
              accept=".json,application/json"
              onChange={onImportBackup}
            />
          </div>
        </div>

        <div className="settings-row danger-row">
          <div>
            <strong>{t("clearCompleted")}</strong>
            <small>ล้างงานที่ทำเสร็จแล้วในบอร์ดนี้ทั้งหมดเพื่อความสะอาดตา</small>
          </div>
          <button type="button" className="danger-button" onClick={onClearCompletedRequest}>
            <Trash2 size={14} /> <span>{t("clearCompleted")}</span>
          </button>
        </div>

        <div className="settings-row danger-row">
          <div>
            <strong>{t("resetWorkspace")}</strong>
            <small>ล้างข้อมูลในระบบและรีเซ็ตกลับเป็นค่าเริ่มต้น</small>
          </div>
          <button type="button" className="danger-button" onClick={onResetWorkspaceRequest}>
            <Trash2 size={14} /> <span>{t("resetWorkspace")}</span>
          </button>
        </div>
      </div>

      {/* 6. System Status */}
      <div className="settings-section card status-section">
        <div className="settings-section-title">
          <Database size={18} />
          <h3>{t("systemStatus")}</h3>
        </div>

        <div className="system-status-pills">
          <span className="status-pill connected">
            <span className="status-dot" /> {t("dbConnected")}
          </span>
          <span className="status-pill version">
            {t("version")}: <strong>v2.5.0 Pro</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Task Detail Modal (Trello Wide Card Details & Comments)      */
/* ============================================================ */

function TaskDetailModal({
  todo,
  allTodos,
  comments,
  lists,
  userName = "Workspace User",
  t,
  dateLocale,
  onClose,
  onUpdate,
  onDelete,
  onMove,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: {
  todo: Todo;
  allTodos: Todo[];
  comments: TodoComment[];
  lists: BoardList[];
  userName?: string;
  t: (key: TranslationKey) => string;
  dateLocale: string;
  onClose: () => void;
  onUpdate: (id: number, updates: Partial<Todo>) => void;
  onDelete: (todo: Todo) => void;
  onMove: (todoId: number, listId: number, position?: number) => void;
  onAddComment: (content: string, imageUrl?: string | null) => void;
  onUpdateComment: (id: number, content: string) => void;
  onDeleteComment: (id: number) => void;
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
  const [newComment, setNewComment] = useState("");
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const dataImageFileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const currentListCards = useMemo(() => {
    return allTodos.filter((t) => t.listId === (todo.listId ?? lists[0]?.id));
  }, [allTodos, todo.listId, lists]);

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
                    onUpdate(todo.id, { images: next });
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
            onUpdate(todo.id, { images: next });
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
    onUpdate(todo.id, { [key]: val });
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
      onUpdate(todo.id, { imageUrl: null });
    } else {
      setImageUrl(imgSrc);
      onUpdate(todo.id, { imageUrl: imgSrc });
    }
  };

  const handleDeleteImage = (imgSrc: string) => {
    const nextImages = images.filter((img) => img !== imgSrc);
    setImages(nextImages);
    const nextCover = imageUrl === imgSrc ? null : imageUrl;
    if (imageUrl === imgSrc) setImageUrl("");
    onUpdate(todo.id, { images: nextImages, imageUrl: nextCover });
  };

  const handlePostComment = () => {
    const text = newComment.trim();
    if (!text && !commentImage) return;

    onAddComment(text, commentImage);
    setNewComment("");
    setCommentImage(null);
  };

  const handleSaveEditedComment = (commentId: number) => {
    const text = editingCommentText.trim();
    if (!text) return;

    onUpdateComment(commentId, text);
    setEditingCommentId(null);
    setEditingCommentText("");
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
                onUpdate(todo.id, { completed: next });
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
              <div className="member-pill"><User size={13} /> <span>{userName}</span></div>
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
                    handlePostComment();
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
                  disabled={!newComment.trim() && !commentImage}
                  onClick={handlePostComment}
                >
                  {t("postComment")}
                </button>
              </div>
            </div>

            <div className="trello-comments-stream">
              {comments.length === 0 ? (
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
                            onClick={() => onDeleteComment(c.id)}
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
                              onClick={() => handleSaveEditedComment(c.id)}
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
/*  Task Form (Create Modal)                                     */
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
    <form className={compact ? "task-form compact cardless" : "task-form card"} onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
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
/*  Task Card & Other Shared Subcomponents                       */
/* ============================================================ */

function TaskCard({ todo, t, dateLocale, onEdit, onToggle, onDelete, onOpenDetail }: { todo: Todo; t: (key: TranslationKey) => string; dateLocale: string; onEdit: () => void; onToggle: () => void; onDelete: () => void; onOpenDetail: (todo: Todo) => void }) {
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
        <h3>{localizeTaskTitle(todo, t)}</h3>
        {todo.note && <p>{localizeTaskNote(todo, t)}</p>}
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
        </div>
      </div>
      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onEdit} aria-label={t("editTask")}><Pencil size={14} /></button>
        <button type="button" onClick={onDelete} aria-label={t("delete")}><Trash2 size={14} /></button>
      </div>
    </article>
  );
}

function FilterTabs({ filter, onChange, t }: { filter: Filter; onChange: (filter: Filter) => void; t: (key: TranslationKey) => string }) {
  const filters: Array<{ value: Filter; label: string }> = [{ value: "all", label: t("all") }, { value: "active", label: t("open") }, { value: "completed", label: t("done") }];
  return <div className="filter-tabs" role="tablist" aria-label={t("taskList")}>{filters.map((item) => <button key={item.value} type="button" className={filter === item.value ? "is-active" : ""} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

function Modal({ title, children, onClose, destructive = false }: { title: string; children: ReactNode; onClose: () => void; destructive?: boolean }) {
  const { t } = useLanguage();
  return <div className={destructive ? "modal-layer destructive" : "modal-layer"} role="presentation" onMouseDown={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h2 id="modal-title">{title}</h2><button type="button" onClick={onClose} aria-label={t("close")}><X size={18} /></button></div>{children}</section></div>;
}

function EmptyState({ onAdd, t }: { onAdd: () => void; t: (key: TranslationKey) => string }) {
  return <div className="empty-state card"><ListTodo size={36} /><h3>{t("noTasksFound")}</h3><p>{t("noTasksHint")}</p><button type="button" onClick={onAdd}>{t("addTask")}</button></div>;
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
  const overdue = todos.filter((todo) => !todo.completed && getTodoDueDate(todo) < todayKey).length;
  const weeklyCompleted = getWeeklyCompleted(todos, today);
  const completedThisWeek = weeklyCompleted.reduce((sum, item) => sum + item.count, 0);
  const streak = calculateCurrentStreak(todos, today);

  return { total: todos.length, active, completed, progress, dueToday: dueToday.length, completedToday, overdue, pending: active, weeklyCompleted, completedThisWeek, streak, longestStreak: Math.max(streak + 3, streak, completed > 0 ? 1 : 0) };
}

function buildCalendarDays(baseDate: Date, selectedDate: string, firstDay: "sun" | "mon" = "sun"): CalendarDay[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstOfMonth = new Date(year, month, 1, 12, 0, 0);
  let dayOffset = firstOfMonth.getDay();
  if (firstDay === "mon") {
    dayOffset = (dayOffset + 6) % 7;
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDays = (dayOffset + daysInMonth) > 35 ? 42 : 35;

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(year, month, 1 - dayOffset + index, 12, 0, 0);
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
    listId: todo.listId ?? 1,
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
