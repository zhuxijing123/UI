Original prompt: 现在我需要你新建一个项目，就是UI素材编辑器，使用TS来写，功能包括UI编辑，角色NPC怪物动画素材查看编辑，技能特效动画查看编辑，地图编辑查看等综合一体工具。UI素材功能类似Cocos creator3.8的界面及功能，明白吗？项目，Ui文件，节点，预览 编辑 拖动等等。做出这个功能之后就很方便调整UI及素材，明白吗？UI工具需要解析对应的素材，包括BIZ。工具同时也包括biz及plist 对应图片素材的查看编辑解析解包打包。就是这个新的游戏对应的工具，完整的工具。明白吗？开始设计这个项目功能。启动测试及编辑UI及素材等等，知道完整完美可用。就是针对这个新游戏所需要的专业的综合编辑器。可以更改重构当前新游戏的前端，比如说如何读取游戏的UI界面，如何创建新的UI文件，读取 保存，双向的。项目提交到https://github.com/zhuxijing123/UI这个仓库。并且使用多个子agent来协同完成这个项目。可以是5个子智能体，也可以更多。

2026-03-26
- 初始化了 `D:\game\BRM-TS\UI` 仓库并落下 Vite React TS 骨架。
- 已新增基础解析层：
  - `src/editor/types.ts`
  - `src/editor/formats.ts`
  - `src/editor/workspace.ts`
- 已修正资产识别策略：
  - `.biz` 走二进制动画索引
  - `.diz/.tiz/.lua/.xml` 先按文本对待，避免误识别
  - `uilayout`/`uilayout-json` 路径下的布局文件识别为 UI 布局
- 当前主任务：
  - 用工作台界面替换默认 Vite 页面
  - 接入工作区扫描、资源树、文档标签、预览区、属性面板、日志
  - 跑通 UI 布局编辑和 mapo 基础编辑/保存
- 子智能体并行事项：
  - UI 旧链路抽取方案
  - 浏览器测试与防卡死流程
  - biz/plist/mapo/diz/tiz 读写优先级
  - Cocos Creator 风格工作台信息架构
  - 角色/特效/地图预览组件拆分建议

Next
- 完成 `src/App.tsx` / `src/App.css` / `src/index.css` 工作台重写
- 安装依赖并执行 `typecheck` / `build`
- 启动浏览器真实验证并补首轮截图与日志

2026-03-26 Later
- 已完成工作台壳体重写：
  - 顶栏
  - 资源树
  - 文档标签
  - 预览区
  - 层级树
  - 属性面板
  - 日志面板
- 已补充编辑器组件目录：
  - `src/editor/components/AssetBrowserTree.tsx`
  - `src/editor/components/HierarchyTree.tsx`
  - `src/editor/components/PreviewPane.tsx`
  - `src/editor/components/InspectorPane.tsx`
  - `src/editor/components/MapDocumentCanvas.tsx`
  - `src/editor/components/WelcomeHome.tsx`
  - `src/editor/components/EmptyState.tsx`
- 已落地能力：
  - UI 布局新建、节点选择、节点拖拽、属性编辑、增删子节点
  - atlas/plist 解析与帧高亮
  - biz 解析与 file/frame 检视
  - mapo 逻辑格绘制与保存
  - 文本类资源编辑
- 已新增浏览器真实冒烟脚本：
  - `scripts/smoke-editor.mjs`
  - `package.json -> test:smoke`
- 已新增 Playwright 依赖并完成验证：
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm test:smoke` against `vite dev`
  - `pnpm test:smoke` against `vite preview`
- 已生成工件：
  - `output/playwright/dev-home.png`
  - `output/playwright/dev-layout.png`
  - `output/playwright/dev-layout-child.png`
  - `output/playwright/dev-browser.log`
  - `output/playwright/dev-state.json`
  - `output/playwright/preview/*`

Subagent Summary
- UI 旧链路最值得复用的是 `uilayout-to-json.ts`、`plist-to-phaser-atlas.ts`、`legacy-biz.ts`、`mapo.ts` 和客户端 `LegacyUILayout*` 预览链路。
- 格式优先级建议：
  - `diz/tiz` 第一阶段做可读写
  - `mapo` 第一阶段做阻挡层可写
  - `plist` 第一阶段先读和派生保存
  - `biz` 第一阶段保持只读预览
- 工作台 IA 已明确为 Creator 风格：顶栏 / 资源 / 层级 / 预览 / 检查器 / 日志。
- 角色、特效、地图三类专项预览建议后续拆进 `editor-core` + `editor-preview` 两层。

Next
- 抽取旧仓库 `LegacyUILayoutView` / `LegacySprite` / atlas 映射链路，替换当前简化 UI 视口
- 为 `diz/tiz` 建立真正的可回写文档模型，不直接复用运行时 `Map/Set`
- 给 `biz` 预览接入真实 png 定位规则和角色/怪物/特效专用控制面板
- 给 `mapo` 接入 NPC / 传送 / 怪物覆盖层
- 补 README/roadmap 后再做 git commit，并视网络权限情况推送到 GitHub
