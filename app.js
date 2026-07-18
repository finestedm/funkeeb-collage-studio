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

const logoIconAspect = 880 / 424;
const logoIconSourceRatio = 880 / 1903.9945;
const storageKey = "funkeeb-collage-studio:settings:v1";
const storedImageMaxSide = 1600;
const storedImageQuality = 0.78;
const savedSettings = loadSettings();

const state = {
  images: [],
  mode: normalizeMode(savedSettings.mode),
  ratio: normalizeRatio(savedSettings.ratio),
  background: normalizeBackground(savedSettings.background),
  gap: normalizeGap(savedSettings.gap),
  forceTextLogo: false,
};

const elements = {
  canvas: document.getElementById("previewCanvas"),
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  imageMeta: document.getElementById("imageMeta"),
  thumbList: document.getElementById("thumbList"),
  ratioSelect: document.getElementById("ratioSelect"),
  backgroundSelect: document.getElementById("backgroundSelect"),
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
let previewTargets = [];
let dragState = null;

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

elements.canvas.addEventListener("pointerdown", handleCanvasPointerDown);
elements.canvas.addEventListener("pointermove", handleCanvasPointerMove);
elements.canvas.addEventListener("pointerup", finishCanvasDrag);
elements.canvas.addEventListener("pointercancel", finishCanvasDrag);
elements.canvas.addEventListener("lostpointercapture", finishCanvasDrag);
elements.canvas.addEventListener("pointerleave", handleCanvasPointerLeave);

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
  saveSettings();
});

elements.backgroundSelect.addEventListener("change", () => {
  state.background = normalizeBackground(elements.backgroundSelect.value);
  render();
  saveSettings();
});

elements.gapInput.addEventListener("input", () => {
  state.gap = Number(elements.gapInput.value);
  elements.gapValue.textContent = `${state.gap} px`;
  render();
  saveSettings();
});

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    syncModeButtons();
    render();
    saveSettings();
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
  state.images.forEach(revokeImageUrl);
  state.images = [];
  syncImages();
  render();
  saveSettings();
});

function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));

  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    const defaultTitle = makeDefaultTitle(file.name);
    const signature = createFileSignature(file);
    const storedImage = getStoredImageSettings(signature);
    const item = createImageItem({
      id: createId(),
      storageId: createStorageId(signature),
      signature,
      name: file.name,
      title: getStoredText(storedImage, "title", defaultTitle),
      subtitle: getStoredText(storedImage, "subtitle", "FunkeeB keyboard detail"),
      focalX: normalizePercent(storedImage.focalX),
      focalY: normalizePercent(storedImage.focalY),
      rotation: normalizeRotation(storedImage.rotation),
      url,
      source: storedImage.source || "",
      objectUrl: true,
    });

    state.images.push(item);
    persistImageSource(file, item);
  });

  syncImages();
  render();
  saveSettings();
}

function createImageItem(options) {
  const item = {
    id: options.id,
    storageId: options.storageId,
    signature: options.signature,
    name: options.name,
    title: options.title,
    subtitle: options.subtitle,
    focalX: options.focalX,
    focalY: options.focalY,
    rotation: options.rotation,
    url: options.url,
    source: options.source || "",
    objectUrl: Boolean(options.objectUrl),
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
  item.image.src = item.url;

  return item;
}

function handleCanvasPointerDown(event) {
  const target = findPreviewTarget(event);
  if (!target) return;

  const point = getCanvasPoint(event);
  event.preventDefault();
  elements.canvas.setPointerCapture(event.pointerId);
  dragState = {
    pointerId: event.pointerId,
    item: target.item,
    metrics: target.metrics,
    startX: point.x,
    startY: point.y,
    startFocalX: normalizePercent(target.item.focalX),
    startFocalY: normalizePercent(target.item.focalY),
  };
  elements.canvas.classList.add("is-dragging");
}

function handleCanvasPointerMove(event) {
  if (dragState) {
    if (event.pointerId !== dragState.pointerId) return;
    const point = getCanvasPoint(event);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    const nextX =
      dragState.metrics.overflowX > 0
        ? dragState.startFocalX - (deltaX / dragState.metrics.overflowX) * 100
        : dragState.startFocalX;
    const nextY =
      dragState.metrics.overflowY > 0
        ? dragState.startFocalY - (deltaY / dragState.metrics.overflowY) * 100
        : dragState.startFocalY;

    event.preventDefault();
    dragState.item.focalX = roundToTenth(clamp(nextX, 0, 100));
    dragState.item.focalY = roundToTenth(clamp(nextY, 0, 100));
    updateThumbPosition(dragState.item);
    render();
    return;
  }

  elements.canvas.classList.toggle("is-draggable", Boolean(findPreviewTarget(event)));
}

function finishCanvasDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  updateThumbPosition(dragState.item);
  saveSettings();
  dragState = null;
  elements.canvas.classList.remove("is-dragging", "is-draggable");
}

