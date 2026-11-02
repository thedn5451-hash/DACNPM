(function () {
  const apiBase = (window.LAPTOPIA_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
  const productsEndpoint = window.LAPTOPIA_PRODUCTS_ENDPOINT || `${apiBase}/api/products/`;

  function getValue(source, keys) {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
    }
    return undefined;
  }

  function nameOf(value) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") return getValue(value, ["name", "title", "label"]);
    return undefined;
  }

  function normalizeProduct(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Dữ liệu sản phẩm không hợp lệ.");
    const id = getValue(raw, ["id", "product_id", "productId", "slug"]);
    const name = getValue(raw, ["name", "product_name", "title", "model_name"]);
    if (id === undefined || !name) throw new Error("Sản phẩm thiếu mã định danh hoặc tên hiển thị.");

    const rawImages = getValue(raw, ["images", "product_images", "gallery"]);
    const images = Array.isArray(rawImages)
      ? rawImages.map((image) => typeof image === "string" ? image : getValue(image, ["url", "image_url", "src"])).filter(Boolean)
      : [];
    const primaryImage = getValue(raw, ["image_url", "image", "thumbnail", "primary_image"]);
    if (primaryImage && !images.includes(primaryImage)) images.unshift(primaryImage);

    const rawSpecs = getValue(raw, ["specs", "attributes", "specifications"]);
    const specs = Array.isArray(rawSpecs)
      ? rawSpecs.map((item) => typeof item === "string" ? item : [nameOf(item?.attribute || item), getValue(item || {}, ["value", "display_value"])].filter(Boolean).join(": "))
      : rawSpecs && typeof rawSpecs === "object"
        ? Object.entries(rawSpecs).map(([key, value]) => `${key}: ${nameOf(value) || value}`).filter((item) => !item.endsWith(": "))
        : [];
    const priceValue = getValue(raw, ["price", "selling_price", "current_price"]);
    const oldPriceValue = getValue(raw, ["original_price", "old_price", "list_price"]);
    const stockValue = getValue(raw, ["available_quantity", "stock", "quantity_on_hand"]);
    const ratingValue = getValue(raw, ["rating", "average_rating"]);
    const reviewCount = getValue(raw, ["review_count", "reviews_count"]);
    const categories = getValue(raw, ["categories", "category"]);
    const variants = getValue(raw, ["variants", "product_variants"]);

    return {
      ...raw,
      id: String(id),
      name: String(name),
      brand: nameOf(getValue(raw, ["brand", "brand_name", "manufacturer"])),
      category: Array.isArray(categories) ? categories.map(nameOf).filter(Boolean) : [nameOf(categories)].filter(Boolean),
      images,
      specs,
      price: Number.isFinite(Number(priceValue)) && priceValue !== undefined ? Number(priceValue) : null,
      originalPrice: Number.isFinite(Number(oldPriceValue)) && oldPriceValue !== undefined ? Number(oldPriceValue) : null,
      stock: Number.isFinite(Number(stockValue)) && stockValue !== undefined ? Number(stockValue) : null,
      rating: Number.isFinite(Number(ratingValue)) && ratingValue !== undefined ? Number(ratingValue) : null,
      reviewCount: Number.isFinite(Number(reviewCount)) && reviewCount !== undefined ? Number(reviewCount) : null,
      variants: Array.isArray(variants) ? variants : [],
      description: getValue(raw, ["description", "short_description"])
    };
  }

  async function readJson(url, options = {}) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error("Không thể kết nối máy chủ. Kiểm tra kết nối rồi thử lại.");
    }
    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Máy chủ trả về dữ liệu không đọc được.");
      }
    }
    if (!response.ok) {
      const message = payload.message || payload.detail || payload.error;
      const error = new Error(message || `Máy chủ trả lỗi ${response.status}.`);
      error.status = response.status;
      if (response.status === 404) error.message = message || "API sản phẩm chưa được triển khai hoặc không tìm thấy dữ liệu.";
      if (response.status === 401) error.message = message || "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
      throw error;
    }
    return payload;
  }

  function buildListUrl(criteria) {
    const url = new URL(productsEndpoint, window.location.href);
    if (criteria.query) url.searchParams.set("q", criteria.query);
    if (criteria.sort && criteria.sort !== "relevance") url.searchParams.set("sort", criteria.sort);
    if (criteria.page > 1) url.searchParams.set("page", String(criteria.page));
    for (const [key, value] of Object.entries(criteria.filters || {})) {
      if (value === "") continue;
      for (const selected of String(value).split("|")) url.searchParams.append(key, selected);
    }
    return url;
  }

  async function listProducts(criteria, options = {}) {
    const response = await readJson(buildListUrl(criteria), { signal: options.signal });
    const payload = response?.data ?? response;
    const rawItems = Array.isArray(payload)
      ? payload
      : payload && (payload.results || payload.products || payload.items);
    if (!Array.isArray(rawItems)) throw new Error("API danh sách sản phẩm trả về cấu trúc không hợp lệ.");
    return {
      items: rawItems.map(normalizeProduct),
      count: Number.isFinite(Number(payload.count ?? payload.total)) ? Number(payload.count ?? payload.total) : null,
      next: Boolean(payload.next || payload.has_more),
      facets: payload.facets && typeof payload.facets === "object" ? payload.facets : {},
      filterFields: Array.isArray(payload.filter_fields) ? payload.filter_fields : [],
      sortOptions: Array.isArray(payload.sort_options) ? payload.sort_options : ["relevance"]
    };
  }

  async function getProduct(id, options = {}) {
    const configuredTemplate = window.LAPTOPIA_PRODUCT_DETAIL_ENDPOINT;
    const endpoint = configuredTemplate
      ? configuredTemplate.replace("{id}", encodeURIComponent(id))
      : `${productsEndpoint.replace(/\/$/, "")}/${encodeURIComponent(id)}/`;
    const response = await readJson(endpoint, { signal: options.signal });
    const payload = response?.data ?? response;
    return normalizeProduct(payload.product || payload);
  }

  window.LaptopStoreServices = {
    apiBase,
    readJson,
    listProducts,
    getProduct,
    normalizeProduct
  };
})();
