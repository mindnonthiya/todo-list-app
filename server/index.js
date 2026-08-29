require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/", (req, res) => res.json({ status: "ok", message: "Todo List API Server is running" }));

const dbUser = process.env.DB_USER ? process.env.DB_USER.trim() : "postgres";
const dbHost = process.env.DB_HOST ? process.env.DB_HOST.trim() : "localhost";
const dbDatabase = process.env.DB_NAME ? process.env.DB_NAME.trim() : "postgres";
const dbPassword = process.env.DB_PASSWORD ? process.env.DB_PASSWORD.trim() : "";
const dbPort = Number(process.env.DB_PORT ? process.env.DB_PORT.trim() : 5432) || 5432;
const databaseUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : undefined;

const isCloudHost = Boolean(dbHost && (dbHost.includes("supabase.co") || dbHost.includes("neon.tech") || dbHost.includes("railway.app") || dbHost.includes("render.com") || dbHost.includes("pooler.supabase.com")));
const databaseUsesSsl =
  process.env.DB_SSL === "true" ||
  isCloudHost ||
  (Boolean(databaseUrl) && process.env.DB_SSL !== "false");

const pool = new Pool(
  databaseUrl
    ? {
        connectionString: databaseUrl,
        ssl: databaseUsesSsl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10,
      }
    : {
        user: dbUser,
        host: dbHost,
        database: dbDatabase,
        password: dbPassword,
        port: dbPort,
        ssl: databaseUsesSsl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10,
      },
);

const allowedColors = new Set(["green", "blue", "yellow", "orange", "purple", "red"]);
const allowedPriorities = new Set(["normal", "important", "urgent"]);
const allowedCategories = new Set(["work", "study", "personal", "health", "other"]);