function handleCanvasPointerLeave() {
  if (!dragState) elements.canvas.classList.remove("is-draggable");
}

function findPreviewTarget(event) {
  const point = getCanvasPoint(event);
  for (let index = previewTargets.length - 1; index >= 0; index -= 1) {
    const target = previewTargets[index];
    if (isPointInRect(point, target.rect)) return target;
  }
  return null;
}

function getCanvasPoint(event) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * elements.canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * elements.canvas.height,
  };
}

function isPointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function updateThumbPosition(item) {
  const thumb = Array.from(elements.thumbList.querySelectorAll(".thumb-preview img")).find(
    (image) => image.dataset.itemId === item.id,
  );
  if (!thumb) return;
  thumb.style.objectPosition = `${item.focalX}% ${item.focalY}%`;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveSettings() {
  if (writeSettings(createSettingsSnapshot(true))) return;
  writeSettings(createSettingsSnapshot(false));
}

function createSettingsSnapshot(includeSources) {
  const images = {};
  const imageOrder = [];

  state.images.forEach((item) => {
    const storageId = item.storageId || item.signature || item.id;
    imageOrder.push(storageId);
    images[storageId] = {
      signature: item.signature || storageId,
      name: item.name || "Saved image",
      title: item.title || "",
      subtitle: item.subtitle || "",
      focalX: normalizePercent(item.focalX),
      focalY: normalizePercent(item.focalY),
      rotation: normalizeRotation(item.rotation),
      source: includeSources ? item.source || "" : "",
    };
  });

  return {
    version: 2,
    mode: normalizeMode(state.mode),
    ratio: normalizeRatio(state.ratio),
    background: normalizeBackground(state.background),
    gap: normalizeGap(state.gap),
    imageOrder,
    images,
  };
}

function writeSettings(nextSettings) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextSettings));
    Object.keys(savedSettings).forEach((key) => delete savedSettings[key]);
    Object.assign(savedSettings, nextSettings);
    return true;
  } catch (error) {
    // Storage can fail in private browsing or when the browser quota is full.
    return false;
  }
}

function getStoredImageSettings(signature) {
  const images = getSavedImagesMap();
  const storedImage = images[signature] || Object.values(images).find((image) => image.signature === signature);
  return storedImage && typeof storedImage === "object" ? storedImage : {};
}

function getSavedImagesMap() {
  const images = savedSettings.images;
  if (!images) return {};
  if (Array.isArray(images)) {
    return Object.fromEntries(
      images
        .filter((image) => image && typeof image === "object")
        .map((image, index) => [image.storageId || image.signature || `saved-${index}`, image]),
    );
  }
  return typeof images === "object" ? images : {};
}

function getSavedImageOrder(images) {
  const order = Array.isArray(savedSettings.imageOrder) ? savedSettings.imageOrder : [];
  const orderedIds = order.filter((id) => Object.prototype.hasOwnProperty.call(images, id));
  const restIds = Object.keys(images).filter((id) => !orderedIds.includes(id));
  return orderedIds.concat(restIds);
}

