window.LaptopStore = window.LaptopStore || {};

window.LaptopStore.AccountController = class extends window.LaptopStore.CartController {
  async handleLogin(formData) {
    const payload = await this.apiRequest("/api/accounts/token/", {
      method: "POST",
      body: JSON.stringify({ username: formData.username, password: formData.password })
    });
    if (!payload.access || !payload.refresh) throw new Error("Máy chủ không trả về thông tin phiên hợp lệ.");
    this.state.token = payload.access;
    this.state.refresh = payload.refresh;
    sessionStorage.setItem("laptopstore-access", payload.access);
    sessionStorage.setItem("laptopstore-refresh", payload.refresh);
    let mergeError = null;
    try {
      await this.mergeGuestCart();
    } catch (error) {
      mergeError = error;
    }
    await this.loadProfile();
    this.showToast("Đăng nhập thành công.", "success");
    if (mergeError) this.showToast(`Chưa thể gộp giỏ hàng: ${mergeError.message}. Giỏ tạm vẫn được giữ.`, "error");
    if (this.state.pendingCheckout) {
      this.state.pendingCheckout = false;
      this.closeDialog("#account-modal");
      this.openDialog("#checkout-modal");
    }
  }

  async mergeGuestCart() {
    if (!this.state.guestCart.length) return;
    await this.apiRequest("/api/cart/merge", {
      method: "POST",
      body: JSON.stringify({ items: this.state.guestCart })
    });
    this.storeGuestCart([]);
  }

  setAccountMode(mode) {
    this.state.accountMode = mode;
    const register = mode === "register";
    document.querySelectorAll(".account-tab").forEach((tab) => tab.classList.toggle("account-tab--active", tab.dataset.accountMode === mode));
    document.querySelector("#email-field").hidden = !register;
    document.querySelector("#account-email").required = register;
    document.querySelector("#account-password").autocomplete = register ? "new-password" : "current-password";
    document.querySelector("#account-title").innerHTML = register ? "Tạo tài khoản" : "Đăng nhập";
    document.querySelector("#account-subtitle").textContent = register ? "Nhập thông tin để tạo tài khoản." : "Đăng nhập để tiếp tục.";
    document.querySelector(".account-submit").innerHTML = register ? "Tạo tài khoản <span>→</span>" : "Đăng nhập <span>→</span>";
    document.querySelector("#account-message").textContent = "";
    document.querySelector("#account-message").classList.remove("is-success");
  }

  setFormMessage(selector, message, success = false) {
    const element = document.querySelector(selector);
    element.textContent = message;
    element.classList.toggle("is-success", success);
  }

  async loadProfile() {
    if (!this.state.token) return;
    try {
      this.state.profile = await this.apiRequest("/api/accounts/profile/");
      document.querySelector("#account-form").hidden = true;
      document.querySelector("#account-tabs").hidden = true;
      document.querySelector("#account-profile").hidden = false;
      document.querySelector("#account-title").textContent = `Xin chào ${this.state.profile.first_name || this.state.profile.username || ""}`;
      document.querySelector("#account-subtitle").textContent = this.state.profile.email || "Hồ sơ tài khoản";
      document.querySelector("#profile-first-name").value = this.state.profile.first_name || "";
      document.querySelector("#profile-last-name").value = this.state.profile.last_name || "";
      document.querySelector("#profile-email").value = this.state.profile.email || "";
      document.querySelector("#account-button").setAttribute("aria-label", `Tài khoản ${this.state.profile.username || ""}`);
    } catch (error) {
      if (error.message.includes("401") || error.message.toLocaleLowerCase("vi").includes("token")) {
        this.clearSession();
        this.setFormMessage("#account-message", "Phiên đã hết hạn. Vui lòng đăng nhập lại.");
      } else {
        this.showToast(`Không tải được hồ sơ: ${error.message}`, "error");
      }
    }
  }

  clearSession() {
    this.state.token = null;
    this.state.refresh = null;
    this.state.profile = null;
    sessionStorage.removeItem("laptopstore-access");
    sessionStorage.removeItem("laptopstore-refresh");
    document.querySelector("#account-form").hidden = false;
    document.querySelector("#account-tabs").hidden = false;
    document.querySelector("#account-profile").hidden = true;
  }

  openAccount() {
    this.openDialog("#account-modal");
    if (this.state.token) this.loadProfile();
  }

  async submitAccount(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const submit = form.querySelector(".account-submit");
    this.setBusy(submit, true, this.state.accountMode === "register" ? "Đang tạo tài khoản…" : "Đang đăng nhập…");
    try {
      if (this.state.accountMode === "register") {
        await this.apiRequest("/api/accounts/register/", {
          method: "POST",
          body: JSON.stringify({ username: data.username, email: data.email, password: data.password })
        });
        this.setAccountMode("login");
        document.querySelector("#account-username").value = data.username;
        this.setFormMessage("#account-message", "Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.", true);
      } else {
        await this.handleLogin(data);
      }
    } catch (error) {
      this.setFormMessage("#account-message", error.message);
    } finally {
      this.setBusy(submit, false);
      submit.innerHTML = this.state.accountMode === "register" ? "Tạo tài khoản <span>→</span>" : "Đăng nhập <span>→</span>";
    }
  }

  async saveProfile(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    this.setBusy(button, true, "Đang lưu…");
    try {
      const response = await this.apiRequest("/api/accounts/profile/", { method: "PATCH", body: JSON.stringify(data) });
      this.state.profile = response.user || { ...this.state.profile, ...data };
      this.setFormMessage("#profile-message", response.message || "Đã cập nhật hồ sơ.", true);
    } catch (error) {
      this.setFormMessage("#profile-message", error.message);
    } finally {
      this.setBusy(button, false);
    }
  }

  async changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const data = Object.fromEntries(new FormData(form).entries());
    this.setBusy(button, true, "Đang cập nhật…");
    try {
      const response = await this.apiRequest("/api/accounts/change-password/", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      this.setFormMessage("#password-message", response.message || "Đã đổi mật khẩu.", true);
    } catch (error) {
      this.setFormMessage("#password-message", error.message);
    } finally {
      this.setBusy(button, false);
    }
  }

  async logout() {
    try {
      if (this.state.refresh) {
        await this.apiRequest("/api/accounts/logout/", {
          method: "POST",
          body: JSON.stringify({ refresh: this.state.refresh })
        });
      }
      this.clearSession();
      this.state.cartItems = [];
      this.state.cartTotal = null;
      this.showToast("Đã đăng xuất.", "success");
      this.closeDialog("#account-modal");
    } catch (error) {
      this.showToast(`Không thể xác nhận đăng xuất: ${error.message}`, "error");
    }
  }
};