const sendServerError = (res, error) => {
  console.error("Database / Server Error:", error);
  res.status(500).json({
    message: "Internal server error",
    error: error.message || String(error),
    detail: error.detail || undefined,
  });
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

const normalizeTodo = (todo) => {
  let dueDate = null;
  if (todo.dueDate) {
    if (typeof todo.dueDate === "string") {
      dueDate = todo.dueDate.slice(0, 10);
    } else if (todo.dueDate instanceof Date) {
      const y = todo.dueDate.getFullYear();
      const m = String(todo.dueDate.getMonth() + 1).padStart(2, "0");
      const d = String(todo.dueDate.getDate()).padStart(2, "0");
      dueDate = `${y}-${m}-${d}`;
    }
  } else if (todo.created_at) {
    dueDate = String(todo.created_at).slice(0, 10);
  }

  return {
    ...todo,
    dueDate,
    completed: Boolean(todo.completed),
    alarmEnabled: Boolean(todo.alarmEnabled),
    alarm: Boolean(todo.alarmEnabled),
    images: Array.isArray(todo.images) ? todo.images : (() => {
      try {
        return todo.images ? JSON.parse(todo.images) : [];
      } catch {
        return [];
      }
    })(),
  };
};

const todoSelect = `
  SELECT
    id, board_id AS "boardId", title, note, description, completed, color, priority, category,
    TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate", due_time AS "dueTime",
    alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
    list_id AS "listId", position, image_url AS "imageUrl", images,
    (SELECT COUNT(*) FROM todo_comments WHERE todo_comments.todo_id = todos.id)::int AS "commentsCount",
    created_at, updated_at
  FROM todos
`;

/* ---------- Schema bootstrap ---------- */

const ensureSchema = async () => {
  // 1. Create boards table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boards (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      color VARCHAR(50) DEFAULT 'blue',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Create board_lists table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_lists (
      id SERIAL PRIMARY KEY,
      board_id INTEGER,
      title VARCHAR(100) NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      color VARCHAR(20) DEFAULT 'green',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Create todos table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      board_id INTEGER,
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
      images TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Ensure columns on existing tables
  await pool.query(`
    ALTER TABLE board_lists
      ADD COLUMN IF NOT EXISTS board_id INTEGER
  `);

  await pool.query(`
    ALTER TABLE todos
      ADD COLUMN IF NOT EXISTS board_id INTEGER,
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
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS images TEXT
  `);

  await pool.query(`
    ALTER TABLE todo_comments
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  // 6. Seed default board if empty
  const { rowCount: boardCount } = await pool.query("SELECT 1 FROM boards LIMIT 1");
  if (boardCount === 0) {
    await pool.query(`
      INSERT INTO boards (title, color) VALUES
        ('Business Development / Dev', 'blue')
    `);
  }

  const defaultBoard = await pool.query("SELECT id FROM boards ORDER BY id ASC LIMIT 1");
  const defaultBoardId = defaultBoard.rows[0]?.id;

  if (defaultBoardId) {
    await pool.query("UPDATE board_lists SET board_id = $1 WHERE board_id IS NULL", [defaultBoardId]);
    await pool.query("UPDATE todos SET board_id = $1 WHERE board_id IS NULL", [defaultBoardId]);
  }

  // 7. Seed default lists for boards with no lists
  const boardsWithNoLists = await pool.query(`
    SELECT b.id FROM boards b
    LEFT JOIN board_lists bl ON bl.board_id = b.id
    WHERE bl.id IS NULL
  `);

  for (const row of boardsWithNoLists.rows) {
    await pool.query(`
      INSERT INTO board_lists (board_id, title, position, color) VALUES
        ($1, 'To Do', 0, 'blue'),
        ($1, 'In Progress', 1, 'yellow'),
        ($1, 'Done', 2, 'green')
    `, [row.id]);
  }

  // 8. Priority migrations
  await pool.query("UPDATE todos SET priority = 'normal'    WHERE priority = 'low'");
  await pool.query("UPDATE todos SET priority = 'important' WHERE priority = 'medium'");
  await pool.query("UPDATE todos SET priority = 'urgent'    WHERE priority = 'high'");
};

let schemaPromise;

const waitForSchema = () => {
  if (!schemaPromise) {
    schemaPromise = ensureSchema().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
};

app.use(async (_req, res, next) => {
  try {
    await waitForSchema();
    next();
  } catch (error) {
    sendServerError(res, error);
  }
});

/* ---------- Health & Diagnostics ---------- */
app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as current_time, 1 as ok");
    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].current_time,
      host: dbHost,
      ssl: databaseUsesSsl,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: err.message,
      host: dbHost,
    });
  }
});

/* ---------- Boards CRUD ---------- */

app.get("/api/boards", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM boards ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) { sendServerError(res, error); }
});

app.post("/api/boards", async (req, res) => {
  try {
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: "Board title is required" });
    const color = req.body.color || "blue";

    const result = await pool.query(
      "INSERT INTO boards (title, color) VALUES ($1, $2) RETURNING *",
      [title, color]
    );
    const newBoard = result.rows[0];

    // Auto-create default lists for the new board
    await pool.query(`
      INSERT INTO board_lists (board_id, title, position, color) VALUES
        ($1, 'To Do', 0, 'blue'),
        ($1, 'In Progress', 1, 'yellow'),
        ($1, 'Done', 2, 'green')
    `, [newBoard.id]);

    res.status(201).json(newBoard);
  } catch (error) { sendServerError(res, error); }
});

app.put("/api/boards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const title = req.body.title?.trim();
    const color = req.body.color;
    if (!title && !color) return res.status(400).json({ message: "Provide at least one field" });

    const result = await pool.query(
      `UPDATE boards SET
         title = COALESCE($1, title),
         color = COALESCE($2, color),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [title || null, color || null, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: "Board not found" });
    res.json(result.rows[0]);
  } catch (error) { sendServerError(res, error); }
});

