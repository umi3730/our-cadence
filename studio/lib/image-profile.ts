import { suggestedMood, type MusicProfile, type ProfileImage, type Mood, type SemanticTag, type VisualSlice } from './music';

type AnalysisResult = { image: ProfileImage; music: MusicProfile; mood: Mood };
const SIZE = 112;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
function hue(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
function luma(r: number, g: number, b: number) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function skinLike(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return Number(r > 70 && g > 42 && b > 28 && max - min > 12 && Math.abs(r - g) > 7 && r > g && g > b);
}
function fingerprint(data: Uint8ClampedArray) {
  let value = 2166136261;
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 24) continue;
    const packed = ((data[i] >> 4) << 12) | ((data[i + 1] >> 4) << 8) | ((data[i + 2] >> 4) << 4) | (data[i + 3] >> 4);
    value = Math.imul(value ^ packed, 16777619);
  }
  return `img-${(value >>> 0).toString(16).padStart(8, '0')}`;
}
function topPalette(data: Uint8ClampedArray) {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 8) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.18) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count += alpha; bin.r += r * alpha; bin.g += g * alpha; bin.b += b * alpha; bins.set(key, bin);
  }
  return [...bins.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(v => {
    const toHex = (n: number) => Math.round(n / v.count).toString(16).padStart(2, '0');
    return `#${toHex(v.r)}${toHex(v.g)}${toHex(v.b)}`;
  });
}
function makeThumbnail(bitmap: ImageBitmap) {
  // Persist a high-resolution preview. The UI uses the original object URL for the current session;
  // this 900px copy is only the reload/project-file fallback, so it should still look crisp.
  const maxSide = 900, scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true })!;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL('image/webp', 0.9);
}

type SliceAccumulator = { count: number; sumL: number; sumL2: number; sumSat: number; sumWarm: number; sumEdge: number; edgeCount: number };
function createSlice(): SliceAccumulator { return { count: 0, sumL: 0, sumL2: 0, sumSat: 0, sumWarm: 0, sumEdge: 0, edgeCount: 0 }; }
function finishSlice(slice: SliceAccumulator, total = SIZE * SIZE): VisualSlice {
  if (!slice.count) return { brightness: 50, saturation: 0, contrast: 0, complexity: 0, warmth: 50, size: 0 };
  const meanL = slice.sumL / slice.count, variance = Math.max(0, slice.sumL2 / slice.count - meanL * meanL);
  return {
    brightness: Math.round(clamp(meanL / 255 * 100)),
    saturation: Math.round(clamp(slice.sumSat / slice.count * 100)),
    contrast: Math.round(clamp(Math.sqrt(variance) / 72 * 100)),
    complexity: Math.round(clamp((slice.sumEdge / Math.max(1, slice.edgeCount)) / 52 * 100)),
    warmth: Math.round(clamp(slice.sumWarm / slice.count * 100)),
    size: Math.round(clamp(slice.count / Math.max(1, total) * 100)),
  };
}
function push(slice: SliceAccumulator, light: number, sat: number, warm: number, edge: number, weight = 1) {
  slice.count += weight; slice.sumL += light * weight; slice.sumL2 += light * light * weight; slice.sumSat += sat * weight; slice.sumWarm += warm * weight; slice.sumEdge += edge * weight; slice.edgeCount += weight;
}
function addTag(target: SemanticTag[], label: string, confidence: number, source: SemanticTag['source']) {
  const capped = Math.round(clamp(confidence));
  const existing = target.find(tag => tag.label === label);
  if (existing) existing.confidence = Math.max(existing.confidence, capped);
  else target.push({ label, confidence: capped, source });
}

