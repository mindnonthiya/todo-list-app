import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "./TodoList.css";

type Filter = "all" | "active" | "completed";
type PlannerView = "calendar" | "tasks" | "add" | "progress";
type DoodleMood = "happy" | "focused" | "excited" | "relaxed" | "sleepy" | "motivated";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/todos";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  active: "Active",
  completed: "Done",
};

const VIEW_LABELS: Record<PlannerView, string> = {
  calendar: "Calendar",
  tasks: "Daily Task",
  add: "Add Note",
  progress: "Progress",
};

const MOODS: DoodleMood[] = ["happy", "focused", "excited", "relaxed", "sleepy", "motivated"];

const CATEGORY_STYLES = [
  { label: "Home", tone: "mint" },
  { label: "Focus", tone: "sage" },
  { label: "Diary", tone: "butter" },
  { label: "Errand", tone: "sky" },
  { label: "Care", tone: "peach" },
];

const PRIORITIES = [
  { label: "Low", tone: "low" },
  { label: "Soft", tone: "medium" },
  { label: "High", tone: "high" },
];

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeView, setActiveView] = useState<PlannerView>("calendar");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(API_URL);

      if (!res.ok) {
        throw new Error("Unable to load todos");
      }

      const data = await res.json();
      setTodos(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError("เชื่อมต่อ API ไม่สำเร็จ กรุณาตรวจสอบ Express server และฐานข้อมูล");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchTodos, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTodos]);

  const today = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length;
    const active = todos.length - completed;
    const progress = todos.length === 0 ? 0 : Math.round((completed / todos.length) * 100);

    return {
      total: todos.length,
      active,
      completed,
      progress,
    };
  }, [todos]);

  const calendarDays = useMemo(() => buildCalendarDays(today), [today]);

  const todaysSummary = useMemo(() => {
    const nextTask = todos.find((todo) => !todo.completed);

    return {
      nextTask,
      caption:
        stats.active === 0 && stats.total > 0
          ? "Everything feels tucked in for today."
          : stats.active === 1
            ? "One gentle task is waiting for you."
            : `${stats.active} cozy tasks are waiting for you.`,
    };
  }, [stats.active, stats.total, todos]);

  const filteredTodos = useMemo(() => {
    if (filter === "active") {
      return todos.filter((todo) => !todo.completed);
    }

    if (filter === "completed") {
      return todos.filter((todo) => todo.completed);
    }

    return todos;
  }, [filter, todos]);

  const previewTodos = useMemo(() => {
    const activeTodos = todos.filter((todo) => !todo.completed);
    return (activeTodos.length > 0 ? activeTodos : todos).slice(0, 3);
  }, [todos]);

  const addTodo = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      inputRef.current?.focus();
      return;
    }

    setError("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!res.ok) {
        throw new Error("Unable to create todo");
      }

      const newTodo = await res.json();
      setTodos((currentTodos) => [newTodo, ...currentTodos]);
      setTitle("");
      setFilter("all");
      setActiveView("tasks");
    } catch (fetchError) {
      console.error(fetchError);
      setError("เพิ่มรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const updateTodo = async (id: number, updates: Partial<Pick<Todo, "title" | "completed">>) => {
    setError("");

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error("Unable to update todo");
      }

      const updatedTodo = await res.json();
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === id ? updatedTodo : todo))
      );
      return updatedTodo as Todo;
    } catch (fetchError) {
      console.error(fetchError);
      setError("อัปเดตรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return null;
    }
  };

  const deleteTodo = async (id: number) => {
    setError("");

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Unable to delete todo");
      }

      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
    } catch (fetchError) {
      console.error(fetchError);
      setError("ลบรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  };

  const saveEditing = async () => {
    const trimmedTitle = editingTitle.trim();

    if (!editingId || !trimmedTitle) {
      return;
    }

    const updatedTodo = await updateTodo(editingId, { title: trimmedTitle });

    if (updatedTodo) {
      setEditingId(null);
      setEditingTitle("");
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const openAddView = () => {
    setActiveView("add");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  };

  return (
    <main className="planner-shell">
      <div className="paper-grain" aria-hidden="true" />
      <section className="planner-stage" aria-label="Pastel planner app preview">
        <div className="planner-phone">
          <header className="app-topbar">
            <button type="button" className="top-icon-button" aria-label="Menu">
              <span />
              <span />
            </button>
            <div>
              <p>{today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
              <h1>{VIEW_LABELS[activeView]}</h1>
            </div>
            <div className="avatar-sticker" aria-hidden="true">
              <DoodleMoodSticker mood="motivated" size="tiny" />
            </div>
          </header>

          {error && <div className="app-error">{error}</div>}

          <div className="screen-viewport">
            {activeView === "calendar" && (
              <section className="app-screen calendar-screen" aria-label="Calendar screen">
                <CalendarCard today={today} days={calendarDays} taskCount={stats.total} />
                <section className="today-panel">
                  <div className="panel-handle" aria-hidden="true" />
                  <div className="panel-title-row">
                    <h2>Today</h2>
                    <button type="button" onClick={() => setActiveView("tasks")}>
                      View all
                    </button>
                  </div>
                  {isLoading ? (
                    <div className="compact-skeleton-stack">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="compact-skeleton" />
                      ))}
                    </div>
                  ) : previewTodos.length === 0 ? (
                    <MiniEmptyState onAdd={openAddView} />
                  ) : (
                    <div className="timeline-list">
                      {previewTodos.map((todo) => (
                        <CompactTodoRow
                          key={todo.id}
                          todo={todo}
                          editingId={editingId}
                          editingTitle={editingTitle}
                          setEditingTitle={setEditingTitle}
                          onToggle={() => updateTodo(todo.id, { completed: !todo.completed })}
                          onEdit={() => startEditing(todo)}
                          onCancel={cancelEditing}
                          onSave={saveEditing}
                          onDelete={() => deleteTodo(todo.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </section>
            )}

            {activeView === "tasks" && (
              <section className="app-screen tasks-screen" aria-label="Daily task screen">
                <div className="screen-header-row">
                  <div>
                    <span>December planner</span>
                    <h2>Daily Task</h2>
                  </div>
                  <button type="button" onClick={fetchTodos} className="round-refresh" aria-label="Refresh todos">
                    <RefreshCw size={15} />
                  </button>
                </div>

                <div className="filter-tabs" aria-label="Todo filters">
                  {(["all", "active", "completed"] as Filter[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFilter(item)}
                      className={filter === item ? "is-active" : ""}
                    >
                      {FILTER_LABELS[item]}
                      <span>{item === "all" ? stats.total : item === "active" ? stats.active : stats.completed}</span>
                    </button>
                  ))}
                </div>

                {isLoading ? (
                  <div className="compact-skeleton-stack roomy">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="compact-skeleton" />
                    ))}
                  </div>
                ) : filteredTodos.length === 0 ? (
                  <EmptyState filter={filter} onAdd={openAddView} />
                ) : (
                  <div className="daily-card-list">
                    {filteredTodos.map((todo) => {
                      const category = getCategory(todo);
                      const priority = getPriority(todo);
                      const mood = getMood(todo);

                      return (
                        <TaskCard
                          key={todo.id}
                          todo={todo}
                          mood={mood}
                          category={category}
                          priority={priority}
                          editingId={editingId}
                          editingTitle={editingTitle}
                          setEditingTitle={setEditingTitle}
                          onToggle={() => updateTodo(todo.id, { completed: !todo.completed })}
                          onEdit={() => startEditing(todo)}
                          onCancel={cancelEditing}
                          onSave={saveEditing}
                          onDelete={() => deleteTodo(todo.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeView === "add" && (
              <section className="app-screen add-screen" aria-label="Add note screen">
                <div className="add-hero">
                  <DoodleMoodSticker mood="excited" size="medium" />
                  <div>
                    <span>Quick note</span>
                    <h2>Add Todo</h2>
                  </div>
                </div>

                <div className="date-picker-card">
                  <span>Date and Time</span>
                  <div className="date-columns" aria-hidden="true">
                    <strong>{today.getDate()}</strong>
                    <strong>{today.toLocaleDateString("en-US", { month: "2-digit" })}</strong>
                    <strong>{today.getHours().toString().padStart(2, "0")}</strong>
                    <strong>{today.getMinutes().toString().padStart(2, "0")}</strong>
                    <strong>{today.getHours() >= 12 ? "PM" : "AM"}</strong>
                  </div>
                  <div className="date-labels" aria-hidden="true">
                    <small>Day</small>
                    <small>Month</small>
                    <small>Hour</small>
                    <small>Minute</small>
                    <small>Time</small>
                  </div>
                </div>

                <div className="note-form-card">
                  <label htmlFor="todo-title">Title</label>
                  <input
                    ref={inputRef}
                    id="todo-title"
                    type="text"
                    placeholder="Write the title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addTodo();
                      }
                    }}
                  />
                  <label htmlFor="todo-note-preview">Note</label>
                  <textarea id="todo-note-preview" placeholder="Write your important note" value={title} onChange={(event) => setTitle(event.target.value)} />
                  <div className="form-options-row">
                    <div>
                      <span>Color</span>
                      <div className="color-dots" aria-hidden="true">
                        <i className="orange" />
                        <i className="lime" />
                        <i className="mint" />
                      </div>
                    </div>
                    <div>
                      <span>Alarm</span>
                      <button type="button" className="toggle-pill" aria-label="Decorative alarm toggle" />
                    </div>
                  </div>
                  <button type="button" onClick={addTodo} className="save-note-button">
                    Save
                  </button>
                </div>
              </section>
            )}

            {activeView === "progress" && (
              <section className="app-screen progress-screen" aria-label="Progress screen">
                <div className="progress-hero-card">
                  <div>
                    <span>Your Progress</span>
                    <strong>{stats.progress}%</strong>
                    <p>{todaysSummary.caption}</p>
                  </div>
                  <div className="progress-ring compact" style={{ "--progress": `${stats.progress}%` } as CSSProperties}>
                    <span>{stats.completed}</span>
                    <small>done</small>
                  </div>
                </div>
                <div className="stat-tile-grid">
                  <StatCard label="Total" value={stats.total} tone="sage" />
                  <StatCard label="Active" value={stats.active} tone="yellow" />
                  <StatCard label="Done" value={stats.completed} tone="blue" />
                </div>
                <section className="mood-strip-card">
                  <div className="section-heading compact">
                    <span>Today&apos;s mood</span>
                    <Sparkles size={16} />
                  </div>
                  <div className="mood-strip" aria-hidden="true">
                    <DoodleMoodSticker mood="happy" size="small" />
                    <DoodleMoodSticker mood="focused" size="small" />
                    <DoodleMoodSticker mood="relaxed" size="small" />
                    <DoodleMoodSticker mood="motivated" size="small" />
                  </div>
                </section>
              </section>
            )}
          </div>

          <BottomTaskBar activeView={activeView} onChange={setActiveView} onAdd={openAddView} />
        </div>
      </section>

      <button type="button" onClick={focusNewTask} className="floating-add" aria-label="Focus add todo input">
        <Plus size={26} />
      </button>
    </main>
  );
}

function BottomTaskBar({
  activeView,
  onChange,
  onAdd,
}: {
  activeView: PlannerView;
  onChange: (view: PlannerView) => void;
  onAdd: () => void;
}) {
  return (
    <nav className="bottom-taskbar" aria-label="Planner navigation">
      <button type="button" onClick={() => onChange("calendar")} className={activeView === "calendar" ? "is-active" : ""}>
        <CalendarDays size={18} />
        <span>Calendar</span>
      </button>
      <button type="button" onClick={() => onChange("tasks")} className={activeView === "tasks" ? "is-active" : ""}>
        <Check size={18} />
        <span>Tasks</span>
      </button>
      <button type="button" onClick={onAdd} className={activeView === "add" ? "nav-add is-active" : "nav-add"} aria-label="Add todo">
        <Plus size={25} />
      </button>
      <button type="button" onClick={() => onChange("progress")} className={activeView === "progress" ? "is-active" : ""}>
        <Sparkles size={18} />
        <span>Mood</span>
      </button>
    </nav>
  );
}

function CalendarCard({ today, days, taskCount }: { today: Date; days: CalendarDay[]; taskCount: number }) {
  return (
    <section className="calendar-card glass-card">
      <div className="calendar-topline">
        <div>
          <span className="section-kicker">Calendar</span>
          <h2>{today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="weekday-grid" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => (
          <span key={day.key} className={`${day.isOutside ? "is-outside" : ""} ${day.isToday ? "is-today" : ""}`}>
            {day.date.getDate()}
          </span>
        ))}
      </div>
      <div className="calendar-note">
        <DoodleMoodSticker mood="relaxed" size="tiny" />
        <p>{taskCount === 0 ? "Fresh planner page" : `${taskCount} synced notes`}</p>
      </div>
    </section>
  );
}

function CompactTodoRow({
  todo,
  editingId,
  editingTitle,
  setEditingTitle,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: TodoActionsProps) {
  return (
    <article className={todo.completed ? "compact-todo-row is-complete" : "compact-todo-row"}>
      <button type="button" onClick={onToggle} className="tiny-check" aria-label={todo.completed ? "Mark as active" : "Mark as completed"}>
        <Check size={13} />
      </button>
      <span className="timeline-line" aria-hidden="true" />
      <div className="compact-row-content">
        {editingId === todo.id ? (
          <input
            value={editingTitle}
            onChange={(event) => setEditingTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSave();
              }

              if (event.key === "Escape") {
                onCancel();
              }
            }}
            className="inline-edit-input"
            autoFocus
          />
        ) : (
          <h3>{todo.title}</h3>
        )}
        <p>{todo.completed ? "Done" : formatTaskMeta(todo)}</p>
      </div>
      <div className="compact-actions">
        {editingId === todo.id ? (
          <>
            <button type="button" onClick={onCancel} aria-label="Cancel editing">
              <X size={13} />
            </button>
            <button type="button" onClick={onSave} className="text-action">
              Save
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} aria-label="Edit todo">
              <Pencil size={13} />
            </button>
            <button type="button" onClick={onDelete} aria-label="Delete todo">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

interface TodoActionsProps {
  todo: Todo;
  editingId: number | null;
  editingTitle: string;
  setEditingTitle: (title: string) => void;
  onToggle: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
}

function TaskCard({
  todo,
  mood,
  category,
  priority,
  editingId,
  editingTitle,
  setEditingTitle,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: TodoActionsProps & {
  mood: DoodleMood;
  category: { label: string; tone: string };
  priority: { label: string; tone: string };
}) {
  return (
    <article className={todo.completed ? "daily-task-card is-complete" : "daily-task-card"}>
      <div className="task-accent-date">
        <span>{todo.completed ? "Done" : "Now"}</span>
      </div>
      <div className="daily-task-body">
        <div className="daily-task-top">
          <DoodleMoodSticker mood={mood} size="tiny" />
          <div className="task-badges">
            <span className={`category-chip ${category.tone}`}>{category.label}</span>
            <span className={`priority-chip ${priority.tone}`}>{priority.label}</span>
          </div>
        </div>
        <div className="daily-task-title-row">
          <button type="button" onClick={onToggle} className={todo.completed ? "tiny-check is-complete" : "tiny-check"} aria-label={todo.completed ? "Mark as active" : "Mark as completed"}>
            <Check size={13} />
          </button>
          <div>
            {editingId === todo.id ? (
              <input
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSave();
                  }

                  if (event.key === "Escape") {
                    onCancel();
                  }
                }}
                className="inline-edit-input"
                autoFocus
              />
            ) : (
              <h3>{todo.title}</h3>
            )}
            <p>{todo.completed ? "Completed with a happy little check" : formatTaskMeta(todo)}</p>
          </div>
        </div>
        <div className="daily-task-actions">
          {editingId === todo.id ? (
            <>
              <button type="button" onClick={onCancel} aria-label="Cancel editing">
                <X size={14} />
              </button>
              <button type="button" onClick={onSave} className="text-action">
                Save
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onEdit} aria-label="Edit todo">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={onDelete} aria-label="Delete todo">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "sage" | "yellow" | "blue" }) {
  return (
    <div className={`stat-card ${tone}`}>
      <p>{value}</p>
      <span>{label}</span>
    </div>
  );
}

function MiniEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mini-empty-state">
      <DoodleMoodSticker mood="sleepy" size="small" />
      <p>No notes yet</p>
      <button type="button" onClick={onAdd}>Add one</button>
    </div>
  );
}

function EmptyState({ filter, onAdd }: { filter: Filter; onAdd: () => void }) {
  return (
    <div className="empty-state">
      <EmptyDoodle />
      <h3>{filter === "all" ? "Your planner page is blank" : "No notes in this view"}</h3>
      <p>
        {filter === "all"
          ? "Add a first todo to pin a cute little plan to today."
          : "Try another filter or add a new task to keep planning."}
      </p>
      <button type="button" onClick={onAdd}>Add Todo</button>
    </div>
  );
}

interface CalendarDay {
  key: string;
  date: Date;
  isOutside: boolean;
  isToday: boolean;
}

function buildCalendarDays(baseDate: Date): CalendarDay[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayIndex = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayIndex);

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      key: date.toISOString(),
      date,
      isOutside: date.getMonth() !== month,
      isToday: date.toDateString() === baseDate.toDateString(),
    };
  });
}

function formatTaskMeta(todo: Todo) {
  if (!todo.created_at) {
    return "New planner note";
  }

  const createdAt = new Date(todo.created_at);

  if (Number.isNaN(createdAt.getTime())) {
    return "Saved in your planner";
  }

  return `Added ${createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getCategory(todo: Todo) {
  return CATEGORY_STYLES[Math.abs(todo.id) % CATEGORY_STYLES.length];
}

function getPriority(todo: Todo) {
  const urgentWords = ["urgent", "important", "today", "now", "ด่วน", "สำคัญ"];
  const hasUrgentWord = urgentWords.some((word) => todo.title.toLowerCase().includes(word));

  if (hasUrgentWord) {
    return PRIORITIES[2];
  }

  return PRIORITIES[Math.abs(todo.id + todo.title.length) % PRIORITIES.length];
}

function getMood(todo: Todo): DoodleMood {
  if (todo.completed) {
    return "happy";
  }

  return MOODS[Math.abs(todo.id + todo.title.length) % MOODS.length];
}

function DoodleMoodSticker({ mood, size }: { mood: DoodleMood; size: "tiny" | "small" | "medium" | "large" }) {
  const moodClass = `doodle-sticker ${mood} ${size}`;

  return (
    <svg className={moodClass} viewBox="0 0 120 120" role="img" aria-label={`${mood} doodle mood`}>
      <path className="blob-shadow" d="M24 96c15 16 61 18 78-2 14-17 8-55-5-70C82 6 38 8 22 25 5 43 8 80 24 96Z" />
      <path className="blob" d="M22 92c16 19 61 20 77 1 15-18 9-53-4-68C80 7 40 8 23 25 6 42 7 76 22 92Z" />
      {mood === "happy" && (
        <>
          <circle className="eye" cx="43" cy="49" r="5" />
          <circle className="eye" cx="75" cy="48" r="5" />
          <path className="mouth" d="M39 67c8 14 32 15 42-1" />
          <circle className="cheek" cx="31" cy="63" r="5" />
          <circle className="cheek" cx="89" cy="62" r="5" />
        </>
      )}
      {mood === "focused" && (
        <>
          <path className="brow" d="M34 39c7-6 16-7 23-4" />
          <path className="brow" d="M70 36c8-3 16-1 21 5" />
          <circle className="eye" cx="47" cy="53" r="5" />
          <circle className="eye" cx="75" cy="54" r="5" />
          <path className="mouth" d="M45 75c9-7 24-7 33 0" />
        </>
      )}
      {mood === "excited" && (
        <>
          <rect className="eye" x="38" y="44" width="11" height="13" rx="4" />
          <rect className="eye" x="72" y="44" width="11" height="13" rx="4" />
          <path className="open-mouth" d="M47 67c8-12 27-11 33 1 3 13-8 23-19 22-10-1-18-10-14-23Z" />
          <path className="tongue" d="M53 78c7 5 15 5 22 0" />
          <path className="star" d="M96 25l5 10 11 4-10 5-4 11-6-10-11-4 10-6Z" />
        </>
      )}
      {mood === "relaxed" && (
        <>
          <path className="closed-eye" d="M36 50c6 6 15 6 21 0" />
          <path className="closed-eye" d="M69 50c6 6 15 6 21 0" />
          <path className="mouth" d="M42 69c9 13 30 13 39 0" />
          <circle className="cheek" cx="34" cy="63" r="5" />
          <circle className="cheek" cx="88" cy="63" r="5" />
        </>
      )}
      {mood === "sleepy" && (
        <>
          <path className="closed-eye" d="M35 52c5 4 13 4 18 0" />
          <path className="closed-eye" d="M68 52c5 4 13 4 18 0" />
          <path className="mouth" d="M48 76c6-5 17-5 23 0" />
          <path className="sleep-mark" d="M87 25h15L88 43h16" />
        </>
      )}
      {mood === "motivated" && (
        <>
          <path className="brow" d="M34 38c7-5 15-6 22-1" />
          <path className="brow" d="M70 37c8-4 16-2 22 4" />
          <circle className="eye" cx="45" cy="52" r="5" />
          <circle className="eye" cx="77" cy="52" r="5" />
          <path className="open-mouth" d="M45 68c8-10 29-10 35 2 1 12-9 21-20 20-11-1-18-10-15-22Z" />
          <path className="tongue" d="M54 80c7 4 14 4 21-1" />
          <path className="leaf-deco" d="M88 18c12-6 21-4 26 4-6 10-17 12-27 5" />
        </>
      )}
    </svg>
  );
}

function EmptyDoodle() {
  return (
    <svg className="empty-doodle" viewBox="0 0 220 170" role="img" aria-label="Hand drawn empty planner illustration">
      <path className="empty-paper" d="M45 28c38-12 88-10 125 0 10 32 7 74-5 110-34 13-82 13-119 2C35 105 34 63 45 28Z" />
      <path className="empty-line" d="M70 68c30-5 57-4 85 1" />
      <path className="empty-line short" d="M72 91c20-4 43-4 67 0" />
      <path className="empty-line" d="M69 114c27 4 56 4 86-2" />
      <circle className="empty-check" cx="52" cy="70" r="8" />
      <circle className="empty-check" cx="52" cy="94" r="8" />
      <circle className="empty-check" cx="52" cy="117" r="8" />
      <path className="empty-spark" d="M177 43l6 12 13 4-12 6-5 13-7-12-12-5 12-7Z" />
      <path className="empty-heart" d="M34 42c-10-13 10-26 19-9 11-17 31 0 18 14L53 66Z" />
    </svg>
  );
}
