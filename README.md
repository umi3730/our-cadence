# Our Cadence

为原创角色创建主题旋律，并延展为日常、回忆、战斗场景配乐。目前是浏览器内运行的声音样机，包含官网和创作工作室。

## 开始开发

安装 Node.js 24 和 Git。克隆仓库或解压源码包后，在项目根目录执行：

```sh
cd studio
npm run install:ci
npm run dev
```

访问终端打印的地址，通常为 http://localhost:5173；工作室为 `/studio`。首次安装需要联网。普通本地开发无需 API Key、数据库、Cloudflare 账号或 Codex 插件；干净副本自动使用 portable 模式。

当前支持角色图片与故事分析、三个主题候选、三种场景四轨编曲、混音、版本快照和 JSON / MIDI / WAV 导出。配置官方或公司网关 API Key 后，可在场景页手动请求 GPT-6 Astra 生成分段发展的四轨乐谱，声音仍由现有音源渲染；详见 [谱曲接入说明](studio/design/gpt-composer.md)。数据保存在当前浏览器的 localStorage，不会随 Git 同步给朋友；要分享音乐工程，请在工作室导出 JSON 后由对方导入。登录与云端存档尚未实现。

## 目录

| 路径 | 用途 |
| --- | --- |
| `studio/` | 主应用、测试、依赖锁文件和运行脚本 |
| `studio/README.md` | 功能边界、源码入口和脚手架说明 |
| `Our Cadence-需求与开发路线-v0.1.md` | 早期需求与后续路线；其中“未开发”描述是立项时状态 |
| `design/brand/` | 字标设计稿和生成说明 |
| `noise-portfilo copy/` | 原始视觉参考项目，主应用运行不依赖它 |
| `scripts/package-source.ps1` | 生成用于分享的源码 ZIP |
| [`修改日志/`](修改日志/README.md) | 按日期保存改动、验证结果、版本位置和待修问题 |

## 两人协作

建议主分支使用 `main`，每个功能独立建分支，通过 PR / MR 合并：

```sh
git switch main
git pull --ff-only
git switch -c feat/your-feature
```

修改后在 `studio/` 内验证：

```sh
npm run typecheck
npm test
npm run build
```

然后回到仓库根目录，检查差异并提交相关文件。依赖有变化时同时提交 `package.json` 和 `package-lock.json`；不要提交 `node_modules`、构建产物或个人环境配置。

## 首次上传

在 GitHub / GitLab 新建一个空仓库。源码 ZIP 不包含 `.git`，解压后需要初始化；本目录若已初始化，可跳过 `git init`。

```sh
git init -b main
git status --short
git add .
git diff --cached --stat
git commit -m "Initial Our Cadence source"
git remote add origin <你的仓库地址>
git push -u origin main
```

朋友获得仓库访问权限后，克隆仓库并按“开始开发”操作即可。

## 重新打包

在已初始化的仓库根目录用 PowerShell 执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-source.ps1
```

ZIP 输出到 `releases/`，按 Git 忽略规则收集当前源码，包含尚未提交的新文件，不包含 Git 历史。文件路径清单与 SHA-256 校验值一起生成。打包前请先检查 `git status`，确认当前文件都适合分享。
