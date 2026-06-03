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
type PlannerView = "calendar" | "tasks" | "add" | "progress" | "profile";
type TaskColor = "green" | "blue" | "yellow" | "orange" | "purple" | "red";
type Priority = "low" | "medium" | "high";
type Category = "work" | "study" | "personal" | "health" | "other";
type SortMode = "newest" | "oldest" | "completed" | "priority";
type Mood = "happy" | "calm" | "tired" | "motivated";
type DialogMode = "edit" | "delete" | null;

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
  created_at?: string;
  updated_at?: string;
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
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/todos";
const todayKey = toDateInputValue(new Date());

const COLOR_OPTIONS: Array<{ value: TaskColor; key: "green" | "blue" | "yellow" | "orange" | "purple" | "red" }> = [
  { value: "green", key: "green" },
  { value: "blue", key: "blue" },
  { value: "yellow", key: "yellow" },
  { value: "orange", key: "orange" },
  { value: "purple", key: "purple" },
  { value: "red", key: "red" },
];

const PRIORITY_OPTIONS: Array<{ value: Priority; key: "low" | "medium" | "high" }> = [
  { value: "low", key: "low" },
  { value: "medium", key: "medium" },
  { value: "high", key: "high" },
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

const priorityRank: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

const createDefaultFormState = (): TaskFormState => ({
  title: "",
  note: "",
  color: "green",
  priority: "medium",
  category: "work",
  dueDate: todayKey,
  dueTime: "09:00",
  alarmEnabled: false,
  alarmDate: todayKey,
  alarmTime: "09:00",
});

export default function TodoList() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [form, setForm] = useState<TaskFormState>(() => createDefaultFormState());
  const [filter, setFilter] = useState<Filter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<PlannerView>("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedMood, setSelectedMood] = useState<Mood>("calm");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingTodo, setDeletingTodo] = useState<Todo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const dateLocale = language === "th" ? "th-TH" : "en-US";

  const dateLocale = language === "th" ? "th-TH" : "en-US";

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTodos();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTodos]);

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
    calendar: t("calendar"),
    tasks: t("tasks"),
    add: t("addTask"),
    progress: t("analytics"),
    profile: t("profile"),
  }), [t]);

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
        }),
      });

      if (!res.ok) throw new Error("Unable to create todo");
      const newTodo = normalizeTodo(await res.json());
      setTodos((currentTodos) => [newTodo, ...currentTodos]);
      setForm(createDefaultFormState());
      setFilter("all");
      setActiveView("tasks");
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

  const openAddView = useCallback(() => {
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

  const closeDialog = useCallback(() => {
    setDialogMode(null);
    setEditingTodo(null);
    setEditingTitle("");
    setDeletingTodo(null);
  }, []);

  const monthLabel = currentMonth.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });

  return (
    <main className="planner-app">
      <div className="planner-container">
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="brand-mark">
            <div className="brand-glyph" aria-hidden="true"><LayoutDashboard size={20} /></div>
            <div><strong>{t("appName")}</strong><span>{t("workspace")}</span></div>
          </div>
          <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} onAdd={openAddView} variant="sidebar" />
          <div className="sidebar-summary">
            <span>{t("completion")}</span>
            <strong>{stats.progress}%</strong>
            <div className="progress-track"><i style={{ width: `${stats.progress}%` }} /></div>
          </div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div>
              <p>{today.toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric" })}</p>
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
                onProfile={() => { setActiveView("profile"); setProfileOpen(false); }}
                onToggleTheme={toggleTheme}
                themeLabel={theme === "dark" ? t("light") : t("dark")}
              />
            )}
          </header>

          {error && <div className="app-error" role="alert">{error}</div>}

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
                <TaskPreview title={formatDateHeading(selectedDate, dateLocale)} todos={selectedDateTasks} t={t} dateLocale={dateLocale} isLoading={isLoading} onAdd={openAddView} onToggle={(todo) => void updateTodo(todo.id, { completed: !todo.completed })} />
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
                <button type="button" className="primary-button" onClick={openAddView}><Plus size={18} /> {t("addTask")}</button>
              </div>
              <FilterTabs filter={filter} onChange={setFilter} t={t} />
              <div className="task-board">
                {isLoading ? <SkeletonList /> : visibleTodos.length === 0 ? <EmptyState onAdd={openAddView} t={t} /> : visibleTodos.map((todo) => (
                  <TaskCard key={todo.id} todo={todo} t={t} dateLocale={dateLocale} onEdit={() => openEditDialog(todo)} onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })} onDelete={() => requestDelete(todo)} />
                ))}
              </div>
            </section>
          )}

          {activeView === "add" && (
            <section className="add-view" aria-label={t("addTask")}>
              <div className="form-intro card"><span className="eyebrow">{t("createTask")}</span><h2>{t("formIntroTitle")}</h2><p>{t("formIntroBody")}</p></div>
              <TaskForm form={form} setForm={setForm} t={t} inputRef={inputRef} onSubmit={addTodo} submitLabel={t("saveTask")} />
            </section>
          )}

          {activeView === "progress" && (
            <AnalyticsView stats={stats} todos={todos} selectedMood={selectedMood} onMoodChange={setSelectedMood} t={t} />
          )}

          {activeView === "profile" && (
            <ProfileView stats={stats} t={t} theme={theme} onToggleTheme={toggleTheme} language={language} onLanguageChange={setLanguage} />
          )}
        </section>
      </div>

      <Navigation activeView={activeView} labels={viewLabels} onChange={setActiveView} onAdd={openAddView} variant="bottom" />

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
    </main>
  );
}

