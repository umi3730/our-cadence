# Our Cadence — 声音 MVP

新增可选的 **GPT-6 Astra 谱曲**：在“场景”页手动生成有段落变化的四轨乐谱，继续使用现有采样音源和 MIDI／WAV 导出。配置、数据格式与费用触发方式见 [GPT 谱曲说明](design/gpt-composer.md)。

> 2026-09-18：界面移除“攻击性”调节项，仅显示六项参数；旧工程字段保持兼容。首页字体、配色和装饰动效已更新，详见 [本次留档](../修改日志/2026-09-18_六维参数与视觉谱曲更新.md)。

> 2026-09-17：已暂时移除相似歌曲搜索及试听匹配接口；图片分析、主题生成、编曲与导出保留。

本次更新包括角色故事参与分析、分段参数尺、候选自动更新和四轨混音台。完整变化与已知限制见 [提交汇总](../修改日志/2026-09-17_本次提交汇总.md)。当前测试为 21 项中 20 项通过；继承的调式测试失败尚未修复，后文的早期验收记录仅对应当时版本。

第一阶段声音可行性样机：手填角色设定 → 三个四小节主题候选 → 选择主题 → 日常 / 回忆 / 战斗四轨编曲 → 保存与导出。

## 快速运行

需要 Node.js 24（测试使用内置 TypeScript 类型剥离）。

```powershell
cd studio
npm run install:ci
npm run dev
```

打开终端输出的本地地址，通常为 `http://localhost:5173/`（官网）。点击“进入工作室”前往 `/studio`，也可直接打开 `http://localhost:5173/studio`。两页同源，继续使用已有浏览器草稿。如本机 npm 的 Windows 启动包装发生路径错误，可直接启动：

```powershell
node scripts/run-framework.mjs dev
```

