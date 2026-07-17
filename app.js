const ratios = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1600, 900],
  story: [1080, 1920],
};

const palette = {
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
};

const state = {
  images: [],
  mode: "grid",
  ratio: "square",
  gap: 28,
  forceTextLogo: false,
};

const elements = {
  canvas: document.getElementById("previewCanvas"),
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  imageMeta: document.getElementById("imageMeta"),
  thumbList: document.getElementById("thumbList"),
  ratioSelect: document.getElementById("ratioSelect"),
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

elements.ratioSelect.addEventListener("change", () => {
  state.ratio = elements.ratioSelect.value;
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
  link.download = "funkeeb-collage.png";
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
    const defaultTitle = makeDefaultTitle(file.name);
    const item = {
      id: createId(),
      name: file.name,
      title: defaultTitle,
      subtitle: "FunkeeB keyboard detail",
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

    const body = document.createElement("div");
    body.className = "thumb-body";

    const titleRow = document.createElement("div");
    titleRow.className = "thumb-title-row";

    const filename = document.createElement("span");
    filename.className = "thumb-filename";
    filename.textContent = item.name;

    const actions = document.createElement("div");
    actions.className = "thumb-actions";

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

    actions.append(up, down, remove);
    titleRow.append(filename, actions);

    const fields = document.createElement("div");
    fields.className = "thumb-fields";
    fields.append(
      createCaptionField("Title", item.title, (value) => {
        item.title = value;
        render();
      }),
      createCaptionField("Subtitle", item.subtitle, (value) => {
        item.subtitle = value;
        render();
      }),
    );

    body.append(titleRow, fields);
    row.append(thumb, body);
    elements.thumbList.append(row);
  });
}

function createCaptionField(labelText, value, onInput) {
  const label = document.createElement("label");
  label.className = "field";

  const caption = document.createElement("span");
  caption.textContent = labelText;

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = labelText === "Title" ? 56 : 88;
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value.trim()));

  label.append(caption, input);
  return label;
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
  elements.canvas.width = width;
  elements.canvas.height = height;
  elements.canvasSize.textContent = `${width} x ${height}`;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  drawBackground(context, width, height);

  const pad = clamp(Math.round(width * 0.055), 44, 92);
  const contentTop = drawHeader(context, width, height, pad);
  const bottomPad = Math.round(pad * 0.55);
  const layoutRect = {
    x: pad,
    y: contentTop,
    w: width - pad * 2,
    h: Math.max(height - contentTop - bottomPad, height * 0.35),
  };

  const items = state.images.length > 0 ? state.images : createPlaceholders();
  const gap = Math.round(state.gap * (width / 1080));

  if (state.mode === "collage") {
    drawCollage(context, layoutRect, items, gap);
  } else {
    drawGrid(context, layoutRect, items, gap, state.mode === "cards");
  }
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.background);
  gradient.addColorStop(0.62, palette.surfaceLow);
  gradient.addColorStop(1, palette.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = Math.max(1, width * 0.0015);

  for (let x = -width; x < width * 1.8; x += width / 7) {
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x + width * 0.38, 0);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = palette.orange;
  ctx.fillRect(0, Math.round(height * 0.12), width, Math.max(8, height * 0.008));
  ctx.fillStyle = palette.blue;
  ctx.fillRect(0, Math.round(height * 0.12) + Math.max(8, height * 0.008), width, Math.max(5, height * 0.005));
  ctx.restore();
}

function drawHeader(ctx, width, height, pad) {
  let y = Math.round(pad * 0.58);
  const logoHeight = clamp(Math.round(width * 0.058), 54, 82);
  const markWidth = measureLogoMark(ctx, logoHeight);
  const logoX = Math.round((width - markWidth) / 2);

  drawLogoMark(ctx, logoX, y, logoHeight);

  y += logoHeight + Math.round(pad * 0.42);

  const lineWidth = clamp(Math.round(width * 0.18), 150, 260);
  ctx.save();
  ctx.fillStyle = palette.orange;
  ctx.fillRect(Math.round((width - lineWidth) / 2), y, lineWidth, Math.max(5, width * 0.005));
  ctx.fillStyle = palette.lime;
  ctx.fillRect(Math.round((width - lineWidth) / 2), y + Math.max(5, width * 0.005), Math.round(lineWidth * 0.42), Math.max(3, width * 0.003));
  ctx.restore();

  return y + Math.round(pad * 0.58);
}