const UserMenu = forwardRef<HTMLDivElement, { onClose: () => void; onProfile: () => void; onToggleTheme: () => void; themeLabel: string }>(function UserMenu({ onClose, onProfile, onToggleTheme, themeLabel }, ref) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="popover-layer" role="presentation" onClick={onClose}>
      <div ref={ref} className="profile-menu" role="menu" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-handle" aria-hidden="true" />
        <button type="button" role="menuitem" onClick={onProfile}><UserCircle size={16} /> {t("profile")}</button>
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
    { view: "calendar", icon: <CalendarDays size={19} /> },
    { view: "tasks", icon: <ListTodo size={19} /> },
    { view: "add", icon: <Plus size={variant === "bottom" ? 22 : 19} />, action: onAdd },
    { view: "progress", icon: <BarChart3 size={19} /> },
    { view: "profile", icon: <UserCircle size={19} /> },
  ];

  return <nav className={variant === "sidebar" ? "nav-list" : "bottom-nav"} aria-label={variant === "sidebar" ? "Sidebar navigation" : "Mobile navigation"}>{items.map((item) => <button key={item.view} type="button" className={`${activeView === item.view ? "is-active" : ""} ${item.view === "add" ? "add-nav-item" : ""}`} onClick={() => item.action ? item.action() : onChange(item.view)} aria-current={activeView === item.view ? "page" : undefined}>{item.icon}<span>{labels[item.view]}</span></button>)}</nav>;
}

function CalendarPanel({ days, monthLabel, taskDates, dateLocale, t, onPrevious, onNext, onSelect }: { days: CalendarDay[]; monthLabel: string; taskDates: Set<string>; dateLocale: string; t: (key: TranslationKey) => string; onPrevious: () => void; onNext: () => void; onSelect: (date: Date) => void }) {
  return <section className="calendar-card card"><div className="calendar-header"><div><span className="eyebrow">{t("monthPlanner")}</span><h2>{monthLabel}</h2></div><div className="month-actions"><button type="button" aria-label={t("previousMonth")} onClick={onPrevious}><ChevronLeft size={18} /></button><button type="button" aria-label={t("nextMonth")} onClick={onNext}><ChevronRight size={18} /></button></div></div><div className="weekday-grid" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => <button key={day.key} type="button" className={`${day.isOutside ? "is-outside" : ""} ${day.isToday ? "is-today" : ""} ${day.isSelected ? "is-selected" : ""}`} onClick={() => onSelect(day.date)} aria-label={day.date.toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}><span>{day.date.getDate()}</span>{taskDates.has(toDateInputValue(day.date)) && <i aria-hidden="true" />}</button>)}</div></section>;
}

