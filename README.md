# 田间时刻 · QQ 农场收菜时间计算器

一个在本地运行的网页，用作物生长时间、季数和每季土地加成推算收菜时间。时间输入和结果都按北京时间（UTC+08:00）解释和显示，精确到分钟。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

打开终端显示的本地地址。代码检查、计算测试和生产构建：

```bash
npm run lint
npm test
npm run build
```

## 计算规则

- 生长档位：4、8、12、24 小时。
- 第一季：播种时间 + 生长时间 × 第一季土地系数。
- 第二季：第一次收菜时间 + 生长时间 ÷ 2 × 第二季土地系数。
- 普通、黑、金土地的系数分别为 1、0.9、0.8；两季可独立选择土地。
- 第一次实际收菜时间留空时，第二季按第一季成熟时立即收菜估算；填写后按实际时间重新计算。实际时间不得早于第一季成熟时间。

页面使用 Vue 3、Vite、TypeScript 和 Naive UI。计算在浏览器内完成，输入不会上传或持久保存。选择“此刻”时按当前分钟记录播种时间。

日期选择器的面板使用设备本地时区。在实行夏令时的地区，切换当天个别本地不存在的时间可能无法在面板中选取；已选时间的收获计算始终按北京时间解释。

## GitHub Pages 部署

网站地址：<https://longshihui.github.io/qq-farmer/>。

仓库的 **Settings → Pages → Build and deployment → Source** 设为 **GitHub Actions**。推送到 `main` 后，工作流会运行测试、以 `/qq-farmer/` 为资源基路径构建，并部署 `dist`。也可以在 **Actions → Deploy GitHub Pages → Run workflow** 手动部署。
