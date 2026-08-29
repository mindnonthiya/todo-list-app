require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
});

const allowedColors = new Set(["green", "blue", "yellow", "orange", "purple", "red"]);
const allowedPriorities = new Set(["normal", "important", "urgent"]);
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
    id, title, note, description, completed, color, priority, category,
    due_date AS "dueDate", due_time AS "dueTime",
    alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
    list_id AS "listId", position, image_url AS "imageUrl",
    (SELECT COUNT(*) FROM todo_comments WHERE todo_comments.todo_id = todos.id)::int AS "commentsCount",
    created_at, updated_at
  FROM todos
`;

/* ---------- Schema bootstrap ---------- */

const ensureSchema = async () => {
  // 1. Create todos table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT NOT NULL DEFAULT '',
      color VARCHAR(20) NOT NULL DEFAULT 'green',
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      category VARCHAR(30) NOT NULL DEFAULT 'other',
      due_date DATE DEFAULT CURRENT_DATE,
      due_time TIME,
      alarm_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      alarm_datetime TIMESTAMP,
      list_id INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Ensure extra columns on existing tables
  await pool.query(`
    ALTER TABLE todos
      ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS color VARCHAR(20) NOT NULL DEFAULT 'green',
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'other',
      ADD COLUMN IF NOT EXISTS due_date DATE,
      ADD COLUMN IF NOT EXISTS due_time TIME,
      ADD COLUMN IF NOT EXISTS alarm_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS alarm_datetime TIMESTAMP,
      ADD COLUMN IF NOT EXISTS list_id INTEGER,
      ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS image_url TEXT
  `);

  // 3. Create board_lists table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_lists (
      id SERIAL PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      color VARCHAR(20) DEFAULT 'green',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Create todo_comments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todo_comments (
      id SERIAL PRIMARY KEY,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      author VARCHAR(100) NOT NULL DEFAULT 'Maya',
      content TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE todo_comments
      ADD COLUMN IF NOT EXISTS image_url TEXT
  `);

  // 5. Seed default lists when table is empty
  const { rowCount } = await pool.query("SELECT 1 FROM board_lists LIMIT 1");
  if (rowCount === 0) {
    await pool.query(`
      INSERT INTO board_lists (title, position, color) VALUES
        ('To Do', 0, 'blue'),
        ('In Progress', 1, 'yellow'),
        ('Done', 2, 'green')
    `);
  }

  // 6. Assign orphaned todos to the first / last list
  const first = await pool.query("SELECT id FROM board_lists ORDER BY position ASC LIMIT 1");
  const last  = await pool.query("SELECT id FROM board_lists ORDER BY position DESC LIMIT 1");
  if (first.rows.length > 0) {
    await pool.query("UPDATE todos SET list_id = $1 WHERE list_id IS NULL AND completed = false", [first.rows[0].id]);
  }
  if (last.rows.length > 0) {
    await pool.query("UPDATE todos SET list_id = $1 WHERE list_id IS NULL AND completed = true", [last.rows[0].id]);
  }
  if (first.rows.length > 0) {
    await pool.query("UPDATE todos SET list_id = $1 WHERE list_id IS NULL", [first.rows[0].id]);
  }

  // 7. Migrate old priority values
  await pool.query("UPDATE todos SET priority = 'normal'    WHERE priority = 'low'");
  await pool.query("UPDATE todos SET priority = 'important' WHERE priority = 'medium'");
  await pool.query("UPDATE todos SET priority = 'urgent'    WHERE priority = 'high'");
};

/* ---------- Health ---------- */

app.get("/", (_req, res) => {
  res.json({ message: "Todo API is running" });
});

/* ---------- Board Lists ---------- */

app.get("/api/lists", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM board_lists ORDER BY position ASC, id ASC");
    res.json(result.rows);
  } catch (error) { sendServerError(res, error); }
});

app.post("/api/lists", async (req, res) => {
  try {
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: "List title is required" });
    const color = normalizeChoice(req.body.color, allowedColors, "green");
    const maxPos = await pool.query("SELECT COALESCE(MAX(position), -1) AS mp FROM board_lists");
    const result = await pool.query(
      "INSERT INTO board_lists (title, position, color) VALUES ($1, $2, $3) RETURNING *",
      [title, maxPos.rows[0].mp + 1, color]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { sendServerError(res, error); }
});

app.put("/api/lists/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds must be an array" });
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.query("UPDATE board_lists SET position = $1 WHERE id = $2", [i, orderedIds[i]]);
    }
    const result = await pool.query("SELECT * FROM board_lists ORDER BY position ASC");
    res.json(result.rows);
  } catch (error) { sendServerError(res, error); }
});

