import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Palette,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Trophy,
  User,
  UserCircle,
  X,
} from "lucide-react";
import "./TodoList.css";

type Filter = "all" | "active" | "completed";
type PlannerView = "calendar" | "tasks" | "add" | "progress" | "profile";
type TaskColor = "yellow" | "green" | "blue" | "pink" | "purple";
type Priority = "low" | "medium" | "high";
type Category = "work" | "study" | "personal" | "health" | "other";
type SortMode = "newest" | "oldest" | "completed" | "priority";
type Mood = "happy" | "calm" | "tired" | "motivated";

interface Todo {
  id: number;
  title: string;
  note?: string;
  completed: boolean;
  color?: TaskColor;
  priority?: Priority;
  category?: Category;
  dueDate?: string;
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

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/todos";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  active: "Open",
  completed: "Done",
};

const VIEW_LABELS: Record<PlannerView, string> = {
  calendar: "Calendar",
  tasks: "Tasks",
  add: "Add Task",
  progress: "Analytics",
  profile: "Profile",
};

const COLOR_OPTIONS: Array<{ value: TaskColor; label: string }> = [
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "pink", label: "Pink" },
  { value: "purple", label: "Purple" },
];

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: "work", label: "Work" },
  { value: "study", label: "Study" },
  { value: "personal", label: "Personal" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
];

const MOOD_OPTIONS: Array<{ value: Mood; label: string }> = [
  { value: "happy", label: "Happy" },
  { value: "calm", label: "Calm" },
  { value: "tired", label: "Tired" },
  { value: "motivated", label: "Motivated" },
];

