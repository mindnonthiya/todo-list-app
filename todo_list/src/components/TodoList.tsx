import { useEffect, useState } from "react";
import {
    Plus,
    Trash2,
    Check,
} from "lucide-react";

interface Todo {
    id: number;
    title: string;
    completed: boolean;
}

export default function TodoList() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [title, setTitle] = useState("");

    // โหลดข้อมูล
    useEffect(() => {
        fetchTodos();
    }, []);

    const fetchTodos = async () => {
        try {
            const res = await fetch(
                "http://localhost:5000/api/todos"
            );

            const data = await res.json();

            setTodos(data);
        } catch (error) {
            console.log(error);
        }
    };

    // เพิ่ม Todo
    const addTodo = async () => {
        if (!title.trim()) return;

        try {
            const res = await fetch(
                "http://localhost:5000/api/todos",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title,
                    }),
                }
            );

            const newTodo = await res.json();

            setTodos([newTodo, ...todos]);

            setTitle("");
        } catch (error) {
            console.log(error);
        }
    };

    // ลบ Todo
    const deleteTodo = async (id: number) => {
        try {
            await fetch(
                `http://localhost:5000/api/todos/${id}`,
                {
                    method: "DELETE",
                }
            );

            setTodos(
                todos.filter((todo) => todo.id !== id)
            );
        } catch (error) {
            console.log(error);
        }
    };

    // เปลี่ยนสถานะ
    const toggleTodo = async (todo: Todo) => {
        try {
            const res = await fetch(
                `http://localhost:5000/api/todos/${todo.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        completed: !todo.completed,
                    }),
                }
            );

            const updatedTodo = await res.json();

            setTodos(
                todos.map((t) =>
                    t.id === todo.id
                        ? updatedTodo
                        : t
                )
            );
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8f7f4] px-4 py-8">
            <div className="mx-auto max-w-md">

                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-zinc-800">
                        Todo List
                    </h1>

                    <p className="mt-2 text-sm text-zinc-500">
                        Organize your life beautifully
                    </p>
                </div>

                {/* Add Todo */}
                <div className="mb-6 flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
                    <input
                        type="text"
                        placeholder="Add a new task..."
                        value={title}
                        onChange={(e) =>
                            setTitle(e.target.value)
                        }
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                addTodo();
                            }
                        }}
                        className="flex-1 bg-transparent px-2 outline-none"
                    />

                    <button
                        onClick={addTodo}
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white transition hover:scale-105"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {/* Todo Cards */}
                <div className="space-y-4">
                    {todos.map((todo) => (
                        <div
                            key={todo.id}
                            className="rounded-3xl bg-white p-4 shadow-sm transition hover:shadow-md"
                        >
                            <div className="flex items-center justify-between">

                                {/* Left */}
                                <div className="flex items-center gap-4">

                                    {/* Circle */}
                                    <button
                                        onClick={() =>
                                            toggleTodo(todo)
                                        }
                                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${todo.completed
                                                ? "border-green-500 bg-green-500"
                                                : "border-zinc-300"
                                            }`}
                                    >
                                        {todo.completed && (
                                            <Check
                                                size={14}
                                                className="text-white"
                                            />
                                        )}
                                    </button>

                                    {/* Text */}
                                    <div>
                                        <p
                                            className={`font-medium ${todo.completed
                                                    ? "text-zinc-400 line-through"
                                                    : "text-zinc-800"
                                                }`}
                                        >
                                            {todo.title}
                                        </p>

                                        <p className="mt-1 text-xs text-zinc-400">
                                            {todo.completed
                                                ? "Completed"
                                                : "In Progress"}
                                        </p>
                                    </div>
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={() =>
                                        deleteTodo(todo.id)
                                    }
                                    className="rounded-xl p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                                >
                                    <Trash2 size={18} />
                                </button>

                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}