app.put("/api/lists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const sets = []; const vals = []; let i = 1;
    if (req.body.title)              { sets.push(`title = $${i++}`);    vals.push(req.body.title.trim()); }
    if (req.body.color)              { sets.push(`color = $${i++}`);    vals.push(normalizeChoice(req.body.color, allowedColors, "green")); }
    if (req.body.position !== undefined) { sets.push(`position = $${i++}`); vals.push(req.body.position); }
    if (sets.length === 0) return res.status(400).json({ message: "Provide at least one field" });
    vals.push(id);
    const result = await pool.query(`UPDATE board_lists SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
    if (result.rowCount === 0) return res.status(404).json({ message: "List not found" });
    res.json(result.rows[0]);
  } catch (error) { sendServerError(res, error); }
});

app.delete("/api/lists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const first = await pool.query("SELECT id FROM board_lists WHERE id != $1 ORDER BY position ASC LIMIT 1", [id]);
    if (first.rows.length > 0) {
      await pool.query("UPDATE todos SET list_id = $1 WHERE list_id = $2", [first.rows[0].id, id]);
    }
    const result = await pool.query("DELETE FROM board_lists WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "List not found" });
    res.json({ message: "List deleted" });
  } catch (error) { sendServerError(res, error); }
});

/* ---------- Todos ---------- */

app.get("/api/todos", async (_req, res) => {
  try {
    const result = await pool.query(`${todoSelect} ORDER BY position ASC, created_at DESC, id DESC`);
    res.json(result.rows.map(normalizeTodo));
  } catch (error) { sendServerError(res, error); }
});

app.post("/api/todos", async (req, res) => {
  try {
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: "Todo title is required" });

    const description = typeof req.body.description === "string" ? req.body.description.trim()
      : typeof req.body.note === "string" ? req.body.note.trim() : "";
    const note = description;
    const color = normalizeChoice(req.body.color, allowedColors, "green");
    const priority = normalizeChoice(req.body.priority, allowedPriorities, "normal");
    const category = normalizeChoice(req.body.category, allowedCategories, "other");
    const dueDate = normalizeDate(req.body.dueDate);
    const dueTime = typeof req.body.dueTime === "string" ? req.body.dueTime : null;
    const alarmEnabled = Boolean(req.body.alarmEnabled ?? req.body.alarm);
    const alarmDateTime = alarmEnabled ? normalizeAlarmDateTime(req.body.alarmDateTime) : null;
    const imageUrl = typeof req.body.imageUrl === "string" ? req.body.imageUrl : null;

    let listId = req.body.listId || null;
    if (!listId) {
      const first = await pool.query("SELECT id FROM board_lists ORDER BY position ASC LIMIT 1");
      listId = first.rows.length > 0 ? first.rows[0].id : null;
    }

    const maxPos = await pool.query("SELECT COALESCE(MAX(position), -1) AS mp FROM todos WHERE list_id = $1", [listId]);

    const result = await pool.query(
      `INSERT INTO todos(title, note, description, completed, color, priority, category,
                         due_date, due_time, alarm_enabled, alarm_datetime, list_id, position, image_url)
       VALUES($1,$2,$3,$4,$5,$6,$7, COALESCE($8::date, CURRENT_DATE), $9,$10,$11,$12,$13,$14)
       RETURNING id, title, note, description, completed, color, priority, category,
                 due_date AS "dueDate", due_time AS "dueTime",
                 alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
                 list_id AS "listId", position, image_url AS "imageUrl",
                 0 AS "commentsCount",
                 created_at, updated_at`,
      [title, note, description, false, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime, listId, maxPos.rows[0].mp + 1, imageUrl]
    );

    res.status(201).json(normalizeTodo(result.rows[0]));
  } catch (error) { sendServerError(res, error); }
});

app.put("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const title = typeof req.body.title === "string" ? req.body.title.trim() : undefined;
    const description = typeof req.body.description === "string" ? req.body.description.trim()
      : typeof req.body.note === "string" ? req.body.note.trim() : undefined;
    const note = description;
    const completed = typeof req.body.completed === "boolean" ? req.body.completed : undefined;
    const color    = req.body.color    === undefined ? undefined : normalizeChoice(req.body.color, allowedColors, "green");
    const priority = req.body.priority === undefined ? undefined : normalizeChoice(req.body.priority, allowedPriorities, "normal");
    const category = req.body.category === undefined ? undefined : normalizeChoice(req.body.category, allowedCategories, "other");
    const dueDate  = req.body.dueDate  === undefined ? undefined : normalizeDate(req.body.dueDate);
    const dueTime  = req.body.dueTime  === undefined ? undefined : req.body.dueTime;
    const alarmEnabled  = req.body.alarmEnabled === undefined && req.body.alarm === undefined ? undefined : Boolean(req.body.alarmEnabled ?? req.body.alarm);
    const alarmDateTime = req.body.alarmDateTime === undefined ? undefined : normalizeAlarmDateTime(req.body.alarmDateTime);
    const listId   = req.body.listId   === undefined ? undefined : req.body.listId;
    const position = req.body.position === undefined ? undefined : req.body.position;
    const imageUrl = req.body.imageUrl === undefined ? undefined : req.body.imageUrl;

    if (title === "") return res.status(400).json({ message: "Todo title cannot be empty" });
    if ([title, note, description, completed, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime, listId, position, imageUrl].every((v) => v === undefined)) {
      return res.status(400).json({ message: "Provide at least one field to update" });
    }

    const result = await pool.query(
      `UPDATE todos SET
         title=COALESCE($1,title), note=COALESCE($2,note), description=COALESCE($3,description),
         completed=COALESCE($4,completed), color=COALESCE($5,color), priority=COALESCE($6,priority),
         category=COALESCE($7,category), due_date=COALESCE($8::date,due_date), due_time=COALESCE($9,due_time),
         alarm_enabled=COALESCE($10,alarm_enabled), alarm_datetime=COALESCE($11,alarm_datetime),
         list_id=COALESCE($12,list_id), position=COALESCE($13,position),
         image_url=CASE WHEN $14::text = '__CLEAR_IMAGE__' THEN NULL WHEN $14 IS NOT NULL THEN $14 ELSE image_url END,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=$15
       RETURNING id, title, note, description, completed, color, priority, category,
                 due_date AS "dueDate", due_time AS "dueTime",
                 alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
                 list_id AS "listId", position, image_url AS "imageUrl",
                 (SELECT COUNT(*) FROM todo_comments WHERE todo_comments.todo_id = todos.id)::int AS "commentsCount",
                 created_at, updated_at`,
      [title, note, description, completed, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime, listId, position, imageUrl === null ? '__CLEAR_IMAGE__' : imageUrl, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: "Todo not found" });
    res.json(normalizeTodo(result.rows[0]));
  } catch (error) { sendServerError(res, error); }
});

app.put("/api/todos/:id/move", async (req, res) => {
  try {
    const { id } = req.params;
    const { listId, position: pos } = req.body;
    if (!listId) return res.status(400).json({ message: "listId is required" });
    const maxPos = await pool.query("SELECT COALESCE(MAX(position), -1) AS mp FROM todos WHERE list_id = $1", [listId]);
    const result = await pool.query(
      `UPDATE todos SET list_id=$1, position=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3
       RETURNING id, title, note, description, completed, color, priority, category,
                 due_date AS "dueDate", due_time AS "dueTime",
                 alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
                 list_id AS "listId", position, image_url AS "imageUrl",
                 (SELECT COUNT(*) FROM todo_comments WHERE todo_comments.todo_id = todos.id)::int AS "commentsCount",
                 created_at, updated_at`,
      [listId, pos ?? maxPos.rows[0].mp + 1, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Todo not found" });
    res.json(normalizeTodo(result.rows[0]));
  } catch (error) { sendServerError(res, error); }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM todos WHERE id=$1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Todo not found" });
    res.json({ message: "Todo deleted" });
  } catch (error) { sendServerError(res, error); }
});

/* ---------- Comments ---------- */

app.get("/api/todos/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, todo_id AS \"todoId\", author, content, image_url AS \"imageUrl\", created_at AS \"createdAt\" FROM todo_comments WHERE todo_id = $1 ORDER BY created_at ASC, id ASC",
      [id]
    );
    res.json(result.rows);
  } catch (error) { sendServerError(res, error); }
});

app.post("/api/todos/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const content = req.body.content?.trim() || "";
    const author = req.body.author?.trim() || "Maya";
    const imageUrl = req.body.imageUrl?.trim() || null;
    if (!content && !imageUrl) return res.status(400).json({ message: "Comment content or image is required" });

    const result = await pool.query(
      "INSERT INTO todo_comments(todo_id, author, content, image_url) VALUES ($1, $2, $3, $4) RETURNING id, todo_id AS \"todoId\", author, content, image_url AS \"imageUrl\", created_at AS \"createdAt\"",
      [id, author, content, imageUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { sendServerError(res, error); }
});

app.delete("/api/comments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM todo_comments WHERE id=$1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Comment not found" });
    res.json({ message: "Comment deleted" });
  } catch (error) { sendServerError(res, error); }
});

/* ---------- Start ---------- */

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to prepare database schema", error);
    process.exit(1);
  });
