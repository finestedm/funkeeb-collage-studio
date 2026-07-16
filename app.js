const ratios = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1600, 900],
  story: [1080, 1920],
};

const palettes = {
  dark: {
    background: "#111317",
    surface: "#151820",
    surfaceLow: "#1a1d23",
    surfaceHigh: "#232733",
    ink: "#e8edf3",
    muted: "#9ba9bd",
    soft: "#c0cad8",
    border: "rgba(141, 167, 206, 0.34)",
    blue: "#8da7ce",
    orange: "#f6732c",
    lime: "#b8d250",
    shadow: "rgba(0, 0, 0, 0.34)",
  },
  light: {
    background: "#f9f9ff",
    surface: "#ffffff",
    surfaceLow: "#f0f3ff",
    surfaceHigh: "#e5e9fb",
    ink: "#1a1c1d",
    muted: "#5d5f5f",
    soft: "#46474a",
    border: "rgba(26, 28, 29, 0.16)",
    blue: "#4b6f9c",
    orange: "#f6732c",
    lime: "#7c9900",
    shadow: "rgba(26, 28, 29, 0.12)",
  },
};

const state = {
  images: [],
  mode: "grid",
  ratio: "square",
  theme: "dark",
  gap: 28,
  title: "FunkeeB build",
  subtitle: "Custom keyboard photo set",
  forceTextLogo: false,
};

const elements = {
  canvas: document.getElementById("previewCanvas"),
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  imageMeta: document.getElementById("imageMeta"),
  thumbList: document.getElementById("thumbList"),
  titleInput: document.getElementById("titleInput"),
  subtitleInput: document.getElementById("subtitleInput"),
  ratioSelect: document.getElementById("ratioSelect"),
  themeSelect: document.getElementById("themeSelect"),
  gapInput: document.getElementById("gapInput"),
  gapValue: document.getElementById("gapValue"),
  canvasSize: document.getElementById("canvasSize"),
  downloadButton: document.getElementById("downloadButton"),
  clearButton: document.getElementById("clearButton"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
};

const context = elements.canvas.getContext("2d");
const logo = new Image();
let logoReady = false;
let logoFailed = false;

logo.onload = () => {
  logoReady = true;
  render();
};
logo.onerror = () => {
  logoFailed = true;
  render();
};
logo.src = "./assets/transparent-logo-v3.svg";

if (document.fonts) {
  document.fonts.ready.then(render).catch(() => render());
}

elements.fileInput.addEventListener("change", (event) => {
  addFiles(event.target.files);
  event.target.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => {
  addFiles(event.dataTransfer.files);
});

elements.titleInput.addEventListener("input", () => {
  state.title = elements.titleInput.value.trim();
  render();
});

elements.subtitleInput.addEventListener("input", () => {
  state.subtitle = elements.subtitleInput.value.trim();
  render();
});

elements.ratioSelect.addEventListener("change", () => {
  state.ratio = elements.ratioSelect.value;
  render();
});

elements.themeSelect.addEventListener("change", () => {
  state.theme = elements.themeSelect.value;
  render();
});

elements.gapInput.addEventListener("input", () => {
  state.gap = Number(elements.gapInput.value);
  elements.gapValue.textContent = `${state.gap} px`;
  render();
});

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    syncModeButtons();
    render();
  });
});

elements.downloadButton.addEventListener("click", () => {
  render();
  let href = "";
  try {
    href = elements.canvas.toDataURL("image/png");
  } catch (error) {
    state.forceTextLogo = true;
    render();
    href = elements.canvas.toDataURL("image/png");
    state.forceTextLogo = false;
  }

  const link = document.createElement("a");
  link.download = `${slugify(state.title || "funkeeb-collage")}.png`;
  link.href = href;
  link.click();
});

elements.clearButton.addEventListener("click", () => {
  state.images.forEach((item) => URL.revokeObjectURL(item.url));
  state.images = [];
  syncImages();
  render();
});

function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));

  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    const item = {
      id: createId(),
      name: file.name,
      url,
      image: new Image(),
      ready: false,
    };

    item.image.onload = () => {
      item.ready = true;
      syncImages();
      render();
    };
    item.image.onerror = () => {
      item.error = true;
      syncImages();
      render();
    };
    item.image.src = url;
    state.images.push(item);
  });

  syncImages();
  render();
}

