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

const allowedColors = new Set(["green", "blue", "yellow", "orange", "purple", "red"]);
const allowedPriorities = new Set(["low", "medium", "high"]);
const allowedCategories = new Set(["work", "study", "personal", "health", "other"]);

const sendServerError = (res, error) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};

const normalizeChoice = (value, allowedValues, fallback) =>
  allowedValues.has(value) ? value : fallback;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : value;
};

const normalizeAlarmDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeTodo = (todo) => ({
  ...todo,
  completed: Boolean(todo.completed),
  alarmEnabled: Boolean(todo.alarmEnabled),
  alarm: Boolean(todo.alarmEnabled),
});

const todoSelect = `
  SELECT
    id,
    title,
    note,
    description,
    completed,
    color,
    priority,
    category,
    due_date AS "dueDate",
    due_time AS "dueTime",
    alarm_enabled AS "alarmEnabled",
    alarm_datetime AS "alarmDateTime",
    created_at,
    updated_at
  FROM todos
`;

const ensureTodoColumns = async () => {
  await pool.query(`
    ALTER TABLE todos
      ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS color VARCHAR(20) NOT NULL DEFAULT 'green',
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'other',
      ADD COLUMN IF NOT EXISTS due_date DATE,
      ADD COLUMN IF NOT EXISTS due_time TIME,
      ADD COLUMN IF NOT EXISTS alarm_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS alarm_datetime TIMESTAMP
  `);
};

app.get("/", (req, res) => {
  res.json({ message: "Todo API is running" });
});

app.get("/api/todos", async (req, res) => {
  try {
    const result = await pool.query(`${todoSelect} ORDER BY created_at DESC, id DESC`);

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

    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : typeof req.body.note === "string"
          ? req.body.note.trim()
          : "";
    const note = description;
    const color = normalizeChoice(req.body.color, allowedColors, "green");
    const priority = normalizeChoice(req.body.priority, allowedPriorities, "medium");
    const category = normalizeChoice(req.body.category, allowedCategories, "other");
    const dueDate = normalizeDate(req.body.dueDate);
    const dueTime = typeof req.body.dueTime === "string" ? req.body.dueTime : null;
    const alarmEnabled = Boolean(req.body.alarmEnabled ?? req.body.alarm);
    const alarmDateTime = alarmEnabled ? normalizeAlarmDateTime(req.body.alarmDateTime) : null;

    const result = await pool.query(
      `INSERT INTO todos(title, note, description, completed, color, priority, category, due_date, due_time, alarm_enabled, alarm_datetime)
       VALUES($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, CURRENT_DATE), $9, $10, $11)
       RETURNING id, title, note, description, completed, color, priority, category, due_date AS "dueDate", due_time AS "dueTime", alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime", created_at, updated_at`,
      [title, note, description, false, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime]
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
    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : typeof req.body.note === "string"
          ? req.body.note.trim()
          : undefined;
    const note = description;
    const completed =
      typeof req.body.completed === "boolean" ? req.body.completed : undefined;
    const color = req.body.color === undefined ? undefined : normalizeChoice(req.body.color, allowedColors, "green");
    const priority = req.body.priority === undefined ? undefined : normalizeChoice(req.body.priority, allowedPriorities, "medium");
    const category = req.body.category === undefined ? undefined : normalizeChoice(req.body.category, allowedCategories, "other");
    const dueDate = req.body.dueDate === undefined ? undefined : normalizeDate(req.body.dueDate);
    const dueTime = req.body.dueTime === undefined ? undefined : req.body.dueTime;
    const alarmEnabled =
      req.body.alarmEnabled === undefined && req.body.alarm === undefined
        ? undefined
        : Boolean(req.body.alarmEnabled ?? req.body.alarm);
    const alarmDateTime =
      req.body.alarmDateTime === undefined ? undefined : normalizeAlarmDateTime(req.body.alarmDateTime);

    if (title === "") {
      return res.status(400).json({ message: "Todo title cannot be empty" });
    }

    if (
      title === undefined &&
      note === undefined &&
      description === undefined &&
      completed === undefined &&
      color === undefined &&
      priority === undefined &&
      category === undefined &&
      dueDate === undefined &&
      dueTime === undefined &&
      alarmEnabled === undefined &&
      alarmDateTime === undefined
    ) {
      return res.status(400).json({ message: "Provide at least one field to update" });
    }

    const result = await pool.query(
      `UPDATE todos
       SET title = COALESCE($1, title),
           note = COALESCE($2, note),
           description = COALESCE($3, description),
           completed = COALESCE($4, completed),
           color = COALESCE($5, color),
           priority = COALESCE($6, priority),
           category = COALESCE($7, category),
           due_date = COALESCE($8::date, due_date),
           due_time = COALESCE($9, due_time),
           alarm_enabled = COALESCE($10, alarm_enabled),
           alarm_datetime = COALESCE($11, alarm_datetime),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING id, title, note, description, completed, color, priority, category, due_date AS "dueDate", due_time AS "dueTime", alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime", created_at, updated_at`,
      [title, note, description, completed, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime, id]
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

ensureTodoColumns()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to prepare todos table", error);
    process.exit(1);
  });
