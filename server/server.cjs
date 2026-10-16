/* Athenaeum REST API (Experiments 1, 3 & 4)
 *
 * Zero-dependency Node server that serves the EXISTING sample data in
 * src/data/sampleData.js (read directly, so the data is not duplicated).
 * Swap this for a real backend later; the React services only depend on the
 * endpoint contract below.
 *
 * --- Reads (Experiment 1 / original app) ---
 *   GET    /api/health
 *   GET    /api/books?search=&category=&available=true
 *   GET    /api/books/:id                    (400 bad id, 404 not found)
 *   GET    /api/books/:id/related
 *   GET    /api/members/:id
 *   GET    /api/members/:id/recommendations?exclude=1,2&categories=Fantasy,Mystery
 *
 * --- CRUD (Experiment 3) ---
 *   POST   /api/books                        create a book
 *   PUT    /api/books/:id                    full update
 *   PATCH  /api/books/:id                    partial update
 *   DELETE /api/books/:id                    remove a book
 *   GET    /api/borrowings?status=loan       borrowing records
 *   POST   /api/borrowings                   create a borrowing record
 *   GET    /api/borrowings/:id
 *   PUT    /api/borrowings/:id               full update (renewal / return)
 *   PATCH  /api/borrowings/:id               partial update (renewal / return)
 *   DELETE /api/borrowings/:id
 *
 * --- Authentication & tokens (Experiment 4) ---
 *   POST   /api/auth/login                   {identifier, password} -> {token, expiresIn, member}
 *   POST   /api/auth/logout                  invalidates the bearer token
 *   GET    /api/auth/me                      current member for a valid token
 *
 * Everything under /api/borrowings, the book mutations and the auth
 * endpoints other than login require  Authorization: Bearer <token>.
 * Missing, invalid and expired tokens are answered with 401 + a message the
 * UI can show directly.
 *
 * Env: PORT (default 5001), API_DELAY_MS (simulated latency, default 0),
 *      TOKEN_TTL_MS (token lifetime, default 8 hours).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 5001;
const DELAY_MS = Number(process.env.API_DELAY_MS) || 0;
const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS) || 1000 * 60 * 60 * 8;

async function loadData() {
  const file = path.join(__dirname, "..", "src", "data", "sampleData.js");
  const source = fs.readFileSync(file, "utf8");
  // sampleData.js uses ES module syntax; import it from a data: URL so this
  // works on any Node version without changing the file or package.json.
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

// src/data/authData.js imports ./sampleData, so it cannot be loaded through a
// data: URL. The account store is tiny (salt + salted SHA-256 hash + email),
// so read those three string literals straight out of the file instead of
// duplicating them here.
function loadAccounts() {
  const file = path.join(__dirname, "..", "src", "data", "authData.js");
  const src = fs.readFileSync(file, "utf8");
  const pick = (key) => {
    const m = src.match(new RegExp(`${key}\\s*:\\s*"([^"]+)"`));
    return m ? m[1] : null;
  };
  const salt = pick("salt");
  const passwordHash = pick("passwordHash");
  const email = pick("email");
  if (!salt || !passwordHash) {
    throw new Error("Could not read the demo credentials from src/data/authData.js");
  }
  return { salt, passwordHash, email: email || "" };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const send = (res, status, body, extraHeaders = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
};

// 204 must not carry a body (used for OPTIONS preflight).
const sendEmpty = (res, status, extraHeaders = {}) => {
  res.writeHead(status, { ...CORS_HEADERS, ...extraHeaders });
  res.end();
};

const methodNotAllowed = (res, allow) =>
  send(res, 405, { error: "Method not allowed" }, { Allow: allow });

const parseId = (raw) => (/^\d+$/.test(raw) ? Number(raw) : null);
const parseIdList = (raw) =>
  (raw || "").split(",").map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).map(Number);

const sanitize = (s) => String(s || "").toLowerCase().replace(/-/g, "");

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// Forms hand us strings; coerce anything numeric-looking so a plain curl
// POST with "totalCopies": "5" behaves the same as 5.
const coerce = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "" || !/^-?\d+(\.\d+)?$/.test(trimmed)) return value;
  return Number(trimmed);
};

const isIsoDate = (v) => {
  if (typeof v !== "string" || !v.trim()) return false;
  return !Number.isNaN(Date.parse(v));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(Object.assign(new Error("Request body must be a JSON object."), { status: 400 }));
        } else {
          resolve(parsed);
        }
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

loadData().then(({ initialBooks, initialMember, initialLoans, initialHistory, LOAN_DAYS }) => {
  const books = initialBooks;
  const members = [initialMember];
  const account = loadAccounts();

  // ---------- Experiment 4: bearer tokens (in memory, expire automatically) ----------
  const tokens = new Map(); // token -> { memberId, expiresAt }

  const issueToken = (memberId) => {
    const token = crypto.randomBytes(24).toString("hex");
    tokens.set(token, { memberId, expiresAt: Date.now() + TOKEN_TTL_MS });
    return token;
  };

  // Returns { ok: true, member } or { ok: false, status, error }.
  const requireToken = (req) => {
    const header = req.headers["authorization"] || "";
    const match = /^Bearer\s+(\S+)$/i.exec(String(header).trim());
    if (!match) {
      return { ok: false, status: 401, error: "Authentication required. Please sign in." };
    }
    const record = tokens.get(match[1]);
    if (!record) {
      return { ok: false, status: 401, error: "Invalid or expired token. Please sign in again." };
    }
    if (record.expiresAt < Date.now()) {
      tokens.delete(match[1]);
      return { ok: false, status: 401, error: "Your session has expired. Please sign in again." };
    }
    const member = members.find((m) => m.id === record.memberId);
    if (!member) {
      tokens.delete(match[1]);
      return { ok: false, status: 401, error: "Invalid or expired token. Please sign in again." };
    }
    return { ok: true, member, token: match[1] };
  };

  const hashPassword = (salt, password) =>
    crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");

  // ---------- Experiment 3: borrowing records ----------
  let borrowingSeq = 0;
  const borrowings = [
    ...initialLoans.map((loan) => ({
      id: ++borrowingSeq,
      memberId: initialMember.id,
      bookId: loan.bookId,
      borrowedOn: loan.borrowedOn,
      dueDate: loan.dueDate,
      renewals: loan.renewals || 0,
      status: "loan",
    })),
    ...initialHistory.map((entry) => ({
      id: ++borrowingSeq,
      memberId: initialMember.id,
      bookId: entry.bookId,
      borrowedOn: entry.borrowedOn,
      returnedOn: entry.returnedOn,
      status: "returned",
    })),
  ];

  const bookExists = (bookId) => books.some((b) => b.id === bookId);

  // Validate + normalise a book payload. `partial` is used by PATCH.
  const normaliseBookBody = (body, partial) => {
    const errors = [];
    const out = {};

    if (!partial || "title" in body) {
      if (!isNonEmptyString(body.title)) errors.push("title is required");
      else out.title = body.title.trim();
    }
    if (!partial || "author" in body) {
      if (!isNonEmptyString(body.author)) errors.push("author is required");
      else out.author = body.author.trim();
    }

    const optionalStrings = ["category", "description", "isbn", "publisher", "coverImage"];
    optionalStrings.forEach((key) => {
      if (key in body && body[key] !== undefined && body[key] !== null) {
        if (typeof body[key] !== "string") errors.push(`${key} must be a string`);
        else out[key] = body[key];
      }
    });

    if ("year" in body && body.year !== undefined && body.year !== null && body.year !== "") {
      const year = coerce(body.year);
      if (typeof year !== "number" || !Number.isInteger(year) || year < 0 || year > 3000) {
        errors.push("year must be a whole number");
      } else out.year = year;
    }

    if ("rating" in body && body.rating !== undefined && body.rating !== null && body.rating !== "") {
      const rating = coerce(body.rating);
      if (typeof rating !== "number" || rating < 0 || rating > 5) {
        errors.push("rating must be a number between 0 and 5");
      } else out.rating = rating;
    }

    if ("totalCopies" in body && body.totalCopies !== undefined && body.totalCopies !== null && body.totalCopies !== "") {
      const total = coerce(body.totalCopies);
      if (typeof total !== "number" || !Number.isInteger(total) || total < 1) {
        errors.push("totalCopies must be a whole number of 1 or more");
      } else out.totalCopies = total;
    }

    if ("availableCopies" in body && body.availableCopies !== undefined && body.availableCopies !== null && body.availableCopies !== "") {
      const available = coerce(body.availableCopies);
      if (typeof available !== "number" || !Number.isInteger(available) || available < 0) {
        errors.push("availableCopies must be a whole number of 0 or more");
      } else out.availableCopies = available;
    }

    return { errors, out };
  };

  // Apply a validated payload on top of an existing book (keeps id).
  const applyBookPatch = (book, out) => {
    const next = { ...book, ...out };
    if (next.totalCopies !== undefined) {
      if (typeof next.totalCopies !== "number" || next.totalCopies < 1) next.totalCopies = book.totalCopies;
    }
    if (next.availableCopies !== undefined) {
      if (typeof next.availableCopies !== "number" || next.availableCopies < 0) next.availableCopies = book.availableCopies;
    }
    // Never allow more copies out than exist.
    const total = next.totalCopies ?? book.totalCopies ?? 0;
    if (typeof next.availableCopies === "number") {
      next.availableCopies = Math.min(Math.max(next.availableCopies, 0), total);
    }
    return next;
  };

  const server = http.createServer((req, res) => {
    const handle = async () => {
      if (req.method === "OPTIONS") return sendEmpty(res, 204);

      const url = new URL(req.url, "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean); // ["api","books",...]
      if (parts[0] !== "api") return send(res, 404, { error: "Not found" });
      const [, resource, id, sub] = parts;
      const method = req.method;

      // ========================= Experiment 4: auth =========================
      if (resource === "auth") {
        if (sub) return send(res, 404, { error: "Not found" });

        if (id === "login") {
          if (method !== "POST") return methodNotAllowed(res, "POST");
          const body = await readBody(req);
          const identifier = isNonEmptyString(body.identifier) ? body.identifier.trim().toLowerCase() : "";
          const password = typeof body.password === "string" ? body.password : "";
          if (!identifier || !password) {
            return send(res, 400, { error: "Member ID/email and password are required." });
          }
          const matches =
            (members.some((m) => m.id.toLowerCase() === identifier) ||
              account.email.toLowerCase() === identifier) &&
            password.length > 0;
          const hashed = hashPassword(account.salt, password);
          if (!matches || hashed !== account.passwordHash) {
            return send(res, 401, { error: "Incorrect Member ID/email or password." });
          }
          const token = issueToken(initialMember.id);
          return send(res, 200, {
            token,
            tokenType: "Bearer",
            expiresIn: TOKEN_TTL_MS,
            expiresAt: Date.now() + TOKEN_TTL_MS,
            member: { ...initialMember, email: account.email },
          });
        }

        if (id === "logout") {
          if (method !== "POST") return methodNotAllowed(res, "POST");
          const auth = requireToken(req);
          if (!auth.ok) return send(res, auth.status, { error: auth.error });
          tokens.delete(auth.token);
          return send(res, 200, { ok: true });
        }

        if (id === "me") {
          if (method !== "GET") return methodNotAllowed(res, "GET");
          const auth = requireToken(req);
          if (!auth.ok) return send(res, auth.status, { error: auth.error });
          return send(res, 200, auth.member);
        }

        return send(res, 404, { error: "Not found" });
      }

      // ==================== Experiment 3: borrowing records ====================
      if (resource === "borrowings") {
        const auth = requireToken(req); // every borrowing operation is protected
        if (!auth.ok) return send(res, auth.status, { error: auth.error });

        if (!id) {
          if (method === "GET") {
            const status = url.searchParams.get("status");
            const result = status ? borrowings.filter((b) => b.status === status) : borrowings;
            return send(res, 200, result);
          }
          if (method === "POST") {
            const body = await readBody(req);
            const bookId = coerce(body.bookId);
            if (typeof bookId !== "number" || !bookExists(bookId)) {
              return send(res, 400, { error: "bookId must be the id of an existing book." });
            }
            const borrowedOn = isIsoDate(body.borrowedOn) ? body.borrowedOn : new Date().toISOString();
            const dueDate = isIsoDate(body.dueDate)
              ? body.dueDate
              : new Date(Date.now() + (Number(LOAN_DAYS) || 14) * 86400000).toISOString();
            const renewals = coerce(body.renewals);
            const record = {
              id: ++borrowingSeq,
              memberId: isNonEmptyString(body.memberId) ? body.memberId : auth.member.id,
              bookId,
              borrowedOn,
              dueDate,
              renewals: typeof renewals === "number" && renewals >= 0 ? renewals : 0,
              status: "loan",
            };
            borrowings.push(record);
            return send(res, 201, record);
          }
          return methodNotAllowed(res, "GET, POST");
        }

        const recordId = parseId(id);
        if (recordId === null) return send(res, 400, { error: "Invalid borrowing id" });
        const index = borrowings.findIndex((b) => b.id === recordId);
        if (index === -1) return send(res, 404, { error: "Borrowing record not found" });
        const existing = borrowings[index];

        if (method === "GET") return send(res, 200, existing);

        if (method === "PUT" || method === "PATCH") {
          const body = await readBody(req);
          const problems = [];

          let next = { ...existing };
          if (method === "PUT") {
            // Full replace: bookId is mandatory, dates/renewals have defaults.
            const bookId = coerce(body.bookId);
            if (typeof bookId !== "number" || !bookExists(bookId)) {
              problems.push("bookId must be the id of an existing book.");
            } else next.bookId = bookId;
            if (isIsoDate(body.borrowedOn)) next.borrowedOn = body.borrowedOn;
            if (isIsoDate(body.dueDate)) next.dueDate = body.dueDate;
            else if (method === "PUT" && !body.dueDate && next.status === "loan") {
              /* keep existing due date */
            }
            if ("renewals" in body) {
              const renewals = coerce(body.renewals);
              if (typeof renewals !== "number" || renewals < 0) problems.push("renewals must be 0 or more.");
              else next.renewals = renewals;
            }
            if (isNonEmptyString(body.status)) {
              if (!["loan", "returned"].includes(body.status)) problems.push("status must be 'loan' or 'returned'.");
              else next.status = body.status;
            }
            if (isIsoDate(body.returnedOn)) next.returnedOn = body.returnedOn;
            if (isNonEmptyString(body.memberId)) next.memberId = body.memberId;
          } else {
            // Partial update: only touch the keys that were sent.
            if ("bookId" in body) {
              const bookId = coerce(body.bookId);
              if (typeof bookId !== "number" || !bookExists(bookId)) problems.push("bookId must be the id of an existing book.");
              else next.bookId = bookId;
            }
            if ("borrowedOn" in body) {
              if (!isIsoDate(body.borrowedOn)) problems.push("borrowedOn must be an ISO date.");
              else next.borrowedOn = body.borrowedOn;
            }
            if ("dueDate" in body) {
              if (!isIsoDate(body.dueDate)) problems.push("dueDate must be an ISO date.");
              else next.dueDate = body.dueDate;
            }
            if ("renewals" in body) {
              const renewals = coerce(body.renewals);
              if (typeof renewals !== "number" || renewals < 0) problems.push("renewals must be 0 or more.");
              else next.renewals = renewals;
            }
            if ("status" in body) {
              if (!["loan", "returned"].includes(body.status)) problems.push("status must be 'loan' or 'returned'.");
              else next.status = body.status;
            }
            if ("returnedOn" in body) {
              if (body.returnedOn === null) delete next.returnedOn;
              else if (!isIsoDate(body.returnedOn)) problems.push("returnedOn must be an ISO date.");
              else next.returnedOn = body.returnedOn;
            }
            if ("memberId" in body && isNonEmptyString(body.memberId)) next.memberId = body.memberId;
          }

          if (problems.length) return send(res, 400, { error: problems.join(" ") });
          borrowings[index] = next;
          return send(res, 200, next);
        }

        if (method === "DELETE") {
          borrowings.splice(index, 1);
          return send(res, 200, { ok: true, id: recordId });
        }

        return methodNotAllowed(res, "GET, PUT, PATCH, DELETE");
      }

      // ============================ Books ============================
      if (resource === "books") {
        if (!id) {
          if (method === "GET") {
            const q = sanitize(url.searchParams.get("search")).trim();
            const category = url.searchParams.get("category");
            const onlyAvailable = url.searchParams.get("available") === "true";
            const result = books.filter((b) => {
              const hay = [b.title, b.author, b.isbn, b.publisher].map(sanitize).join(" ");
              return (
                (!q || hay.includes(q)) &&
                (!category || category === "All" || b.category === category) &&
                (!onlyAvailable || b.availableCopies > 0)
              );
            });
            return send(res, 200, result);
          }

          if (method === "POST") {
            const auth = requireToken(req); // creating a book is a protected operation
            if (!auth.ok) return send(res, auth.status, { error: auth.error });

            const body = await readBody(req);
            const { errors, out } = normaliseBookBody(body, false);
            if (errors.length) return send(res, 400, { error: errors.join("; ") });

            const totalCopies = out.totalCopies ?? 1;
            const book = {
              id: books.reduce((max, b) => Math.max(max, b.id), 0) + 1,
              title: out.title,
              author: out.author,
              category: out.category || "Fiction",
              year: out.year,
              rating: out.rating ?? 0,
              totalCopies,
              availableCopies: out.availableCopies ?? totalCopies,
              description: out.description,
              isbn: out.isbn,
              publisher: out.publisher,
              coverImage: out.coverImage,
            };
            // Drop keys the client never sent so responses stay tidy.
            Object.keys(book).forEach((k) => book[k] === undefined && delete book[k]);
            books.push(book);
            return send(res, 201, book);
          }

          return methodNotAllowed(res, "GET, POST");
        }

        const bookId = parseId(id);
        if (bookId === null) return send(res, 400, { error: "Invalid book id" });
        const index = books.findIndex((b) => b.id === bookId);
        if (index === -1) return send(res, 404, { error: "Book not found" });
        const existing = books[index];

        if (method === "GET") {
          if (!sub) return send(res, 200, existing);
          if (sub === "related") {
            const related = books
              .filter((b) => b.id !== existing.id && (b.category === existing.category || b.author === existing.author))
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 4);
            return send(res, 200, related);
          }
          return send(res, 404, { error: "Not found" });
        }

        const auth = requireToken(req); // update / delete are protected
        if (!auth.ok) return send(res, auth.status, { error: auth.error });

        if (method === "PUT" || method === "PATCH") {
          if (sub) return send(res, 404, { error: "Not found" });
          const body = await readBody(req);
          const { errors, out } = normaliseBookBody(body, method === "PATCH");
          if (errors.length) return send(res, 400, { error: errors.join("; ") });
          if (method === "PUT" && (!("category" in out) || !out.category)) out.category = existing.category;
          const next = applyBookPatch(existing, out);
          books[index] = next;
          return send(res, 200, next);
        }

        if (method === "DELETE") {
          if (sub) return send(res, 404, { error: "Not found" });
          books.splice(index, 1);
          return send(res, 200, { ok: true, id: bookId });
        }

        return methodNotAllowed(res, "GET, PUT, PATCH, DELETE");
      }

      // ============================ Members ============================
      if (resource === "members" && id) {
        if (method !== "GET") return methodNotAllowed(res, "GET");
        const member = members.find((m) => m.id.toLowerCase() === id.toLowerCase());
        if (!member) return send(res, 404, { error: "Member not found" });
        if (!sub) return send(res, 200, member);
        if (sub === "recommendations") {
          const exclude = new Set(parseIdList(url.searchParams.get("exclude")));
          const extra = (url.searchParams.get("categories") || "").split(",").filter(Boolean);
          const liked = new Set([...member.favoriteCategories, ...extra]);
          const recs = books
            .filter((b) => liked.has(b.category) && !exclude.has(b.id))
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 6);
          return send(res, 200, recs);
        }
      }

      if (resource === "health" && !id) {
        if (method !== "GET") return methodNotAllowed(res, "GET");
        return send(res, 200, { status: "ok" });
      }

      return send(res, 404, { error: "Not found" });
    };

    const run = () => {
      handle().catch((err) => {
        if (err && err.status) return send(res, err.status, { error: err.message });
        // eslint-disable-next-line no-console
        console.error("[Athenaeum API]", err);
        if (!res.headersSent) send(res, 500, { error: "Internal server error" });
      });
    };

    try {
      if (DELAY_MS > 0) setTimeout(run, DELAY_MS);
      else run();
    } catch {
      send(res, 500, { error: "Internal server error" });
    }
  });

  server.listen(PORT, () =>
    console.log(
      `Athenaeum API listening on http://localhost:${PORT}/api ` +
        `(CRUD + auth, token TTL ${Math.round(TOKEN_TTL_MS / 60000)} min)`
    )
  );
});