function syncModeButtons() {
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncImages() {
  const count = state.images.length;
  const grid = getAutoGrid(Math.max(count, 1));
  elements.imageMeta.textContent = count === 0 ? "0 plikow" : `${count} plikow - ${grid.cols} x ${grid.rows}`;
  elements.thumbList.innerHTML = "";

  state.images.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "thumb-item";

    const thumb = document.createElement("img");
    thumb.src = item.url;
    thumb.alt = "";

    const label = document.createElement("span");
    label.textContent = item.name;

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "Up";
    up.disabled = index === 0;
    up.addEventListener("click", () => moveImage(index, -1));

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "Down";
    down.disabled = index === state.images.length - 1;
    down.addEventListener("click", () => moveImage(index, 1));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Usun";
    remove.addEventListener("click", () => removeImage(item.id));

    row.append(thumb, label, up, down, remove);
    elements.thumbList.append(row);
  });
}

function moveImage(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.images.length) return;
  const [item] = state.images.splice(index, 1);
  state.images.splice(nextIndex, 0, item);
  syncImages();
  render();
}

function removeImage(id) {
  const index = state.images.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [item] = state.images.splice(index, 1);
  URL.revokeObjectURL(item.url);
  syncImages();
  render();
}

function render() {
  const [width, height] = ratios[state.ratio];
  const palette = palettes[state.theme];
  elements.canvas.width = width;
  elements.canvas.height = height;
  elements.canvasSize.textContent = `${width} x ${height}`;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  drawBackground(context, width, height, palette);

  const pad = clamp(Math.round(width * 0.055), 44, 92);
  const contentTop = drawHeader(context, width, height, pad, palette);
  const bottomPad = Math.round(pad * 0.8);
  const layoutRect = {
    x: pad,
    y: contentTop,
    w: width - pad * 2,
    h: Math.max(height - contentTop - bottomPad, height * 0.35),
  };

  const items = state.images.length > 0 ? state.images : createPlaceholders();
  const gap = Math.round(state.gap * (width / 1080));

  if (state.mode === "collage") {
    drawCollage(context, layoutRect, items, gap, palette);
  } else {
    drawGrid(context, layoutRect, items, gap, palette, state.mode === "cards");
  }

  drawFooterMark(context, width, height, pad, palette);
}

function drawBackground(ctx, width, height, palette) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.background);
  gradient.addColorStop(0.58, palette.surfaceLow);
  gradient.addColorStop(1, palette.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = state.theme === "dark" ? 0.4 : 0.28;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = Math.max(1, width * 0.0015);

  for (let x = -width; x < width * 1.8; x += width / 7) {
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x + width * 0.38, 0);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = palette.orange;
  ctx.fillRect(0, Math.round(height * 0.12), width, Math.max(8, height * 0.008));
  ctx.fillStyle = palette.blue;
  ctx.fillRect(0, Math.round(height * 0.12) + Math.max(8, height * 0.008), width, Math.max(5, height * 0.005));
  ctx.restore();
}

function drawHeader(ctx, width, height, pad, palette) {
  let y = Math.round(pad * 0.72);
  const logoWidth = clamp(Math.round(width * 0.26), 210, 360);
  const logoHeight = Math.round(logoWidth / 4.49);
  const logoX = Math.round((width - logoWidth) / 2);

  if (logoReady && !logoFailed && !state.forceTextLogo) {
    ctx.drawImage(logo, logoX, y, logoWidth, logoHeight);
  } else {
    drawWordmark(ctx, width / 2, y + logoHeight * 0.8, logoHeight * 0.85, palette);
  }

  y += logoHeight + Math.round(pad * 0.42);

  if (state.title) {
    const titleSize = clamp(Math.round(width * 0.06), 44, 92);
    const titleHeight = drawWrappedText({
      ctx,
      text: state.title,
      x: width / 2,
      y,
      maxWidth: width - pad * 2.6,
      maxLines: 2,
      size: titleSize,
      weight: 900,
      color: palette.ink,
      family: "\"Hanken Grotesk\", Inter, sans-serif",
      align: "center",
    });
    y += titleHeight + Math.round(pad * 0.14);
  }

  if (state.subtitle) {
    const subtitleSize = clamp(Math.round(width * 0.024), 24, 36);
    const subtitleHeight = drawWrappedText({
      ctx,
      text: state.subtitle,
      x: width / 2,
      y,
      maxWidth: width - pad * 2.4,
      maxLines: 2,
      size: subtitleSize,
      weight: 600,
      color: palette.soft,
      family: "Inter, sans-serif",
      align: "center",
    });
    y += subtitleHeight + Math.round(pad * 0.28);
  }

  const lineWidth = clamp(Math.round(width * 0.18), 150, 260);
  ctx.save();
  ctx.fillStyle = palette.orange;
  ctx.fillRect(Math.round((width - lineWidth) / 2), y, lineWidth, Math.max(5, width * 0.005));
  ctx.fillStyle = palette.lime;
  ctx.fillRect(Math.round((width - lineWidth) / 2), y + Math.max(5, width * 0.005), Math.round(lineWidth * 0.42), Math.max(3, width * 0.003));
  ctx.restore();

  return y + Math.round(pad * 0.72);
}

