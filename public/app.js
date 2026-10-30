const booksTable = document.querySelector("#booksTable");
const loansTable = document.querySelector("#loansTable");
const membersTable = document.querySelector("#membersTable");
const bookSearch = document.querySelector("#bookSearch");
const bookDialog = document.querySelector("#bookDialog");
const toast = document.querySelector("#toast");

let books = [];
let members = [];
let loans = [];
let toastTimer;

document.querySelector("#today").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric"
}).format(new Date());

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  return result;
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function renderBooks() {
  const search = bookSearch.value.trim().toLowerCase();
  const visibleBooks = books.filter((book) =>
    `${book.TITLE} ${book.AUTHOR} ${book.ISBN || ""}`.toLowerCase().includes(search)
  );
  booksTable.innerHTML = visibleBooks.length
    ? visibleBooks.map((book) => `
        <tr>
          <td><div class="book-title">${escapeHtml(book.TITLE)}<span class="book-author">${escapeHtml(book.AUTHOR)}</span></div></td>
          <td>${escapeHtml(book.ISBN || "—")}</td>
          <td><span class="availability ${book.AVAILABLE_COPIES === 0 ? "none" : ""}">${book.AVAILABLE_COPIES} / ${book.TOTAL_COPIES} copies</span></td>
        </tr>`).join("")
    : '<tr><td class="empty-state" colspan="3">No books found. Add one to get started.</td></tr>';

  const availableBooks = books.filter((book) => book.AVAILABLE_COPIES > 0);
  document.querySelector("#issueBook").innerHTML =
    '<option value="">Choose an available book</option>' +
    availableBooks.map((book) =>
      `<option value="${book.BOOK_ID}">${escapeHtml(book.TITLE)} (${book.AVAILABLE_COPIES} available)</option>`
    ).join("");
}

function renderMembers() {
  document.querySelector("#issueMember").innerHTML =
    '<option value="">Choose a member</option>' +
    members.map((member) =>
      `<option value="${member.MEMBER_ID}">${escapeHtml(member.NAME)}</option>`
    ).join("");
  membersTable.innerHTML = members.length
    ? members.map((member) => `
        <tr>
          <td>${escapeHtml(member.NAME)}</td>
          <td>${escapeHtml(member.EMAIL)}</td>
        </tr>`).join("")
    : '<tr><td class="empty-state" colspan="2">No members yet. Register a reader to get started.</td></tr>';
}

function renderLoans() {
  loansTable.innerHTML = loans.length
    ? loans.map((loan) => {
        const returned = Boolean(loan.RETURNED_ON);
        return `<tr>
          <td>${escapeHtml(loan.TITLE)}</td>
          <td>${escapeHtml(loan.MEMBER_NAME)}<span class="book-author">${escapeHtml(loan.EMAIL)}</span></td>
          <td>${formatDate(loan.ISSUED_ON)}</td>
          <td>${formatDate(loan.DUE_ON)}</td>
          <td><span class="status-pill ${returned ? "returned" : ""}">${returned ? "Returned" : "Checked out"}</span></td>
          <td>${returned ? "" : `<button class="return-button" type="button" data-return="${loan.LOAN_ID}">Return</button>`}</td>
        </tr>`;
      }).join("")
    : '<tr><td class="empty-state" colspan="6">No checkouts yet. They’ll show up here.</td></tr>';
}

async function refreshDashboard() {
  const [summary, loadedBooks, loadedMembers, loadedLoans] = await Promise.all([
    api("/api/summary"),
    api("/api/books"),
    api("/api/members"),
    api("/api/loans")
  ]);
  books = loadedBooks;
  members = loadedMembers;
  loans = loadedLoans;
  document.querySelector("#statTitles").textContent = summary.TOTAL_TITLES;
  document.querySelector("#statCopies").textContent = summary.TOTAL_COPIES;
  document.querySelector("#statLoans").textContent = summary.ACTIVE_LOANS;
  document.querySelector("#statMembers").textContent = summary.MEMBERS;
  document.querySelector("#databaseStatus").textContent = "Connected";
  renderBooks();
  renderMembers();
  renderLoans();
}

async function submitForm(form, url, successMessage, onSuccess = () => {}) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    await api(url, { method: "POST", body: JSON.stringify(data) });
    form.reset();
    onSuccess();
    await refreshDashboard();
    showToast(successMessage);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

document.querySelector("#addBookShortcut").addEventListener("click", () => bookDialog.showModal());
document.querySelector("#bookForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitForm(event.currentTarget, "/api/books", "Book added to your collection.", () => bookDialog.close());
});
document.querySelector("#showMemberForm").addEventListener("click", () => {
  const form = document.querySelector("#memberForm");
  form.classList.remove("hidden");
  document.querySelector("#members").scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.namedItem("name").focus();
});
document.querySelector("#addMemberShortcut").addEventListener("click", () => {
  const form = document.querySelector("#memberForm");
  form.classList.remove("hidden");
  form.elements.namedItem("name").focus();
});
document.querySelector("#memberForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  submitForm(form, "/api/members", "Member registered.", () => {
    form.classList.add("hidden");
  });
});
document.querySelector("#issueForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const bookId = form.elements.namedItem("bookId").value;
    const memberId = form.elements.namedItem("memberId").value;
    await api("/api/loans", {
      method: "POST",
      body: JSON.stringify({ bookId, memberId })
    });
    form.reset();
    await refreshDashboard();
    showToast("Book checked out.");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});
bookSearch.addEventListener("input", renderBooks);
loansTable.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-return]");
  if (!button) return;
  button.disabled = true;
  try {
    await api(`/api/loans/${button.dataset.return}/return`, { method: "POST" });
    await refreshDashboard();
    showToast("Book returned to the collection.");
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
  }
});

refreshDashboard().catch((error) => {
  document.querySelector("#databaseStatus").textContent = "Offline";
  showToast(`Could not load library data: ${error.message}`, true);
  booksTable.innerHTML = '<tr><td class="empty-state" colspan="3">Could not load collection.</td></tr>';
  loansTable.innerHTML = '<tr><td class="empty-state" colspan="6">Could not load checkouts.</td></tr>';
  membersTable.innerHTML = '<tr><td class="empty-state" colspan="2">Could not load members.</td></tr>';
});
