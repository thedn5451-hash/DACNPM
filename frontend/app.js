window.LaptopStore.App = class App extends window.LaptopStore.OrderController {
  bindEvents() {
    let searchTimer;
    document.querySelector("#search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const query = document.querySelector("#search-input").value.trim();
      this.state.query = query;
      this.navigate(query ? "search" : "laptops", query);
    });
    document.querySelector("#search-input").addEventListener("input", (event) => {
      this.state.query = event.target.value.trim();
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        this.navigate(this.state.query ? "search" : "laptops", this.state.query, { scroll: false, replace: true });
      }, 350);
    });
    document.querySelector("#search-input").addEventListener("focus", () => {
      if (window.innerWidth <= 767) document.querySelector(".header-search").classList.add("is-open");
    });
    document.querySelector(".search-icon").addEventListener("click", () => {
      if (window.innerWidth <= 767) {
        document.querySelector(".header-search").classList.add("is-open");
        document.querySelector("#search-input").focus();
      }
    });
    document.querySelector("#search-form").addEventListener("click", (event) => {
      if (event.target.closest(".search-icon") && window.innerWidth > 767) {
        document.querySelector("#search-input").focus();
      }
    });
    document.addEventListener("click", (event) => {
      const routeLink = event.target.closest("[data-route]");
      if (routeLink) {
        event.preventDefault();
        const route = routeLink.dataset.route;
        this.navigate(route, route === "search" ? this.state.query : "");
        document.querySelector("#main-nav").classList.remove("is-open");
        return;
      }
      if (event.target.closest("[data-open-account]")) {
        event.preventDefault();
        this.openAccount();
        return;
      }
      if (event.target.closest("[data-open-orders]")) {
        event.preventDefault();
        this.openOrders();
        return;
      }
      if (!event.target.closest(".header-search") && window.innerWidth <= 767) {
        document.querySelector(".header-search").classList.remove("is-open");
      }
    });

    document.querySelector("#sort-select").addEventListener("change", (event) => {
      this.state.sort = event.target.value;
      this.loadProducts();
    });
    document.querySelector("#filter-options").addEventListener("change", (event) => {
      const input = event.target.closest("[data-filter-field]");
      if (!input) return;
      const field = input.dataset.filterField;
      const selected = [...document.querySelectorAll(`[data-filter-field="${CSS.escape(field)}"]:checked`)].map((item) => item.value);
      this.setFilter(field, selected.join("|"));
    });
    document.querySelector("#filter-options").addEventListener("click", (event) => {
      if (event.target.id !== "apply-price-filter") return;
      const min = document.querySelector("#filter-min-price");
      const max = document.querySelector("#filter-max-price");
      if ((min && min.value && Number(min.value) < 0) || (max && max.value && Number(max.value) < 0)) {
        this.showToast("Giá lọc không được là số âm.", "error");
        return;
      }
      if (min && max && min.value && max.value && Number(min.value) > Number(max.value)) {
        this.showToast("Giá tối thiểu không thể lớn hơn giá tối đa.", "error");
        return;
      }
      if (min) this.setFilter("min_price", min.value);
      if (max) this.setFilter("max_price", max.value);
      if (!min && max) this.loadProducts();
    });
    document.querySelector("#filter-options").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("input[type=number]")) {
        event.preventDefault();
        document.querySelector("#apply-price-filter").click();
      }
    });
    document.querySelector("#active-filters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-filter]");
      if (!button) return;
      delete this.state.filters[button.dataset.removeFilter];
      this.loadProducts();
    });
    document.querySelector("#clear-filters").addEventListener("click", this.clearFilters.bind(this));
    document.querySelector("#empty-reset").addEventListener("click", this.clearFilters.bind(this));
    document.querySelector("#category-grid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      const categoryField = this.state.filterFields.find((entry) =>
        (typeof entry === "string" ? entry : entry.name || entry.key)?.toLowerCase().startsWith("categor")
      );
      if (!categoryField) {
        this.navigate("laptops");
        this.showToast("API chưa hỗ trợ lọc theo danh mục.", "error");
        return;
      }
      const field = typeof categoryField === "string" ? categoryField : categoryField.name || categoryField.key;
      this.state.filters[field] = button.dataset.category;
      this.navigate("laptops", "");
    });
    this.productGrid.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-add-cart]");
      if (addButton) {
        event.preventDefault();
        this.addToCart(addButton.dataset.addCart);
        return;
      }
      const productLink = event.target.closest("[data-product]");
      if (productLink) {
        event.preventDefault();
        this.openProduct(productLink.dataset.product, { pushRoute: true });
      }
    });
    document.querySelector("#product-modal-content").addEventListener("click", (event) => {
      const retry = event.target.closest("[data-retry-product]");
      if (retry) {
        this.openProduct(retry.dataset.retryProduct);
        return;
      }
      const imageButton = event.target.closest("[data-image-index]");
      if (imageButton && this.state.detail) {
        const image = this.state.detail.images[Number(imageButton.dataset.imageIndex)];
        const main = document.querySelector(".product-main-image");
        if (main) {
          main.src = image || this.fallbackImage;
          main.alt = `${this.state.detail.name}, ảnh ${Number(imageButton.dataset.imageIndex) + 1}`;
        }
        return;
      }
      const addButton = event.target.closest("[data-add-detail]");
      if (addButton && this.state.detail) {
        const cartId = this.state.selectedVariant?.id ?? this.state.selectedVariant?.product_id ?? this.state.detail.id;
        this.addToCart(cartId);
      }
    });
    document.querySelector("#product-modal-content").addEventListener("change", (event) => {
      if (event.target.id !== "variant-select" || !this.state.detail) return;
      this.state.selectedVariant = this.state.detail.variants.find((variant, index) => String(variant.id ?? variant.product_id ?? index) === event.target.value) || null;
      this.renderProductDetail();
    });

    document.querySelector("#cart-button").addEventListener("click", this.openCart.bind(this));
    document.querySelector("#cart-items").addEventListener("click", (event) => {
      const quantityButton = event.target.closest("[data-cart-quantity]");
      if (quantityButton) {
        const product = this.state.cartItems.find((item) => item.product.id === quantityButton.dataset.id);
        if (!product) return;
        const next = product.quantity + Number(quantityButton.dataset.cartQuantity);
        if (next > 0 && product.product.stock !== null && next > product.product.stock) {
          this.showToast("Số lượng vượt quá tồn kho hiện tại.", "error");
          return;
        }
        this.updateCartItem(product.product.id, next);
        return;
      }
      const remove = event.target.closest("[data-remove-cart]");
      if (remove) this.updateCartItem(remove.dataset.removeCart, 0);
    });
    document.querySelector("#checkout-button").addEventListener("click", this.openCheckout.bind(this));
    document.querySelector("#clear-cart-button").addEventListener("click", this.clearCart.bind(this));
    document.querySelector("#retry-cart").addEventListener("click", this.loadCart.bind(this));
    document.querySelector("#retry-products").addEventListener("click", () => this.loadProducts());
    document.querySelector("#load-more").addEventListener("click", () => {
      this.state.page += 1;
      this.loadProducts({ append: true });
    });
    document.querySelector("#account-button").addEventListener("click", this.openAccount.bind(this));
    document.querySelector("#mobile-account-link").addEventListener("click", this.openAccount.bind(this));
    document.querySelectorAll("[data-account-mode]").forEach((button) => button.addEventListener("click", () => this.setAccountMode(button.dataset.accountMode)));
    document.querySelector("#account-form").addEventListener("submit", this.submitAccount.bind(this));
    document.querySelector("#profile-form").addEventListener("submit", this.saveProfile.bind(this));
    document.querySelector("#password-form").addEventListener("submit", this.changePassword.bind(this));
    document.querySelector("#logout-button").addEventListener("click", this.logout.bind(this));
    document.querySelector("#view-orders-button").addEventListener("click", this.openOrders.bind(this));
    document.querySelector("#checkout-form").addEventListener("submit", this.submitOrder.bind(this));
    document.querySelector("#orders-content").addEventListener("click", (event) => {
      if (event.target.id === "retry-orders") {
        this.loadOrders();
        return;
      }
      const orderButton = event.target.closest("[data-order-id]");
      if (orderButton) this.loadOrderDetail(orderButton.dataset.orderId, orderButton);
    });
    document.querySelectorAll("[data-close-drawer]").forEach((button) => button.addEventListener("click", this.closeCart.bind(this)));
    document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => {
      this.closeDialog("#product-modal");
      if (this.currentRoute() === "detail") {
        history.pushState({}, "", this.routeUrl("laptops"));
        this.applyRoute();
      }
    }));
    document.querySelectorAll("[data-close-account]").forEach((button) => button.addEventListener("click", () => this.closeDialog("#account-modal")));
    document.querySelectorAll("[data-close-checkout]").forEach((button) => button.addEventListener("click", () => this.closeDialog("#checkout-modal")));
    document.querySelectorAll("[data-close-orders]").forEach((button) => button.addEventListener("click", () => this.closeDialog("#orders-modal")));
    document.querySelector("#mobile-filter-button").addEventListener("click", () => {
      document.querySelector("#filter-panel").classList.add("is-open");
      this.showOverlay();
    });
    document.querySelector("#mobile-menu-button").addEventListener("click", (event) => {
      const isOpen = document.querySelector("#main-nav").classList.toggle("is-open");
      event.currentTarget.setAttribute("aria-expanded", String(isOpen));
    });
    document.querySelectorAll(".main-nav__link:not(.mobile-account-link)").forEach((link) => link.addEventListener("click", () => {
      document.querySelector("#main-nav").classList.remove("is-open");
      document.querySelector("#mobile-menu-button").setAttribute("aria-expanded", "false");
    }));
    this.overlay.addEventListener("click", () => {
      this.closeCart();
      for (const selector of ["#product-modal", "#account-modal", "#checkout-modal", "#orders-modal"]) this.closeDialog(selector);
      document.querySelector("#filter-panel").classList.remove("is-open");
      this.updateOverlay();
    });
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.querySelector("#search-input");
        input.closest(".header-search").classList.add("is-open");
        input.focus();
      }
      if (event.key === "Escape") {
        this.closeCart();
        for (const selector of ["#product-modal", "#account-modal", "#checkout-modal", "#orders-modal"]) this.closeDialog(selector);
        document.querySelector("#filter-panel").classList.remove("is-open");
        document.querySelector("#main-nav").classList.remove("is-open");
        this.updateOverlay();
      }
    });
    window.addEventListener("popstate", () => {
      const route = this.currentRoute();
      const params = new URLSearchParams(location.search);
      this.state.query = params.get("q") || "";
      if (route === "detail" && location.protocol !== "file:") {
        document.querySelector("#products").hidden = true;
        document.querySelector("#home").hidden = true;
        document.querySelector("#categories").hidden = true;
        document.querySelector("#catalog-callout").hidden = true;
        this.openProduct(decodeURIComponent(location.pathname.split("/").filter(Boolean).pop()), { pushRoute: false });
      } else {
        this.closeDialog("#product-modal");
        this.applyRoute();
      }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".header-search") && window.innerWidth <= 767) {
        document.querySelector(".header-search").classList.remove("is-open");
      }
    });
  }

  start() {
    this.bindEvents();
    if (this.state.token) document.querySelector("#account-button").classList.add("is-signed-in");
    this.applyRoute();
    if (this.state.token) this.loadProfile();
  }
};

new window.LaptopStore.App().start();