function restoreSavedImages() {
  const images = getSavedImagesMap();
  getSavedImageOrder(images).forEach((storageId) => {
    const storedImage = images[storageId];
    if (!storedImage || typeof storedImage.source !== "string" || !storedImage.source.startsWith("data:image/")) return;

    const name = storedImage.name || "Saved image";
    const item = createImageItem({
      id: createId(),
      storageId,
      signature: storedImage.signature || storageId,
      name,
      title: getStoredText(storedImage, "title", makeDefaultTitle(name)),
      subtitle: getStoredText(storedImage, "subtitle", "FunkeeB keyboard detail"),
      focalX: normalizePercent(storedImage.focalX),
      focalY: normalizePercent(storedImage.focalY),
      rotation: normalizeRotation(storedImage.rotation),
      url: storedImage.source,
      source: storedImage.source,
      objectUrl: false,
    });
    state.images.push(item);
  });
}

async function persistImageSource(file, item) {
  try {
    const source = await createStoredImageSource(file);
    if (!state.images.includes(item)) return;
    item.source = source;
    saveSettings();
  } catch (error) {
    saveSettings();
  }
}

async function createStoredImageSource(file) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImageSource(source);
  return resizeImageForStorage(image);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function resizeImageForStorage(image) {
  const scale = Math.min(1, storedImageMaxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", storedImageQuality);
}

function createFileSignature(file) {
  return [file.name, file.size, file.lastModified, file.type].join("|");
}

function createStorageId(signature) {
  const usedIds = new Set(state.images.map((item) => item.storageId));
  const baseId = signature || createId();
  let storageId = baseId;
  let index = 2;
  while (usedIds.has(storageId)) {
    storageId = `${baseId}#${index}`;
    index += 1;
  }
  return storageId;
}

function revokeImageUrl(item) {
  if (item && item.objectUrl) URL.revokeObjectURL(item.url);
}

function syncControlsFromState() {
  elements.ratioSelect.value = state.ratio;
  elements.backgroundSelect.value = state.background;
  elements.gapInput.value = String(state.gap);
  elements.gapValue.textContent = `${state.gap} px`;
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

    const thumbFrame = document.createElement("div");
    thumbFrame.className = "thumb-preview";

    const thumb = document.createElement("img");
    thumb.src = item.url;
    thumb.alt = "";
    thumb.dataset.itemId = item.id;
    thumb.style.objectPosition = `${item.focalX}% ${item.focalY}%`;
    thumb.style.transform = `rotate(${normalizeRotation(item.rotation)}deg)`;
    thumbFrame.append(thumb);

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
        saveSettings();
      }),
      createCaptionField("Subtitle", item.subtitle, (value) => {
        item.subtitle = value;
        render();
        saveSettings();
      }),
    );

    const adjustmentFields = document.createElement("div");
    adjustmentFields.className = "thumb-adjust-fields";
    adjustmentFields.append(
      createRotationField(item.rotation, (value) => {
        item.rotation = value;
        thumb.style.transform = `rotate(${item.rotation}deg)`;
        render();
        saveSettings();
      }),
    );
    fields.append(adjustmentFields);

    body.append(titleRow, fields);
    row.append(thumbFrame, body);
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

function createRotationField(value, onChange) {
  const label = document.createElement("label");
  label.className = "field";

  const caption = document.createElement("span");
  caption.textContent = "Obrot";

  const select = document.createElement("select");
  [0, 90, 180, 270].forEach((rotation) => {
    const option = document.createElement("option");
    option.value = String(rotation);
    option.textContent = `${rotation} deg`;
    select.append(option);
  });
  select.value = String(normalizeRotation(value));
  select.addEventListener("change", () => onChange(Number(select.value)));

  label.append(caption, select);
  return label;
}

function moveImage(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.images.length) return;
  const [item] = state.images.splice(index, 1);
  state.images.splice(nextIndex, 0, item);
  syncImages();
  render();
  saveSettings();
}

function removeImage(id) {
  const index = state.images.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [item] = state.images.splice(index, 1);
  revokeImageUrl(item);
  syncImages();
  render();
  saveSettings();
}