function drawGrid(ctx, rect, items, gap, palette, cardMode) {
  const slots = createGridSlots(rect, items.length, gap);
  slots.forEach((slot, index) => {
    if (cardMode) {
      drawCardTile(ctx, items[index], slot, palette);
    } else {
      drawImageTile(ctx, items[index], slot, palette, 6);
    }
  });
}

function drawCollage(ctx, rect, items, gap, palette) {
  const slots = createCollageSlots(rect, items.length, gap);
  slots.forEach((slot, index) => {
    drawImageTile(ctx, items[index], slot, palette, index === 0 ? 8 : 6);
  });
}

function drawImageTile(ctx, item, rect, palette, radius) {
  ctx.save();
  ctx.fillStyle = palette.surfaceHigh;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fill();
  ctx.clip();

  if (item && item.ready) {
    drawImageCover(ctx, item.image, rect.x, rect.y, rect.w, rect.h);
  } else {
    drawPlaceholder(ctx, rect, palette, item);
  }

  ctx.restore();
  drawStroke(ctx, rect, palette.border, radius);
}

function drawCardTile(ctx, item, rect, palette) {
  const inset = clamp(Math.round(Math.min(rect.w, rect.h) * 0.055), 12, 24);
  const imageRect = {
    x: rect.x + inset,
    y: rect.y + inset,
    w: rect.w - inset * 2,
    h: rect.h - inset * 2,
  };

  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = Math.max(14, rect.w * 0.035);
  ctx.shadowOffsetY = Math.max(8, rect.h * 0.02);
  ctx.fillStyle = palette.surface;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fill();
  ctx.restore();

  drawImageTile(ctx, item, imageRect, palette, 4);

  ctx.save();
  ctx.fillStyle = palette.orange;
  ctx.fillRect(imageRect.x, imageRect.y + imageRect.h + Math.max(4, inset * 0.3), Math.round(imageRect.w * 0.34), Math.max(4, inset * 0.22));
  ctx.fillStyle = palette.blue;
  ctx.fillRect(imageRect.x + Math.round(imageRect.w * 0.36), imageRect.y + imageRect.h + Math.max(4, inset * 0.3), Math.round(imageRect.w * 0.18), Math.max(4, inset * 0.22));
  ctx.restore();

  drawStroke(ctx, rect, palette.border, 6);
}

function drawPlaceholder(ctx, rect, palette, item) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  gradient.addColorStop(0, palette.surfaceHigh);
  gradient.addColorStop(1, palette.surfaceLow);
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = Math.max(2, Math.min(rect.w, rect.h) * 0.006);
  for (let x = rect.x - rect.h; x < rect.x + rect.w; x += Math.max(44, rect.w * 0.12)) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.h);
    ctx.lineTo(x + rect.h, rect.y);
    ctx.stroke();
  }
  ctx.restore();

  const label = item && item.error ? "Blad pliku" : "Zdjecie";
  ctx.font = `800 ${clamp(Math.round(rect.w * 0.055), 18, 34)}px Inter, sans-serif`;
  ctx.fillStyle = palette.soft;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawFooterMark(ctx, width, height, pad, palette) {
  ctx.save();
  ctx.font = `800 ${clamp(Math.round(width * 0.014), 14, 20)}px Inter, sans-serif`;
  const main = "funkee";
  const accent = "B";
  const mainWidth = ctx.measureText(main).width;
  const accentWidth = ctx.measureText(accent).width;
  const start = width - pad - mainWidth - accentWidth;
  ctx.fillStyle = palette.muted;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(main, start, height - Math.round(pad * 0.34));
  ctx.fillStyle = palette.orange;
  ctx.fillText(accent, start + mainWidth, height - Math.round(pad * 0.34));
  ctx.restore();
}

