# 一隅 Focus 0.7.0 界面

保留 Windows 与安卓的叶子应用图标与 SVG 功能图标，使用共享本地样式，无远程字体或素材。

## 设计依据

- [apple-design](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md)：中性材质、文字层级、直接按压反馈、清楚的主操作。轻透材质仅用于导航，避免全屏玻璃与重复叠加。
- [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md)：常用导航与键盘动作不播放入场动画；弹窗 200ms，反馈 180ms，按压 120ms；只动画 transform 与 opacity。鼠标 hover 样式通过输入能力查询限定。
- [mobile-native](https://github.com/emilkowalski/skills/blob/main/skills/mobile-native/SKILL.md)：视口安全区与动态高度、触摸输入 16px、不禁用缩放、底部导航、局部滚动与可见的主操作。

## 视觉与交互

背景 #f5f5f7、正文 #1d1d1f、辅助文字 #6e6e73、专注强调 #28694c。系统字体优先；大标题略收紧字距，计时数字等宽。白色卡片分组，目标与课程输入使用灰色填充，时长采用分段控件。热力图保留五档明显梯度，标签和时间阈值仍可读取。

不增加持续呼吸、图表逐项入场或页面导航等待。系统减少动画和本机动效开关均生效；系统减少透明度时改用实色导航，增强对比度时加强边框。Android 使用同色状态栏与导航栏；原生安全区和 WebView 安全区分别由系统与 CSS 处理。

## 验收

使用 npm run test:design 检查桌面页面、360×640 / 390×844 / 430×932 手机页面溢出、开始按钮是否位于底部导航上方、键盘导航与减少动画。预览截图位于忽略目录 test-results/apple-*.png。其他流程沿用课程、计时、同步、原生悬浮窗、APK WebView 和最终 Windows EXE 验收。测试使用隔离数据；真实手机的系统字体、触摸与键盘行为仍需实际设备体验确认。
