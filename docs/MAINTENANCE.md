# TIGER 网站构建与维护

[返回数据库介绍](../README.md) · [中文介绍](../README.zh-CN.md)

本文件面向网站维护人员。数据库用途、数据规模、检索和下载入口见仓库首页 README。

## 架构与目录

网页由 Python/Jinja2 离线生成，GitHub Pages 提供静态托管。搜索、筛选、分页及结果导出在浏览器 Web Worker 内完成；运行期读取 Pages 同源的版本化公开文件。

| 路径 | 作用 |
| --- | --- |
| `frontend/` | 页面模板、样式、浏览器检索与导出代码、3D 资源 |
| `tools/` | 固定版本数据获取、构建与校验脚本 |
| `.github/workflows/pages.yml` | GitHub Pages 构建与发布工作流 |
| `release-lock.json` | 数据版本与 manifest SHA-256 |
| `publication-lock.json` | Release 仓库、tag、归档名及 SHA-256 |
| `acceptance/` | 已发布基线的验收记录 |
| `docs/` | 仓库介绍图片与维护说明 |

`public-data/`、`dist/`、`reports/` 和大归档由构建生成或获取，不提交 Git。版本化公开数据保存在 GitHub Release assets；原文献、数据生产工程和内部数据库由原生产环境维护。

## 本地重建

使用 Python 3.11 和独立虚拟环境。在仓库根目录运行：

```bash
python -m pip install -r requirements.txt
python tools/fetch_release.py
python tools/build_site.py --base-path /tiger-amp-database/
python tools/verify_dist.py
```

`fetch_release.py` 下载 lock 文件指定的公开归档，核对 SHA-256 后解包。已有该版本数据目录时，使用新的工作目录重建。也可使用已下载归档：

```bash
python tools/fetch_release.py --archive /path/to/TIGER-public-data.tar.gz
```

生成文件在 `dist/`。项目路径预览需要让 HTTP 服务将该目录映射到 `/tiger-amp-database/`。若仅在本机根路径预览，可单独构建：

```bash
python tools/build_site.py --base-path / --output dist-root
python tools/verify_dist.py --directory dist-root
python -m http.server 8080 --bind 127.0.0.1 --directory dist-root
```

随后在服务所在机器访问 `http://127.0.0.1:8080/`；远程服务器可使用 SSH 转发此本机端口。

## GitHub Pages 发布

仓库：<https://github.com/YueWang-Lambda/tiger-amp-database>

网站：<https://yuewang-lambda.github.io/tiger-amp-database/>

Pages 发布源为 **GitHub Actions**。推送 `main` 或手动运行 **Build and publish TIGER** 工作流，依次完成：固定依赖安装、数据归档获取与校验、路径适配构建、文件与记录校验、站点上传及部署。保持工作流使用固定的 action 提交版本。

首次部署另一个仓库时，应先在 Settings → Pages 启用 GitHub Actions，并保证 lock 文件指定的公开 Release asset 已存在，再运行发布工作流。

## 版本更新

科学数据更新应先在生产环境完成一致性检查和网站验收，然后建立新 Release/tag，保存对应数据、源代码、完整站点归档与 SHA256SUMS，再同步两个 lock 文件及展示数据。每个已发布归档保持固定。

`site_release_id` 绑定数据版本、前端、模板与构建器。README 和 `docs/` 的说明性修改可以独立提交；其不改变科学数据和站点内容版本。涉及前端、模板、构建器或数据的修改应重新完成相应验收。

更新 README 数据规模时，以该公开版本的 manifest 和 Data guide 为准，分别标记源数据日期与网站版本日期。区分实体数、文献引用数、关系数和条件汇总行数。

## 回退与验收

恢复对应已验收 tag 下的代码和两个 lock 文件，再运行部署工作流；也可用 Release 的完整 site 归档恢复。页面与数据须属于同一版本。

发布后检查首页、3D、检索、深层记录链接、CSV／FASTA 导出、四张主表下载和手机布局，并核对线上版本及文件摘要。大陆与海外的访问速度、实体手机性能按真实网络和设备分别记录。

记录链接使用 `peptide/?id=...` 和 `article/?key=...`。当前公开数据接口为静态文件、manifest 和校验清单；下载页提供 Python／R 用法。

## 资源说明

README 中的 3D 截图来自 2026-11-04 对已发布 TIGER 网站的浏览器验收，链接到首页交互展示。

前端资源由站点自身提供。gzip 兼容实现 fflate 0.8.2 的许可见 `frontend/vendor/fflate.LICENSE`；3D bundle 的第三方许可见相邻 `LEGAL.txt`。

官方参考：[Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Pages 容量与使用限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。
