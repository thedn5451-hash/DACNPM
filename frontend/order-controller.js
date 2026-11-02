window.LaptopStore = window.LaptopStore || {};

window.LaptopStore.OrderController = class extends window.LaptopStore.AccountController {
  openCheckout() {
    if (!this.state.cartItems.length) {
      this.showToast("Giỏ hàng đang trống.", "error");
      return;
    }
    this.closeCart();
    if (!this.state.token) {
      this.state.pendingCheckout = true;
      this.openAccount();
      this.setFormMessage("#account-message", "Vui lòng đăng nhập trước khi đặt hàng.");
      return;
    }
    this.openDialog("#checkout-modal");
  }

  async submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const data = Object.fromEntries(new FormData(form).entries());
    if (!/^(?:0|\+84)\d{9,10}$/.test(data.phone.replace(/[\s.-]/g, ""))) {
      this.setFormMessage("#checkout-message", "Số điện thoại cần bắt đầu bằng 0 hoặc +84 và có 9–10 chữ số phía sau.");
      return;
    }
    this.setBusy(button, true, "Đang kiểm tra đơn…");
    this.setFormMessage("#checkout-message", "");
    try {
      const response = await this.apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({ ...data, payment_method: "COD" })
      });
      this.closeDialog("#checkout-modal");
      this.closeCart();
      this.storeGuestCart([]);
      this.state.cartItems = [];
      this.state.cartTotal = null;
      form.reset();
      this.showToast(response.message || `Đã gửi đơn hàng ${response.order_id || response.id || ""}.`, "success");
      this.openOrders();
    } catch (error) {
      this.setFormMessage("#checkout-message", error.message);
      if (error.message.includes("409") || error.message.toLocaleLowerCase("vi").includes("tồn kho")) await this.loadCart();
    } finally {
      this.setBusy(button, false);
    }
  }

  openOrders() {
    if (!this.state.token) {
      this.openAccount();
      this.setFormMessage("#account-message", "Vui lòng đăng nhập để xem lịch sử đơn hàng.");
      return;
    }
    this.openDialog("#orders-modal");
    this.loadOrders();
  }

  async loadOrders() {
    const content = document.querySelector("#orders-content");
    content.innerHTML = `<div class="catalog-state"><span class="loading-spinner"></span><span>Đang tải lịch sử đơn hàng…</span></div>`;
    try {
      const response = await this.apiRequest("/api/orders");
      const payload = response?.data ?? response;
      const orders = Array.isArray(payload) ? payload : payload.results || payload.orders || [];
      if (!orders.length) {
        content.innerHTML = `<div class="empty-state"><span>▤</span><h3>Chưa có đơn hàng</h3><p>Đơn hàng sẽ hiển thị tại đây sau khi đặt thành công.</p></div>`;
        return;
      }
      content.innerHTML = `<div class="orders-list">${orders.map((order) => `
        <button class="order-row" data-order-id="${this.escapeHtml(order.id ?? order.order_id)}">
          <span><strong>Đơn #${this.escapeHtml(order.id ?? order.order_id)}</strong><small>${this.escapeHtml(order.created_at || "")}</small></span>
          <span>${this.escapeHtml(order.status || "Chưa có trạng thái")}</span>
          <strong>${Number.isFinite(Number(order.total_amount)) ? this.formatPrice(Number(order.total_amount)) : "Tổng tiền chưa có dữ liệu"}</strong>
        </button>`).join("")}</div>`;
    } catch (error) {
      content.innerHTML = `<div class="catalog-error" role="alert"><p>${this.escapeHtml(error.message)}</p><button class="button button--outline" id="retry-orders">Thử tải lại</button></div>`;
    }
  }

  async loadOrderDetail(id, button) {
    this.setBusy(button, true, "Đang tải…");
    try {
      const order = await this.apiRequest(`/api/orders/${encodeURIComponent(id)}`);
      const lines = (order.items || order.order_items || []).map((item) => `
        <div class="order-detail-item"><span>${this.escapeHtml(item.product_name || item.name || "Sản phẩm")} × ${this.escapeHtml(item.quantity)}</span>
        <strong>${Number.isFinite(Number(item.unit_price)) ? this.formatPrice(Number(item.unit_price)) : "Giá chưa có dữ liệu"}</strong></div>`).join("");
      button.insertAdjacentHTML("afterend", `<div class="order-detail"><p>Địa chỉ: ${this.escapeHtml(order.address || "Chưa có dữ liệu")}</p><p>Thanh toán: ${this.escapeHtml(order.payment_method || "")} · ${this.escapeHtml(order.payment_status || "")}</p>${lines}</div>`);
    } catch (error) {
      this.showToast(error.message, "error");
    } finally {
      this.setBusy(button, false);
    }
  }
};
