'use strict';

/**
 * MENU PAGE ENHANCEMENTS
 * Search, veg / non-veg filter, category scroll-spy and a WhatsApp order cart.
 * Reads the dishes already in menu.html, so adding a dish there is all it takes.
 * Depends on pages.js (SITE, openWhatsApp, formatINR, validateForm, setError).
 */

(function () {

  const cards = [...document.querySelectorAll(".menu-dish-card")];
  if (!cards.length) return;

  const CART_KEY = "itf-cart-v1";
  const dishes = new Map();
  const slugify = s => s.toLowerCase().replace(/&amp;|&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ---------- Read dishes + decorate cards ---------- */

  cards.forEach(function (card) {
    const li = card.closest("li");
    const block = card.closest(".menu-category-block");
    const titleEl = card.querySelector(".menu-dish-title");
    const name = titleEl.textContent.trim();
    const price = parseFloat(card.querySelector(".menu-dish-price").textContent.replace(/[^\d.]/g, "")) || 0;
    const desc = card.querySelector(".menu-dish-desc")?.textContent || "";
    const badge = card.querySelector(".menu-dish-badge")?.textContent || "";
    const isVeg = block?.id === "veg" || /\b(veg|paneer)\b/i.test(name);

    let id = slugify(name);
    while (dishes.has(id)) id += "-x";
    dishes.set(id, { id, name, price });

    li.dataset.dish = id;
    li.dataset.diet = isVeg ? "veg" : "nonveg";
    li.dataset.search = `${name} ${desc} ${badge}`.toLowerCase();

    titleEl.insertAdjacentHTML("afterbegin",
      `<span class="diet-mark ${isVeg ? "veg" : "nonveg"}" role="img" aria-label="${isVeg ? "Vegetarian" : "Non-vegetarian"}"></span>`);

    const callLink = card.querySelector(".menu-dish-action");
    const actions = document.createElement("div");
    actions.className = "menu-dish-actions";
    if (callLink) {
      callLink.querySelector("span").textContent = "Call to Order";
      callLink.replaceWith(actions);
      actions.appendChild(callLink);
    } else {
      card.querySelector(".menu-dish-info").appendChild(actions);
    }
    const control = document.createElement("div");
    control.dataset.cartControl = id;
    actions.appendChild(control);
  });

  /* ---------- Toolbar: search + diet filter ---------- */

  const stickyContainer = document.querySelector(".menu-nav-sticky .container");
  stickyContainer.insertAdjacentHTML("afterbegin", `
    <div class="menu-tools">
      <label class="menu-search">
        <ion-icon name="search-outline" aria-hidden="true"></ion-icon>
        <input type="search" placeholder="Search dishes — e.g. prawns, paneer, soup" aria-label="Search dishes" data-menu-search>
      </label>
      <div class="diet-filter" role="group" aria-label="Filter by diet">
        <button type="button" data-diet="all" aria-pressed="true">All</button>
        <button type="button" data-diet="veg" aria-pressed="false"><span class="diet-mark veg" aria-hidden="true"></span>Veg</button>
        <button type="button" data-diet="nonveg" aria-pressed="false"><span class="diet-mark nonveg" aria-hidden="true"></span>Non-Veg</button>
      </div>
    </div>`);

  const blocks = [...document.querySelectorAll(".menu-category-block")];
  const navLinks = [...document.querySelectorAll(".menu-nav-link")];
  const searchInput = document.querySelector("[data-menu-search]");
  const dietButtons = [...document.querySelectorAll("[data-diet]")];
  let diet = "all";

  const lastBlock = blocks[blocks.length - 1];
  lastBlock.insertAdjacentHTML("afterend", `
    <div class="menu-empty" data-menu-empty role="status">
      <ion-icon name="restaurant-outline" aria-hidden="true"></ion-icon>
      <p class="title-2" style="font-family: var(--fontFamily-forum); color: var(--white);">No dishes found</p>
      <p>Try another search, or <button type="button" class="link" style="color: var(--gold-crayola); text-decoration: underline;" data-menu-reset>show the full menu</button>.</p>
    </div>`);
  const emptyState = document.querySelector("[data-menu-empty]");

  const applyFilters = function () {
    const q = searchInput.value.trim().toLowerCase();
    let total = 0;

    blocks.forEach(function (block) {
      let visible = 0;
      block.querySelectorAll("li[data-dish]").forEach(function (li) {
        const show = (diet === "all" || li.dataset.diet === diet) && (!q || li.dataset.search.includes(q));
        li.hidden = !show;
        if (show) visible++;
      });
      block.hidden = visible === 0;
      const link = navLinks.find(a => a.getAttribute("href") === `#${block.id}`);
      if (link) link.hidden = visible === 0;
      total += visible;
    });

    emptyState.classList.toggle("show", total === 0);
    updateActiveLink();
  };

  let searchTimer;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 120);
  });

  dietButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      diet = btn.dataset.diet;
      dietButtons.forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      applyFilters();
    });
  });

  document.querySelector("[data-menu-reset]").addEventListener("click", function () {
    searchInput.value = "";
    dietButtons[0].click();
  });

  /* ---------- Category nav: smooth scroll + scroll-spy ---------- */

  const stickyNav = document.querySelector(".menu-nav-sticky");
  const navScroll = document.querySelector(".menu-nav-scroll");
  const offset = () => stickyNav.getBoundingClientRect().height + 110;

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - offset() + 20;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  function updateActiveLink() {
    const visibleBlocks = blocks.filter(b => !b.hidden);
    let current = visibleBlocks[0];
    visibleBlocks.forEach(function (block) {
      if (block.getBoundingClientRect().top - offset() <= 0) current = block;
    });
    navLinks.forEach(function (link) {
      const active = current && link.getAttribute("href") === `#${current.id}`;
      if (active && !link.classList.contains("active")) {
        navScroll.scrollTo({ left: link.offsetLeft - navScroll.clientWidth / 2 + link.clientWidth / 2, behavior: "smooth" });
      }
      link.classList.toggle("active", Boolean(active));
    });
  }

  let ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { updateActiveLink(); ticking = false; });
  }, { passive: true });

  /* ---------- Cart ---------- */

  let cart = {};
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
    Object.entries(saved).forEach(([id, qty]) => { if (dishes.has(id) && qty > 0) cart[id] = Math.min(qty, 50); });
  } catch (e) { cart = {}; }

  const saveCart = function () {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* storage unavailable */ }
  };

  const cartLines = () => Object.entries(cart).map(([id, qty]) => ({ ...dishes.get(id), qty }));
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = () => cartLines().reduce((sum, l) => sum + l.price * l.qty, 0);

  const setQty = function (id, qty) {
    if (qty <= 0) delete cart[id];
    else cart[id] = Math.min(qty, 50);
    saveCart();
    renderCart();
  };

  const qtyControlHTML = (id, qty, name) => `
    <div class="qty-control" role="group" aria-label="Quantity of ${name}">
      <button type="button" data-qty="${id}" data-delta="-1" aria-label="Remove one ${name}"><ion-icon name="remove-outline" aria-hidden="true"></ion-icon></button>
      <output aria-live="polite">${qty}</output>
      <button type="button" data-qty="${id}" data-delta="1" aria-label="Add one more ${name}"><ion-icon name="add-outline" aria-hidden="true"></ion-icon></button>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", `
    <button type="button" class="cart-fab" data-cart-open aria-label="View your order">
      <span class="cart-count" data-cart-count>0</span>
      <span data-cart-fab-total>₹0</span>
      <span class="cart-cta">View Order</span>
    </button>
    <div class="cart-overlay" data-cart-close></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true" data-cart-drawer>
      <div class="cart-head">
        <h2 id="cart-title">Your Order</h2>
        <button type="button" class="cart-close" data-cart-close aria-label="Close order"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
      </div>
      <div class="cart-body">
        <ul class="cart-items" data-cart-items></ul>
        <form data-order-form novalidate>
          <div class="field">
            <label for="o-name">Your Name</label>
            <input id="o-name" name="name" type="text" class="input-field" autocomplete="name" placeholder="e.g. Rahul Patel" data-validate="name">
          </div>
          <div class="field">
            <label for="o-phone">Mobile Number</label>
            <input id="o-phone" name="phone" type="tel" class="input-field" autocomplete="tel" inputmode="tel" placeholder="98765 43210" data-validate="phone">
          </div>
          <div class="field">
            <span class="field-label">Order Type</span>
            <div class="chip-group">
              <input type="radio" name="type" id="ot-take" value="Takeaway" checked><label for="ot-take">Takeaway</label>
              <input type="radio" name="type" id="ot-dine" value="Dine-in (pre-order)"><label for="ot-dine">Dine-in pre-order</label>
            </div>
          </div>
          <div class="field">
            <label for="o-note">Note for the kitchen <span class="optional">(optional)</span></label>
            <textarea id="o-note" name="note" class="input-field" placeholder="Spice level, pickup time…"></textarea>
          </div>
        </form>
      </div>
      <div class="cart-foot">
        <div class="cart-total"><span>Total</span><span data-cart-total>₹0</span></div>
        <p class="form-note">Prices as per menu. Final bill confirmed by the restaurant.</p>
        <button type="button" class="btn btn-secondary" data-cart-send>
          <span class="text text-1"><ion-icon name="logo-whatsapp" aria-hidden="true"></ion-icon>Send Order on WhatsApp</span>
          <span class="text text-2" aria-hidden="true">Send Order</span>
        </button>
        <button type="button" class="cart-clear" data-cart-clear>Clear order</button>
      </div>
    </aside>`);

  const fab = document.querySelector("[data-cart-open]");
  const drawer = document.querySelector("[data-cart-drawer]");
  const overlayEl = document.querySelector(".cart-overlay");
  const itemsEl = document.querySelector("[data-cart-items]");
  const orderForm = document.querySelector("[data-order-form]");

  function renderCart() {
    document.querySelectorAll("[data-cart-control]").forEach(function (el) {
      const id = el.dataset.cartControl;
      const { name } = dishes.get(id);
      el.innerHTML = cart[id]
        ? qtyControlHTML(id, cart[id], name)
        : `<button type="button" class="add-btn" data-qty="${id}" data-delta="1" aria-label="Add ${name} to order">Add <ion-icon name="add-outline" aria-hidden="true"></ion-icon></button>`;
    });

    const lines = cartLines();
    itemsEl.innerHTML = lines.length
      ? lines.map(l => `
          <li class="cart-item">
            <div>
              <p class="cart-item-name">${l.name}</p>
              <p class="cart-item-price">${formatINR(l.price)} each</p>
            </div>
            <p class="cart-item-total">${formatINR(l.price * l.qty)}</p>
            ${qtyControlHTML(l.id, l.qty, l.name)}
          </li>`).join("")
      : `<li class="cart-empty">Your order is empty.<br>Add dishes from the menu to get started.</li>`;

    const count = cartCount();
    document.querySelector("[data-cart-count]").textContent = count;
    document.querySelector("[data-cart-fab-total]").textContent = formatINR(cartTotal());
    document.querySelector("[data-cart-total]").textContent = formatINR(cartTotal());
    fab.classList.toggle("show", count > 0);
    orderForm.hidden = count === 0;
    document.querySelector("[data-cart-send]").disabled = count === 0;
  }

  document.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-qty]");
    if (!btn) return;
    const id = btn.dataset.qty;
    const delta = btn.dataset.delta;
    const scope = btn.closest("[data-cart-control], .cart-item");
    const inDrawer = Boolean(btn.closest(".cart-drawer"));
    setQty(id, (cart[id] || 0) + Number(delta));
    // re-render replaced the button — put keyboard focus back on its counterpart
    if (scope) {
      const root = inDrawer ? itemsEl : document.querySelector(`[data-cart-control="${id}"]`);
      const next = root?.querySelector(`[data-qty="${id}"][data-delta="${delta}"]`) || root?.querySelector(`[data-qty="${id}"]`);
      next?.focus({ preventScroll: true });
    }
  });

  const openCart = function () {
    drawer.classList.add("show");
    overlayEl.classList.add("show");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-open");
    drawer.querySelector(".cart-close").focus();
  };

  const closeCart = function () {
    drawer.classList.remove("show");
    overlayEl.classList.remove("show");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cart-open");
    fab.focus();
  };

  fab.addEventListener("click", openCart);
  document.querySelectorAll("[data-cart-close]").forEach(el => el.addEventListener("click", closeCart));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && drawer.classList.contains("show")) closeCart(); });

  document.querySelector("[data-cart-clear]").addEventListener("click", function () {
    cart = {};
    saveCart();
    renderCart();
  });

  document.querySelector("[data-cart-send]").addEventListener("click", function () {
    if (!cartCount() || !validateForm(orderForm)) return;
    const data = new FormData(orderForm);
    const lines = [
      `*New order — ${SITE.name}*`,
      "",
      ...cartLines().map(l => `• ${l.qty} × ${l.name} — ${formatINR(l.price * l.qty)}`),
      "",
      `*Total:* ${formatINR(cartTotal())}`,
      `*Order type:* ${data.get("type")}`,
      `*Name:* ${data.get("name").trim()}`,
      `*Phone:* ${data.get("phone").trim()}`
    ];
    if (data.get("note").trim()) lines.push(`*Note:* ${data.get("note").trim()}`);
    lines.push("", "Please confirm my order. Thank you!");
    openWhatsApp(lines.join("\n"));
  });

  renderCart();
  applyFilters();

})();
