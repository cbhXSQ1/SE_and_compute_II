---
name: annotation-proto-dev-loop
description: 裁判文书论证结构标注纯前端原型（原型/ 目录）功能新增与修改的标准开发闭环。当用户要求在标注原型上实现需求条目、补标注规则辅助或优化现有功能时使用。不用于后端开发或无关项目。
---

# 标注原型功能开发闭环

适用于本仓库 `原型/` 目录下无框架纯前端原型。每次功能推进按以下顺序执行，并分阶段向用户验证，不要一次性做完。

## 架构事实（先记住，勿重新摸索）

- 无框架 IIFE 模块，全局挂 `window.APP`；`core.js` 会重建 `window.APP`，故 `store/api/persist/annotate-logic` 必须在 `core.js` **之后**加载，view 在最后。
- `APP.store`：`get(key?) / set / patch / subscribe / touch`，初始数据含 `pieces, segments, relations, diagrams, history`。
- `APP.api.loadAnnotation(taskId)` 优先读 `persist` 草稿，否则回退 `window.MOCK`，返回 Promise。
- **业务规则一律写成纯函数放 `src/annotate-logic.js`**，暴露到 `window.APP.annotateLogic`；禁止在视图里写业务分支。
- 视图在 `src/view-*.js`；标注页用 `canEdit` 与 `READONLY_BLOCKED` 表控制只读拦截，新增可编辑操作必须登记进该表。
- 需求依据只有两份：`系统需求梳理.md` 与 `v1.2 …标注与图示指南.md`；动手前先检索对应条目原文。

## 标准流程

1. **需求溯源**：grep 需求文档与指南，摘出规则原文；模糊处先向用户提问，不自行扩张范围。
2. **纯函数先行**：在 `annotate-logic.js` 新增纯函数（入参 state，返回新数据，不改入参），嵌套引用等递归用纯函数展开。
3. **最小补丁接视图**：局部 Edit，不整文件重写；破坏性数据变更（清空 segments 等）必须弹窗警示并经用户确认。
4. **零依赖单测**：追加到 `原型/tests/store-api.test.js`（Node `assert`，浏览器垫片 `global.window={MOCK:...}`，logic 测试前 require 真实 `mock-data.js`）；运行 `node "原型/tests/store-api.test.js"`，全部通过才算完。
5. **外链版本号**：改动任何 `src/*.js` 或 `style.css` 后，把 `index.html` 中全部外链的 `?v=N` 统一 +1（CSS 同步）。
6. **浏览器全链路验证**：
   - 服务器在 `原型/` 目录运行 `python -m http.server 8000`，地址 `http://localhost:8000/index.html?v=N`；连接被拒时重启。
   - 验证前清旧草稿：`localStorage.removeItem('annotation-draft-T1')`。
   - 页面执行旧 JS（启发式缓存）时：先顶层导航一次 `src/xxx.js?v=N` 强制 revalidate，再回页面。
   - DOM 操作用真实 click（`el.click()` 或 browser_click），不要用 read-only evaluate 改 DOM。
   - `browser_evaluate` 传脚本时避免正则字面量与换行转义（中文环境会被破坏），改用字符串 `indexOf`/`String.fromCharCode(10)`；返回大对象可能得到 undefined，拆成多个小返回。
   - 必查项：功能主路径、只读角色拦截、console error（导航中断的 ERR_ABORTED 可忽略）。
7. **提交**：仅在用户明确要求时 commit；只提交到 `feature/annotation-flow-and-store`，**main 必须保持不变**；commit message 概述功能与测试数变化。

## 常见数据结构

- 关系 `{id:"R1", type:"S|A|J|M|I", members:["P4","R2"], formal:"..."}`，members 可含 R id 表示嵌套。
- 切割片段 `{id:"s1", text, boxed}`；要素 `{id:"P1", text, type:""}`。
- 图示 `{id, nodes:[{id,x,y}], relNodes:[{id,kind,x,y}], edges:[{from,to,arrow?}]}`。
- 历史版本为提交级只读快照 `{id:"Vn", seq, stage, stageName, operator, ts, counts, snapshot}`，仅存内存、不进草稿。

## 用户协作约定

- 始终中文回答；回答简洁；阶段性验证成果。
- 用户需求模糊时多提问；每完成一个编号事项主动报告并询问下一项。
- 用户提到 rainstorm 时，先对该事项做不加筛选的发散（方案/介质/角色/形态/边界/最小可行），再收敛成选项表让用户拍板。
