require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

const sendServerError = (res, error) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};

const normalizeTodo = (todo) => ({
  ...todo,
  completed: Boolean(todo.completed),
});

app.get("/", (req, res) => {
  res.json({ message: "Todo API is running" });
});

app.get("/api/todos", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, completed, created_at, updated_at FROM todos ORDER BY created_at DESC, id DESC"
    );

    res.json(result.rows.map(normalizeTodo));
  } catch (error) {
    sendServerError(res, error);
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const title = req.body.title?.trim();

    if (!title) {
      return res.status(400).json({ message: "Todo title is required" });
    }

    const result = await pool.query(
      "INSERT INTO todos(title, completed) VALUES($1, $2) RETURNING id, title, completed, created_at, updated_at",
      [title, false]
    );

    res.status(201).json(normalizeTodo(result.rows[0]));
  } catch (error) {
    sendServerError(res, error);
  }
});

app.put("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const title = typeof req.body.title === "string" ? req.body.title.trim() : undefined;
    const completed =
      typeof req.body.completed === "boolean" ? req.body.completed : undefined;

    if (title === "") {
      return res.status(400).json({ message: "Todo title cannot be empty" });
    }

    if (title === undefined && completed === undefined) {
      return res
        .status(400)
        .json({ message: "Provide a title or completed status to update" });
    }

    const result = await pool.query(
      `UPDATE todos
       SET title = COALESCE($1, title),
           completed = COALESCE($2, completed),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, title, completed, created_at, updated_at`,
      [title, completed, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.json(normalizeTodo(result.rows[0]));
  } catch (error) {
    sendServerError(res, error);
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM todos WHERE id=$1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.json({ message: "Todo deleted" });
  } catch (error) {
    sendServerError(res, error);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
