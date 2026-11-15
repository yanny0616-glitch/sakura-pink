# sakura-pink

Claude 的浅色粉嫩主题：`#fff1f1` 底色，像素风樱花树，花瓣逐格飘落，像素云慢慢飘过。

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

这是私有仓库：只有能在 GitHub 上读到它的人可以安装，并且电脑上要先配置好 github.com 的 git 凭据（SSH key，或 `gh auth login` 后 `gh auth setup-git`），安装过程不会弹出登录。

## 修改

树的位置和大小在 `hooks/scene.ts` 的 `TREES` 里，云在同一文件的 `cloud(...)` 调用里，配色在 `hooks/register.tsx`。