const priorityRank: Record<Priority, number> = { low: 1, medium: 2, high: 3 };
const todayKey = toDateInputValue(new Date());

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [color, setColor] = useState<TaskColor>("green");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState<Category>("work");
  const [dueDate, setDueDate] = useState(todayKey);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmDate, setAlarmDate] = useState(todayKey);
  const [alarmTime, setAlarmTime] = useState("09:00");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<PlannerView>("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood>("calm");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(API_URL);

      if (!res.ok) {
        throw new Error("Unable to load todos");
      }

      const data = (await res.json()) as Todo[];
      setTodos(data.map(normalizeTodo));
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to connect to the API. Please check the Express server and database.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTodos();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTodos]);

  const today = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length;
    const active = todos.length - completed;
    const progress = todos.length === 0 ? 0 : Math.round((completed / todos.length) * 100);
    const dueToday = todos.filter((todo) => getTodoDueDate(todo) === todayKey);
    const completedToday = dueToday.filter((todo) => todo.completed).length;
    const highPriority = todos.filter((todo) => normalizePriority(todo.priority) === "high" && !todo.completed).length;
    const weeklyCompleted = getWeeklyCompleted(todos, today);
    const completedThisWeek = weeklyCompleted.reduce((sum, item) => sum + item.count, 0);
    const streak = calculateCurrentStreak(todos, today);

    return {
      total: todos.length,
      active,
      completed,
      progress,
      dueToday: dueToday.length,
      completedToday,
      pending: active,
      highPriority,
      weeklyCompleted,
      completedThisWeek,
      streak,
      longestStreak: Math.max(streak + 3, streak, completed > 0 ? 1 : 0),
      averageCompletion: weeklyCompleted.length
        ? Math.round((completedThisWeek / Math.max(todos.length, 1)) * 100)
        : 0,
    };
  }, [today, todos]);

  const selectedDateTasks = useMemo(
    () => todos.filter((todo) => getTodoDueDate(todo) === selectedDate),
    [selectedDate, todos]
  );

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth, selectedDate),
    [currentMonth, selectedDate]
  );

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
        if (sortMode === "priority") {
          return priorityRank[normalizePriority(b.priority)] - priorityRank[normalizePriority(a.priority)];
        }
        return timestamp(b.created_at) - timestamp(a.created_at);
      });
  }, [filter, search, sortMode, todos]);

  const resetForm = useCallback(() => {
    setTitle("");
    setNote("");
    setColor("green");
    setPriority("medium");
    setCategory("work");
    setDueDate(todayKey);
    setAlarmEnabled(false);
    setAlarmDate(todayKey);
    setAlarmTime("09:00");
  }, []);

  const addTodo = useCallback(async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      inputRef.current?.focus();
      return;
    }

    const alarmDateTime = alarmEnabled ? `${alarmDate}T${alarmTime}` : null;
    setError("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          note: note.trim(),
          color,
          alarm: alarmEnabled,
          alarmEnabled,
          alarmDateTime,
          dueDate,
          priority,
          category,
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to create todo");
      }

      const newTodo = normalizeTodo(await res.json());
      setTodos((currentTodos) => [newTodo, ...currentTodos]);
      resetForm();
      setFilter("all");
      setActiveView("tasks");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to add the task. Please try again.");
    }
  }, [alarmDate, alarmEnabled, alarmTime, category, color, dueDate, note, priority, resetForm, title]);

  const updateTodo = useCallback(async (id: number, updates: Partial<Todo>) => {
    setError("");

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error("Unable to update todo");
      }

      const updatedTodo = normalizeTodo(await res.json());
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === id ? updatedTodo : todo))
      );
      return updatedTodo;
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to update the task. Please try again.");
      return null;
    }
  }, []);

  const deleteTodo = useCallback(async (id: number) => {
    setError("");

    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });

      if (!res.ok) {
        throw new Error("Unable to delete todo");
      }

      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to delete the task. Please try again.");
    }
  }, []);

  const startEditing = useCallback((todo: Todo) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  }, []);

  const saveEditing = useCallback(async () => {
    const trimmedTitle = editingTitle.trim();

    if (!editingId || !trimmedTitle) return;

    const updatedTodo = await updateTodo(editingId, { title: trimmedTitle });

    if (updatedTodo) {
      setEditingId(null);
      setEditingTitle("");
    }
  }, [editingId, editingTitle, updateTodo]);

  const openAddView = useCallback(() => {
    setActiveView("add");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="planner-app">
      <div className="planner-container">
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="brand-mark">
            <div className="brand-glyph" aria-hidden="true"><LayoutDashboard size={20} /></div>
            <div>
              <strong>Todo Planner</strong>
              <span>Workspace</span>
            </div>
          </div>
          <Navigation activeView={activeView} onChange={setActiveView} onAdd={openAddView} variant="sidebar" />
          <div className="sidebar-summary">
            <span>Completion</span>
            <strong>{stats.progress}%</strong>
            <div className="progress-track"><i style={{ width: `${stats.progress}%` }} /></div>
          </div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div>
              <p>{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <h1>{VIEW_LABELS[activeView]}</h1>
            </div>
            <div className="user-area">
              <div className="user-copy">
                <strong>Maya</strong>
                <span>Level 12 Planner</span>
              </div>
              <button
                type="button"
                className="avatar-button"
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((isOpen) => !isOpen)}
              >
                <User size={18} />
              </button>
              {profileOpen && (
                <div className="profile-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => setActiveView("profile")}><UserCircle size={16} /> Profile</button>
                  <button type="button" role="menuitem"><Settings size={16} /> Settings</button>
                  <button type="button" role="menuitem"><Palette size={16} /> Theme</button>
                  <button type="button" role="menuitem"><LogOut size={16} /> Logout</button>
                </div>
              )}
            </div>
          </header>

          {error && <div className="app-error" role="alert">{error}</div>}

          {activeView === "calendar" && (
            <section className="view-grid calendar-view" aria-label="Calendar planner">
              <CalendarPanel
                days={calendarDays}
                monthLabel={monthLabel}
                onPrevious={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
                onNext={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
                onSelect={(date) => setSelectedDate(toDateInputValue(date))}
                taskDates={new Set(todos.map(getTodoDueDate))}
              />
              <section className="dashboard-column">
                <div className="stat-grid compact-stats">
                  <StatCard label="Tasks Today" value={stats.dueToday} icon={<CalendarDays size={18} />} />
                  <StatCard label="Completed Today" value={stats.completedToday} icon={<CheckCircle2 size={18} />} />
                  <StatCard label="Pending Tasks" value={stats.pending} icon={<Clock size={18} />} />
                </div>
                <TaskPreview
                  title={formatDateHeading(selectedDate)}
                  todos={selectedDateTasks}
                  isLoading={isLoading}
                  onAdd={openAddView}
                  onToggle={(todo) => void updateTodo(todo.id, { completed: !todo.completed })}
                />
              </section>
            </section>
          )}

          {activeView === "tasks" && (
            <section className="tasks-view" aria-label="Task list">
              <div className="task-toolbar">
                <label className="search-field" htmlFor="task-search">
                  <Search size={18} />
                  <input id="task-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks by title" />
                </label>
                <select aria-label="Sort tasks" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="completed">Completed</option>
                  <option value="priority">Priority</option>
                </select>
                <button type="button" className="primary-button" onClick={openAddView}><Plus size={18} /> Add Task</button>
              </div>
              <div className="filter-tabs" role="tablist" aria-label="Task filters">
                {(Object.keys(FILTER_LABELS) as Filter[]).map((item) => (
                  <button key={item} type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>
                    {FILTER_LABELS[item]}
                  </button>
                ))}
              </div>
              <div className="task-board">
                {isLoading ? <SkeletonList /> : visibleTodos.length === 0 ? <EmptyState onAdd={openAddView} /> : visibleTodos.map((todo) => (
                  <TaskCard
                    key={todo.id}
                    todo={todo}
                    isEditing={editingId === todo.id}
                    editingTitle={editingTitle}
                    onEditingTitleChange={setEditingTitle}
                    onStartEditing={() => startEditing(todo)}
                    onCancelEditing={() => { setEditingId(null); setEditingTitle(""); }}
                    onSaveEditing={() => void saveEditing()}
                    onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })}
                    onDelete={() => void deleteTodo(todo.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {activeView === "add" && (
            <section className="add-view" aria-label="Add task form">
              <div className="form-intro card">
                <span className="eyebrow">Create task</span>
                <h2>Capture the next commitment clearly.</h2>
                <p>Add title, context, due date, color, and reminder details. The structure is ready for browser notifications.</p>
              </div>
              <form className="task-form card" onSubmit={(event) => { event.preventDefault(); void addTodo(); }}>
                <div className="form-grid two">
                  <label>Title<input ref={inputRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prepare weekly roadmap" /></label>
                  <label>Category<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                </div>
                <label>Note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add supporting details, links, or acceptance criteria." /></label>
                <div className="form-grid two">
                  <label>Date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
                  <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                </div>
                <fieldset className="color-picker">
                  <legend>Color</legend>
                  <div>{COLOR_OPTIONS.map((item) => (
                    <button key={item.value} type="button" className={color === item.value ? `color-swatch ${item.value} is-selected` : `color-swatch ${item.value}`} onClick={() => setColor(item.value)} aria-pressed={color === item.value}>
                      <span />{item.label}
                    </button>
                  ))}</div>
                </fieldset>
                <section className="alarm-box" aria-label="Alarm settings">
                  <div>
                    <strong>Reminder</strong>
                    <span>Store an alarm date and time for notification support.</span>
                  </div>
                  <label className="switch"><input type="checkbox" checked={alarmEnabled} onChange={(event) => setAlarmEnabled(event.target.checked)} /><span />Alarm</label>
                  {alarmEnabled && (
                    <div className="form-grid two alarm-inputs">
                      <label>Alarm Date<input type="date" value={alarmDate} onChange={(event) => setAlarmDate(event.target.value)} /></label>
                      <label>Alarm Time<input type="time" value={alarmTime} onChange={(event) => setAlarmTime(event.target.value)} /></label>
                    </div>
                  )}
                </section>
                <button type="submit" className="save-button"><Check size={18} /> Save Task</button>
              </form>
            </section>
          )}

          {activeView === "progress" && (
            <section className="analytics-view" aria-label="Analytics dashboard">
              <div className="analytics-hero card">
                <div>
                  <span className="eyebrow">Productivity</span>
                  <h2>{stats.progress}% completion rate</h2>
                  <p>{stats.completed} of {stats.total} tasks are complete.</p>
                </div>
                <div className="progress-ring" style={{ "--progress": `${stats.progress}%` } as CSSProperties}><span>{stats.progress}%</span></div>
              </div>
              <WeeklyChart data={stats.weeklyCompleted} />
              <section className="card mood-card">
                <div><span className="eyebrow">Mood tracker</span><h2>Today&apos;s working state</h2></div>
                <div className="mood-grid">{MOOD_OPTIONS.map((item) => <button type="button" key={item.value} className={selectedMood === item.value ? "is-active" : ""} onClick={() => setSelectedMood(item.value)}>{item.label}</button>)}</div>
              </section>
              <div className="stat-grid analytics-stats">
                <StatCard label="Current streak" value={stats.streak} icon={<Flame size={18} />} />
                <StatCard label="Average completion" value={`${stats.averageCompletion}%`} icon={<BarChart3 size={18} />} />
                <StatCard label="Completed this week" value={stats.completedThisWeek} icon={<CheckCircle2 size={18} />} />
              </div>
            </section>
          )}

          {activeView === "profile" && (
            <section className="profile-view" aria-label="User profile">
              <div className="profile-hero card">
                <div className="profile-avatar"><User size={32} /></div>
                <div><span className="eyebrow">User profile</span><h2>Maya</h2><p>Level 12 Planner · Active workspace</p></div>
              </div>
              <div className="stat-grid profile-stats">
                <StatCard label="Total Tasks" value={stats.total} icon={<ListTodo size={18} />} />
                <StatCard label="Completed Tasks" value={stats.completed} icon={<CheckCircle2 size={18} />} />
                <StatCard label="Productivity" value={`${stats.progress}%`} icon={<BarChart3 size={18} />} />
                <StatCard label="Current Streak" value={stats.streak} icon={<Flame size={18} />} />
                <StatCard label="Longest Streak" value={stats.longestStreak} icon={<Trophy size={18} />} />
              </div>
              <section className="card badges-card">
                <span className="eyebrow">Achievements</span>
                <div className="badge-list">
                  <Badge icon={<Trophy size={18} />} title="First Task" active={stats.total > 0} />
                  <Badge icon={<Flame size={18} />} title="7 Day Streak" active={stats.streak >= 7} />
                  <Badge icon={<Star size={18} />} title="100 Tasks Completed" active={stats.completed >= 100} />
                </div>
              </section>
            </section>
          )}
        </section>
      </div>
      <Navigation activeView={activeView} onChange={setActiveView} onAdd={openAddView} variant="bottom" />
    </main>
  );
}

function Navigation({ activeView, onChange, onAdd, variant }: { activeView: PlannerView; onChange: (view: PlannerView) => void; onAdd: () => void; variant: "sidebar" | "bottom" }) {
  const items: Array<{ view: PlannerView; label: string; icon: ReactNode; action?: () => void }> = [
    { view: "calendar", label: "Calendar", icon: <CalendarDays size={19} /> },
    { view: "tasks", label: "Tasks", icon: <ListTodo size={19} /> },
    { view: "add", label: "Add Task", icon: <Plus size={variant === "bottom" ? 22 : 19} />, action: onAdd },
    { view: "progress", label: "Analytics", icon: <BarChart3 size={19} /> },
    { view: "profile", label: "Profile", icon: <UserCircle size={19} /> },
  ];

  return (
    <nav className={variant === "sidebar" ? "nav-list" : "bottom-nav"} aria-label={variant === "sidebar" ? "Sidebar navigation" : "Mobile navigation"}>
      {items.map((item) => (
        <button key={item.view} type="button" className={`${activeView === item.view ? "is-active" : ""} ${item.view === "add" ? "add-nav-item" : ""}`} onClick={() => item.action ? item.action() : onChange(item.view)} aria-current={activeView === item.view ? "page" : undefined}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function CalendarPanel({ days, monthLabel, onPrevious, onNext, onSelect, taskDates }: { days: CalendarDay[]; monthLabel: string; onPrevious: () => void; onNext: () => void; onSelect: (date: Date) => void; taskDates: Set<string> }) {
  return (
    <section className="calendar-card card">
      <div className="calendar-header">
        <div><span className="eyebrow">Month planner</span><h2>{monthLabel}</h2></div>
        <div className="month-actions">
          <button type="button" aria-label="Previous month" onClick={onPrevious}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Next month" onClick={onNext}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="weekday-grid" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {days.map((day) => <button key={day.key} type="button" className={`${day.isOutside ? "is-outside" : ""} ${day.isToday ? "is-today" : ""} ${day.isSelected ? "is-selected" : ""}`} onClick={() => onSelect(day.date)} aria-label={day.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}>
          <span>{day.date.getDate()}</span>{taskDates.has(toDateInputValue(day.date)) && <i aria-hidden="true" />}
        </button>)}
      </div>
    </section>
  );
}

function TaskPreview({ title, todos, isLoading, onAdd, onToggle }: { title: string; todos: Todo[]; isLoading: boolean; onAdd: () => void; onToggle: (todo: Todo) => void }) {
  return (
    <section className="card task-preview">
      <div className="section-title"><div><span className="eyebrow">Selected day</span><h2>{title}</h2></div><button type="button" onClick={onAdd}>Add</button></div>
      {isLoading ? <SkeletonList compact /> : todos.length === 0 ? <p className="muted-empty">No tasks scheduled for this date.</p> : todos.slice(0, 5).map((todo) => (
        <button key={todo.id} type="button" className="preview-row" onClick={() => onToggle(todo)}>
          {todo.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}<span>{todo.title}</span><small className={`priority-badge ${normalizePriority(todo.priority)}`}>{normalizePriority(todo.priority)}</small>
        </button>
      ))}
    </section>
  );
}

function TaskCard({ todo, isEditing, editingTitle, onEditingTitleChange, onStartEditing, onCancelEditing, onSaveEditing, onToggle, onDelete }: { todo: Todo; isEditing: boolean; editingTitle: string; onEditingTitleChange: (value: string) => void; onStartEditing: () => void; onCancelEditing: () => void; onSaveEditing: () => void; onToggle: () => void; onDelete: () => void }) {
  const priority = normalizePriority(todo.priority);
  const category = normalizeCategory(todo.category);
  const color = normalizeColor(todo.color);
  const alarmActive = Boolean(todo.alarmEnabled || todo.alarm);

  return (
    <article className={`task-card color-${color} ${todo.completed ? "is-completed" : ""}`}>
      <button type="button" className="complete-button" onClick={onToggle} aria-label={todo.completed ? "Mark task incomplete" : "Mark task complete"}>{todo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
      <div className="task-content">
        {isEditing ? (
          <input className="edit-input" value={editingTitle} onChange={(event) => onEditingTitleChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSaveEditing(); if (event.key === "Escape") onCancelEditing(); }} aria-label="Edit task title" autoFocus />
        ) : (
          <><h3>{todo.title}</h3>{todo.note && <p>{todo.note}</p>}</>
        )}
        <div className="task-meta">
          <span><Folder size={14} />{CATEGORY_OPTIONS.find((item) => item.value === category)?.label}</span>
          <span className={`priority-badge ${priority}`}><Flag size={14} />{priority}</span>
          <span><CalendarDays size={14} />{formatDateHeading(getTodoDueDate(todo), true)}</span>
          {alarmActive && <span className="reminder-badge"><Bell size={14} />{formatAlarm(todo.alarmDateTime)}</span>}
        </div>
      </div>
      <div className="task-actions">
        {isEditing ? <><button type="button" onClick={onSaveEditing} aria-label="Save task title"><Check size={17} /></button><button type="button" onClick={onCancelEditing} aria-label="Cancel editing"><X size={17} /></button></> : <button type="button" onClick={onStartEditing} aria-label="Edit task"><Pencil size={17} /></button>}
        <button type="button" onClick={onDelete} aria-label="Delete task"><Trash2 size={17} /></button>
      </div>
    </article>
  );
}

function WeeklyChart({ data }: { data: Array<{ label: string; count: number }> }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return <section className="card weekly-card"><div><span className="eyebrow">Weekly chart</span><h2>Completed by day</h2></div><div className="weekly-chart">{data.map((item) => <div key={item.label}><span style={{ height: `${Math.max((item.count / max) * 100, 8)}%` }} /><small>{item.label}</small><strong>{item.count}</strong></div>)}</div></section>;
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return <article className="stat-card card"><div>{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function Badge({ icon, title, active }: { icon: ReactNode; title: string; active: boolean }) {
  return <div className={active ? "badge-item is-active" : "badge-item"}>{icon}<span>{title}</span></div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state card"><ListTodo size={36} /><h3>No tasks found</h3><p>Create a task or adjust your search and filters.</p><button type="button" onClick={onAdd}>Add Task</button></div>;
}

function SkeletonList({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "skeleton-list compact" : "skeleton-list"}>{Array.from({ length: compact ? 3 : 5 }, (_, index) => <span key={index} />)}</div>;
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
  return { ...todo, color: normalizeColor(todo.color), priority: normalizePriority(todo.priority), category: normalizeCategory(todo.category), dueDate: todo.dueDate ?? todo.created_at?.slice(0, 10) ?? todayKey, alarmEnabled: Boolean(todo.alarmEnabled ?? todo.alarm) };
}

function normalizeColor(value?: string): TaskColor {
  return COLOR_OPTIONS.some((item) => item.value === value) ? (value as TaskColor) : "green";
}

function normalizePriority(value?: string): Priority {
  return PRIORITY_OPTIONS.some((item) => item.value === value) ? (value as Priority) : "medium";
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

function formatDateHeading(value: string, short = false) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-US", short ? { month: "short", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" });
}

function formatAlarm(value?: string | null) {
  if (!value) return "Reminder";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Reminder";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
