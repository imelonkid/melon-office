# 工作姿态素材

运行时文件：`web/public/assets/illustration/working.png`。使用内置 imagegen 生成并去除背景，再由 `tools/pack_working_sprites.swift` 裁切、等比缩放；没有修改已有的角色图集与头像。

六列依次为小瓜、小甜、小籽、阿瓜、小皮、老板，两行为打字动作的两帧。每格 208×312，在两端按 104×156 显示。外包与实习生沿用 `layout.characters` 的角色映射。

生成提示词：

> Game sprite sheet, exactly 6 equal columns x 2 equal rows, true transparent alpha background. Characters in order: black hoodie red headphones boy; orange ponytail glasses cream blouse girl; purple bun lavender blouse girl; brown hair mustard jacket boy; brown hair cream knit sweater boy; black side-part glasses navy suit boss. Top row typing frame A, bottom row typing frame B with subtle hand movement. All figures sit facing upper right / northeast with backs towards the viewer, three-quarter rear view. Both arms reach towards an unseen keyboard. Full seated body, bent knees and shoes; no furniture, computer, keyboard, chair, floor, shadows, grid lines or text. Preserve the reference characters' chibi illustration style and identities. Consistent registration and generous transparent gutters.

背景清理提示词：

> Keep all twelve characters, poses, outlines, sizes and grid layout unchanged. Remove the pale white background, haze, glow and shadows. Empty space must have alpha zero. Preserve opaque character interiors, including cream clothes and white shoes. No new content.

打包：`swift tools/pack_working_sprites.swift <生成图.png> web/public/assets/illustration/working.png`。检查透明空白区、两帧落座位置、手与键盘的位置；不要通过翻转正面人物模拟背向工作。
