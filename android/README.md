# 一隅 Focus 安卓 0.11.0

## 安装与同步

1. 将 release/Yiyu-Focus-0.11.0-Android.apk 传到手机安装，按系统提示允许此次安装。支持 Android 8.0 及以上。
2. 先离线使用也可以。同步时点右上角“账号同步”，填写 Windows 端相同的坚果云邮箱和应用密码，再连接。不要填写坚果云网页登录密码。
3. Windows 端建议同时升级到 0.11.0，以同步日历与学习量新字段。常用专注事件、日历安排、任务、完成记录、课程、收获、疑问及其解决状态、下一步、暂存念头与个人偏好共享；正在进行的计时、目标草稿、回收站和备份只在当前设备保存。
4. “课程学习习惯”中的网页可直接打开。Windows 文件路径在手机无效，请重新选择手机文件。手机通过系统文件选择器授权读取资料，不请求访问全部文件。
5. “偏好设置”中开启通知和准时提醒。没有准时提醒授权也能计时，但后台通知可能延迟。部分手机需在系统设置允许一隅后台运行。

图标使用 Windows 相同的叶子路径和配色，界面共用同一套 SVG 图标。手机启动器可按系统规范将外形显示为圆形或圆角；支持系统主题单色图标。

## 计时与数据

切到资料、按 Home 或锁屏后计时继续；到点先停在目标时长，返回页面后选择“读完这一段”“延长 5 分钟”或“现在结束”，不把等待时间计入专注。系统回收后台应用进程后，已授权的到点闹钟仍可提醒。系统强行停止应用可能取消提醒；重启手机后保留已存检查点并暂停，避免把重启期间算成学习。通过系统开机次数区分真实重启与 Android 15 重开时重新发送的启动广播；重开时重新注册已取消的到点提醒。

记录原子写入应用私有目录，旧数据损坏时保护原文件；最近 30 份轮转备份和恢复前保护也在该目录。可用系统文件选择器导出或导入 JSON。卸载会删除本机数据，请先同步或导出。系统自动云备份关闭，避免账号授权和学习内容进入系统备份。

坚果云应用密码使用 Android Keystore 加密保存，不进入学习备份、日志或仓库。网络仅用于用户连接后的 HTTPS 坚果云 WebDAV；每台设备独立文件、ETag 缓存和条件写入，共享层负责合并。没有自建注册服务器，不依赖 GPT 网站或 Google 服务。

安卓没有 Windows 的置顶小窗和全局快捷键。Android WebView 只加载随安装包提供的页面，网页资料打开到手机浏览器；不允许远程网页调用本机桥接接口。

0.9.0 新增快速专注管理页：保存名称、图标、课程、固定时长和学习量目标，首页可直接开始。日历翻页与“今天”按钮统一高度；同时修复原生同步对日历类型的支持。与 Windows 0.9.0 使用同一账号同步新字段，请同时升级两端。0.9.0 当时的 DDL 仅为日历内倒计时；0.10.0 已新增后台日历通知。

## 0.11.0 新增

“我的成长”新增每日投入趋势、课程投入分布、学习量目标与实际、分心原因分布。支持近 7 / 30 / 90 天、课程与学习量单位筛选。点击图表或拖动触摸滑块可查看具体数值，也可展开数据表；手机纵向排列，宽屏并排展示。图表完全本地计算，沿用账号同步后的原始记录；不会把未填写的学习量算作零，也不会推断未记录的分心原因。沿用原签名，可以覆盖安装保留数据。

## 0.10.0 新增

- 日历事件按自己的时长与学习量一键开始，学习记录自动关联；日历与 DDL 列表汇总投入和最近的下一步。
- 记录分心原因后显示原目标与学习位置，轻轻回到当前一小步。成长页按近七天记录给出少量建议。
- 常用事件可置顶、排序、复制。长按应用图标可见前四项动态快捷入口；管理页可以请求固定到桌面，使用同一叶子图标。请求还需在手机系统窗口确认。
- 开始时间或 DDL 提醒支持提前一天、一小时和自定义分钟。通知可选“10 分钟后提醒”，点击打开对应日历安排。系统进程回收、重启和时区变更后可重新登记；标记完成、删除或改变提醒会取消旧计划。通知和准时闹钟权限仍需开启。
- 账号页显示最近成功同步和待同步状态，对不同设备版本保留本机副本并允许选择。提醒依据、排序与记录关联随账号同步；当前计时、稍后提醒、提醒送达状态、固定桌面入口与版本副本留在本机。

## 构建

需要 Node.js、JDK 17 或 21、Android SDK platform 36 与 build-tools、网络下载 Gradle/Maven 依赖。官方入口：[Android 开发工具](https://developer.android.com/studio)。

设置 JAVA_HOME 与 ANDROID_HOME，运行：

~~~powershell
npm ci
npm run android:build
~~~

工具也会识别本项目 .android-tools/sdk。构建前自动复制 web/ 到 app/src/main/assets/web，使用 Gradle 8.13 和 Android Gradle Plugin 8.13.2。Windows 和安卓界面版本统一为 0.11.0。最终 APK 位于 release/。

首次构建在 .android-signing/yiyu-release.jks 创建本地发布签名，密码保存在 android/signing.properties；两者已忽略，不应上传仓库。请安全备份这两个文件，后续覆盖安装必须保留同一签名；丢失密钥就无法正常升级现有安装。备份签名文件不等于导出用户学习数据。

## 验证

~~~powershell
npm test
npm run test:desktop
# 先在专用模拟器 emulator-5580 安装 debug 包，不使用真实手机
npm run android:prepare
android/gradlew.bat -p android assembleDebug assembleDebugAndroidTest lintDebug
# 安装 app/build/outputs/apk/debug/app-debug.apk 和 androidTest/debug/app-debug-androidTest.apk
npm run test:android
# 日历后台通知、系统入口和新学习流程
npm run test:android-journey
# 如需验证系统文件选择器，先安装自动化驱动
npx playwright install android
npm run test:android-files
# 原生测试通过 adb -s emulator-5580 shell am instrument -w local.yiyu.focus.test/local.yiyu.focus.NativeChecks 运行
~~~

test:android 会清除专用模拟器上 local.yiyu.focus 的测试数据。不得把这个测试改为真实用户手机序列号。原生检查使用独立目录和模拟 WebDAV 响应，不连接真实账号，不上传用户资料。

文件流程测试验证原生导出、content URI 读取的 JSON 导入、恢复前保护、本机资料持久授权以及系统返回手势。

测试覆盖共享界面图标、原生持久化、后台计时、柔和收尾、疑问筛选、热力图、备份和回收、返回键及进程回收后的到点通知；原生检查覆盖损坏保护、30 份轮转、恢复前保护、Keystore、多设备协议、条件写入冲突和离线错误。最终发布 APK 另做签名校验和模拟器安装启动。正式包还验证了实际进程结束后的计时恢复、到点通知、同一次开机重复广播不会误暂停，以及通过开机次数变化模拟真实重启后的暂停。真实账号同步、各品牌手机后台策略仍需在实际手机验证。

参考：[WebView 本地资源](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[后台闹钟](https://developer.android.com/develop/background-work/services/alarms)、[Android 15 停止状态](https://developer.android.com/about/versions/15/behavior-changes-all)、[准时提醒授权](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)。