function measureLogoMark(ctx, height) {
  const iconWidth = Math.round(height * 1.66);
  const gap = Math.round(height * 0.18);
  const fontSize = Math.round(height * 0.76);
  ctx.save();
  ctx.font = `800 ${fontSize}px Poppins, sans-serif`;
  const textWidth = ctx.measureText("FunkeeB").width;
  ctx.restore();
  return iconWidth + gap + textWidth;
}

function drawLogoMark(ctx, x, y, height) {
  const iconWidth = Math.round(height * 1.66);
  const gap = Math.round(height * 0.18);
  const fontSize = Math.round(height * 0.76);
  const textY = y + Math.round(height * 0.78);

  if (logoReady && !logoFailed && !state.forceTextLogo) {
    const sourceWidth = Math.round(logo.naturalWidth * 0.37);
    ctx.drawImage(logo, 0, 0, sourceWidth, logo.naturalHeight, x, y, iconWidth, height);
  } else {
    drawFallbackIcon(ctx, x, y, iconWidth, height);
  }

  ctx.save();
  ctx.font = `800 ${fontSize}px Poppins, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.blue;
  ctx.fillText("Funkee", x + iconWidth + gap, textY);
  ctx.fillStyle = palette.orange;
  ctx.fillText("B", x + iconWidth + gap + ctx.measureText("Funkee").width, textY);
  ctx.restore();
}

function drawFallbackIcon(ctx, x, y, width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(75, 111, 156, 0.14)";
  roundRect(ctx, x, y + height * 0.12, width, height * 0.72, height * 0.14);
  ctx.fill();
  ctx.strokeStyle = palette.blue;
  ctx.lineWidth = Math.max(2, height * 0.04);
  roundRect(ctx, x, y + height * 0.12, width, height * 0.72, height * 0.14);
  ctx.stroke();
  ctx.fillStyle = palette.orange;
  ctx.fillRect(x + width * 0.18, y + height * 0.36, width * 0.64, height * 0.1);
  ctx.restore();
}

function drawGrid(ctx, rect, items, gap, cardMode) {
  const slots = createGridSlots(rect, items.length, gap);
  slots.forEach((slot, index) => {
    if (cardMode) {
      drawCardTile(ctx, items[index], slot);
    } else {
      drawCaptionedTile(ctx, items[index], slot, 6, false);
    }
  });
}

function drawCollage(ctx, rect, items, gap) {
  const slots = createCollageSlots(rect, items.length, gap);
  slots.forEach((slot, index) => {
    drawCaptionedTile(ctx, items[index], slot, index === 0 ? 8 : 6, false);
  });
}

function drawCardTile(ctx, item, rect) {
  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = Math.max(16, rect.w * 0.04);
  ctx.shadowOffsetY = Math.max(8, rect.h * 0.02);
  ctx.fillStyle = palette.surface;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fill();
  ctx.restore();

  const inset = clamp(Math.round(Math.min(rect.w, rect.h) * 0.045), 12, 24);
  drawCaptionedTile(
    ctx,
    item,
    {
      x: rect.x + inset,
      y: rect.y + inset,
      w: rect.w - inset * 2,
      h: rect.h - inset * 2,
    },
    4,
    true,
  );
  drawStroke(ctx, rect, palette.border, 6);
}

function drawCaptionedTile(ctx, item, rect, radius, isInsetCard) {
  const caption = getCaptionMetrics(rect, item);
  const imageRect = {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: Math.max(rect.h - caption.height, rect.h * 0.46),
  };
  const captionRect = {
    x: rect.x,
    y: imageRect.y + imageRect.h,
    w: rect.w,
    h: rect.h - imageRect.h,
  };

  ctx.save();
  ctx.fillStyle = palette.surface;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fill();
  ctx.clip();

  if (item && item.ready) {
    drawImageCover(ctx, item.image, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
  } else {
    drawPlaceholder(ctx, imageRect, item);
  }

  ctx.fillStyle = isInsetCard ? palette.surface : "rgba(255, 255, 255, 0.94)";
  ctx.fillRect(captionRect.x, captionRect.y, captionRect.w, captionRect.h);
  drawCaptionText(ctx, captionRect, item, caption);

  ctx.restore();
  drawStroke(ctx, rect, palette.border, radius);
}

function getCaptionMetrics(rect, item) {
  const titleSize = clamp(Math.round(rect.w * 0.05), 18, 32);
  const subtitleSize = clamp(Math.round(rect.w * 0.034), 13, 21);
  const pad = clamp(Math.round(rect.w * 0.035), 12, 22);
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);
  const titleHeight = title ? Math.round(titleSize * 1.16) : 0;
  const subtitleHeight = subtitle ? Math.round(subtitleSize * 1.24) : 0;
  const gap = title && subtitle ? Math.max(4, Math.round(subtitleSize * 0.25)) : 0;
  const desired = pad * 2 + titleHeight + gap + subtitleHeight;
  const maxHeight = Math.round(rect.h * 0.38);

  return {
    height: clamp(desired, Math.round(rect.h * 0.18), maxHeight),
    pad,
    titleSize,
    subtitleSize,
  };
}

function drawCaptionText(ctx, rect, item, metrics) {
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);
  const x = rect.x + metrics.pad;
  const maxWidth = rect.w - metrics.pad * 2;
  let y = rect.y + metrics.pad;

  if (title) {
    const titleHeight = drawWrappedText({
      ctx,
      text: title,
      x,
      y,
      maxWidth,
      maxLines: 1,
      size: metrics.titleSize,
      weight: 800,
      color: palette.ink,
      family: "Poppins, sans-serif",
      align: "left",
    });
    y += titleHeight + Math.max(4, Math.round(metrics.subtitleSize * 0.22));
  }

  if (subtitle) {
    drawWrappedText({
      ctx,
      text: subtitle,
      x,
      y,
      maxWidth,
      maxLines: 1,
      size: metrics.subtitleSize,
      weight: 500,
      color: palette.soft,
      family: "Poppins, sans-serif",
      align: "left",
    });
  }
}

function drawPlaceholder(ctx, rect, item) {
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
  ctx.font = `800 ${clamp(Math.round(rect.w * 0.055), 18, 34)}px Poppins, sans-serif`;
  ctx.fillStyle = palette.soft;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawWrappedText(options) {
  const { ctx, text, x, y, maxWidth, maxLines, weight, color, family, align } = options;
  if (!text) return 0;

  let size = options.size;
  let lines = [];

  while (size >= 11) {
    ctx.font = `${weight} ${size}px ${family}`;
    lines = wrapText(ctx, text, maxWidth);
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
    if (lines.length <= maxLines && widest <= maxWidth) break;
    size -= 1;
  }

  lines = lines.slice(0, maxLines);
  const lineHeight = Math.round(size * 1.16);

  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  ctx.restore();

  return lines.length * lineHeight;
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
    title: `Keyboard angle ${index + 1}`,
    subtitle: "Add photo title and subtitle",
    ready: false,
  }));
}

function getItemTitle(item) {
  return (item && item.title ? item.title : "").trim();
}

function getItemSubtitle(item) {
  return (item && item.subtitle ? item.subtitle : "").trim();
}

function makeDefaultTitle(fileName) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return "Keyboard detail";
  return base.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

syncModeButtons();
syncImages();
render();