app.delete("/api/boards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const totalBoards = await pool.query("SELECT COUNT(*) FROM boards");
    if (Number(totalBoards.rows[0].count) <= 1) {
      return res.status(400).json({ message: "Cannot delete the only remaining board" });
    }

    await pool.query("DELETE FROM boards WHERE id = $1", [id]);
    res.json({ message: "Board deleted" });
  } catch (error) { sendServerError(res, error); }
});

/* ---------- Board Lists ---------- */

app.get("/api/lists", async (req, res) => {
  try {
    const boardId = req.query.boardId ? Number(req.query.boardId) : null;
    let query = "SELECT * FROM board_lists";
    const params = [];

    if (boardId) {
      query += " WHERE board_id = $1";
      params.push(boardId);
    }
    query += " ORDER BY position ASC, id ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) { sendServerError(res, error); }
});

app.post("/api/lists", async (req, res) => {
  try {
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: "List title is required" });
    const color = normalizeChoice(req.body.color, allowedColors, "green");
    const boardId = Number(req.body.boardId) || (await pool.query("SELECT id FROM boards ORDER BY id ASC LIMIT 1")).rows[0]?.id;

    const maxPos = await pool.query("SELECT COALESCE(MAX(position), -1) AS mp FROM board_lists WHERE board_id = $1", [boardId]);
    const result = await pool.query(
      "INSERT INTO board_lists (board_id, title, position, color) VALUES ($1, $2, $3, $4) RETURNING *",
      [boardId, title, maxPos.rows[0].mp + 1, color]
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
    const current = await pool.query("SELECT board_id FROM board_lists WHERE id = $1", [id]);
    const boardId = current.rows[0]?.board_id;

    const first = await pool.query(
      "SELECT id FROM board_lists WHERE id != $1 AND board_id = $2 ORDER BY position ASC LIMIT 1",
      [id, boardId]
    );

    if (first.rows.length > 0) {
      await pool.query("UPDATE todos SET list_id = $1 WHERE list_id = $2", [first.rows[0].id, id]);
    }
    const result = await pool.query("DELETE FROM board_lists WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "List not found" });
    res.json({ message: "List deleted" });
  } catch (error) { sendServerError(res, error); }
});

/* ---------- Todos ---------- */

app.get("/api/todos", async (req, res) => {
  try {
    const boardId = req.query.boardId ? Number(req.query.boardId) : null;
    let query = todoSelect;
    const params = [];

    if (boardId) {
      query += " WHERE todos.board_id = $1";
      params.push(boardId);
    }
    query += " ORDER BY position ASC, created_at DESC, id DESC";

    const result = await pool.query(query, params);
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
    const images = Array.isArray(req.body.images) ? JSON.stringify(req.body.images) : typeof req.body.images === "string" ? req.body.images : null;

    let boardId = req.body.boardId ? Number(req.body.boardId) : null;
    let listId = req.body.listId ? Number(req.body.listId) : null;

    if (!boardId && listId) {
      const listInfo = await pool.query("SELECT board_id FROM board_lists WHERE id = $1", [listId]);
      boardId = listInfo.rows[0]?.board_id || null;
    }
    if (!boardId) {
      const firstBoard = await pool.query("SELECT id FROM boards ORDER BY id ASC LIMIT 1");
      boardId = firstBoard.rows[0]?.id || null;
    }
    if (!listId && boardId) {
      const firstList = await pool.query("SELECT id FROM board_lists WHERE board_id = $1 ORDER BY position ASC LIMIT 1", [boardId]);
      listId = firstList.rows[0]?.id || null;
    }

    const maxPos = await pool.query("SELECT COALESCE(MAX(position), -1) AS mp FROM todos WHERE list_id = $1", [listId]);

    const result = await pool.query(
      `INSERT INTO todos(board_id, title, note, description, completed, color, priority, category,
                         due_date, due_time, alarm_enabled, alarm_datetime, list_id, position, image_url, images)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9::date, CURRENT_DATE), $10,$11,$12,$13,$14,$15,$16)
       RETURNING id, board_id AS "boardId", title, note, description, completed, color, priority, category,
                 due_date AS "dueDate", due_time AS "dueTime",
                 alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
                 list_id AS "listId", position, image_url AS "imageUrl", images,
                 0 AS "commentsCount",
                 created_at, updated_at`,
      [boardId, title, note, description, false, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime, listId, maxPos.rows[0].mp + 1, imageUrl, images]
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
    const images   = req.body.images   === undefined ? undefined : (Array.isArray(req.body.images) ? JSON.stringify(req.body.images) : req.body.images);

    if (title === "") return res.status(400).json({ message: "Todo title cannot be empty" });
    if ([title, note, description, completed, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime, listId, position, imageUrl, images].every((v) => v === undefined)) {
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
         images=COALESCE($15,images),
         updated_at=CURRENT_TIMESTAMP
       WHERE id=$16
       RETURNING id, board_id AS "boardId", title, note, description, completed, color, priority, category,
                 due_date AS "dueDate", due_time AS "dueTime",
                 alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
                 list_id AS "listId", position, image_url AS "imageUrl", images,
                 (SELECT COUNT(*) FROM todo_comments WHERE todo_comments.todo_id = todos.id)::int AS "commentsCount",
                 created_at, updated_at`,
      [title, note, description, completed, color, priority, category, dueDate, dueTime, alarmEnabled, alarmDateTime, listId, position, imageUrl === null ? '__CLEAR_IMAGE__' : imageUrl, images, id]
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

    const targetPos = typeof pos === "number" ? pos : null;

    if (targetPos !== null) {
      // Shift any existing cards at or after targetPos in the target list
      await pool.query(
        "UPDATE todos SET position = position + 1 WHERE list_id = $1 AND position >= $2 AND id != $3",
        [listId, targetPos, id]
      );
    }

    const maxPos = await pool.query("SELECT COALESCE(MAX(position), -1) AS mp FROM todos WHERE list_id = $1", [listId]);
    const finalPos = targetPos !== null ? targetPos : maxPos.rows[0].mp + 1;

    const result = await pool.query(
      `UPDATE todos SET list_id=$1, position=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3
       RETURNING id, board_id AS "boardId", title, note, description, completed, color, priority, category,
                 due_date AS "dueDate", due_time AS "dueTime",
                 alarm_enabled AS "alarmEnabled", alarm_datetime AS "alarmDateTime",
                 list_id AS "listId", position, image_url AS "imageUrl", images,
                 (SELECT COUNT(*) FROM todo_comments WHERE todo_comments.todo_id = todos.id)::int AS "commentsCount",
                 created_at, updated_at`,
      [listId, finalPos, id]
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

/* ---------- Comments (CRUD with Edit) ---------- */

app.get("/api/todos/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, todo_id AS \"todoId\", author, content, image_url AS \"imageUrl\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM todo_comments WHERE todo_id = $1 ORDER BY created_at ASC, id ASC",
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
      `INSERT INTO todo_comments(todo_id, author, content, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, todo_id AS "todoId", author, content, image_url AS "imageUrl", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, author, content, imageUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { sendServerError(res, error); }
});

app.put("/api/comments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const content = req.body.content?.trim() || "";
    const imageUrl = req.body.imageUrl === undefined ? undefined : req.body.imageUrl;

    const result = await pool.query(
      `UPDATE todo_comments SET
         content = $1,
         image_url = CASE WHEN $2::text = '__CLEAR_IMAGE__' THEN NULL WHEN $2 IS NOT NULL THEN $2 ELSE image_url END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, todo_id AS "todoId", author, content, image_url AS "imageUrl", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [content, imageUrl === null ? '__CLEAR_IMAGE__' : imageUrl, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: "Comment not found" });
    res.json(result.rows[0]);
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

if (require.main === module) {
  waitForSchema()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });
    })
    .catch((error) => {
      console.error("Unable to prepare database schema", error);
      process.exit(1);
    });
}

module.exports = app;
