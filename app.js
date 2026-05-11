const LEGACY_STORAGE_KEYS = ["simple-crm-records-v2", "simple-crm-records-v1"];
const state = {
  authenticated: false,
  contacts: [],
  options: {
    relationshipTypes: [],
    relationshipStatus: [],
    salesStages: [],
    priorities: [],
  },
  search: "",
  focusFilter: "all",
  typeFilter: "all",
  editingId: null,
  loading: false,
};

const elements = {
  authShell: document.querySelector("#authShell"),
  loginForm: document.querySelector("#loginForm"),
  passwordInput: document.querySelector("#passwordInput"),
  loginError: document.querySelector("#loginError"),
  logoutBtn: document.querySelector("#logoutBtn"),
  appShell: document.querySelector(".app-shell"),
  statsGrid: document.querySelector("#statsGrid"),
  todayList: document.querySelector("#todayList"),
  contactsTableBody: document.querySelector("#contactsTableBody"),
  pipelineBoard: document.querySelector("#pipelineBoard"),
  relationshipsList: document.querySelector("#relationshipsList"),
  contactForm: document.querySelector("#contactForm"),
  formTitle: document.querySelector("#formTitle"),
  searchInput: document.querySelector("#searchInput"),
  focusFilter: document.querySelector("#focusFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  contactId: document.querySelector("#contactId"),
  nameInput: document.querySelector("#nameInput"),
  companyInput: document.querySelector("#companyInput"),
  emailInput: document.querySelector("#emailInput"),
  phoneInput: document.querySelector("#phoneInput"),
  sourceInput: document.querySelector("#sourceInput"),
  relationshipTypeInput: document.querySelector("#relationshipTypeInput"),
  relationshipStatusInput: document.querySelector("#relationshipStatusInput"),
  salesTrackInput: document.querySelector("#salesTrackInput"),
  salesStageInput: document.querySelector("#salesStageInput"),
  valueInput: document.querySelector("#valueInput"),
  priorityInput: document.querySelector("#priorityInput"),
  lastContactInput: document.querySelector("#lastContactInput"),
  nextFollowUpInput: document.querySelector("#nextFollowUpInput"),
  nextActionInput: document.querySelector("#nextActionInput"),
  notesInput: document.querySelector("#notesInput"),
  salesFields: document.querySelector("#salesFields"),
  salesHelpText: document.querySelector("#salesHelpText"),
  resetFormBtn: document.querySelector("#resetFormBtn"),
  newContactBtn: document.querySelector("#newContactBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

function loadLegacyBrowserContacts() {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch (error) {
      console.error(`Unable to read legacy browser data from ${key}`, error);
    }
  }

  return [];
}

function normalizeRecoveryContact(contact) {
  if (contact.relationshipType) {
    return {
      name: contact.name || "",
      company: contact.company || "",
      email: contact.email || "",
      phone: contact.phone || "",
      source: contact.source || "",
      relationshipType: contact.relationshipType || "partner",
      relationshipStatus: contact.relationshipStatus || "warm",
      isSales: Boolean(contact.isSales),
      salesStage: contact.salesStage || "",
      value: Number(contact.value || 0),
      priority: contact.priority || "medium",
      lastContact: contact.lastContact || "",
      nextFollowUp: contact.nextFollowUp || "",
      nextAction: contact.nextAction || "",
      notes: contact.notes || "",
    };
  }

  return {
    name: contact.name || "",
    company: contact.company || "",
    email: contact.email || "",
    phone: contact.phone || "",
    source: contact.source || "",
    relationshipType: "prospect",
    relationshipStatus: "warm",
    isSales: true,
    salesStage: contact.status || "watchlist",
    value: Number(contact.value || 0),
    priority: "medium",
    lastContact: contact.lastContact || "",
    nextFollowUp: contact.nextFollowUp || "",
    nextAction: contact.nextAction || "",
    notes: contact.notes || "",
  };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    const message = payload.error || "Something went wrong";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function optionMarkup(list) {
  return list
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join("");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(dateString) {
  if (!dateString) {
    return "Not set";
  }

  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysUntil(dateString) {
  if (!dateString) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function getLabel(list, value) {
  return list.find((item) => item.value === value)?.label || value || "Not set";
}

function getTypeLabel(value) {
  return getLabel(state.options.relationshipTypes, value);
}

function getRelationshipStatusLabel(value) {
  return getLabel(state.options.relationshipStatus, value);
}

function getSalesStageLabel(value) {
  return getLabel(state.options.salesStages, value);
}

function getPriorityLabel(value) {
  return getLabel(state.options.priorities, value);
}

function getVisibleContacts() {
  return state.contacts
    .filter((contact) => {
      const matchesFocus =
        state.focusFilter === "all" ||
        (state.focusFilter === "sales" && contact.isSales) ||
        (state.focusFilter === "relationships" && !contact.isSales);
      const matchesType =
        state.typeFilter === "all" || contact.relationshipType === state.typeFilter;
      const haystack = [
        contact.name,
        contact.company,
        contact.email,
        contact.source,
        contact.notes,
        contact.nextAction,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = haystack.includes(state.search.toLowerCase());
      return matchesFocus && matchesType && matchesSearch;
    })
    .sort((a, b) => {
      const aDate = a.nextFollowUp || "9999-12-31";
      const bDate = b.nextFollowUp || "9999-12-31";
      return aDate.localeCompare(bDate);
    });
}

function getSalesContacts() {
  return state.contacts.filter((contact) => contact.isSales);
}

function getRelationshipContacts() {
  return state.contacts.filter((contact) => !contact.isSales);
}

function getFollowUpContacts() {
  return state.contacts
    .filter((contact) => contact.nextFollowUp)
    .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
}

function buildStats() {
  const salesContacts = getSalesContacts();
  const opportunityContacts = salesContacts.filter((contact) =>
    ["watchlist", "lead", "discovery", "proposal", "negotiation"].includes(contact.salesStage)
  );
  const activePipelineDeals = salesContacts.filter((contact) =>
    ["discovery", "proposal", "negotiation"].includes(contact.salesStage)
  );
  const totalPotentialValue = opportunityContacts.reduce((sum, contact) => sum + Number(contact.value || 0), 0);
  const wonValue = salesContacts
    .filter((contact) => contact.salesStage === "won")
    .reduce((sum, contact) => sum + Number(contact.value || 0), 0);
  const todayItems = getFollowUpContacts().filter((contact) => {
    const remaining = daysUntil(contact.nextFollowUp);
    return remaining !== null && remaining <= 0;
  }).length;

  return [
    {
      label: "Potential value",
      value: formatCurrency(totalPotentialValue),
      detail: `${activePipelineDeals.length} active sales conversations`,
    },
    {
      label: "Due today or overdue",
      value: todayItems,
      detail: todayItems ? "Start here first" : "Breathing room today",
    },
    {
      label: "Non-sales relationships",
      value: getRelationshipContacts().length,
      detail: "Journalists, referrers, guests, peers",
    },
    {
      label: "Won revenue",
      value: formatCurrency(wonValue),
      detail: "Closed work so far",
    },
  ];
}

function renderStats() {
  elements.statsGrid.innerHTML = buildStats()
    .map(
      (stat) => `
        <article class="stat-card">
          <p class="stat-label">${stat.label}</p>
          <p class="stat-value">${stat.value}</p>
          <p class="stat-detail">${stat.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderSelectOptions() {
  elements.relationshipTypeInput.innerHTML = optionMarkup(state.options.relationshipTypes);
  elements.relationshipStatusInput.innerHTML = optionMarkup(state.options.relationshipStatus);
  elements.salesStageInput.innerHTML = optionMarkup(state.options.salesStages);
  elements.priorityInput.innerHTML = optionMarkup(state.options.priorities);
  elements.typeFilter.innerHTML =
    `<option value="all">All relationship types</option>${optionMarkup(state.options.relationshipTypes)}`;
}

function renderTodayList() {
  const items = getFollowUpContacts().filter((contact) => {
    const remaining = daysUntil(contact.nextFollowUp);
    return remaining !== null && remaining <= 0;
  });

  if (!items.length) {
    elements.todayList.innerHTML = `
      <div class="empty-state">
        <p>No overdue follow-ups. That is a real win.</p>
      </div>
    `;
    return;
  }

  elements.todayList.innerHTML = items
    .map((contact) => {
      const remaining = daysUntil(contact.nextFollowUp);
      const dueLabel =
        remaining === 0
          ? "Due today"
          : `${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} overdue`;

      return `
        <article class="task-card ${remaining < 0 ? "is-overdue" : ""}">
          <div class="card-topline">
            <span class="tag ${contact.isSales ? "sales" : "relationship"}">
              ${contact.isSales ? "Sales" : "Relationship"}
            </span>
            <span class="tag priority-${contact.priority}">${getPriorityLabel(contact.priority)}</span>
          </div>
          <strong>${contact.name}</strong>
          <p class="task-meta">${contact.company || "Independent"} • ${getTypeLabel(contact.relationshipType)}</p>
          <p class="task-meta">${dueLabel}</p>
          <p class="task-meta"><strong>Next:</strong> ${contact.nextAction || "No next action written yet"}</p>
          <div class="task-actions">
            <button class="text-button" data-action="edit" data-id="${contact.id}">Open record</button>
            <button class="text-button" data-action="complete-task" data-id="${contact.id}">Push 7 days</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTable() {
  const contacts = getVisibleContacts();

  if (!contacts.length) {
    elements.contactsTableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <p>No contacts match your filters yet.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  elements.contactsTableBody.innerHTML = contacts
    .map(
      (contact) => `
        <tr>
          <td>
            <button class="contact-link" data-action="edit" data-id="${contact.id}">
              ${contact.name}
              <span class="contact-subtitle">${contact.email || "No email saved"}</span>
            </button>
          </td>
          <td>${contact.company || "Independent"}</td>
          <td><span class="tag ${contact.isSales ? "sales" : "relationship"}">${getTypeLabel(contact.relationshipType)}</span></td>
          <td>${contact.isSales ? `<span class="tag ${contact.salesStage}">${getSalesStageLabel(contact.salesStage)}</span>` : getRelationshipStatusLabel(contact.relationshipStatus)}</td>
          <td>${contact.isSales ? formatCurrency(Number(contact.value || 0)) : "—"}</td>
          <td>${formatDate(contact.nextFollowUp)}</td>
          <td>
            <button class="text-button" data-action="delete" data-id="${contact.id}">Delete</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderPipeline() {
  const pipelineStages = state.options.salesStages.filter(
    (stage) => !["watchlist", "lead"].includes(stage.value)
  );
  const columns = pipelineStages
    .map((stage) => {
      const contacts = getSalesContacts().filter((contact) => contact.salesStage === stage.value);
      const total = contacts.reduce((sum, contact) => sum + Number(contact.value || 0), 0);
      const cards = contacts.length
        ? `<div class="deal-stack">${contacts
            .map(
              (contact) => `
                <article class="deal-card">
                  <div class="card-topline">
                    <span class="tag sales">${getTypeLabel(contact.relationshipType)}</span>
                    <span class="tag priority-${contact.priority}">${getPriorityLabel(contact.priority)}</span>
                  </div>
                  <div class="deal-title">${contact.name}</div>
                  <p class="deal-meta">${contact.company || "Independent"}</p>
                  <p class="deal-meta">${formatCurrency(Number(contact.value || 0))}</p>
                  <p class="deal-meta"><strong>Next:</strong> ${contact.nextAction || "No next step captured"}</p>
                  <button class="text-button" data-action="edit" data-id="${contact.id}">Open</button>
                </article>
              `
            )
            .join("")}</div>`
        : elements.emptyStateTemplate.innerHTML;

      return `
        <section class="pipeline-column">
          <h3>${stage.label}</h3>
          <p class="pipeline-meta">${contacts.length} deal${contacts.length === 1 ? "" : "s"} • ${formatCurrency(total)}</p>
          ${cards}
        </section>
      `;
    })
    .join("");

  elements.pipelineBoard.innerHTML = columns;
}

function renderRelationships() {
  const contacts = getRelationshipContacts();

  if (!contacts.length) {
    elements.relationshipsList.innerHTML = elements.emptyStateTemplate.innerHTML;
    return;
  }

  elements.relationshipsList.innerHTML = contacts
    .sort((a, b) => {
      const aDate = a.nextFollowUp || "9999-12-31";
      const bDate = b.nextFollowUp || "9999-12-31";
      return aDate.localeCompare(bDate);
    })
    .map((contact) => {
      const remaining = daysUntil(contact.nextFollowUp);
      const dueText =
        remaining === null
          ? "No follow-up date"
          : remaining < 0
            ? `${Math.abs(remaining)} days overdue`
            : remaining === 0
              ? "Due today"
              : `Due in ${remaining} days`;

      return `
        <article class="relationship-card">
          <div class="card-topline">
            <span class="tag relationship">${getTypeLabel(contact.relationshipType)}</span>
            <span class="tag priority-${contact.priority}">${getPriorityLabel(contact.priority)}</span>
          </div>
          <strong>${contact.name}</strong>
          <p class="task-meta">${contact.company || "Independent"} • ${getRelationshipStatusLabel(contact.relationshipStatus)}</p>
          <p class="task-meta">${dueText}</p>
          <p class="task-meta"><strong>Next:</strong> ${contact.nextAction || "No next step captured"}</p>
          <button class="text-button" data-action="edit" data-id="${contact.id}">Open record</button>
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  renderStats();
  renderTodayList();
  renderTable();
  renderPipeline();
  renderRelationships();
}

function syncSalesFieldVisibility() {
  const isSales = elements.salesTrackInput.checked;
  elements.salesFields.hidden = !isSales;
  elements.salesHelpText.textContent = isSales
    ? "This person will appear in the money pipeline."
    : "This person stays out of the sales pipeline and lives in relationships only.";
}

function setAuthenticatedView(isAuthenticated) {
  state.authenticated = isAuthenticated;
  elements.authShell.hidden = isAuthenticated;
  elements.appShell.hidden = !isAuthenticated;
}

function resetForm() {
  state.editingId = null;
  elements.formTitle.textContent = "Add contact";
  elements.contactForm.reset();
  elements.contactId.value = "";
  elements.relationshipTypeInput.value = "prospect";
  elements.relationshipStatusInput.value = "warm";
  elements.salesTrackInput.checked = true;
  elements.salesStageInput.value = "watchlist";
  elements.priorityInput.value = "medium";
  syncSalesFieldVisibility();
}

function populateForm(contact) {
  state.editingId = contact.id;
  elements.formTitle.textContent = `Editing ${contact.name}`;
  elements.contactId.value = contact.id;
  elements.nameInput.value = contact.name;
  elements.companyInput.value = contact.company || "";
  elements.emailInput.value = contact.email || "";
  elements.phoneInput.value = contact.phone || "";
  elements.sourceInput.value = contact.source || "";
  elements.relationshipTypeInput.value = contact.relationshipType;
  elements.relationshipStatusInput.value = contact.relationshipStatus;
  elements.salesTrackInput.checked = contact.isSales;
  elements.salesStageInput.value = contact.salesStage || "watchlist";
  elements.valueInput.value = contact.value || "";
  elements.priorityInput.value = contact.priority;
  elements.lastContactInput.value = contact.lastContact || "";
  elements.nextFollowUpInput.value = contact.nextFollowUp || "";
  elements.nextActionInput.value = contact.nextAction || "";
  elements.notesInput.value = contact.notes || "";
  syncSalesFieldVisibility();
}

function collectFormPayload() {
  return {
    name: elements.nameInput.value.trim(),
    company: elements.companyInput.value.trim(),
    email: elements.emailInput.value.trim(),
    phone: elements.phoneInput.value.trim(),
    source: elements.sourceInput.value.trim(),
    relationshipType: elements.relationshipTypeInput.value,
    relationshipStatus: elements.relationshipStatusInput.value,
    isSales: elements.salesTrackInput.checked,
    salesStage: elements.salesTrackInput.checked ? elements.salesStageInput.value : "",
    value: elements.salesTrackInput.checked ? Number(elements.valueInput.value || 0) : 0,
    priority: elements.priorityInput.value,
    lastContact: elements.lastContactInput.value,
    nextFollowUp: elements.nextFollowUpInput.value,
    nextAction: elements.nextActionInput.value.trim(),
    notes: elements.notesInput.value.trim(),
  };
}

async function refreshContacts() {
  const payload = await apiRequest("/api/contacts");
  state.contacts = payload.contacts;
  renderAll();
}

async function bootstrapApp() {
  const payload = await apiRequest("/api/bootstrap");
  state.contacts = payload.contacts;
  state.options = payload.options;
  renderSelectOptions();
  resetForm();
  renderAll();
  await maybeRecoverLegacyBrowserData();
}

async function saveContact() {
  const payload = collectFormPayload();
  if (state.editingId) {
    const result = await apiRequest(`/api/contacts/${state.editingId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    state.contacts = state.contacts.map((contact) =>
      contact.id === state.editingId ? result.contact : contact
    );
  } else {
    const result = await apiRequest("/api/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.contacts.push(result.contact);
  }

  renderAll();
  resetForm();
}

async function deleteContact(id) {
  await apiRequest(`/api/contacts/${id}`, { method: "DELETE" });
  state.contacts = state.contacts.filter((contact) => contact.id !== id);
  renderAll();
  if (state.editingId === id) {
    resetForm();
  }
}

async function completeTask(id) {
  const contact = state.contacts.find((item) => item.id === id);
  if (!contact) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existingFollowUp = contact.nextFollowUp
    ? new Date(`${contact.nextFollowUp}T00:00:00`)
    : today;
  const base = existingFollowUp > today ? existingFollowUp : today;
  base.setDate(base.getDate() + 7);

  const updated = {
    ...contact,
    lastContact: today.toISOString().slice(0, 10),
    nextFollowUp: base.toISOString().slice(0, 10),
  };

  const result = await apiRequest(`/api/contacts/${id}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });

  state.contacts = state.contacts.map((item) => (item.id === id ? result.contact : item));
  renderAll();

  if (state.editingId === id) {
    populateForm(result.contact);
  }
}

function exportContacts() {
  const blob = new Blob([JSON.stringify(state.contacts, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "simple-crm-export.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importContacts(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("That file did not contain a contact list.");
  }

  for (const contact of parsed) {
    const payload = {
      name: contact.name || "",
      company: contact.company || "",
      email: contact.email || "",
      phone: contact.phone || "",
      source: contact.source || "",
      relationshipType: contact.relationshipType || "partner",
      relationshipStatus: contact.relationshipStatus || "warm",
      isSales: Boolean(contact.isSales),
      salesStage: contact.salesStage || "",
      value: Number(contact.value || 0),
      priority: contact.priority || "medium",
      lastContact: contact.lastContact || "",
      nextFollowUp: contact.nextFollowUp || "",
      nextAction: contact.nextAction || "",
      notes: contact.notes || "",
    };

    if (contact.id && state.contacts.some((existing) => existing.id === contact.id)) {
      await apiRequest(`/api/contacts/${contact.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await apiRequest("/api/contacts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  }

  await refreshContacts();
  resetForm();
}

async function importContactsArray(contacts, { replaceExisting = false } = {}) {
  if (replaceExisting) {
    for (const existing of [...state.contacts]) {
      await apiRequest(`/api/contacts/${existing.id}`, { method: "DELETE" });
    }
  }

  for (const contact of contacts) {
    await apiRequest("/api/contacts", {
      method: "POST",
      body: JSON.stringify(normalizeRecoveryContact(contact)),
    });
  }

  await refreshContacts();
  resetForm();
}

async function maybeRecoverLegacyBrowserData() {
  const legacyContacts = loadLegacyBrowserContacts();
  if (!legacyContacts.length) {
    return;
  }

  if (window.sessionStorage.getItem("simple-crm-legacy-recovery-seen") === "true") {
    return;
  }

  window.sessionStorage.setItem("simple-crm-legacy-recovery-seen", "true");

  const replaceExisting = state.contacts.length === 0;
  const message = replaceExisting
    ? "Older browser-only CRM data was found in this browser. The new deployed version reads from the server, so it is not showing automatically. Recover that older data into this account now?"
    : "Older browser-only CRM data was found in this browser. Do you want to import it into the new server-backed CRM now?";

  if (!window.confirm(message)) {
    return;
  }

  await importContactsArray(legacyContacts, { replaceExisting });
  window.alert("Your older browser data has been imported into the live CRM.");
}

async function handleActionClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  const contact = state.contacts.find((item) => item.id === id);

  if (action === "edit" && contact) {
    populateForm(contact);
  }

  if (action === "delete" && id) {
    await deleteContact(id);
  }

  if (action === "complete-task" && id) {
    await completeTask(id);
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.loginError.hidden = true;
    try {
      await apiRequest("/api/session", {
        method: "POST",
        body: JSON.stringify({ password: elements.passwordInput.value }),
      });
      elements.passwordInput.value = "";
      await bootstrapApp();
      setAuthenticatedView(true);
    } catch (error) {
      elements.loginError.hidden = false;
      elements.loginError.textContent = error.message;
    }
  });

  elements.logoutBtn.addEventListener("click", async () => {
    await apiRequest("/api/session/logout", { method: "POST", body: "{}" });
    setAuthenticatedView(false);
    elements.passwordInput.focus();
  });

  elements.contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveContact();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderTable();
  });

  elements.focusFilter.addEventListener("change", (event) => {
    state.focusFilter = event.target.value;
    renderTable();
  });

  elements.typeFilter.addEventListener("change", (event) => {
    state.typeFilter = event.target.value;
    renderTable();
  });

  elements.salesTrackInput.addEventListener("change", syncSalesFieldVisibility);

  elements.relationshipTypeInput.addEventListener("change", (event) => {
    if (["journalist", "referrer", "podcast-guest", "partner"].includes(event.target.value)) {
      elements.salesTrackInput.checked = false;
    }
    if (["prospect", "customer"].includes(event.target.value)) {
      elements.salesTrackInput.checked = true;
    }
    if (event.target.value === "customer" && elements.salesTrackInput.checked) {
      elements.salesStageInput.value = "won";
    }
    if (event.target.value === "prospect" && elements.salesTrackInput.checked && !elements.salesStageInput.value) {
      elements.salesStageInput.value = "watchlist";
    }
    syncSalesFieldVisibility();
  });

  elements.contactsTableBody.addEventListener("click", handleActionClick);
  elements.pipelineBoard.addEventListener("click", handleActionClick);
  elements.todayList.addEventListener("click", handleActionClick);
  elements.relationshipsList.addEventListener("click", handleActionClick);
  elements.resetFormBtn.addEventListener("click", resetForm);
  elements.newContactBtn.addEventListener("click", resetForm);

  elements.exportBtn.addEventListener("click", exportContacts);

  elements.importInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (file) {
      try {
        await importContacts(file);
      } catch (error) {
        window.alert(error.message || "That file could not be imported.");
      }
    }
    event.target.value = "";
  });
}

async function init() {
  bindEvents();
  setAuthenticatedView(false);

  try {
    const session = await apiRequest("/api/session");
    if (session.authenticated) {
      await bootstrapApp();
      setAuthenticatedView(true);
    }
  } catch (error) {
    setAuthenticatedView(false);
  }
}

init();
