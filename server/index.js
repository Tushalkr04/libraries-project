require("dotenv").config();

const express = require("express");
const path = require("node:path");
const oracledb = require("oracledb");

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDirectory = path.join(__dirname, "..", "public");

app.use(express.json({ limit: "20kb" }));
app.use(express.static(publicDirectory));

function requireText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    const error = new Error(`${field} is required and must be at most ${maxLength} characters.`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

function requirePositiveInteger(value, field, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    const error = new Error(`${field} must be a positive whole number${max < Number.MAX_SAFE_INTEGER ? ` no greater than ${max}` : ""}.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function withConnection(callback) {
  const connection = await oracledb.getConnection();
  try {
    return await callback(connection);
  } finally {
    await connection.close();
  }
}

async function withTransaction(callback) {
  return withConnection(async (connection) => {
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

app.get("/api/summary", asyncRoute(async (_req, res) => {
  const summary = await withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT
         (SELECT COUNT(*) FROM books) AS TOTAL_TITLES,
         (SELECT NVL(SUM(total_copies), 0) FROM books) AS TOTAL_COPIES,
         (SELECT COUNT(*) FROM loans WHERE returned_on IS NULL) AS ACTIVE_LOANS,
         (SELECT COUNT(*) FROM members) AS MEMBERS
       FROM dual`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0];
  });
  res.json(summary);
}));

app.get("/api/books", asyncRoute(async (_req, res) => {
  const result = await withConnection((connection) => connection.execute(
    `SELECT book_id, title, author, isbn, total_copies, available_copies
     FROM books
     ORDER BY title`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  ));
  res.json(result.rows);
}));

app.post("/api/books", asyncRoute(async (req, res) => {
  const title = requireText(req.body.title, "Title", 200);
  const author = requireText(req.body.author, "Author", 150);
  const isbn = req.body.isbn == null || req.body.isbn === ""
    ? null
    : requireText(req.body.isbn, "ISBN", 30);
  const copies = requirePositiveInteger(req.body.copies, "Copies", 99999);

  await withTransaction((connection) => connection.execute(
    `BEGIN libraries_api.add_book(:title, :author, :isbn, :copies); END;`,
    { title, author, isbn, copies }
  ));
  res.status(201).json({ message: "Book added." });
}));

app.get("/api/members", asyncRoute(async (_req, res) => {
  const result = await withConnection((connection) => connection.execute(
    `SELECT member_id, name, email
     FROM members
     ORDER BY name`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  ));
  res.json(result.rows);
}));

app.post("/api/members", asyncRoute(async (req, res) => {
  const name = requireText(req.body.name, "Name", 150);
  const email = requireText(req.body.email, "Email", 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }

  await withTransaction((connection) => connection.execute(
    `BEGIN libraries_api.add_member(:name, :email); END;`,
    { name, email }
  ));
  res.status(201).json({ message: "Member added." });
}));

app.get("/api/loans", asyncRoute(async (_req, res) => {
  const result = await withConnection((connection) => connection.execute(
    `SELECT l.loan_id, b.title, m.name AS member_name, m.email,
            l.issued_on, l.due_on, l.returned_on
     FROM loans l
     JOIN books b ON b.book_id = l.book_id
     JOIN members m ON m.member_id = l.member_id
     ORDER BY l.issued_on DESC, l.loan_id DESC`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  ));
  res.json(result.rows);
}));

app.post("/api/loans", asyncRoute(async (req, res) => {
  const bookId = requirePositiveInteger(req.body.bookId, "Book");
  const memberId = requirePositiveInteger(req.body.memberId, "Member");

  await withTransaction((connection) => connection.execute(
    `BEGIN libraries_api.issue_book(:book_id, :member_id); END;`,
    { book_id: bookId, member_id: memberId }
  ));
  res.status(201).json({ message: "Book checked out." });
}));

app.post("/api/loans/:loanId/return", asyncRoute(async (req, res) => {
  const loanId = requirePositiveInteger(req.params.loanId, "Loan");
  await withTransaction((connection) => connection.execute(
    `BEGIN libraries_api.return_book(:loan_id); END;`,
    { loan_id: loanId }
  ));
  res.json({ message: "Book returned." });
}));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

app.use((error, _req, res, _next) => {
  const status = error.status
    || ([20001, 20002, 1].includes(error.errorNum) ? 409 : [20003, 20004].includes(error.errorNum) ? 404 : 500);
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({
    error: status === 500 ? "The request could not be completed." : error.message
  });
});

async function start() {
  const requiredSettings = ["DB_USER", "DB_PASSWORD", "DB_CONNECT_STRING"];
  const missingSettings = requiredSettings.filter((setting) => !process.env[setting]);
  if (missingSettings.length) {
    throw new Error(`Missing ${missingSettings.join(", ")}. Copy .env.example to .env and configure Oracle credentials.`);
  }

  await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1
  });

  app.listen(port, () => {
    console.log(`Libraries is running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Unable to start Libraries:", error.message);
  process.exitCode = 1;
});
