window.LaptopStore = window.LaptopStore || {};

window.LaptopStore.Core = class {
  constructor() {
    this.services = window.LaptopStoreServices;
    this.state = {
      query: new URLSearchParams(location.search).get("q") || "",
      filters: {},
      filterFields: [],
      sortOptions: [{ value: "relevance", label: "Liên quan" }],
      sort: "relevance",
      page: 1,
      products: [],
      count: null,
      hasMore: false,
      requestId: 0,
      controller: null,
      detailController: null,
      detail: null,
      selectedVariant: null,
      token: sessionStorage.getItem("laptopstore-access"),
      refresh: sessionStorage.getItem("laptopstore-refresh"),
      profile: null,
      accountMode: "login",
      guestCart: this.readStorage("guest_cart", []),
      cartItems: [],
      cartTotal: null,
      cartLoading: false,
      pendingCheckout: false,
      orderRequestId: 0
    };

    this.productGrid = document.querySelector("#product-grid");
    this.overlay = document.querySelector("#overlay");
    this.cartDrawer = document.querySelector("#cart-drawer");
    this.toastRegion = document.querySelector("#toast-region");
    this.fallbackImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23f2eee8'/%3E%3Crect x='165' y='112' width='310' height='185' rx='12' fill='%23ddd5cc'/%3E%3Cpath d='M125 322h390l-25 24H150z' fill='%23c9c0b7'/%3E%3Ctext x='320' y='220' text-anchor='middle' fill='%238c837a' font-family='sans-serif' font-size='20'%3ECh%C6%B0a c%C3%B3 h%C3%ACnh %E1%BA%A3nh%3C/text%3E%3C/svg%3E";
  }

  readStorage(key, fallback) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  }

  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  formatPrice(price) {
    return new Intl.NumberFormat("vi-VN").format(price) + "₫";
  }

  showToast(message, type = "") {
    const toast = document.createElement("div");
    toast.className = `toast${type ? ` toast--${type}` : ""}`;
    toast.textContent = message;
    this.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3500);
  }

  setBusy(element, busy, label) {
    if (!element) return;
    if (busy) {
      element.dataset.previousLabel = element.textContent;
      element.disabled = true;
      element.textContent = label;
    } else {
      element.disabled = false;
      if (element.dataset.previousLabel) element.textContent = element.dataset.previousLabel;
      delete element.dataset.previousLabel;
    }
  }

  apiUrl(path) {
    return `${this.services.apiBase}${path}`;
  }

  authHeaders() {
    return this.state.token ? { Authorization: `Bearer ${this.state.token}` } : {};
  }

  async apiRequest(path, options = {}) {
    const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...this.authHeaders(), ...(options.headers || {}) };
    try {
      return await this.services.readJson(this.apiUrl(path), { ...options, headers });
    } catch (error) {
      if (error.status === 401 && this.state.token) {
        this.clearSession();
        this.showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "error");
      }
      throw error;
    }
  }
};