function TaskPreview({ title, todos, t, dateLocale, isLoading, onAdd, onToggle }: { title: string; todos: Todo[]; t: (key: TranslationKey) => string; dateLocale: string; isLoading: boolean; onAdd: () => void; onToggle: (todo: Todo) => void }) {
  return <section className="card task-preview"><div className="section-title"><div><span className="eyebrow">{t("selectedDay")}</span><h2>{title}</h2></div><button type="button" onClick={onAdd}>{t("add")}</button></div>{isLoading ? <SkeletonList compact /> : todos.length === 0 ? <p className="muted-empty">{t("noTasksDate")}</p> : todos.slice(0, 5).map((todo) => <button key={todo.id} type="button" className={`preview-row color-${normalizeColor(todo.color)}`} onClick={() => onToggle(todo)}>{todo.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}<span>{todo.title}</span><small>{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</small></button>)}</section>;
}

function TaskCard({ todo, t, dateLocale, onEdit, onToggle, onDelete }: { todo: Todo; t: (key: TranslationKey) => string; dateLocale: string; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const priority = normalizePriority(todo.priority);
  const category = normalizeCategory(todo.category);
  const color = normalizeColor(todo.color);
  const alarmActive = Boolean(todo.alarmEnabled || todo.alarm);

  return <article className={`task-card color-${color} ${todo.completed ? "is-completed" : ""}`}><button type="button" className="complete-button" onClick={onToggle} aria-label={todo.completed ? t("pending") : t("completed")}>{todo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button><div className="task-content"><h3>{todo.title}</h3>{todo.note && <p>{todo.note}</p>}<div className="task-meta"><span><Folder size={14} />{t(category)}</span><span className={`priority-badge ${priority}`}><Flag size={14} />{t(priority)}</span><span><CalendarDays size={14} />{formatDateHeading(getTodoDueDate(todo), dateLocale, true)}</span>{todo.dueTime && <span><Clock size={14} />{todo.dueTime}</span>}{alarmActive && <span className="reminder-badge"><Bell size={14} />{formatAlarm(todo.alarmDateTime, dateLocale)}</span>}</div></div><div className="task-actions"><button type="button" onClick={onEdit} aria-label={t("editTask")}><Pencil size={17} /></button><button type="button" onClick={onDelete} aria-label={t("delete")}><Trash2 size={17} /></button></div></article>;
}

function TaskForm({ form, setForm, t, onSubmit, submitLabel, inputRef, onCancel, compact = false }: { form: TaskFormState; setForm: (form: TaskFormState) => void; t: (key: TranslationKey) => string; onSubmit: () => void; submitLabel: string; inputRef?: React.RefObject<HTMLInputElement | null>; onCancel?: () => void; compact?: boolean }) {
  const updateField = <Key extends keyof TaskFormState>(key: Key, value: TaskFormState[Key]) => setForm({ ...form, [key]: value });

  return <form className={compact ? "task-form compact cardless" : "task-form card"} onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}><div className="form-grid two"><label>{t("title")}<input ref={inputRef} value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder={t("titlePlaceholder")} /></label><label>{t("category")}<select value={form.category} onChange={(event) => updateField("category", event.target.value as Category)}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}</select></label></div><label>{t("note")}<textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder={t("notePlaceholder")} /></label><div className="form-grid two"><label>{t("dueDate")}<input type="date" value={form.dueDate} onChange={(event) => updateField("dueDate", event.target.value)} /></label><label>{t("dueTime")}<input type="time" value={form.dueTime} onChange={(event) => updateField("dueTime", event.target.value)} /></label></div><div className="form-grid two"><label>{t("priority")}<select value={form.priority} onChange={(event) => updateField("priority", event.target.value as Priority)}>{PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}</select></label><fieldset className="color-picker"><legend>{t("color")}</legend><div>{COLOR_OPTIONS.map((item) => <button key={item.value} type="button" className={form.color === item.value ? `color-swatch ${item.value} is-selected` : `color-swatch ${item.value}`} onClick={() => updateField("color", item.value)} aria-pressed={form.color === item.value}><span />{t(item.key)}</button>)}</div></fieldset></div><section className="alarm-box" aria-label={t("reminder")}><div><strong>{t("reminder")}</strong><span>{t("alarmDate")} / {t("alarmTime")}</span></div><label className="switch"><input type="checkbox" checked={form.alarmEnabled} onChange={(event) => updateField("alarmEnabled", event.target.checked)} /><span />{t("reminder")}</label>{form.alarmEnabled && <div className="form-grid two alarm-inputs"><label>{t("alarmDate")}<input type="date" value={form.alarmDate} onChange={(event) => updateField("alarmDate", event.target.value)} /></label><label>{t("alarmTime")}<input type="time" value={form.alarmTime} onChange={(event) => updateField("alarmTime", event.target.value)} /></label></div>}</section><div className="form-actions">{onCancel && <button type="button" className="secondary-button" onClick={onCancel}>{t("cancel")}</button>}<button type="submit" className="save-button"><Check size={18} /> {submitLabel}</button></div></form>;
}

function AnalyticsView({ stats, todos, selectedMood, onMoodChange, t }: { stats: ReturnType<typeof buildStats>; todos: Todo[]; selectedMood: Mood; onMoodChange: (mood: Mood) => void; t: (key: TranslationKey) => string }) {
  return <section className="analytics-view" aria-label={t("analytics")}><div className="analytics-hero card"><div><span className="eyebrow">{t("productivity")}</span><h2>{stats.progress}% {t("completionRate")}</h2><p>{stats.completed} / {stats.total} {t("tasksCompleted")}</p></div><div className="progress-ring" style={{ "--progress": `${stats.progress}%` } as CSSProperties}><span>{stats.progress}%</span></div></div><section className="card donut-card"><span className="eyebrow">{t("completedVsPending")}</span><div className="donut-chart" style={{ "--done": `${stats.progress}%` } as CSSProperties} /><div className="chart-legend"><span><i className="done" />{t("completed")}</span><span><i />{t("pending")}</span></div></section><WeeklyChart data={stats.weeklyCompleted} t={t} /><section className="card mood-card"><div><span className="eyebrow">{t("moodTracker")}</span><h2>{t("workingState")}</h2></div><div className="mood-grid">{MOOD_OPTIONS.map((item) => <button type="button" key={item.value} className={selectedMood === item.value ? "is-active" : ""} onClick={() => onMoodChange(item.value)}>{t(item.key)}</button>)}</div></section><div className="stat-grid analytics-stats"><StatCard label={t("currentStreak")} value={stats.streak} icon={<Flame size={18} />} /><StatCard label={t("tasksThisWeek")} value={stats.completedThisWeek} icon={<BarChart3 size={18} />} /><StatCard label={t("tasksThisMonth")} value={todos.filter((todo) => todo.completed && isThisMonth(todo.updated_at)).length} icon={<CheckCircle2 size={18} />} /></div></section>;
}

function ProfileView({ stats, t, theme, onToggleTheme, language, onLanguageChange }: { stats: ReturnType<typeof buildStats>; t: (key: TranslationKey) => string; theme: "light" | "dark"; onToggleTheme: () => void; language: "en" | "th"; onLanguageChange: (language: "en" | "th") => void }) {
  return <section className="profile-view" aria-label={t("profileScreen")}><div className="profile-hero card"><div className="profile-avatar"><User size={32} /></div><div><span className="eyebrow">{t("profile")}</span><h2>{t("userName")}</h2><p>{t("userLevel")}</p></div></div><div className="profile-controls card"><button type="button" className="secondary-button" onClick={onToggleTheme}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />} {t("theme")}: {theme === "dark" ? t("dark") : t("light")}</button><LanguageToggle language={language} onChange={onLanguageChange} /><button type="button" className="secondary-button"><Settings size={17} /> {t("settings")}</button></div><div className="stat-grid profile-stats"><StatCard label={t("totalTasks")} value={stats.total} icon={<ListTodo size={18} />} /><StatCard label={t("tasksCompleted")} value={stats.completed} icon={<CheckCircle2 size={18} />} /><StatCard label={t("completionRate")} value={`${stats.progress}%`} icon={<BarChart3 size={18} />} /><StatCard label={t("currentStreak")} value={stats.streak} icon={<Flame size={18} />} /><StatCard label={t("longestStreak")} value={stats.longestStreak} icon={<Trophy size={18} />} /></div><section className="card badges-card"><span className="eyebrow">{t("achievements")}</span><div className="badge-list"><Badge icon={<Trophy size={18} />} title={t("firstTask")} active={stats.total > 0} /><Badge icon={<Flame size={18} />} title={t("sevenDayStreak")} active={stats.streak >= 7} /><Badge icon={<Star size={18} />} title={t("hundredTasksCompleted")} active={stats.completed >= 100} /></div></section></section>;
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
  return { ...todo, color: normalizeColor(todo.color), priority: normalizePriority(todo.priority), category: normalizeCategory(todo.category), dueDate: todo.dueDate ?? todo.created_at?.slice(0, 10) ?? todayKey, dueTime: normalizeTime(todo.dueTime), alarmEnabled: Boolean(todo.alarmEnabled ?? todo.alarm) };
}

function normalizeColor(value?: string): TaskColor {
  return COLOR_OPTIONS.some((item) => item.value === value) ? (value as TaskColor) : "green";
}

function normalizePriority(value?: string): Priority {
  return PRIORITY_OPTIONS.some((item) => item.value === value) ? (value as Priority) : "medium";
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
