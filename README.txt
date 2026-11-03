TIGER AMP Database — GitHub Pages
Therapeutic-Index-Guided Exploration and Refinement

目标仓库：YueWang-Lambda/tiger-amp-database
默认地址：https://yuewang-lambda.github.io/tiger-amp-database/

架构
页面由 Python/Jinja2 离线生成；搜索、筛选、分页和结果导出在浏览器
Web Worker 内完成。网页只读取当前版本的公开文件，不连接内部 SQLite。
源文献、生产 ETL 和化学编译仍保留在原服务器，不在 GitHub Actions 运行。

代码仓库与数据分开
本目录是小型代码仓库候选内容。public-data/、dist/、reports/、本地备份
和大归档不提交 Git。固定版本数据作为 GitHub Release asset 保存；
publication-lock.json 指定仓库、tag、文件名和归档 SHA-256；
release-lock.json 固定数据 manifest 的 SHA-256。
完整网页的 site_release_id 还绑定前端、模板与构建器的内容修订。

本地重建（Python 3.11）
  python -m pip install -r requirements.txt
  python tools/fetch_release.py
  python tools/build_site.py --base-path /tiger-amp-database/
  python tools/verify_dist.py

若公开 Release 尚未上传，使用已交付的数据包：
  python tools/fetch_release.py --archive /path/to/TIGER-public-data.tar.gz

自定义域名根路径：
  python tools/build_site.py --base-path / --output dist-root
  python tools/verify_dist.py --directory dist-root

首次发布
1. 使用 GitHub 账号创建或确认 YueWang-Lambda/tiger-amp-database 公共仓库。
2. 仅提交此代码目录。在 Settings → Pages 中选择 GitHub Actions。
3. 按 publication-lock.json 的 tag 创建 Release，上传指定 public-data 包。
   同时保存 source/site 归档及 SHA256SUMS，供复现和回退。
4. 运行 “Build and publish TIGER” 工作流。工作流依次校验归档、构建页面、
   校验字段/数量/链接/体积，然后仅发布 dist/。
   若首次 push 时 Release asset 尚未就位，构建会停止；上传后重新运行。
5. 核验真实网址的首页、3D、检索、深层记录、四张主表下载和手机菜单。

更新
在内部工程生成并验收新数据，创建新的不可变 Release/tag，并更新两个
lock 文件和当前展示上下文。每次公开发布保留对应代码提交和数据归档。
浏览器运行期从 Pages 同源取数，不依赖 GitHub Releases 的跨域读取。

回退
回到对应已验收版本的代码提交及两个 lock 文件，再运行部署工作流。
也可使用完整 site 归档恢复全部页面与数据文件；不要仅回退首页。
GitHub Pages 不提供原动态 API 的 308/410 状态或任意参数 REST 服务。
记录采用 peptide/?id=...、article/?key=...，可以直接打开及刷新。

数据使用
主入口为两张按条件分类的简化表；两张现行核心宽表为补充。
记录缺失值、删失符号、原单位及图源标记保持现有数据口径。
仅开放原文献报告的 SMILES；完整化学源 JSON 和内部数据库不在发布包内。
引用时注明 TIGER 名称、数据发布日期、实体 ID，并引用原始实验文献。

依赖
前端不调用第三方 CDN。gzip 兼容实现为 fflate 0.8.2（MIT），许可位于
frontend/vendor/fflate.LICENSE；3D bundle 的许可见相邻 LEGAL.txt。
CI actions 固定到经官方 GitHub 仓库核验的提交 SHA。

网络验收
本地浏览器测试不能代表中国大陆三网和海外用户。上线后分别在大陆
电信/联通/移动、北美、欧洲测页面、搜索和下载，记录实测时间与失败情况。

官方部署说明：
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
官方容量说明：
https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