function render() {
  const [width, height] = ratios[state.ratio];
  elements.canvas.width = width;
  elements.canvas.height = height;
  elements.canvasSize.textContent = `${width} x ${height}`;
  previewTargets = [];
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  drawBackground(context, width, height, state.background);

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

function drawBackground(ctx, width, height, style) {
  if (style === "white") {
    drawWhiteBackground(ctx, width, height);
    return;
  }

  drawSoftBase(ctx, width, height);

  if (style === "circles") {
    drawCircleBackground(ctx, width, height);
  } else if (style === "lines") {
    drawLineBackground(ctx, width, height);
  } else if (style === "squiggles") {
    drawSquiggleBackground(ctx, width, height);
  } else if (style === "dots") {
    drawDotBackground(ctx, width, height);
  } else {
    drawFunkeebBackground(ctx, width, height);
  }
}

function drawWhiteBackground(ctx, width, height) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
}

function drawSoftBase(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.background);
  gradient.addColorStop(0.62, palette.surfaceLow);
  gradient.addColorStop(1, palette.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawFunkeebBackground(ctx, width, height) {
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

function drawCircleBackground(ctx, width, height) {
  ctx.save();
  const circles = [
    { x: 0.15, y: 0.24, r: 0.16, color: palette.blue, alpha: 0.12 },
    { x: 0.86, y: 0.2, r: 0.11, color: palette.orange, alpha: 0.1 },
    { x: 0.82, y: 0.82, r: 0.18, color: palette.lime, alpha: 0.1 },
    { x: 0.18, y: 0.78, r: 0.1, color: palette.orange, alpha: 0.08 },
  ];

  circles.forEach((circle) => {
    const radius = Math.min(width, height) * circle.r;
    ctx.globalAlpha = circle.alpha;
    ctx.strokeStyle = circle.color;
    ctx.lineWidth = Math.max(2, width * 0.003);
    ctx.beginPath();
    ctx.arc(width * circle.x, height * circle.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = circle.alpha * 0.55;
    ctx.beginPath();
    ctx.arc(width * circle.x, height * circle.y, radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
  drawAccentBand(ctx, width, height, 0.16);
}

function drawLineBackground(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = Math.max(1, width * 0.0018);
  ctx.strokeStyle = palette.blue;

  for (let x = -width * 0.25; x < width * 1.25; x += width / 9) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + width * 0.22, height);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = palette.orange;
  for (let y = height * 0.18; y < height; y += height / 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + height * 0.045);
    ctx.stroke();
  }

  ctx.restore();
  drawAccentBand(ctx, width, height, 0.18);
}

function drawSquiggleBackground(ctx, width, height) {
  ctx.save();
  ctx.lineWidth = Math.max(2, width * 0.0022);
  const rows = 5;

  for (let row = 0; row < rows; row += 1) {
    const y = height * (0.18 + row * 0.16);
    ctx.globalAlpha = row % 2 === 0 ? 0.14 : 0.1;
    ctx.strokeStyle = row % 2 === 0 ? palette.orange : palette.blue;
    ctx.beginPath();
    ctx.moveTo(-width * 0.05, y);

    for (let x = -width * 0.05; x < width * 1.08; x += width * 0.18) {
      ctx.bezierCurveTo(x + width * 0.045, y - height * 0.045, x + width * 0.135, y + height * 0.045, x + width * 0.18, y);
    }

    ctx.stroke();
  }

  ctx.restore();
  drawAccentBand(ctx, width, height, 0.14);
}

function drawDotBackground(ctx, width, height) {
  ctx.save();
  const step = Math.max(34, Math.round(width * 0.046));
  const radius = Math.max(2, Math.round(width * 0.0032));

  for (let y = step * 0.7; y < height; y += step) {
    for (let x = step * 0.7; x < width; x += step) {
      const alternate = (Math.round(x / step) + Math.round(y / step)) % 3 === 0;
      ctx.globalAlpha = alternate ? 0.18 : 0.1;
      ctx.fillStyle = alternate ? palette.orange : palette.blue;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
  drawAccentBand(ctx, width, height, 0.15);
}

function drawAccentBand(ctx, width, height, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
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
  const iconWidth = Math.round(height * logoIconAspect);
  const gap = Math.round(height * 0.18);
  const fontSize = Math.round(height * 0.76);
  ctx.save();
  ctx.font = `800 ${fontSize}px Poppins, sans-serif`;
  const textWidth = ctx.measureText("FunkeeB").width;
  ctx.restore();
  return iconWidth + gap + textWidth;
}

function drawLogoMark(ctx, x, y, height) {
  const iconWidth = Math.round(height * logoIconAspect);
  const gap = Math.round(height * 0.18);
  const fontSize = Math.round(height * 0.76);
  const textY = y + Math.round(height * 0.78);

  if (logoReady && !logoFailed && !state.forceTextLogo) {
    const sourceWidth = Math.round(logo.naturalWidth * logoIconSourceRatio);
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
    trackPreviewTarget(item, imageRect);
    drawImageCover(
      ctx,
      item.image,
      imageRect.x,
      imageRect.y,
      imageRect.w,
      imageRect.h,
      item.focalX,
      item.focalY,
      item.rotation,
    );
  } else {
    drawPlaceholder(ctx, imageRect, item);
  }

  ctx.fillStyle = isInsetCard ? palette.surface : "rgba(255, 255, 255, 0.94)";
  ctx.fillRect(captionRect.x, captionRect.y, captionRect.w, captionRect.h);
  drawCaptionText(ctx, captionRect, item, caption);

  ctx.restore();
  drawStroke(ctx, rect, palette.border, radius);
}

function trackPreviewTarget(item, rect) {
  if (!state.images.includes(item)) return;
  previewTargets.push({
    item,
    rect: { ...rect },
    metrics: getImageCoverMetrics(item.image, rect.w, rect.h, item.rotation),
  });
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

function drawImageCover(ctx, image, x, y, width, height, focalX = 50, focalY = 50, rotation = 0) {
  const metrics = getImageCoverMetrics(image, width, height, rotation);
  const normalizedRotation = normalizeRotation(rotation);
  const offsetX = (0.5 - clamp(focalX / 100, 0, 1)) * metrics.overflowX;
  const offsetY = (0.5 - clamp(focalY / 100, 0, 1)) * metrics.overflowY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.translate(x + width / 2 + offsetX, y + height / 2 + offsetY);
  ctx.rotate((normalizedRotation * Math.PI) / 180);
  ctx.drawImage(image, -metrics.drawWidth / 2, -metrics.drawHeight / 2, metrics.drawWidth, metrics.drawHeight);
  ctx.restore();
}

function getImageCoverMetrics(image, width, height, rotation = 0) {
  const quarterTurn = normalizeRotation(rotation) === 90 || normalizeRotation(rotation) === 270;
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const rotatedWidth = quarterTurn ? sourceHeight : sourceWidth;
  const rotatedHeight = quarterTurn ? sourceWidth : sourceHeight;
  const scale = Math.max(width / rotatedWidth, height / rotatedHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const frameWidth = rotatedWidth * scale;
  const frameHeight = rotatedHeight * scale;

  return {
    drawWidth,
    drawHeight,
    overflowX: Math.max(0, frameWidth - width),
    overflowY: Math.max(0, frameHeight - height),
  };
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
    focalX: 50,
    focalY: 50,
    rotation: 0,
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

function normalizeMode(value) {
  return ["grid", "collage", "cards"].includes(value) ? value : "grid";
}

function normalizeRatio(value) {
  return Object.prototype.hasOwnProperty.call(ratios, value) ? value : "square";
}

function normalizeBackground(value) {
  return ["funkeeb", "white", "circles", "lines", "squiggles", "dots"].includes(value) ? value : "funkeeb";
}

function normalizeGap(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? clamp(Math.round(nextValue), 8, 52) : 28;
}

function normalizePercent(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? clamp(Math.round(nextValue), 0, 100) : 50;
}

function normalizeRotation(value) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return 0;
  const snapped = Math.round(nextValue / 90) * 90;
  return ((snapped % 360) + 360) % 360;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function getStoredText(source, key, fallback) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return fallback;
  return typeof source[key] === "string" ? source[key].trim() : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

restoreSavedImages();
syncControlsFromState();
syncModeButtons();
syncImages();
render();
