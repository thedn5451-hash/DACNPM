window.LaptopStore = window.LaptopStore || {};

window.LaptopStore.CatalogController = class extends window.LaptopStore.Router {
  selectedFilters() {
    return Object.fromEntries(Object.entries(this.state.filters).filter(([, value]) => value !== ""));
  }

  setCatalogLoading(loading, append = false) {
    document.querySelector("#catalog-loading").hidden = !loading;
    document.querySelector("#catalog-error").hidden = true;
    document.querySelector("#empty-state").hidden = true;
    document.querySelector("#catalog-status").textContent = loading ? "Đang tải dữ liệu" : "Dữ liệu hệ thống";
    if (!append) {
      this.productGrid.hidden = loading;
      if (loading) this.productGrid.replaceChildren();
    }
  }

  renderImage(image, alt, className = "") {
    const safeAlt = this.escapeHtml(alt);
    const safeSrc = this.escapeHtml(image || this.fallbackImage);
    return `<img class="${className}" src="${safeSrc}" alt="${safeAlt}" loading="lazy" data-fallback-image />`;
  }

  renderProductCard(product) {
    const stockKnown = Number.isFinite(product.stock);
    const available = stockKnown && product.stock > 0;
    const price = Number.isFinite(product.price) ? `<div class="product-price">${this.formatPrice(product.price)}</div>` : `<div class="product-price product-price--missing">Giá chưa được cung cấp</div>`;
    const originalPrice = Number.isFinite(product.originalPrice) && Number.isFinite(product.price) && product.originalPrice > product.price
      ? `<span class="product-old-price">${this.formatPrice(product.originalPrice)}</span>` : "";
    const specs = product.specs.slice(0, 3).map((spec) => `<span>${this.escapeHtml(spec)}</span>`).join("");
    const availability = stockKnown
      ? `<span class="availability ${available ? "availability--available" : "availability--out"}">${available ? `Còn hàng (${product.stock})` : "Hết hàng"}</span>`
      : `<span class="availability availability--unknown">Chưa có dữ liệu tồn kho</span>`;
    const cardImage = product.images[0];
    return `
      <article class="product-card">
        <a class="product-image-wrap" href="/laptops/${encodeURIComponent(product.id)}" data-product="${this.escapeHtml(product.id)}" aria-label="Xem ${this.escapeHtml(product.name)}">
          ${this.renderImage(cardImage, product.name)}
        </a>
        <div class="product-card__body">
          ${product.brand ? `<span class="product-brand">${this.escapeHtml(product.brand)}</span>` : ""}
          <a class="product-name" href="/laptops/${encodeURIComponent(product.id)}" data-product="${this.escapeHtml(product.id)}">${this.escapeHtml(product.name)}</a>
          <div class="product-specs">${specs}</div>
          <div class="product-price-row"><div>${price}${originalPrice}</div>
            ${available && Number.isFinite(product.price) ? `<button class="add-cart-button" data-add-cart="${this.escapeHtml(product.id)}" aria-label="Thêm ${this.escapeHtml(product.name)} vào giỏ">+</button>` : ""}
          </div>
          ${availability}
          ${product.rating !== null ? `<div class="rating-line"><span aria-hidden="true">★</span><strong>${this.escapeHtml(product.rating)}</strong>${product.reviewCount !== null ? `(${this.escapeHtml(product.reviewCount)} đánh giá)` : ""}</div>` : ""}
        </div>
      </article>`;
  }

  setImageFallbacks(root) {
    root.querySelectorAll("[data-fallback-image]").forEach((image) => {
      image.addEventListener("error", () => {
        if (image.src !== this.fallbackImage) image.src = this.fallbackImage;
      }, { once: true });
    });
  }

  renderProducts() {
    this.productGrid.innerHTML = this.state.products.map(this.renderProductCard.bind(this)).join("");
    this.setImageFallbacks(this.productGrid);
    this.productGrid.hidden = this.state.products.length === 0;
    const empty = this.state.products.length === 0;
    document.querySelector("#empty-state").hidden = !empty;
    document.querySelector("#results-count").textContent = this.state.count === null
      ? `${this.state.products.length} sản phẩm`
      : `${this.state.count} sản phẩm`;
    document.querySelector("#catalog-result-summary").textContent = this.state.count === null
      ? "" : `Đang hiển thị ${this.state.products.length} / ${this.state.count} sản phẩm`;
    document.querySelector("#load-more").hidden = !this.state.hasMore;
    document.querySelector("#load-more").disabled = false;
    this.renderActiveFilters();
  }

  normalizeOptions(values) {
    if (!Array.isArray(values)) return [];
    return values.map((entry) => typeof entry === "string"
      ? { value: entry, label: entry }
      : { value: String(entry.value ?? entry.id ?? ""), label: String(entry.label ?? entry.name ?? entry.value ?? ""), count: entry.count })
      .filter((entry) => entry.value && entry.label);
  }

  renderFacetControls(facets, fields) {
    const container = document.querySelector("#filter-options");
    const groups = fields.map((fieldEntry) => {
      const field = typeof fieldEntry === "string" ? fieldEntry : fieldEntry.name || fieldEntry.key;
      const label = typeof fieldEntry === "string" ? fieldEntry.replace(/_/g, " ") : fieldEntry.label || field;
      if (!field) return "";
      if (field === "min_price" || field === "max_price") return "";
      const options = this.normalizeOptions(facets[field] || facets[`${field}s`]);
      if (!options.length) return "";
      return `<section class="filter-group" data-filter-group="${this.escapeHtml(field)}"><h3>${this.escapeHtml(label)}</h3>${options.map((option) => `
        <label class="filter-option"><input type="checkbox" data-filter-field="${this.escapeHtml(field)}" value="${this.escapeHtml(option.value)}" ${String(this.state.filters[field] || "").split("|").includes(option.value) ? "checked" : ""} />
        <span class="custom-check"></span>${this.escapeHtml(option.label)}${option.count !== undefined ? `<small>(${this.escapeHtml(option.count)})</small>` : ""}</label>`).join("")}</section>`;
    }).join("");
    const hasMin = fields.some((entry) => (typeof entry === "string" ? entry : entry.name || entry.key) === "min_price");
    const hasMax = fields.some((entry) => (typeof entry === "string" ? entry : entry.name || entry.key) === "max_price");
    const priceControl = hasMin || hasMax
      ? `<section class="filter-group"><h3>Khoảng giá</h3><div class="price-range">
          ${hasMin ? `<label for="filter-min-price">Từ</label><input id="filter-min-price" type="number" min="0" inputmode="numeric" value="${this.escapeHtml(this.state.filters.min_price || "")}" placeholder="Giá thấp nhất" />` : ""}
          ${hasMax ? `<label for="filter-max-price">Đến</label><input id="filter-max-price" type="number" min="0" inputmode="numeric" value="${this.escapeHtml(this.state.filters.max_price || "")}" placeholder="Giá cao nhất" />` : ""}
          <button class="button button--outline" id="apply-price-filter">Áp dụng</button>
        </div></section>` : "";
    container.innerHTML = groups || priceControl
      ? `${groups}${priceControl}`
      : `<p class="filter-placeholder">API hiện chưa cung cấp tùy chọn bộ lọc.</p>`;
    const categoryFieldEntry = fields.find((entry) =>
      (typeof entry === "string" ? entry : entry.name || entry.key)?.toLowerCase().startsWith("categor")
    );
    const categoryField = typeof categoryFieldEntry === "string"
      ? categoryFieldEntry
      : categoryFieldEntry?.name || categoryFieldEntry?.key;
    const categoryOptions = categoryField
      ? this.normalizeOptions(facets[categoryField] || facets.category || facets.categories)
      : [];
    const categoryGrid = document.querySelector("#category-grid");
    categoryGrid.innerHTML = categoryOptions.length
      ? categoryOptions.slice(0, 3).map((option, index) => `
        <button class="category-card category-card--${["study", "work", "gaming"][index]}" data-category="${this.escapeHtml(option.value)}">
          <span class="category-card__label">DANH MỤC</span><strong>${this.escapeHtml(option.label)}</strong>
          <span class="category-card__cta">Xem sản phẩm <span>↗</span></span>
        </button>`).join("")
      : `<p class="section-placeholder">Danh mục sẽ hiển thị khi API cung cấp dữ liệu.</p>`;
    document.querySelectorAll("#sort-select option[data-server-option]").forEach((option) => option.remove());
    this.state.sortOptions = (Array.isArray(this.state.sortOptions) ? this.state.sortOptions : []).map((option) =>
      typeof option === "string" ? { value: option, label: option } : option
    );
    const select = document.querySelector("#sort-select");
    for (const option of this.state.sortOptions) {
      const value = option.value || option.key;
      if (!value || [...select.options].some((existing) => existing.value === value)) continue;
      const element = document.createElement("option");
      element.value = value;
      element.textContent = option.label || value;
      element.dataset.serverOption = "true";
      select.append(element);
    }
    if ([...select.options].some((option) => option.value === this.state.sort)) select.value = this.state.sort;
  }

  renderActiveFilters() {
    const elements = Object.entries(this.state.filters).filter(([, value]) => value !== "").map(([field, value]) => {
      if (field === "min_price" || field === "max_price") return { field, value, label: `${field === "min_price" ? "Từ" : "Đến"} ${this.formatPrice(Number(value))}` };
      return { field, value, label: `${field.replace(/_/g, " ")}: ${String(value).split("|").join(", ")}` };
    });
    document.querySelector("#active-filters").innerHTML = elements.map(({ field, value, label }) =>
      `<span class="filter-chip">${this.escapeHtml(label)} <button data-remove-filter="${this.escapeHtml(field)}" data-value="${this.escapeHtml(value)}" aria-label="Bỏ bộ lọc ${this.escapeHtml(label)}">×</button></span>`
    ).join("");
  }

  async loadProducts(options = {}) {
    const requestId = ++this.state.requestId;
    if (this.state.controller) this.state.controller.abort();
    this.state.controller = new AbortController();
    const append = Boolean(options.append);
    if (!append) {
      this.state.page = 1;
      this.state.products = [];
    }
    this.setCatalogLoading(true, append);
    document.querySelector("#catalog-error").hidden = true;
    try {
      const response = await this.services.listProducts({
        query: this.state.query.trim(),
        filters: this.selectedFilters(),
        sort: this.state.sort,
        page: this.state.page
      }, { signal: this.state.controller.signal });
      if (requestId !== this.state.requestId) return;
      this.state.products = append ? [...this.state.products, ...response.items] : response.items;
      this.state.count = response.count;
      this.state.hasMore = response.next;
      this.state.filterFields = response.filterFields;
      this.state.sortOptions = response.sortOptions;
      document.querySelector("#catalog-loading").hidden = true;
      this.renderFacetControls(response.facets, response.filterFields);
      this.renderProducts();
      document.querySelector("#catalog-status").textContent = "Đã cập nhật";
    } catch (error) {
      if (error.name === "AbortError" || requestId !== this.state.requestId) return;
      document.querySelector("#catalog-loading").hidden = true;
      document.querySelector("#catalog-error").hidden = false;
      document.querySelector("#catalog-error-message").textContent = error.message;
      document.querySelector("#catalog-status").textContent = "Không tải được dữ liệu";
      this.productGrid.replaceChildren();
      this.productGrid.hidden = true;
      document.querySelector("#empty-state").hidden = true;
      document.querySelector("#results-count").textContent = "Không có kết quả mới";
    }
  }

  clearFilters() {
    this.state.filters = {};
    this.state.query = "";
    document.querySelector("#search-input").value = "";
    this.navigate("laptops", "", { scroll: false });
  }

  setFilter(field, value) {
    if (value) this.state.filters[field] = value;
    else delete this.state.filters[field];
    this.state.page = 1;
    this.loadProducts();
  }

  async openProduct(id, options = {}) {
    this.openDialog("#product-modal");
    const content = document.querySelector("#product-modal-content");
    content.innerHTML = `<div class="catalog-state"><span class="loading-spinner"></span><span>Đang tải chi tiết sản phẩm…</span></div>`;
    if (this.state.detailController) this.state.detailController.abort();
    this.state.detailController = new AbortController();
    if (options.pushRoute) {
      const url = location.protocol === "file:" ? `${location.pathname}?page=detail&id=${encodeURIComponent(id)}` : `/laptops/${encodeURIComponent(id)}`;
      history.pushState({}, "", url);
    }
    try {
      const product = await this.services.getProduct(id, { signal: this.state.detailController.signal });
      this.state.detail = product;
      this.state.selectedVariant = product.variants[0] || null;
      this.renderProductDetail();
    } catch (error) {
      if (error.name === "AbortError") return;
      content.innerHTML = `<div class="catalog-error" role="alert"><strong>Không tải được thông tin laptop.</strong><p>${this.escapeHtml(error.message)}</p><button class="button button--outline" data-retry-product="${this.escapeHtml(id)}">Thử lại</button></div>`;
    }
  }

  renderProductDetail() {
    const product = this.state.detail;
    if (!product) return;
    const selected = this.state.selectedVariant;
    const priceValue = selected?.price ?? product.price;
    const stockValue = selected?.stock ?? selected?.available_quantity ?? product.stock;
    const available = Number.isFinite(Number(stockValue)) && Number(stockValue) > 0;
    const images = product.images.length ? product.images : [null];
    const variantOptions = product.variants.map((variant, index) => {
      const id = variant.id ?? variant.product_id ?? index;
      const label = variant.name || variant.label || variant.sku || `Phiên bản ${index + 1}`;
      return `<option value="${this.escapeHtml(id)}" ${selected === variant ? "selected" : ""}>${this.escapeHtml(label)}</option>`;
    }).join("");
    document.querySelector("#product-modal-content").innerHTML = `
      <div class="product-modal__image">
        ${this.renderImage(images[0], product.name, "product-main-image")}
        ${images.length > 1 ? `<div class="product-thumbnails">${images.map((image, index) => `<button data-image-index="${index}" aria-label="Xem ảnh ${index + 1}">${this.renderImage(image, `${product.name}, ảnh ${index + 1}`)}</button>`).join("")}</div>` : ""}
      </div>
      <div class="product-modal__details">
        <span class="product-brand">${product.brand ? `${this.escapeHtml(product.brand)} · ` : ""}CHI TIẾT LAPTOP</span>
        <h2 id="modal-title">${this.escapeHtml(product.name)}</h2>
        ${product.rating !== null ? `<div class="rating-line"><span>★</span><strong>${this.escapeHtml(product.rating)}</strong>${product.reviewCount !== null ? `(${this.escapeHtml(product.reviewCount)} đánh giá)` : ""}</div>` : ""}
        <div class="product-modal__price">${Number.isFinite(Number(priceValue)) ? this.formatPrice(Number(priceValue)) : "Giá chưa được cung cấp"}</div>
        ${product.variants.length ? `<label class="variant-label" for="variant-select">Phiên bản</label><select class="variant-select" id="variant-select">${variantOptions}</select>` : ""}
        <p class="product-modal__description">${product.description ? this.escapeHtml(product.description) : "Chưa có mô tả cho sản phẩm này."}</p>
        <div class="product-spec-list">${product.specs.map((spec) => `<span>${this.escapeHtml(spec)}</span>`).join("")}</div>
        <p class="product-stock">${Number.isFinite(Number(stockValue)) ? (available ? `Còn hàng: ${Number(stockValue)}` : "Sản phẩm hiện hết hàng") : "Tình trạng tồn kho chưa được cung cấp."}</p>
        ${available && Number.isFinite(Number(priceValue)) ? `<button class="button button--primary modal-add-button" data-add-detail="${this.escapeHtml(product.id)}">Thêm vào giỏ hàng <span>→</span></button>` : `<button class="button button--primary modal-add-button" disabled>${available ? "Chưa có giá bán" : "Chưa thể mua sản phẩm"}</button>`}
      </div>`;
    this.setImageFallbacks(document.querySelector("#product-modal-content"));
  }
};
