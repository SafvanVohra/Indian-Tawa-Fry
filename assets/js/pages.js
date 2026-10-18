'use strict';

/**
 * Shared helpers for the inner pages: opening hours, WhatsApp hand-off,
 * contact form and table booking form. No backend needed — every form
 * builds a ready-to-send WhatsApp message to the restaurant.
 */

const SITE = {
  name: "Indian Tawa Fry",
  phone: "+918140105711",
  phoneDisplay: "+91 81401 05711",
  whatsapp: "918140105711",
  // Opening hours per weekday (0 = Sunday), minutes from midnight.
  hours: {
    0: [[12 * 60, 13 * 60], [17 * 60 + 30, 23 * 60]],
    1: [[17 * 60 + 30, 23 * 60]],
    2: [[17 * 60 + 30, 23 * 60]],
    3: [[17 * 60 + 30, 23 * 60]],
    4: [[17 * 60 + 30, 23 * 60]],
    5: [[17 * 60 + 30, 23 * 60]],
    6: [[17 * 60 + 30, 23 * 60]]
  },
  slotStep: 30,      // minutes between bookable slots
  lastSlotGap: 30,   // last booking this many minutes before closing
  bookingDaysAhead: 60
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = n => String(n).padStart(2, "0");

const formatTime = function (mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${(h % 12) || 12}:${pad(m)} ${suffix}`;
};

const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseISODate = function (value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatDate = d => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const openWhatsApp = function (text) {
  const url = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
  // "noopener" in the features string makes window.open return null, so clear opener manually
  const win = window.open(url, "_blank");
  if (win) win.opener = null;
  else window.location.href = url;
  return url;
};

window.SITE = SITE;
window.openWhatsApp = openWhatsApp;
window.formatINR = n => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });



/**
 * OPEN / CLOSED STATUS
 */

const getOpenStatus = function (now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = SITE.hours[now.getDay()] || [];

  for (const [start, end] of today) {
    if (mins >= start && mins < end) return { open: true, text: `Open now · until ${formatTime(end)}` };
  }
  for (const [start] of today) {
    if (mins < start) return { open: false, text: `Closed · opens ${formatTime(start)} today` };
  }
  for (let i = 1; i <= 7; i++) {
    const day = (now.getDay() + i) % 7;
    const ranges = SITE.hours[day] || [];
    if (ranges.length) {
      const label = i === 1 ? "tomorrow" : DAY_NAMES[day];
      return { open: false, text: `Closed · opens ${formatTime(ranges[0][0])} ${label}` };
    }
  }
  return { open: false, text: "Closed" };
};

document.querySelectorAll("[data-open-status]").forEach(function (el) {
  const status = getOpenStatus();
  el.textContent = status.text;
  el.classList.add(status.open ? "is-open" : "is-closed");
});

document.querySelectorAll("[data-hours-table] tr[data-day]").forEach(function (row) {
  const days = row.dataset.day.split(",").map(Number);
  if (days.includes(new Date().getDay())) row.classList.add("is-today");
});



/**
 * FORM VALIDATION HELPERS
 */

const setError = function (input, message) {
  const field = input.closest(".field");
  if (!field) {
    // Compact forms (homepage) have no .field wrapper — use the native bubble
    input.setCustomValidity(message || "");
    input.style.borderColor = message ? "hsl(8, 75%, 58%)" : "";
    if (message && input.type !== "hidden") input.reportValidity();
    return;
  }
  field.classList.toggle("has-error", Boolean(message));
  let err = field.querySelector(".field-error");
  if (!err) {
    err = document.createElement("p");
    err.className = "field-error";
    field.appendChild(err);
  }
  err.textContent = message || "";
};

const validators = {
  name: v => v.trim().length >= 2 ? "" : "Please enter your name.",
  phone: v => /^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/.test(v.trim()) ? "" : "Enter a valid 10-digit mobile number.",
  email: v => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter a valid email address.",
  message: v => v.trim().length >= 5 ? "" : "Please write a short message.",
  required: v => v.trim() ? "" : "This field is required."
};

const validateForm = function (form) {
  let firstInvalid = null;
  form.querySelectorAll("[data-validate]").forEach(function (input) {
    const rule = validators[input.dataset.validate] || validators.required;
    const msg = rule(input.value);
    setError(input, msg);
    if (msg && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
};

document.querySelectorAll("[data-validate]").forEach(function (input) {
  input.addEventListener("input", function () {
    const rule = validators[input.dataset.validate] || validators.required;
    const field = input.closest(".field");
    if (field?.classList.contains("has-error")) setError(input, rule(input.value));
    else if (!field && input.style.borderColor && !rule(input.value)) setError(input, "");
  });
});

const showSuccess = function (form, url) {
  const success = form.parentElement.querySelector("[data-form-success]");
  if (!success) {
    let note = form.querySelector("[data-inline-success]");
    if (!note) {
      note = document.createElement("p");
      note.className = "form-note";
      note.dataset.inlineSuccess = "";
      note.setAttribute("role", "status");
      form.appendChild(note);
    }
    note.innerHTML = `✓ WhatsApp opened with your booking — press <strong>send</strong> there to confirm. <a href="${url}" target="_blank" rel="noopener" style="color: var(--gold-crayola); text-decoration: underline;">Open again</a>`;
    return;
  }
  const retry = success.querySelector("[data-wa-retry]");
  if (retry) retry.href = url;
  form.hidden = true;
  success.classList.add("show");
  success.scrollIntoView({ behavior: "smooth", block: "center" });
  const again = success.querySelector("[data-form-reset]");
  if (again) {
    again.onclick = function () {
      form.reset();
      form.dispatchEvent(new Event("reset-ui"));
      success.classList.remove("show");
      form.hidden = false;
    };
  }
};



/**
 * CONTACT FORM
 */

document.querySelectorAll("[data-contact-form]").forEach(function (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validateForm(form)) return;

    const data = new FormData(form);
    const lines = [
      `*New enquiry — ${SITE.name} website*`,
      "",
      `*Name:* ${data.get("name").trim()}`,
      `*Phone:* ${data.get("phone").trim()}`
    ];
    if (data.get("email")?.trim()) lines.push(`*Email:* ${data.get("email").trim()}`);
    lines.push(`*Topic:* ${data.get("subject")}`, "", data.get("message").trim());

    showSuccess(form, openWhatsApp(lines.join("\n")));
  });
});



/**
 * TABLE BOOKING FORM
 * Works with either a slot grid ([data-slots]) or a plain <select name="time">.
 */

const getSlots = function (date) {
  const ranges = SITE.hours[date.getDay()] || [];
  const now = new Date();
  const isToday = toISODate(date) === toISODate(now);
  const nowMins = now.getHours() * 60 + now.getMinutes() + 30; // 30 min notice

  return ranges.map(function ([start, end]) {
    const slots = [];
    for (let t = start; t <= end - SITE.lastSlotGap; t += SITE.slotStep) {
      if (!isToday || t >= nowMins) slots.push(t);
    }
    return { label: start < 15 * 60 ? "Lunch" : "Dinner", slots };
  }).filter(group => group.slots.length);
};

document.querySelectorAll("[data-booking-form]").forEach(function (form) {
  const dateInput = form.querySelector('input[name="date"]');
  const timeInput = form.querySelector('[name="time"]');
  const slotGrid = form.querySelector("[data-slots]");
  const guestsInput = form.querySelector('[name="guests"]');
  const stepper = form.querySelector("[data-stepper]");
  const summary = document.querySelector("[data-booking-summary]");

  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + SITE.bookingDaysAhead);
  dateInput.min = toISODate(today);
  dateInput.max = toISODate(maxDate);

  // Default to the first day that still has slots
  const pickDefaultDate = function () {
    const d = new Date();
    for (let i = 0; i < 8; i++) {
      if (getSlots(d).length) return toISODate(d);
      d.setDate(d.getDate() + 1);
    }
    return toISODate(today);
  };
  dateInput.value = pickDefaultDate();

  const updateSummary = function () {
    if (!summary) return;
    const data = new FormData(form);
    const set = (key, value) => {
      const el = summary.querySelector(`[data-sum="${key}"]`);
      if (el) el.textContent = value || "—";
    };
    set("date", data.get("date") ? formatDate(parseISODate(data.get("date"))) : "");
    set("time", data.get("time") ? formatTime(Number(data.get("time"))) : "");
    set("guests", data.get("guests") ? `${data.get("guests")} ${Number(data.get("guests")) === 1 ? "guest" : "guests"}` : "");
    set("occasion", data.get("occasion"));
    set("seating", data.get("seating"));
  };

  const renderSlots = function () {
    const date = dateInput.value ? parseISODate(dateInput.value) : null;
    const groups = date ? getSlots(date) : [];
    const previous = timeInput.value;

    if (slotGrid) {
      slotGrid.innerHTML = "";
      if (!groups.length) {
        slotGrid.innerHTML = `<p class="slot-empty">No tables left for this day. Please pick another date.</p>`;
        timeInput.value = "";
      }
      groups.forEach(function (group) {
        if (groups.length > 1) {
          const label = document.createElement("p");
          label.className = "slot-group-label";
          label.textContent = group.label;
          slotGrid.appendChild(label);
        }
        group.slots.forEach(function (t) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "slot";
          btn.textContent = formatTime(t);
          btn.dataset.value = t;
          btn.setAttribute("aria-pressed", "false");
          btn.addEventListener("click", function () {
            slotGrid.querySelectorAll(".slot").forEach(s => { s.classList.remove("selected"); s.setAttribute("aria-pressed", "false"); });
            btn.classList.add("selected");
            btn.setAttribute("aria-pressed", "true");
            timeInput.value = t;
            setError(timeInput, "");
            updateSummary();
          });
          slotGrid.appendChild(btn);
        });
      });
      const keep = slotGrid.querySelector(`.slot[data-value="${previous}"]`);
      if (keep) keep.click();
      else timeInput.value = "";
    } else if (timeInput.tagName === "SELECT") {
      timeInput.innerHTML = groups.length ? "" : `<option value="">No slots this day</option>`;
      groups.forEach(function (group) {
        const og = document.createElement("optgroup");
        og.label = group.label;
        group.slots.forEach(t => og.appendChild(new Option(formatTime(t), t)));
        timeInput.appendChild(og);
      });
      if ([...timeInput.options].some(o => o.value === previous)) timeInput.value = previous;
    }
    updateSummary();
  };

  dateInput.addEventListener("change", renderSlots);
  form.addEventListener("change", updateSummary);

  if (stepper && guestsInput) {
    const out = stepper.querySelector("output");
    const [minus, plus] = stepper.querySelectorAll("button");
    const min = Number(guestsInput.min || 1);
    const max = Number(guestsInput.max || 30);
    const sync = function () {
      const v = Number(guestsInput.value);
      out.textContent = v >= max ? `${max}+` : v;
      minus.disabled = v <= min;
      plus.disabled = v >= max;
      updateSummary();
    };
    minus.addEventListener("click", () => { guestsInput.value = Math.max(min, Number(guestsInput.value) - 1); sync(); });
    plus.addEventListener("click", () => { guestsInput.value = Math.min(max, Number(guestsInput.value) + 1); sync(); });
    form.addEventListener("reset-ui", () => { guestsInput.value = 2; sync(); });
    sync();
  }

  form.addEventListener("reset-ui", function () {
    dateInput.value = pickDefaultDate();
    renderSlots();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    let ok = validateForm(form);
    if (!timeInput.value) {
      setError(timeInput, "Please choose a time.");
      ok = false;
    }
    if (!ok) return;

    const data = new FormData(form);
    const lines = [
      `*Table booking request — ${SITE.name}*`,
      "",
      `*Name:* ${data.get("name").trim()}`,
      `*Phone:* ${data.get("phone").trim()}`,
      `*Date:* ${formatDate(parseISODate(data.get("date")))}`,
      `*Time:* ${formatTime(Number(data.get("time")))}`,
      `*Guests:* ${data.get("guests")}`
    ];
    if (data.get("occasion") && data.get("occasion") !== "None") lines.push(`*Occasion:* ${data.get("occasion")}`);
    if (data.get("seating") && data.get("seating") !== "No preference") lines.push(`*Seating:* ${data.get("seating")}`);
    if (data.get("message")?.trim()) lines.push("", `*Requests:* ${data.get("message").trim()}`);
    lines.push("", "Please confirm my table. Thank you!");

    showSuccess(form, openWhatsApp(lines.join("\n")));
  });

  renderSlots();
});
