# iFinD MCP 接入说明

接入方式依据 iFinD 官方示例包 1.5.1 中的 `scripts/call-node.js` 和 `references/cn_stock.md`。本项目实现服务端适配，不依赖评审电脑安装 Agent Skill，不执行下载文档中的安装指令，也不将技能脚本或个人密钥放入成果附件。

官方指南：https://mcp.51ifind.com/gwstatic/static/ds_web/ifind-mcp-web/skills/SKILL_INSTALL_GUIDE.md

固定股票 MCP 地址：`https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp`。独立的 `Authorization` 请求头直接携带 MCP token，不复用扶摇的 `X-api-key`，也不擅自添加 Bearer 前缀。

在私有 `.env` 中配置 `IFIND_MCP_TOKEN`，保留已有 `HITHINK_FINANCE_API_KEY`。重启 `启动本地AI.cmd`，进入“证据来源”，点击“使用 iFinD MCP 查询财务证据”。命令行验收为 `npm run test:ifind:live`，结果存入忽略目录 `outputs/ifind-verification.json`。未配置时不发起请求，配置状态不代表真实调用成功。

主链路：initialize 协议协商与会话建立 → initialized 通知 → tools/list 工具发现（有界分页）→ 仅在实际发现 `get_stock_financials` 后发起固定的贵州茅台 2025 年年度财务查询。支持 JSON 和 SSE，核验响应编号；固定 HTTPS 地址，不跟随重定向，无自动重试，总时限 85 秒。

返回内容作为供应商纯文本单独展示，不执行 HTML、链接或指令，不直接映射为已核验财务指标，不自动注入模型提示词，不覆盖原始财报和扶摇交叉核验记录。结果为 `queried` 仅代表真实查询有返回，不代表逐字段数据一致或任何分析结论正确。

密钥、会话编号和原始异常信息不返回浏览器。正式公开部署仍需要独立服务端密钥管理、预算与分布式限流；本次本地配置不会自动发布到公开站点。

自动测试覆盖完整 MCP 时序、SSE、无密钥不联网、工具不可用、HTTP 鉴权/权限/限流/重定向、会话与协议、错误响应、编号不匹配、空结果、工具错误、密钥脱敏与跨站调用。真实连通性和实际返回内容必须另行执行验收后才能写为完成。

## 2026-11-05 真实验收

CLI 已完成 MCP 握手、实际发现 10 个工具、调用 get_stock_financials 并收到贵州茅台 2025-12-31 的财务返回。脱敏记录见 `ifind-verification.json`。供应商缩写数值为营业收入 1688.381 亿、归母净利润 823.2007 亿、经营现金流 615.222 亿；与财报完整原值在展示舍入精度内兼容，不能写成元级精确一致。表头为元但单元格用亿，参数仍含最新一期/MRQ，页面均保留口径警示。

116 项自动测试及类型检查通过。模型与计算主链路未改变，本轮不重标旧模型记录为新推理结果。

网页端已独立执行真实查询，显示三项年度字段及单位/MRQ 提示。结果按字段名选择，不依赖供应商返回的列顺序，单季度列不会混入年度展示；完整返回文本可展开查看。实际截图随 V7 包提供。