export async function analyzeImageFile(file: File): Promise<AnalysisResult> {
  if (!file.type.startsWith('image/')) throw new Error('请选择 JPG、PNG、WebP 等图片文件。');
  if (file.size > 20_000_000) throw new Error('图片不能超过 20 MB。');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE;
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!context) throw new Error('浏览器无法读取这张图片。');
    context.clearRect(0, 0, SIZE, SIZE);
    // contain: do not distort the subject, and keep transparent margins from character cutouts.
    const scale = Math.min(SIZE / bitmap.width, SIZE / bitmap.height), width = bitmap.width * scale, height = bitmap.height * scale;
    context.drawImage(bitmap, (SIZE - width) / 2, (SIZE - height) / 2, width, height);
    const pixels = context.getImageData(0, 0, SIZE, SIZE).data;
    const total = SIZE * SIZE;
    const alpha = new Float32Array(total), lumas = new Float32Array(total), sats = new Float32Array(total), warms = new Float32Array(total), edges = new Float32Array(total), saliency = new Float32Array(total);
    let visible = 0, transparent = 0, sumL = 0, sumL2 = 0, sumSat = 0, sumWarm = 0, redBias = 0, hueX = 0, hueY = 0, hueWeight = 0;
    const colorBins = new Set<number>();
    let minX = SIZE, minY = SIZE, maxX = 0, maxY = 0;

    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = y * SIZE + x, i = p * 4, a = pixels[i + 3] / 255;
      alpha[p] = a;
      if (a < 0.08) { transparent++; continue; }
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], light = luma(r, g, b), sat = saturation(r, g, b), h = hue(r, g, b), rad = h * Math.PI / 180, warm = (r - b + 255) / 510;
      lumas[p] = light; sats[p] = sat; warms[p] = warm;
      visible += a; sumL += light * a; sumL2 += light * light * a; sumSat += sat * a; sumWarm += warm * a; redBias += Math.max(0, r - (g + b) / 2) / 255 * a;
      if (sat > 0.08) { hueX += Math.cos(rad) * sat * a; hueY += Math.sin(rad) * sat * a; hueWeight += sat * a; }
      colorBins.add((r >> 5) << 6 | (g >> 5) << 3 | (b >> 5));
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (visible < 4) throw new Error('图片几乎没有可见内容。');
    const transparencyRatio = transparent / total;
    const alphaForeground = transparencyRatio > 0.08;
    const meanL = sumL / visible, variance = Math.max(0, sumL2 / visible - meanL * meanL);
    let edgeTotal = 0, edgeWeight = 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = y * SIZE + x;
      if (alpha[p] < 0.08) continue;
      let local = 0, n = 0;
      if (x + 1 < SIZE && alpha[p + 1] >= 0.08) { local += Math.abs(lumas[p] - lumas[p + 1]); n++; }
      if (y + 1 < SIZE && alpha[p + SIZE] >= 0.08) { local += Math.abs(lumas[p] - lumas[p + SIZE]); n++; }
      edges[p] = n ? local / n : 0; edgeTotal += edges[p] * alpha[p]; edgeWeight += alpha[p];
    }
    const avgEdge = edgeTotal / Math.max(1, edgeWeight);

    // Opaque images: estimate background from border similarity + center saliency.
    let borderL = 0, borderSat = 0, borderWarm = 0, borderCount = 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (!(x < 9 || x >= SIZE - 9 || y < 9 || y >= SIZE - 9)) continue;
      const p = y * SIZE + x; if (alpha[p] < 0.08) continue;
      borderL += lumas[p]; borderSat += sats[p]; borderWarm += warms[p]; borderCount++;
    }
    borderL /= Math.max(1, borderCount); borderSat /= Math.max(1, borderCount); borderWarm /= Math.max(1, borderCount);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = y * SIZE + x;
      if (alpha[p] < 0.08) continue;
      const centerDistance = Math.hypot((x - (SIZE - 1) / 2) / (SIZE / 2), (y - (SIZE - 1) / 2) / (SIZE / 2));
      const centerBias = clamp01(1 - centerDistance);
      const edgeBias = clamp01(edges[p] / Math.max(12, avgEdge * 2));
      const borderDifference = clamp01(Math.abs(lumas[p] - borderL) / 110 + Math.abs(sats[p] - borderSat) * .55 + Math.abs(warms[p] - borderWarm) * .4);
      saliency[p] = centerBias * .34 + edgeBias * .33 + borderDifference * .33;
    }
    const visibleSaliency = Array.from(saliency).filter((_, i) => alpha[i] >= 0.08).sort((a, b) => a - b);
    const threshold = visibleSaliency[Math.floor(visibleSaliency.length * 0.6)] ?? .45;

    const foreground = createSlice(), background = createSlice();
    let subjectCount = 0, subjectSkin = 0, subjectWarm = 0, subjectContrast = 0, centerSubject = 0, upperSubject = 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = y * SIZE + x, a = alpha[p]; if (a < 0.08) continue;
      const isForeground = alphaForeground ? a >= 0.18 : saliency[p] >= threshold;
      if (isForeground) {
        subjectCount += a;
        if (x > SIZE * .18 && x < SIZE * .82) centerSubject += a;
        if (y < SIZE * .48) upperSubject += a;
        subjectWarm += warms[p] * a; subjectContrast += Math.abs(lumas[p] - meanL) / 255 * a;
        const i = p * 4; subjectSkin += skinLike(pixels[i], pixels[i + 1], pixels[i + 2]) * a;
        push(foreground, lumas[p], sats[p], warms[p], edges[p], a);
      } else push(background, lumas[p], sats[p], warms[p], edges[p], a);
    }
    const subject = finishSlice(foreground, visible), backgroundSlice = finishSlice(background, visible);
    if (alphaForeground && backgroundSlice.size === 0) Object.assign(backgroundSlice, { brightness: 50, saturation: 0, contrast: 0, complexity: 0, warmth: 50, size: 0 });

    const bboxW = Math.max(1, maxX - minX + 1), bboxH = Math.max(1, maxY - minY + 1), bboxRatio = bboxH / bboxW;
    const centerProminence = clamp(centerSubject / Math.max(1, subjectCount) * 100);
    const upperBias = clamp(upperSubject / Math.max(1, subjectCount) * 100);
    const skinScore = clamp(subjectSkin / Math.max(1, subjectCount) * 360);
    const tallFigure = clamp((bboxRatio - .8) * 54);
    const cutoutBonus = alphaForeground ? 28 : 0;
    const personLikelihood = Math.round(clamp(centerProminence * .28 + upperBias * .12 + skinScore * .19 + tallFigure * .21 + cutoutBonus));
    const person = { likelihood: personLikelihood, prominence: Math.round(centerProminence), warmth: Math.round(clamp(subjectWarm / Math.max(1, subjectCount) * 100)), contrast: Math.round(clamp(subjectContrast / Math.max(1, subjectCount) * 220)) };

    let avgHue = hueWeight ? Math.atan2(hueY, hueX) * 180 / Math.PI : 0; if (avgHue < 0) avgHue += 360;
    const visual = {
      brightness: Math.round(clamp(meanL / 255 * 100)), saturation: Math.round(clamp(sumSat / visible * 100)), contrast: Math.round(clamp(Math.sqrt(variance) / 72 * 100)),
      complexity: Math.round(clamp(avgEdge / 52 * 78 + colorBins.size / 190 * 22)), warmth: Math.round(clamp(sumWarm / visible * 100)),
    };
    const red = clamp(redBias / visible * 250);
    // Background influence is suppressed for transparent character cutouts; this fixes false "night scene" readings.
    const bgWeight = backgroundSlice.size > 12 ? 1 : backgroundSlice.size / 12;
    const music: MusicProfile = {
      energy: Math.round(clamp(subject.contrast * .22 + subject.complexity * .24 + visual.saturation * .21 + person.prominence * .12 + Math.max(0, person.contrast - 38) * .11 + backgroundSlice.complexity * .1 * bgWeight)),
      warmth: Math.round(clamp(subject.warmth * .52 + visual.warmth * .28 + person.warmth * .2)),
      tension: Math.round(clamp(subject.contrast * .24 + subject.complexity * .18 + (100 - visual.brightness) * .12 + red * .2 + Math.max(0, 65 - person.likelihood) * .08 + backgroundSlice.contrast * .18 * bgWeight)),
      mystery: Math.round(clamp((100 - visual.brightness) * .18 + (100 - subject.saturation) * .14 + subject.complexity * .2 + Math.abs(visual.warmth - 50) * .15 + (100 - person.likelihood) * .07 + ((100 - backgroundSlice.brightness) * .16 + backgroundSlice.complexity * .1) * bgWeight)),
      brightness: Math.round(clamp(subject.brightness * (alphaForeground ? .72 : .46) + visual.brightness * .28 + backgroundSlice.brightness * .26 * bgWeight)),
      elegance: Math.round(clamp(person.likelihood * .28 + (100 - subject.complexity) * .14 + (100 - visual.contrast) * .1 + subject.saturation * .1 + (100 - Math.abs(subject.size - 46)) * .2 + 18)),
      aggression: Math.round(clamp(subject.contrast * .18 + subject.complexity * .2 + red * .3 + visual.saturation * .13 + person.contrast * .13 + Math.max(0, 58 - visual.brightness) * .06)),
      hue: Math.round(avgHue),
    };

    const semantics: SemanticTag[] = [];
    if (alphaForeground) addTag(semantics, '透明背景', 99, 'background');
    if (person.likelihood >= 56) addTag(semantics, '人物主体', person.likelihood, 'person');
    if (alphaForeground && person.likelihood >= 52) addTag(semantics, '角色立绘', 94, 'subject');
    else if (subject.size >= 24 && person.prominence >= 55) addTag(semantics, '主体突出', 62 + subject.size * .3, 'subject');
    if (!alphaForeground && visual.brightness < 34 && backgroundSlice.size > 15) addTag(semantics, '夜景', 62 + (34 - visual.brightness), 'background');
    if (!alphaForeground && visual.brightness > 67 && backgroundSlice.size > 15) addTag(semantics, '日照感', 56 + (visual.brightness - 67), 'background');
    if (visual.warmth < 42) addTag(semantics, '冷色', 55 + (42 - visual.warmth) * 1.4, 'global');
    if (visual.warmth > 60) addTag(semantics, '暖色', 55 + (visual.warmth - 60) * 1.2, 'global');
    if (visual.saturation < 34) addTag(semantics, '低饱和', 52 + (34 - visual.saturation), 'global');
    if (visual.saturation > 58) addTag(semantics, '高饱和', 52 + (visual.saturation - 58), 'global');
    if (subject.complexity > 56 && subject.contrast > 56) addTag(semantics, '强轮廓', 58 + (subject.contrast - 56), 'subject');
    if (red > 36 && visual.brightness < 62) addTag(semantics, '红黑调', 58 + red * .35, 'global');
    if (!alphaForeground && backgroundSlice.complexity > 56) addTag(semantics, '复杂场景', 52 + (backgroundSlice.complexity - 56), 'background');
    if (!alphaForeground && visual.saturation > 48 && visual.warmth < 45 && visual.brightness < 52) addTag(semantics, '霓虹', 66, 'background');
    semantics.sort((a, b) => b.confidence - a.confidence);

    const image: ProfileImage = {
      fingerprint: fingerprint(pixels), thumbnail: makeThumbnail(bitmap), palette: topPalette(pixels), visual,
      backgroundMode: alphaForeground ? 'transparent' : 'estimated',
      segments: { subject, background: backgroundSlice, person }, semantics: semantics.slice(0, 8),
    };
    return { image, music, mood: suggestedMood(music) };
  } finally { bitmap.close(); }
}
