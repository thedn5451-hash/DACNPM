window.LaptopStore = window.LaptopStore || {};

window.LaptopStore.Router = class extends window.LaptopStore.Core {
  currentRoute() {
    if (location.protocol === "file:") {
      const page = new URLSearchParams(location.search).get("page");
      return page || "home";
    }
    if (location.pathname.startsWith("/search")) return "search";
    if (location.pathname.startsWith("/laptops/")) return "detail";
    return location.pathname.startsWith("/laptops") ? "laptops" : "home";
  }

  routeUrl(route, query = "") {
    if (location.protocol === "file:") {
      const params = new URLSearchParams();
      if (route !== "home") params.set("page", route);
      if (query) params.set("q", query);
      return `${location.pathname}${params.size ? `?${params}` : ""}`;
    }
    if (route === "search") return `/search${query ? `?q=${encodeURIComponent(query)}` : ""}`;
    if (route === "laptops") return `/laptops${query ? `?q=${encodeURIComponent(query)}` : ""}`;
    return "/";
  }

  navigate(route, query = "", options = {}) {
    const url = this.routeUrl(route, query);
    if (options.replace) history.replaceState({}, "", url);
    else history.pushState({}, "", url);
    this.applyRoute();
    if (options.scroll !== false) {
      const target = route === "home" ? "#home" : "#products";
      document.querySelector(target).scrollIntoView({ behavior: "smooth" });
    }
  }

  applyRoute() {
    const route = this.currentRoute();
    const params = new URLSearchParams(location.search);
    if (route === "detail" && location.protocol === "file:") {
      document.querySelector("#home").hidden = true;
      document.querySelector("#categories").hidden = true;
      document.querySelector("#catalog-callout").hidden = true;
      document.querySelector("#products").hidden = true;
      const id = params.get("id");
      if (id) this.openProduct(id, { pushRoute: false });
      return;
    }
    if (route === "search") this.state.query = params.get("q") || "";
    if (route === "home" && !params.has("q")) this.state.query = "";
    document.querySelector("#search-input").value = this.state.query;
    document.querySelector("#breadcrumb-current").textContent = route === "search" && this.state.query
      ? `Kết quả tìm kiếm: “${this.state.query}”`
      : route === "detail" ? "Chi tiết laptop" : "Laptop";
    const showHome = route === "home";
    document.querySelector("#home").hidden = !showHome;
    document.querySelector("#categories").hidden = !showHome;
    document.querySelector("#catalog-callout").hidden = !showHome;
    document.querySelector("#products").hidden = route === "detail";
    if (route === "detail") {
      const id = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
      if (id) this.openProduct(id, { pushRoute: false });
    } else {
      this.loadProducts();
    }
  }
};