function drawWordmark(ctx, x, y, size, palette) {
  ctx.save();
  ctx.font = `900 ${size}px "Hanken Grotesk", Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const main = "Funkee";
  const accent = "B";
  const mainWidth = ctx.measureText(main).width;
  const accentWidth = ctx.measureText(accent).width;
  const start = x - (mainWidth + accentWidth) / 2;
  ctx.fillStyle = palette.blue;
  ctx.fillText(main, start + mainWidth / 2, y);
  ctx.fillStyle = palette.orange;
  ctx.fillText(accent, start + mainWidth + accentWidth / 2, y);
  ctx.restore();
}

function drawWrappedText(options) {
  const { ctx, text, x, y, maxWidth, maxLines, weight, color, family, align } = options;
  let size = options.size;
  let lines = [];

  while (size >= 16) {
    ctx.font = `${weight} ${size}px ${family}`;
    lines = wrapText(ctx, text, maxWidth);
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
    if (lines.length <= maxLines && widest <= maxWidth) break;
    size -= 2;
  }

  lines = lines.slice(0, maxLines);
  const lineHeight = Math.round(size * 1.08);

  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  ctx.restore();

  return Math.max(lineHeight, lines.length * lineHeight);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let line = "";

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
      return;
    }
    lines.push(line);
    line = word;
  });

  if (line) lines.push(line);
  return lines;
}

function createGridSlots(rect, count, gap) {
  const { cols, rows } = getAutoGrid(count);
  return createFixedGridSlots(rect, count, cols, rows, gap);
}

function createFixedGridSlots(rect, count, cols, rows, gap) {
  const cellWidth = (rect.w - gap * (cols - 1)) / cols;
  const cellHeight = (rect.h - gap * (rows - 1)) / rows;
  const slots = [];

  for (let index = 0; index < count; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    slots.push({
      x: Math.round(rect.x + col * (cellWidth + gap)),
      y: Math.round(rect.y + row * (cellHeight + gap)),
      w: Math.round(cellWidth),
      h: Math.round(cellHeight),
    });
  }

  return slots;
}

function createCollageSlots(rect, count, gap) {
  if (count <= 2) return createGridSlots(rect, count, gap);

  const slots = [];
  const portrait = rect.h > rect.w * 1.08;

  if (portrait) {
    const featureHeight = Math.round(rect.h * 0.48);
    slots.push({ x: rect.x, y: rect.y, w: rect.w, h: featureHeight });
    const restRect = {
      x: rect.x,
      y: rect.y + featureHeight + gap,
      w: rect.w,
      h: rect.h - featureHeight - gap,
    };
    return slots.concat(createGridSlots(restRect, count - 1, gap));
  }

  const featureWidth = Math.round(rect.w * 0.54);
  slots.push({ x: rect.x, y: rect.y, w: featureWidth, h: rect.h });
  const restCount = count - 1;
  const restCols = restCount <= 3 ? 1 : 2;
  const restRect = {
    x: rect.x + featureWidth + gap,
    y: rect.y,
    w: rect.w - featureWidth - gap,
    h: rect.h,
  };
  return slots.concat(createFixedGridSlots(restRect, restCount, restCols, Math.ceil(restCount / restCols), gap));
}

function getAutoGrid(count) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 8) return { cols: 4, rows: 2 };
  if (count === 9) return { cols: 3, rows: 3 };
  if (count <= 12) return { cols: 4, rows: 3 };

  const cols = Math.ceil(Math.sqrt(count * 1.25));
  return { cols, rows: Math.ceil(count / cols) };
}

function drawImageCover(ctx, image, x, y, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawStroke(ctx, rect, color, radius) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.min(rect.w, rect.h) * 0.004);
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createPlaceholders() {
  return Array.from({ length: 4 }, (_, index) => ({
    id: `placeholder-${index}`,
    name: `Zdjecie ${index + 1}`,
    ready: false,
  }));
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "funkeeb-collage";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

syncModeButtons();
syncImages();
render();
