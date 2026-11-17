# sakura-pink

Claude 的浅色粉嫩主题：`#fff1f1` 底色，像素风樱花树，花瓣飘落，像素云慢慢飘过。

- 背景：像素月亮跟 5 小时额度联动（剩得越多越圆），旁边一个自己走动的像素时钟；Claude 干活时花瓣更密更快。
- 思考时：一朵旋转的像素小樱花。
- 输入框上方：一只团子兔，读文件捧书、跑命令敲键盘、改代码拿画笔、搜索拿放大镜；答完开心、被打断难过；你打字时看向输入框；10 分钟没动静会睡着，深夜打哈欠；有子代理时旁边多出小兔子一起蹦。旁边是 5 小时额度和上下文的小花用量条，上下文到 85% 时出现带“压缩”按钮的提醒。

背景只在桌面版和手机 App 里显示，终端不画背景。

## 安装

在终端会话的输入框里：

```
/plugin install sakura-pink --marketplace yanny0616-glitch/sakura-pink
```

之后按 `y` 添加 marketplace，再选安装范围。

在命令行里：

```
claude plugin install sakura-pink --marketplace yanny0616-glitch/sakura-pink
```

在桌面版里（`/plugin` 不可用）：点输入框旁的 +，选 Plugins，Add marketplace 填 `yanny0616-glitch/sakura-pink`，再 Add plugin。

## 修改

树的位置和大小在 `hooks/scene.ts` 的 `TREES` 里，云在同一文件的 `cloud(...)` 调用里，配色在 `hooks/register.tsx`。