安装 / 构建也可以用 npm 的 JavaScript 入口：

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run install:ci
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build
```

## 当前能力

- 三个内置角色设定，可以编辑名字、文本与音乐气质。文本只作为可重复的随机种子；音乐气质选择大调、小调或多利亚调式，未接入 AI 语义分析。
- 每次生成三个四小节候选，可先试听；重新生成候选不会覆盖已选主题。切换已选主题、切换示例角色或恢复版本前，会保留当前草稿快照。
- 固定 4/4、16 小节、四轨编曲。三种场景保留主题音高、拍点与音长，改变配器、伴奏和默认速度。每种场景的自定义参数分别保存。
- 播放 / 停止 / 循环，调 BPM、旋律音色、各轨音量、静音与独奏。音量、静音、独奏可在播放中实时调整；速度、音色与场景变更后从头播放。
- 自动保存草稿、最多 40 个不可变版本、JSON 工程导入 / 导出。所有数据仅保存在当前浏览器，键为 `our-cadence.library.v1`；没有服务端存档。
- MIDI 格式 1：速度轨及四个音乐轨，鼓使用通道 10，保留音量与当前静音 / 独奏状态。不同 MIDI 播放器的音色可能不同。
- 44.1 kHz 立体声 PCM WAV，使用与试听相同的合成音源及混音图，包含 1.1 秒尾音。16 小节时长随 BPM 变化。

## 当前边界

这是声音样机，不是完整 MVP 文档里 B–D 阶段的交付。尚未接入图片上传 / 分析、音符网格编辑、撤销重做、采样乐器、AI 成曲、登录与云端存储。音色来自 Web Audio 振荡器与合成鼓，不依赖第三方采样授权或付费 API。

浏览器首次发声需要本人点击播放按钮；音频权限受限时会显示错误并允许重试。草稿保存失败会显示提示，不宣称保存成功。损坏的旧存档不会被自动覆盖。导入校验失败不改变当前工程。请定期导出 JSON 备份。

## 验证

```powershell
npm run typecheck
npm test
npm run build
```

7 项核心测试覆盖主题重现与保留、MIDI 结构 / 音符 / 混音、WAV 编码、工程快照与导入校验。浏览器功能接口实测：三种编曲均输出非零四轨信号及双声道 WAV；日常 / 回忆 / 战斗峰值约为 0.367 / 0.279 / 0.385，均小于 1；刷新后恢复主题和编曲。自动化环境没有获得扬声器播放权限，已验证其失败提示；实际听感及不同浏览器兼容性仍待人工验收。

前端现按项目中的 `noise-portfilo copy` 完全重构：官网左上角保留用户提供的手写字标，三个主画面使用居中的 Inter 500 斜体英文标题、小字索引及下方两侧的说明与入口按钮，保留三屏切换、细线胶囊按钮与圆形翻页器；生成式人物插画已从首页和工作室撤下展示；工作室采用两侧信息、中间操作的三栏详情页布局。首页使用 WebGL 3D simplex noise 生成奶白、香槟金与浅杏色雾，四周较明显、文字区域更淡，三屏共用连续动画，增强噪声演化速度与坐标漂移以呈现明显动态；无颗粒层。渲染限制为最高 30 FPS 和 1280×900 像素，后台暂停，减少动态效果模式下保留静态帧，WebGL 不可用时回退静态渐变。工作室仍保持纯色背景。首页主内容区加入金黄色四角星拖尾，每六个粒子点缀一个灰黑音符，约一秒内淡出；控件上不产生粒子，触屏与减少动态效果模式下停用，无新增依赖。音乐核心与 `our-cadence.library.v1` 存档格式未改动，未发布到外部环境。

上一版前端已备份到 `design/archive/frontend-before-noise-20260916.zip`，参考文件夹保持原样。检视用副本及其依赖位于被忽略的 `.sites-runtime/reference-preview`，不是运行应用的一部分。

## 代码入口

- `app/page.tsx` / `components/landing.tsx`：三屏首页、滚轮 / 按钮 / 键盘翻页和工作室入口。
- `components/simplex-background.tsx` / `vendor/simplex-noise-3d.ts`：首页色雾着色器与保留 MIT 许可的 Ashima Arts simplex noise 实现。
- `app/studio/page.tsx` / `components/creation-studio.tsx`：角色、主题、场景、混音、存档与导出。
- `components/editorial-ui.tsx`：共用导航、文字悬浮动效和圆形翻页器。
- `app/globals.css` / `app/studio.css` / `app/landing.css`：单色视觉系统、三栏工作室与三屏首页；旧 `mvp.css` 不被页面引用。
- `lib/music.ts`：确定性主题与四轨编曲。
- `lib/audio.ts`：离线四轨合成、实时混音、WAV 编码。
- `lib/midi.ts`：标准 MIDI 写入。
- `lib/project.ts`：工程结构、校验、版本与文件备份。
- `lib/webmcp.ts`：页面音乐操作接口，支持读工程、选择主题 / 场景、播放 / 停止、导出 WAV。

## 底层脚手架说明

以下保留初始化工具的运行维护说明。应用当前不使用数据库或身份认证。

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter with the explicit `--execution-profile portable` or `--execution-profile managed-linux` argument from the plugin's setup instructions. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Clean clones default to the portable profile and can run the npm commands directly without a plugin. When using the Sites plugin, follow its instructions to run `configure-execution-profile.mjs --execution-profile <portable|managed-linux>` before project commands. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

On managed Linux, use `sites-preview start` only for requested browser QA. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## Image → Music Profile prototype

The studio can now analyze a local image before theme generation. The current prototype runs entirely in the browser and does **not** upload the source image. It extracts deterministic visual features (brightness, saturation, contrast, warmth, palette and image complexity), maps them into an editable seven-axis Music Profile, and uses that profile to alter theme scale, density, contour, dynamics and suggested scene tempos.

Music Profile axes: Energy, Warmth, Tension, Mystery, Brightness, Elegance and Aggression. The small image thumbnail and visual fingerprint are stored with the project so the profile survives export/import without embedding the full-resolution image.

This is intentionally a visual-feature prototype rather than semantic character recognition. A future CLIP/VLM layer can replace or augment the analyzer while keeping the same Music Profile contract and deterministic composition pipeline.
