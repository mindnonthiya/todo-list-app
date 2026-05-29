require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// GET TODOS
app.get("/api/todos", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM todos ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    console.log(error);
  }
});

// CREATE TODO
app.post("/api/todos", async (req, res) => {
  try {
    const { title } = req.body;

    const result = await pool.query(
      "INSERT INTO todos(title, completed) VALUES($1, $2) RETURNING *",
      [title, false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.log(error);
  }
});

// UPDATE TODO
app.put("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { completed } = req.body;

    const result = await pool.query(
      "UPDATE todos SET completed=$1 WHERE id=$2 RETURNING *",
      [completed, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.log(error);
  }
});

// DELETE TODO
app.delete("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM todos WHERE id=$1",
      [id]
    );

    res.json({
      message: "Deleted",
    });
  } catch (error) {
    console.log(error);
  }
});

// START SERVER
app.listen(5000, () => {
  console.log("Server running on port 5000");
});