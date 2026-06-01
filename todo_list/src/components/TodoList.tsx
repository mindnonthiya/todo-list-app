import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  Leaf,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "./TodoList.css";

type Filter = "all" | "active" | "completed";
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
  all: "All notes",
  active: "In progress",
  completed: "Done",
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
    const completedToday = todos.filter((todo) => todo.completed).slice(0, 2);

    return {
      nextTask,
      completedToday,
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
      inputRef.current?.focus();
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

  const focusNewTask = () => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="planner-shell">
      <div className="paper-grain" aria-hidden="true" />
      <section className="planner-page">
        <header className="hero-card glass-card">
          <div className="hero-copy">
            <div className="eyebrow-pill">
              <Leaf size={16} />
              Doodle planner
            </div>
            <p className="date-line">{formatLongDate(today)}</p>
            <h1>Good morning, let&apos;s plan a gentle day.</h1>
            <p className="hero-description">
              A cozy diary-inspired space for your existing todos, complete with calendar rhythm,
              progress tracking, and soft doodle companions.
            </p>
          </div>

          <div className="hero-sticker" aria-label="Decorative motivated doodle planner character">
            <DoodleMoodSticker mood="motivated" size="large" />
            <span className="sparkle sparkle-one" />
            <span className="sparkle sparkle-two" />
          </div>
        </header>

        <section className="dashboard-grid" aria-label="Planner dashboard">
          <CalendarCard today={today} days={calendarDays} taskCount={stats.total} />

          <section className="mood-card glass-card">
            <div className="section-heading compact">
              <span>Today&apos;s mood</span>
              <Sparkles size={17} />
            </div>
            <DoodleMoodSticker mood="happy" size="medium" />
            <h2>Soft focus mode</h2>
            <p>Decorative mood stickers keep the diary feeling playful while your task data stays unchanged.</p>
            <div className="mini-mood-row" aria-hidden="true">
              <DoodleMoodSticker mood="focused" size="tiny" />
              <DoodleMoodSticker mood="relaxed" size="tiny" />
              <DoodleMoodSticker mood="excited" size="tiny" />
            </div>
          </section>

          <section className="progress-card glass-card">
            <div className="section-heading compact">
              <span>Progress</span>
              <span className="progress-percent">{stats.progress}%</span>
            </div>
            <div className="progress-ring" style={{ "--progress": `${stats.progress}%` } as CSSProperties}>
              <span>{stats.completed}</span>
              <small>done</small>
            </div>
            <div className="progress-track" aria-label={`${stats.progress}% completed`}>
              <span style={{ width: `${stats.progress}%` }} />
            </div>
            <p>{stats.total === 0 ? "Add your first task to start the day." : todaysSummary.caption}</p>
          </section>

          <section className="summary-card glass-card">
            <div className="section-heading compact">
              <span>Today&apos;s summary</span>
              <Clock3 size={17} />
            </div>
            <h2>{stats.active} active</h2>
            <p>{todaysSummary.nextTask ? todaysSummary.nextTask.title : "Your task basket is peaceful right now."}</p>
            <div className="summary-stack">
              <span>{stats.total} total notes</span>
              <span>{stats.completed} tucked away</span>
            </div>
          </section>
        </section>

        <section className="workspace-grid">
          <aside className="control-panel glass-card">
            <div className="section-heading">
              <div>
                <span>Quick capture</span>
                <h2>Add a tiny plan</h2>
              </div>
              <Edit3 size={18} />
            </div>
            <p className="panel-copy">
              Type a task and press Enter or Add. The same API create flow is preserved.
            </p>

            <div className="task-input-card">
              <label htmlFor="todo-title">Task name</label>
              <div className="task-input-row">
                <input
                  ref={inputRef}
                  id="todo-title"
                  type="text"
                  placeholder="Write a cozy task..."
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addTodo();
                    }
                  }}
                />
                <button onClick={addTodo} type="button" className="primary-button">
                  <Plus size={18} />
                  Add
                </button>
              </div>
            </div>

            <div className="filter-stack" aria-label="Todo filters">
              {(["all", "active", "completed"] as Filter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={filter === item ? "filter-button is-active" : "filter-button"}
                >
                  <span>{FILTER_LABELS[item]}</span>
                  <strong>{item === "all" ? stats.total : item === "active" ? stats.active : stats.completed}</strong>
                </button>
              ))}
            </div>

            <div className="stats-row" aria-label="Todo statistics">
              <StatCard label="Total" value={stats.total} tone="sage" />
              <StatCard label="Active" value={stats.active} tone="yellow" />
              <StatCard label="Done" value={stats.completed} tone="blue" />
            </div>
          </aside>

          <section className="todo-board glass-card">
            <div className="board-header">
              <div>
                <p className="section-kicker">Today</p>
                <h2>Planner notes</h2>
              </div>
              <button type="button" onClick={fetchTodos} className="ghost-button">
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {isLoading ? (
              <div className="task-skeleton-grid" aria-label="Loading todos">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="task-skeleton" />
                ))}
              </div>
            ) : filteredTodos.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <div className="task-grid">
                {filteredTodos.map((todo) => {
                  const category = getCategory(todo);
                  const priority = getPriority(todo);
                  const mood = getMood(todo);

                  return (
                    <article key={todo.id} className={todo.completed ? "task-card is-complete" : "task-card"}>
                      <div className="task-card-header">
                        <DoodleMoodSticker mood={mood} size="small" />
                        <div className="task-badges">
                          <span className={`category-chip ${category.tone}`}>{category.label}</span>
                          <span className={`priority-chip ${priority.tone}`}>{priority.label} priority</span>
                        </div>
                      </div>

                      <div className="task-main-row">
                        <button
                          type="button"
                          onClick={() => updateTodo(todo.id, { completed: !todo.completed })}
                          className={todo.completed ? "complete-button is-complete" : "complete-button"}
                          aria-label={todo.completed ? "Mark as active" : "Mark as completed"}
                        >
                          <Check size={18} />
                        </button>

                        <div className="task-content">
                          {editingId === todo.id ? (
                            <input
                              value={editingTitle}
                              onChange={(event) => setEditingTitle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  saveEditing();
                                }

                                if (event.key === "Escape") {
                                  cancelEditing();
                                }
                              }}
                              className="edit-input"
                              autoFocus
                            />
                          ) : (
                            <h3>{todo.title}</h3>
                          )}
                          <p>{todo.completed ? "Completed with a happy little check" : formatTaskMeta(todo)}</p>
                        </div>
                      </div>

                      <div className="task-footer">
                        <span className="task-status-dot" />
                        <span>{todo.completed ? "Done" : "In progress"}</span>
                        <div className="task-actions">
                          {editingId === todo.id ? (
                            <>
                              <button type="button" onClick={cancelEditing} className="icon-button" aria-label="Cancel editing">
                                <X size={16} />
                              </button>
                              <button type="button" onClick={saveEditing} className="save-button">
                                Save
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => startEditing(todo)} className="icon-button" aria-label="Edit todo">
                                <Pencil size={16} />
                              </button>
                              <button type="button" onClick={() => deleteTodo(todo.id)} className="icon-button danger" aria-label="Delete todo">
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </section>

      <button type="button" onClick={focusNewTask} className="floating-add" aria-label="Focus add todo input">
        <Plus size={26} />
      </button>
    </main>
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
        <CalendarDays size={22} />
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
        <p>{taskCount === 0 ? "No tasks yet — your page is fresh." : `${taskCount} planner notes are synced from your API.`}</p>
      </div>
    </section>
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

function EmptyState({ filter }: { filter: Filter }) {
  return (
    <div className="empty-state">
      <EmptyDoodle />
      <h3>{filter === "all" ? "Your planner page is blank" : "No notes in this view"}</h3>
      <p>
        {filter === "all"
          ? "Add a first todo to pin a cute little plan to today."
          : "Try another filter or add a new task to keep planning."}
      </p>
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

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
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
