import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Circle, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";

type Filter = "all" | "active" | "completed";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/todos";

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

  const stats = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length;
    const active = todos.length - completed;

    return {
      total: todos.length,
      active,
      completed,
    };
  }, [todos]);

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

  return (
    <main className="min-h-screen bg-stone-50 text-neutral-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-6 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,15,15,0.08)] sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-900 bg-neutral-950 text-lg font-semibold text-white">
              T
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.35em] text-neutral-400">
              Minimal Todo Workspace
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-6xl">
              จัดการงานประจำวันอย่างเรียบง่ายและชัดเจน
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-500">
              เพิ่ม แก้ไข ลบ และทำเครื่องหมายงานที่เสร็จแล้ว โดยทุกการเปลี่ยนแปลงถูกบันทึกผ่าน RESTful API ไปยัง PostgreSQL
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-3">
            <StatCard label="ทั้งหมด" value={stats.total} />
            <StatCard label="กำลังทำ" value={stats.active} />
            <StatCard label="เสร็จแล้ว" value={stats.completed} />
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em]">เพิ่มรายการใหม่</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              พิมพ์งานที่ต้องทำแล้วกด Enter หรือปุ่ม Add เพื่อบันทึกลงฐานข้อมูล
            </p>

            <div className="mt-6 space-y-3">
              <label htmlFor="todo-title" className="text-sm font-medium text-neutral-700">
                Task name
              </label>
              <div className="flex gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-2 transition focus-within:border-neutral-950 focus-within:bg-white">
                <input
                  id="todo-title"
                  type="text"
                  placeholder="เช่น วางแผนงานสัปดาห์นี้"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addTodo();
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
                <button
                  onClick={addTodo}
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2"
                >
                  <Plus size={17} />
                  Add
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-2">
              {(["all", "active", "completed"] as Filter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    filter === item
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  <span className="capitalize">{item}</span>
                  <span>{item === "all" ? stats.total : item === "active" ? stats.active : stats.completed}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-400">Today</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Todo list</h2>
              </div>
              <button
                type="button"
                onClick={fetchTodos}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-neutral-950 hover:text-neutral-950"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
                ))}
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center">
                <Circle className="text-neutral-300" size={44} strokeWidth={1.2} />
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em]">ยังไม่มีรายการในมุมมองนี้</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                  เพิ่มงานใหม่หรือเปลี่ยนตัวกรองเพื่อดูรายการที่บันทึกไว้จาก API
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTodos.map((todo) => (
                  <article
                    key={todo.id}
                    className="group relative rounded-3xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 hover:shadow-sm focus-within:ring-2 focus-within:ring-neutral-950 focus-within:ring-offset-2"
                  >
                    <div className="flex items-start gap-4">
                      <button
                        type="button"
                        onClick={() => updateTodo(todo.id, { completed: !todo.completed })}
                        className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                          todo.completed
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-neutral-300 bg-white text-neutral-400 hover:border-neutral-950 hover:text-neutral-950"
                        }`}
                        aria-label={todo.completed ? "Mark as active" : "Mark as completed"}
                      >
                        <Check size={17} />
                      </button>

                      <div className="min-w-0 flex-1">
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
                            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-950"
                            autoFocus
                          />
                        ) : (
                          <h3
                            className={`truncate text-base font-semibold tracking-[-0.02em] ${
                              todo.completed ? "text-neutral-400 line-through" : "text-neutral-950"
                            }`}
                          >
                            {todo.title}
                          </h3>
                        )}
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                          {todo.completed ? "Completed" : "In progress"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2">
                      {editingId === todo.id ? (
                        <>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition hover:border-neutral-950 hover:text-neutral-950"
                            aria-label="Cancel editing"
                          >
                            <X size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={saveEditing}
                            className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(todo)}
                            className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition hover:border-neutral-950 hover:text-neutral-950"
                            aria-label="Edit todo"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTodo(todo.id)}
                            className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition hover:border-neutral-950 hover:bg-neutral-950 hover:text-white"
                            aria-label="Delete todo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-4 text-center">
      <p className="text-2xl font-semibold tracking-[-0.04em] text-neutral-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-400">{label}</p>
    </div>
  );
}
