window.LaptopStore = window.LaptopStore || {};

window.LaptopStore.CartController = class extends window.LaptopStore.CatalogController {
  cartCount(items = this.state.cartItems) {
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  normalizeCartResponse(payload) {
    payload = payload?.data ?? payload;
    const rawItems = Array.isArray(payload) ? payload : payload.items || payload.cart_items || payload.results || [];
    if (!Array.isArray(rawItems)) throw new Error("Dữ liệu giỏ hàng không hợp lệ.");
    const items = rawItems.map((item) => {
      const productRaw = item.product && typeof item.product === "object" ? item.product : item;
      const product = this.services.normalizeProduct({
        ...productRaw,
        id: item.product_id ?? item.productId ?? productRaw.id,
        name: item.product_name ?? item.name ?? productRaw.name,
        price: item.unit_price ?? item.price ?? productRaw.price,
        image: item.image_url ?? productRaw.image_url ?? productRaw.image,
        stock: item.stock ?? productRaw.stock
      });
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Số lượng trong giỏ hàng không hợp lệ.");
      return {
        product,
        quantity,
        lineTotal: Number(item.subtotal ?? item.line_total ?? item.total_price)
      };
    });
    const total = payload.total_amount ?? payload.total ?? payload.subtotal;
    return { items, total: Number.isFinite(Number(total)) ? Number(total) : null };
  }

  storeGuestCart(items) {
    this.state.guestCart = items;
    localStorage.setItem("guest_cart", JSON.stringify(items));
  }

  async previewGuestCart(items) {
    if (items.length === 0) return { items: [], total: 0 };
    const payload = await this.apiRequest("/api/cart/preview", {
      method: "POST",
      body: JSON.stringify({ items })
    });
    return this.normalizeCartResponse(payload);
  }

  renderCart() {
    const quantity = this.cartCount();
    document.querySelector("#cart-count").textContent = quantity;
    document.querySelector("#drawer-cart-count").textContent = `(${quantity})`;
    document.querySelector("#cart-loading").hidden = !this.state.cartLoading;
    const items = document.querySelector("#cart-items");
    items.innerHTML = this.state.cartItems.map(({ product, quantity: amount, lineTotal }) => {
      const linePrice = Number.isFinite(lineTotal) ? this.formatPrice(lineTotal) : "Thành tiền chưa có dữ liệu";
      return `<div class="cart-item">
        ${this.renderImage(product.images[0], product.name)}
        <div class="cart-item__info"><strong>${this.escapeHtml(product.name)}</strong><span>${linePrice}</span>
          <div class="quantity-control"><button data-cart-quantity="-1" data-id="${this.escapeHtml(product.id)}" aria-label="Giảm số lượng">−</button>
          <span>${amount}</span><button data-cart-quantity="1" data-id="${this.escapeHtml(product.id)}" aria-label="Tăng số lượng">+</button></div>
          ${product.stock !== null ? `<small class="cart-stock">Tồn kho hiện tại: ${product.stock}</small>` : ""}
        </div><button class="cart-remove" data-remove-cart="${this.escapeHtml(product.id)}" aria-label="Xóa ${this.escapeHtml(product.name)}">×</button>
      </div>`;
    }).join("");
    this.setImageFallbacks(items);
    document.querySelector("#cart-empty").hidden = items.length > 0 || this.state.cartLoading;
    document.querySelector("#cart-summary").hidden = items.length === 0 || this.state.cartTotal === null;
    document.querySelector("#cart-total").textContent = this.state.cartTotal === null ? "" : this.formatPrice(this.state.cartTotal);
  }

  async loadCart() {
    this.state.cartLoading = true;
    document.querySelector("#cart-error").hidden = true;
    this.renderCart();
    try {
      const cart = this.state.token
        ? this.normalizeCartResponse(await this.apiRequest("/api/cart"))
        : await this.previewGuestCart(this.state.guestCart);
      this.state.cartItems = cart.items;
      this.state.cartTotal = cart.total;
      this.state.cartLoading = false;
      this.renderCart();
    } catch (error) {
      this.state.cartLoading = false;
      this.state.cartItems = [];
      this.state.cartTotal = null;
      this.renderCart();
      document.querySelector("#cart-error").hidden = false;
      document.querySelector("#cart-error-message").textContent = error.message;
    }
  }

  async addToCart(id) {
    const button = document.querySelector(`[data-add-cart="${CSS.escape(id)}"]`);
    if (button) this.setBusy(button, true, "Đang kiểm tra…");
    try {
      if (this.state.token) {
        await this.apiRequest("/api/cart/items", {
          method: "POST",
          body: JSON.stringify({ productId: id, quantity: 1 })
        });
      } else {
        const current = this.state.guestCart.find((item) => String(item.productId) === String(id));
        const updated = current
          ? this.state.guestCart.map((item) => item === current ? { ...item, quantity: item.quantity + 1 } : item)
          : [...this.state.guestCart, { productId: id, quantity: 1 }];
        const preview = await this.previewGuestCart(updated);
        const previewItem = preview.items.find((item) => item.product.id === String(id));
        if (!previewItem) throw new Error("Sản phẩm không còn trong danh sách mua được.");
        if (previewItem.product.stock !== null && previewItem.quantity > previewItem.product.stock) {
          throw new Error("Số lượng vượt quá tồn kho hiện tại.");
        }
        this.storeGuestCart(updated);
      }
      await this.loadCart();
      this.showToast("Đã thêm sản phẩm vào giỏ.", "success");
    } catch (error) {
      this.showToast(error.message, "error");
    } finally {
      if (button && button.isConnected) this.setBusy(button, false);
    }
  }

  async updateCartItem(id, quantity) {
    try {
      if (this.state.token) {
        if (quantity <= 0) await this.apiRequest(`/api/cart/items/${encodeURIComponent(id)}`, { method: "DELETE" });
        else await this.apiRequest(`/api/cart/items/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ quantity })
        });
      } else {
        const updated = this.state.guestCart
          .map((item) => String(item.productId) === String(id) ? { ...item, quantity } : item)
          .filter((item) => item.quantity > 0);
        await this.previewGuestCart(updated);
        this.storeGuestCart(updated);
      }
      await this.loadCart();
    } catch (error) {
      this.showToast(error.message, "error");
      await this.loadCart();
    }
  }

  async clearCart() {
    const button = document.querySelector("#clear-cart-button");
    this.setBusy(button, true, "Đang xóa…");
    try {
      if (this.state.token) await this.apiRequest("/api/cart", { method: "DELETE" });
      this.storeGuestCart([]);
      await this.loadCart();
    } catch (error) {
      this.showToast(error.message, "error");
    } finally {
      if (button.isConnected) this.setBusy(button, false);
    }
  }

  showOverlay() {
    this.overlay.hidden = false;
    document.body.classList.add("is-locked");
  }

  isAnyPanelOpen() {
    return this.cartDrawer.classList.contains("is-open")
      || [...document.querySelectorAll(".product-modal,.account-modal,.checkout-modal,.orders-modal")].some((element) => !element.hidden)
      || document.querySelector("#filter-panel").classList.contains("is-open");
  }

  updateOverlay() {
    this.overlay.hidden = !this.isAnyPanelOpen();
    document.body.classList.toggle("is-locked", this.isAnyPanelOpen());
  }

  openCart() {
    this.cartDrawer.classList.add("is-open");
    this.cartDrawer.setAttribute("aria-hidden", "false");
    this.showOverlay();
    this.loadCart();
  }

  closeCart() {
    this.cartDrawer.classList.remove("is-open");
    this.cartDrawer.setAttribute("aria-hidden", "true");
    this.updateOverlay();
  }

  openDialog(selector) {
    document.querySelector(selector).hidden = false;
    this.showOverlay();
  }

  closeDialog(selector) {
    document.querySelector(selector).hidden = true;
    this.updateOverlay();
  }
};
