# 别问 AI 了，它真不会

1024 程序员节特别企划：8 道人类一眼看穿、主流大模型集体沉默的小题。

纯静态页面，无构建、无依赖，直接部署到 GitHub Pages 即可。

## 本地预览

```bash
python -m http.server 8000
```

打开 `http://localhost:8000`。

## 发布到 GitHub Pages

1. 新建一个 GitHub 仓库（Public）。
2. 把本目录下的 `index.html`、`styles.css`、`app.js`、`imgs/`、`.nojekyll` 推到仓库根目录。
3. 进入仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，分支选 `main`，目录选 `/ (root)`，保存。
4. 等一两分钟，访问 `https://<你的用户名>.github.io/<仓库名>/`。

之后每次改完文件推送到 `main`，页面会自动更新。

## 素材约定

- 第一题：`imgs/001.jpg`
- 第二题：`imgs/002.png`
- 第三题：`imgs/003.gif`（也支持 `imgs/003.webp`、`imgs/003.mp4`）

第三题的素材不存在时，页面会显示“等待素材”，题目自动锁定，不会影响其他题。把 GIF 放进 `imgs/` 并命名为 `003.gif`，刷新页面即可解锁。

## 修改题目 / 答案

所有题目都在 `app.js` 顶部的 `QUESTIONS` 数组中：

- `title` / `desc` / `tags`：题目标题、说明、标签。
- `answer`：解析内容，支持一段 HTML。前 3 题目前是 `null`，填入后点“看解析”就会显示。
- `quiet`：`answer` 为 `null` 时显示的占位文案。
- `type`：交互类型，`match`（匹配填空）、`mark`（图片点选）、`text`（文字作答）、`number`（数字作答）、`choice`（单选）、`stroop`（颜色干扰）。
- 第三题如需改成选择题，把 `type` 改成 `choice`，再加一行 `choices: [...]` 即可。

改标题：`index.html` 里的 `<title>`、`<h1>` 和 `og:title`。

## 成绩存储

作答进度存在浏览器 `localStorage`，不上传服务器。页脚的“清空重来”会清除本机记录。
