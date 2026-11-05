# 宣传页与媒体素材

主题：**我的 AI 员工，入职大厂了。** 英文标题为 **You hired AI. Now take a break.**，表达 AI 工作、你可以休息。工区、工卡与猫共同构成主视觉。黑色外场、米黄墙面、薄荷绿和暖黄沿用项目的视觉语言。

## 静态 Hero

页面位于产品仓库 `site/`，按 melon-ops / project-init 基线 v3 的「静态宣传页」维护：纯 HTML、CSS、图片、预渲染视频与少量脚本，无构建依赖。运行 `npm run promo:preview`，访问 `http://127.0.0.1:5175/`；也可直接打开 `site/index.html`。应用的 Vite 构建不包含宣传页。宣传页播放离线生成的办公室无声循环视频，不启动实时场景引擎、不引入 Phaser、不连接 WebSocket、hooks 或外部模型，也不读取本地任务；脚本处理中文/英文切换，并在系统要求减少动态效果时停止自动播放。视频提供原生播放控制，可手动暂停。下载按钮沿用 Drip 的方案：加载公开 OSS `latest.json`，取 `files.arm64`（本项目为同时支持 Apple 芯片和 Intel 的 universal DMG）。校验 HTTPS 来源、项目目录、`.dmg` 后缀和无嵌入凭据，再用 HEAD 确认可访问后替换下载链接；清单和 HEAD 共用五秒超时，失败、缺字段或非法地址时保留 HTML 中的 GitHub Release 链接。禁用脚本或清单尚未加载完成时也保留 GitHub。普通 GitHub 源码按钮不变。

桌面布局为主题文案、等距工区及前景工卡。手机布局将工卡下移，保留工区与行政猫；页面只保留 Hero 和页脚，移除四场景说明与底部重复介绍。工卡复用实际档案中的夹扣、角色头像、岗位、来源、工作状态和任务摘要样式。页面中的姓名、项目、在岗时长属于固定示例档案。

循环视频：`site/assets/office-loop-v1.mp4`（1448×1086，20 秒、20 fps、H.264 / yuv420p，无声）；静态封面：`site/assets/office-hero-v1.png`；工卡头像：`site/assets/tian-portrait-v1.png`。页面渲染资源均在 `site/` 内，不依赖社交平台宣传视频、本地桥接或 Node 服务；仅下载链接查询公开 OSS 版本清单。资源采用版本化文件名；上线后修改图片、样式或脚本须换文件名，避免长缓存影响。

## 离线生成

依赖 macOS AppKit、Swift 编译器和 FFmpeg；不需要 API Key。运行：

```bash
npm run promo:render
```

`tools/render_promo.swift` 只读取仓库里的场景、角色图集及布局导航，生成固定剧情；人物经过现有通道，老板穿过玻璃门。`scripts/render-promo.sh` 编译渲染器、编码视频，并生成网页封面与独立办公室循环视频。

输出在被 Git 忽略的 `promo-output/`，避免把视频产物放入源代码历史：

| 文件 | 内容 |
| --- | --- |
| `hero-1920x1080.png` | 中文 Hero 静态设计稿，包含工区与工卡 |
| `x-cover-1920x1080.png` | 英文横版封面，包含工区与工卡 |
| `xiaohongshu-cover-1080x1920.png` | 中文竖版封面，包含工卡与猫 |
| `x-promo-1920x1080.mp4` | 20 秒、20 fps、H.264 / yuv420p，英文横版，无声 |
| `xiaohongshu-promo-1080x1920.mp4` | 20 秒、20 fps、H.264 / yuv420p，中文竖版，无声 |
| `x-promo-960x540.gif` | 20 秒、10 fps，横版循环 GIF |

视频四幕各五秒：开工 → 举手找老板 → 交付喝咖啡/撸猫 → 老板出现、大家假装忙碌。影片与封面使用「演示」标记，03:00 和工卡数据是创作示例，均不来自真实会话。横版含公开 GitHub 地址；竖版使用项目与甜瓜科技署名。没有自动发帖、合并或发布步骤。

Hero PNG 是独立宣传设计稿，并非网页截图；HTML 的布局应在桌面和手机浏览器中分别验收。

## 验证

代码按 `scripts/ci-test.sh` 执行基线检查。渲染后使用 `ffprobe` 核对尺寸、时长、帧数与编码，并抽取各剧情节点检查文字、工卡、通道和透明素材。视频默认不含配音和音乐，可在剪辑时补充。

## 后续部署

按项目基线「静态宣传页」使用 `scripts/deploy-page.sh`，脚本来自 project-init 模板，仅将服务名设为已登记的 `melon-office-page`，页面目录为 `site`。它与桌面端发布完全独立：

- 页面使用 `page-v*`；桌面端继续使用原有版本前缀和门户。
- 页面只允许从已推送的干净 main 发布，通过环境变量 `PAGE_DEPLOY_SSH` 调用部署入口；不在公开仓库写主机地址、站点目录或部署密钥。
- 部署入口从 GitHub 对应 tag 取 `site/`，原子切换版本并支持回滚；不使用 rsync、不起容器、不增加 Dockerfile 或 `/health`。
- 腾讯站服务注册、部署入口与限定钥匙、反代、DNS/证书及 Gatus 首页探活由 melon-ops 管理；服务登记为 `melon-office-page`，实际发布版本以部署入口 `status` 为准。发布须有用户明确指令，不能随代码提交自动触发。
- 静态宣传页统一门户发布已记入 melon-ops 路线待办，后续由平台补齐发布、回滚与状态查询，再统一接入 Drip 和本项目。
