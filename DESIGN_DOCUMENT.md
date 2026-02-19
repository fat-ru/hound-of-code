# Hound 源代码搜索引擎 - 开发方案设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 项目名称 | Hound |
| 项目类型 | 源代码搜索引擎 |
| 文档版本 | v1.0 |
| 创建日期 | 2025-01-17 |
| 项目地址 | https://github.com/hound-search/hound |

---

## 一、项目概述

### 1.1 项目简介

Hound 是一个极其快速的源代码搜索引擎，其核心基于 Russ Cox 的文章 [Regular Expression Matching with a Trigram Index](http://swtch.com/~rsc/regexp/regexp4.html) 实现。项目采用前后端分离架构：

- **后端**：Go 语言编写的 REST API 服务器
- **前端**：React 构建的静态 Web UI

Hound 设计简洁、资源占用低，无需复杂的依赖即可运行，是代码搜索的理想选择。

### 1.2 核心特性

1. **极速搜索**：基于三 gram 倒排索引的正则表达式搜索
2. **多版本控制系统支持**：Git、Mercurial、Subversion、Bazaar、本地目录
3. **增量更新**：支持轮询和 Webhook 推送更新
4. **低资源占用**：单个 Go 二进制文件，无外部数据库依赖
5. **灵活配置**：支持仓库级别的精细配置
6. **编辑器集成**：支持 Sublime、Vim、Emacs、VS Code 等编辑器插件

### 1.3 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 后端语言 | Go 1.16+ | 高性能、并发友好、静态编译 |
| 前端框架 | React 0.12.2 | 声明式 UI、组件化开发 |
| 构建工具 | Webpack 5 | 模块打包、资源优化 |
| 测试框架 | Go test + Jest | 单元测试覆盖 |
| 包管理 | npm | 前端依赖管理 |
| 构建系统 | Make | 自动化构建 |

---

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端浏览器                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    React Web UI                           │  │
│  │  ┌─────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │SearchBar│  │  ResultView │  │      RepoView       │   │  │
│  │  └─────────┘  └─────────────┘  └─────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬──────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┴──────────────────────────────────┐
│                     Hound Server (houndd)                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  HTTP Server (:6080)                    │  │
│  │  ┌─────────────┐  ┌─────────────────────────────────┐  │  │
│  │  │   Web UI    │  │        REST API                 │  │  │
│  │  │  Handler    │  │  /api/v1/repos                  │  │  │
│  │  │             │  │  /api/v1/search                 │  │  │
│  │  │             │  │  /api/v1/update                 │  │  │
│  │  │             │  │  /api/v1/github-webhook         │  │  │
│  │  │             │  │  /api/v1/excludes               │  │  │
│  │  └─────────────┘  └─────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Searcher Manager                      │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │         每个 Repository 一个 Searcher            │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                      VCS Layer                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  │  │
│  │  │   Git   │  │   Hg    │  │   SVN   │  │  Local   │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └──────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────┬──────────────────────────────────┘
                             │
┌────────────────────────────┴──────────────────────────────────┐
│                        数据存储层                               │
│  ┌──────────────────────┐  ┌──────────────────────────────┐   │
│  │  Repository Cache    │  │   Trigram Inverted Index     │   │
│  │  (VCS Working Dir)   │  │   (LevelDB/文件系统)          │   │
│  └──────────────────────┘  └──────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
hound/
├── cmds/                          # 命令行入口
│   ├── hound/                     # CLI 客户端
│   │   └── main.go                # CLI 主入口
│   └── houndd/                    # 服务器守护进程
│       └── main.go                # 服务端主入口
│
├── api/                           # REST API 处理器
│   ├── api.go                     # API 路由和处理函数
│   └── api_test.go                # API 测试
│
├── client/                        # API 客户端
│   ├── client.go                  # 客户端实现
│   ├── grep.go                    # grep 格式输出
│   ├── coalesce.go                # 结果合并
│   └── ack.go                     # ack 格式输出
│
├── codesearch/                    # 代码搜索核心库 (第三方)
│   ├── index/                     # 倒排索引实现
│   ├── regexp/                    # 正则表达式引擎
│   ├── lib/                       # 基础库
│   └── sparse/                    # 稀疏数组
│
├── config/                        # 配置管理
│   ├── config.go                  # 配置解析和验证
│   └── config_test.go             # 配置测试
│
├── index/                         # 索引构建与管理
│   ├── index.go                   # 索引核心逻辑
│   ├── grep.go                    # grep 搜索实现
│   └── index_test.go              # 索引测试
│
├── searcher/                      # 搜索器管理
│   └── searcher.go                # 搜索器生命周期管理
│
├── vcs/                           # 版本控制系统抽象层
│   ├── vcs.go                     # VCS 接口定义
│   ├── git.go                     # Git 支持
│   ├── hg.go                      # Mercurial 支持
│   ├── svn.go                     # Subversion 支持
│   ├── bzr.go                     # Bazaar 支持
│   ├── local.go                   # 本地目录支持
│   └── vcs_test.go                # VCS 测试
│
├── web/                           # Web 服务器
│   └── web.go                     # HTTP 服务封装
│
├── ui/                            # 前端 UI
│   ├── ui.go                      # UI 路由
│   ├── content.go                 # 静态资源服务
│   ├── bindata.go                 # 编译的前端资源
│   └── assets/                    # 前端源文件
│       ├── css/                   # 样式文件
│       ├── js/                    # JavaScript 源文件
│       ├── images/                # 图片资源
│       └── *.tpl.html             # 模板文件
│
├── ansi/                          # ANSI 颜色输出
│   ├── ansi.go                    # 颜色处理
│   ├── tty.go                     # TTY 检测
│   ├── tty_*.go                   # 平台特定实现
│   └── ansi_test.go               # 颜色测试
│
├── docs/                          # 文档
│   └── config-options.md          # 配置选项说明
│
├── Makefile                       # 构建脚本
├── package.json                   # NPM 包配置
├── webpack.config.js              # Webpack 配置
├── config-example.json            # 配置示例
├── default-config.json            # 默认配置
├── go.mod                         # Go 模块依赖
└── README.md                      # 项目说明
```

---

## 三、核心模块设计

### 3.1 入口模块 (cmds)

#### 3.1.1 服务器入口 (cmds/houndd/main.go)

**职责**：
- 解析命令行参数
- 加载配置文件
- 初始化搜索器
- 启动 HTTP 服务器
- 处理优雅关闭

**命令行参数**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--conf` | config.json | 配置文件路径 |
| `--addr` | :6080 | 服务器监听地址 |
| `--dev` | false | 开发模式（使用 webpack-dev-server） |
| `--version` | false | 显示版本信息 |

**核心流程**：

```
1. 解析命令行参数
2. 加载并验证配置文件
3. 创建数据目录 (dbpath)
4. 初始化所有 Repository 的 Searcher
5. 启动 Web 服务器（后台）
6. 注册 SIGTERM 信号处理
7. 等待关闭信号
8. 优雅关闭所有 Searcher
```

**代码位置**：`D:\Project\OpenSourceTool\hound\cmds\houndd\main.go`

#### 3.1.2 CLI 客户端入口 (cmds/hound/main.go)

**职责**：
- 提供命令行搜索接口
- 支持多种输出格式

**命令行参数**：

| 参数 | 说明 |
|------|------|
| `--host` | 服务器地址（默认 localhost:6080） |
| `--repos` | 搜索的仓库列表 |
| `--files` | 文件名匹配模式 |
| `--context` | 上下文行数 |
| `--ignore-case` | 忽略大小写 |
| `--ack` | ack 格式输出 |
| `--grep` | grep 格式输出 |

### 3.2 配置模块 (config)

#### 3.2.1 配置结构

**Config 全局配置**：

```go
type Config struct {
    DbPath                string                    // 数据库路径
    Title                 string                    // Web UI 标题
    Repos                 map[string]*Repo          // 仓库配置
    MaxConcurrentIndexers int                       // 最大并发索引数
    HealthCheckURI        string                    // 健康检查端点
    VCSConfigMessages     map[string]*SecretMessage // 全局 VCS 配置
    ResultLimit           int                       // 默认结果限制
}
```

**Repo 仓库配置**：

```go
type Repo struct {
    Url                string         // 仓库 URL
    DisplayName        string         // 显示名称
    MsBetweenPolls     int            // 轮询间隔（毫秒）
    Vcs                string         // VCS 类型
    VcsConfigMessage   *SecretMessage // VCS 特定配置
    UrlPattern         *UrlPattern    // URL 模式
    ExcludeDotFiles    bool           // 排除点文件
    EnablePollUpdates  *bool          // 启用轮询更新
    EnablePushUpdates  *bool          // 启用推送更新
    AutoGeneratedFiles []string       // 自动生成文件列表
}
```

**UrlPattern URL 模式**：

```go
type UrlPattern struct {
    BaseUrl string // 文件浏览 URL 模板
    Anchor  string // 锚点模板（行号）
}
```

#### 3.2.2 默认配置值

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `max-concurrent-indexers` | 2 | 最大并发索引构建数 |
| `ms-between-poll` | 30000 | 轮询间隔（毫秒） |
| `enable-poll-updates` | true | 默认启用轮询 |
| `enable-push-updates` | false | 默认禁用推送 |
| `title` | "Hound" | Web UI 标题 |
| `vcs` | "git" | 默认 VCS 类型 |
| `health-check-uri` | "/healthz" | 健康检查路径 |
| `result-limit` | 5000 | 默认结果限制 |

#### 3.2.3 敏感配置保护

VCS 配置（如用户名、密码、SSH 密钥）通过 `SecretMessage` 类型保护，序列化时返回空对象 `{}`，防止泄露给前端。

**代码位置**：`D:\Project\OpenSourceTool\hound\config\config.go`

### 3.3 索引模块 (index)

#### 3.3.1 索引核心数据结构

**Index 索引**：

```go
type Index struct {
    Ref *IndexRef  // 索引引用（包含元数据）
    idx *index.Index  // 内部三 gram 索引
    lck sync.RWMutex  // 读写锁
}
```

**IndexOptions 索引选项**：

```go
type IndexOptions struct {
    ExcludeDotFiles    bool     // 排除点文件
    SpecialFiles       []string // 特殊文件列表（如 .git）
    AutoGeneratedFiles []string // 自动生成文件列表
}
```

**SearchOptions 搜索选项**：

```go
type SearchOptions struct {
    IgnoreCase        bool   // 忽略大小写
    LiteralSearch     bool   // literal 搜索（转义正则）
    LinesOfContext    uint   // 上下文行数
    FileRegexp        string // 文件名匹配正则
    ExcludeFileRegexp string // 排除文件正则
    Offset            int    // 结果偏移
    Limit             int    // 结果限制
    MaxResults        int    // 最大匹配数
}
```

**SearchResponse 搜索响应**：

```go
type SearchResponse struct {
    Matches        []*FileMatch  // 匹配结果
    FilesWithMatch int           // 匹配文件数
    FilesOpened    int           // 打开的文件数
    Duration       time.Duration // 搜索耗时
    Revision       string        // 代码版本
}
```

**FileMatch 文件匹配**：

```go
type FileMatch struct {
    Filename      string   // 文件名
    Matches       []*Match // 匹配行列表
    AutoGenerated bool     // 是否为自动生成文件
}
```

**Match 匹配行**：

```go
type Match struct {
    Line       string   // 匹配行内容
    LineNumber int      // 行号
    Before     []string // 前文行
    After      []string // 后文行
}
```

#### 3.3.2 索引构建流程

```
┌─────────────────────────────────────────────────────────────┐
│                    index.Build()                            │
├─────────────────────────────────────────────────────────────┤
│  1. 创建索引目录 (dst)                                       │
│  2. 创建 raw 子目录存储原始文件                               │
│  3. 遍历源目录 (src)                                         │
│     ├── 检查特殊文件 (.git/.svn 等) → 跳过                   │
│     ├── 检查点文件 → 记录并跳过                               │
│     ├── 检查文件类型 → 非文本文件记录并跳过                   │
│     └── 文本文件 → 添加到三 gram 索引                         │
│  4. 写入排除文件列表 (excluded_files.json)                   │
│  5. 刷新索引                                                 │
│  6. 写入索引元数据 (metadata.gob)                            │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.3 搜索流程

```
┌─────────────────────────────────────────────────────────────┐
│                    index.Search()                           │
├─────────────────────────────────────────────────────────────┤
│  1. 编译正则表达式                                           │
│  2. 编译文件过滤正则（可选）                                  │
│  3. 编译排除文件正则（可选）                                  │
│  4. 使用三 gram 索引查询候选文件                              │
│  5. 遍历候选文件：                                           │
│     ├── 检查文件名过滤条件                                   │
│     ├── 读取文件内容                                         │
│     ├── 执行正则匹配                                         │
│     ├── 提取上下文行                                         │
│     └── 收集匹配结果                                         │
│  6. 返回搜索结果                                             │
└─────────────────────────────────────────────────────────────┘
```

**代码位置**：`D:\Project\OpenSourceTool\hound\index\index.go`

### 3.4 搜索器模块 (searcher)

#### 3.4.1 Searcher 数据结构

```go
type Searcher struct {
    idx  *index.Index  // 当前索引
    lck  sync.RWMutex  // 读写锁
    Repo *config.Repo  // 仓库配置

    updateCh       chan time.Time  // 更新请求通道
    shutdownRequested bool         // 是否请求关闭
    shutdownCh    chan empty       // 关闭信号通道
    doneCh        chan empty       // 完成信号通道
}
```

#### 3.4.2 核心功能

**New()** - 创建新的 Searcher：
- 克隆/更新 VCS 仓库
- 构建或打开索引
- 启动后台轮询 goroutine

**Search()** - 执行搜索：
- 使用读锁保护索引
- 调用 index.Search()

**Update()** - 触发更新：
- 检查是否启用推送更新
- 发送更新信号到通道

**Stop()** - 停止 Searcher：
- 发送关闭信号
- 等待 goroutine 完成

#### 3.4.3 并发控制

使用令牌桶（limiter）控制并发索引构建数：

```go
type limiter chan bool

func (l limiter) Acquire() {
    l <- true
}

func (l limiter) Release() {
    <-l
}
```

#### 3.4.4 索引更新策略

```
┌─────────────────────────────────────────────────────────────┐
│                  Searcher 生命周期                           │
├─────────────────────────────────────────────────────────────┤
│  1. 初始化阶段                                               │
│     ├── 等待 begin() 信号（确保所有 Searcher 同时开始）       │
│     └── 如果更新禁用，直接完成                               │
│                                                                  │
│  2. 轮询循环阶段                                             │
│     ├── 等待轮询间隔或更新信号                               │
│     ├── 更新 VCS（pull/clone）                               │
│     ├── 检查版本变化                                         │
│     ├── 如果版本变化：                                       │
│     │   ├── 构建新索引                                       │
│     │   ├── 原子交换索引                                     │
│     │   └── 销毁旧索引                                       │
│     └── 触发 GC 清理内存                                     │
│                                                                  │
│  3. 关闭阶段                                                 │
│     └── 等待所有操作完成后退出                               │
└─────────────────────────────────────────────────────────────┘
```

**代码位置**：`D:\Project\OpenSourceTool\hound\searcher\searcher.go`

### 3.5 VCS 抽象层 (vcs)

#### 3.5.1 Driver 接口

```go
type Driver interface {
    // 克隆仓库
    Clone(dir, url string) (string, error)

    // 拉取更新
    Pull(dir string) (string, error)

    // 获取当前版本
    HeadRev(dir string) (string, error)

    // 获取特殊文件列表
    SpecialFiles() []string

    // 获取自动生成文件列表
    AutoGeneratedFiles(dir string) []string
}
```

#### 3.5.2 支持的 VCS 类型

| VCS | 驱动文件 | 说明 |
|-----|----------|------|
| git | vcs/git.go | 默认 VCS，支持 SSH/HTTPS |
| hg | vcs/hg.go | Mercurial 支持 |
| svn | vcs/svn.go | Subversion 支持 |
| bzr | vcs/bzr.go | Bazaar 支持 |
| local | vcs/local.go | 本地目录支持 |

#### 3.5.3 WorkDir 封装

```go
type WorkDir struct {
    Driver
}

// 核心方法：如果目录存在则 Pull，否则 Clone
func (w *WorkDir) PullOrClone(dir, url string) (string, error)
```

**代码位置**：`D:\Project\OpenSourceTool\hound\vcs\vcs.go`

### 3.6 API 模块 (api)

#### 3.6.1 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/repos` | GET | 获取仓库列表 |
| `/api/v1/search` | GET | 执行搜索 |
| `/api/v1/update` | POST | 手动更新仓库 |
| `/api/v1/github-webhook` | POST | GitHub Webhook |
| `/api/v1/excludes` | GET | 获取排除文件列表 |

#### 3.6.2 搜索 API 详解

**请求参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `q` | string | 搜索查询（必需） |
| `repos` | string | 仓库列表（默认 *） |
| `files` | string | 文件名匹配正则 |
| `excludeFiles` | string | 排除文件正则 |
| `i` | bool | 忽略大小写 |
| `literal` | bool | literal 搜索 |
| `ctx` | uint | 上下文行数（默认 2，最大 20） |
| `limit` | int | 结果限制 |
| `rng` | string | 范围（格式 "offset:limit"） |
| `stats` | bool | 返回统计信息 |

**响应格式**：

```json
{
  "Results": {
    "RepoName": {
      "Matches": [...],
      "FilesWithMatch": 10,
      "Revision": "abc123"
    }
  },
  "Stats": {
    "FilesOpened": 50,
    "Duration": 15
  }
}
```

#### 3.6.3 并行搜索实现

```go
func searchAll(query string, opts *index.SearchOptions,
    repos []string, idx map[string]*searcher.Searcher,
    filesOpened *int, duration *int) (map[string]*index.SearchResponse, error) {

    // 为每个仓库启动 goroutine
    ch := make(chan *searchResponse, n)
    for _, repo := range repos {
        go func(repo string) {
            fms, err := idx[repo].Search(query, opts)
            ch <- &searchResponse{repo, fms, err}
        }(repo)
    }

    // 收集结果
    res := map[string]*index.SearchResponse{}
    for i := 0; i < n; i++ {
        r := <-ch
        // 合并结果...
    }

    return res, nil
}
```

**代码位置**：`D:\Project\OpenSourceTool\hound\api\api.go`

### 3.7 前端模块 (ui)

#### 3.7.1 前端架构

```
ui/assets/js/
├── hound.js           # 主应用逻辑
├── common.js          # 工具函数
├── signal.js          # 事件系统
├── index.js           # 入口
├── components/
│   ├── SearchBar.js   # 搜索栏
│   ├── ResultView.js  # 结果视图
│   ├── RepoView.js    # 仓库视图
│   └── FileContentView.js  # 文件内容
└── styles/
    ├── main.css       # 主样式
    └── hound.css      # Hound 样式
```

#### 3.7.2 Model 数据模型

```javascript
var Model = {
    // 事件
    willSearch: new Signal(),    // 搜索开始
    didSearch: new Signal(),     // 搜索完成
    didError: new Signal(),      // 错误
    didLoadRepos: new Signal(),  // 仓库加载完成

    // 方法
    Load: function() {},         // 加载仓库列表
    Search: function(params) {}, // 执行搜索
    ValidRepos: function() {},   // 获取有效仓库列表
};
```

#### 3.7.3 搜索流程

```
用户输入搜索词
    ↓
SearchBar 触发搜索
    ↓
Model.Search(params)
    ↓
HTTP GET /api/v1/search
    ↓
API 返回结果
    ↓
Model 处理结果
    ↓
ResultView 渲染
    ↓
用户查看结果
```

**代码位置**：`D:\Project\OpenSourceTool\hound\ui\assets\js\hound.js`

---

## 四、数据流设计

### 4.1 搜索数据流

```
┌────────────────────────────────────────────────────────────────────┐
│                          搜索请求流程                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  浏览器                    houndd                      存储         │
│    │                        │                            │         │
│    │  GET /api/v1/search    │                            │         │
│    │  ?q=pattern            │                            │         │
│    │  &repos=*              │                            │         │
│    │───────────────────────>│                            │         │
│    │                        │                            │         │
│    │                        │ searchAll()                │         │
│    │                        │ 并行搜索每个仓库            │         │
│    │                        │ ┌────────────────────┐     │         │
│    │                        │ │ repo1.Search()     │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ repo2.Search()     │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ ...                │     │         │
│    │                        │ └────────────────────┘     │         │
│    │                        │                            │         │
│    │                        │ index.Search(pattern)      │         │
│    │                        │ ┌────────────────────┐     │         │
│    │                        │ │ 三 gram 索引查询   │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ 读取匹配文件       │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ 返回匹配结果       │     │         │
│    │                        │ └────────────────────┘     │         │
│    │                        │                            │         │
│    │  JSON Response         │                            │         │
│    │  {Results, Stats}      │                            │         │
│    │<───────────────────────│                            │         │
│    │                        │                            │         │
│    └                        └                            ┘         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 索引更新数据流

```
┌────────────────────────────────────────────────────────────────────┐
│                       索引更新流程                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  触发条件                    houndd                     VCS        │
│    │                        │                            │         │
│  轮询触发 ──────────────────>│                            │         │
│  或 Webhook ────────────────>│                            │         │
│    │                        │                            │         │
│    │                        │ wd.PullOrClone()           │         │
│    │                        │ ┌────────────────────┐     │         │
│    │                        │ │ 检查本地是否存在    │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ Clone 或 Pull      │     │────────>│
│    │                        │ └────────────────────┘     │         │
│    │                        │                            │         │
│    │                        │ 检查版本变化               │         │
│    │                        │                            │         │
│    │                        │ index.Build()              │         │
│    │                        │ ┌────────────────────┐     │         │
│    │                        │ │ 遍历文件           │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ 构建三 gram 索引   │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ 写入元数据         │     │         │
│    │                        │ └────────────────────┘     │         │
│    │                        │                            │         │
│    │                        │ swapIndexes(newIdx)        │         │
│    │                        │ ┌────────────────────┐     │         │
│    │                        │ │ 原子交换           │     │         │
│    │                        │ ├────────────────────┤     │         │
│    │                        │ │ 销毁旧索引         │     │         │
│    │                        │ └────────────────────┘     │         │
│    │                        │                            │         │
│    └                        └                            ┘         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 五、配置说明

### 5.1 完整配置示例

```json
{
  "max-concurrent-indexers": 2,
  "dbpath": "data",
  "title": "Hound",
  "health-check-uri": "/healthz",
  "result-limit": 5000,
  "vcs-config": {
    "git": {
      "detect-ref": true
    }
  },
  "repos": {
    "GitHubRepo": {
      "url": "https://github.com/username/repo.git",
      "ms-between-poll": 30000,
      "exclude-dot-files": true,
      "display-name": "显示名称",
      "enable-poll-updates": true,
      "enable-push-updates": false,
      "vcs-config": {},
      "url-pattern": {
        "base-url": "{url}/blob/{rev}/{path}{anchor}",
        "anchor": "#L{line}"
      },
      "auto-generated-files": []
    },
    "PrivateRepo": {
      "url": "git@github.com:username/private.git",
      "vcs": "git",
      "vcs-config": {
        "ref": "main"
      }
    },
    "SVNRepo": {
      "url": "http://svn.example.com/repo",
      "vcs": "svn",
      "url-pattern": {
        "base-url": "{url}/{path}{anchor}"
      },
      "vcs-config": {
        "username": "user",
        "password": "pass"
      }
    },
    "LocalFolder": {
      "url": "file:///absolute/path/to/directory",
      "vcs": "local",
      "vcs-config": {
        "watch-changes": true,
        "ignored-files": ["*.log", "node_modules"]
      }
    }
  }
}
```

### 5.2 配置选项说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max-concurrent-indexers` | int | 2 | 最大并发索引构建数 |
| `dbpath` | string | - | 索引数据存储目录 |
| `title` | string | "Hound" | Web UI 标题 |
| `health-check-uri` | string | "/healthz" | 健康检查端点 |
| `result-limit` | int | 5000 | 默认最大结果数 |
| `vcs-config` | object | {} | 全局 VCS 配置 |

**仓库级配置**：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | string | - | 仓库 URL（必需） |
| `vcs` | string | "git" | VCS 类型 |
| `display-name` | string | - | 显示名称 |
| `ms-between-poll` | int | 30000 | 轮询间隔（毫秒） |
| `exclude-dot-files` | bool | false | 排除点文件 |
| `enable-poll-updates` | bool | true | 启用轮询 |
| `enable-push-updates` | bool | false | 启用推送 |
| `url-pattern` | object | 默认模式 | URL 模式配置 |
| `auto-generated-files` | array | [] | 自动生成文件 |
| `vcs-config` | object | {} | VCS 特定配置 |

---

## 六、构建与部署

### 6.1 构建系统

**Makefile 目标**：

| 目标 | 功能 |
|------|------|
| `make` | 构建所有二进制（hound, houndd） |
| `make ui` | 构建前端 UI |
| `make dev` | 安装开发依赖 |
| `make test` | 运行测试 |
| `make lint` | 代码检查 |
| `make clean` | 清理构建产物 |

### 6.2 构建流程

```
┌─────────────────────────────────────────────────────────────┐
│                        构建流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Go 构建                                                  │
│     ├── 编译 cmds/hound/main.go → .build/bin/hound          │
│     ├── 编译 cmds/houndd/main.go → .build/bin/houndd        │
│     └── 链接 codesearch 静态库                               │
│                                                              │
│  2. 前端构建                                                 │
│     ├── 安装 npm 依赖                                        │
│     ├── 执行 webpack 构建                                    │
│     ├── 打包 JS/CSS/HTML                                     │
│     └── 生成 ui/bindata.go                                   │
│                                                              │
│  3. 输出                                                     │
│     ├── .build/bin/hound     (CLI 客户端)                    │
│     ├── .build/bin/houndd    (服务器)                        │
│     └── ui/bindata.go        (嵌入式资源)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 开发模式

使用 `--dev` 标志启动开发模式：

```bash
.build/bin/houndd --dev
```

开发模式特性：
- 从文件系统读取前端资源
- 启动 webpack-dev-server
- 支持热重载
- 提供源码级调试

### 6.4 Docker 部署

```bash
# 使用官方镜像
docker run -d -p 6080:6080 --name hound \
  -v $(pwd):/data \
  ghcr.io/hound-search/hound:latest

# 自构建镜像
docker build . --tag hound
docker run -d -p 6080:6080 --name hound -v $(pwd):/data hound
```

### 6.5 生产部署建议

1. **反向代理**：使用 nginx/APache 代理到 Hound
2. **TLS 支持**：通过反向代理提供 HTTPS
3. **进程管理**：使用 systemd 或 supervisord 管理
4. **日志配置**：配置日志轮转
5. **资源限制**：根据仓库数量调整 `max-concurrent-indexers`

---

## 七、扩展性设计

### 7.1 添加新的 VCS 支持

1. 在 `vcs/` 目录下创建新文件（如 `vcs/perforce.go`）
2. 实现 `Driver` 接口
3. 在 `init()` 函数中注册驱动：

```go
func init() {
    vcs.Register(func(cfg []byte) (vcs.Driver, error) {
        return &PerforceDriver{}, nil
    }, "p4", "perforce")
}
```

4. 在配置中使用新的 VCS 类型

### 7.2 添加新的 API 端点

在 `api/api.go` 的 `Setup()` 函数中添加：

```go
m.HandleFunc("/api/v1/new-endpoint", func(w http.ResponseWriter, r *http.Request) {
    // 处理逻辑
})
```

### 7.3 自定义 UI

1. 修改 `ui/assets/` 下的源文件
2. 运行 `make ui` 重新构建
3. 或使用 `--dev` 模式进行开发

---

## 八、性能优化

### 8.1 索引性能

| 优化项 | 说明 |
|--------|------|
| 三 gram 索引 | 使用倒排索引加速正则匹配 |
| 并发构建 | 通过 `max-concurrent-indexers` 控制 |
| 增量更新 | 只在版本变化时重建索引 |
| 内存管理 | 每次更新后执行 GC |

### 8.2 搜索性能

| 优化项 | 说明 |
|--------|------|
| 并行搜索 | 每个仓库独立 goroutine 搜索 |
| 结果限制 | `MaxResults` 限制最大匹配数 |
| 读写锁 | 搜索时使用读锁，允许并发搜索 |
| 文件过滤 | 索引阶段过滤非文本文件 |

### 8.3 资源管理

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| `max-concurrent-indexers` | CPU 核心数 | 控制内存使用 |
| `dbpath` | SSD 存储 | 提升 I/O 性能 |
| `ms-between-poll` | 60000+ | 减少不必要的更新 |

---

## 九、测试策略

### 9.1 Go 测试

```bash
# 运行所有测试
make test

# 运行特定包测试
go test ./api/...
go test ./config/...
go test ./index/...
```

### 9.2 JavaScript 测试

```bash
# 运行前端测试
npm test
```

### 9.3 测试覆盖

| 模块 | 测试内容 |
|------|----------|
| config | 配置解析、默认值、验证 |
| index | 索引构建、搜索、过滤 |
| api | API 端点、参数解析、错误处理 |
| vcs | VCS 操作、版本检测 |
| searcher | 并发控制、索引更新 |

---

## 十、参考资料

### 10.1 官方资源

- GitHub: https://github.com/hound-search/hound
- 项目文档: https://github.com/hound-search/hound/tree/master/docs
- Russ Cox 原文: http://swtch.com/~rsc/regexp/regexp4.html

### 10.2 依赖文档

- Go 标准库: https://golang.org/pkg/
- React: https://reactjs.org/
- Jest: https://jestjs.io/
- Webpack: https://webpack.js.org/

---

## 附录

### A. 核心文件清单

| 文件路径 | 功能 |
|----------|------|
| `cmds/houndd/main.go` | 服务器入口 |
| `cmds/hound/main.go` | CLI 入口 |
| `api/api.go` | REST API |
| `config/config.go` | 配置管理 |
| `index/index.go` | 索引核心 |
| `searcher/searcher.go` | 搜索器管理 |
| `vcs/vcs.go` | VCS 抽象 |
| `ui/ui.go` | 前端路由 |

### B. 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 6080 | houndd HTTP | 主要服务端口 |
| 8080 | webpack-dev-server | 开发模式前端热重载 |

### C. 目录结构说明

| 目录/文件 | 说明 |
|-----------|------|
| `data/` | 运行时索引数据目录 |
| `db/` | 默认索引目录 |
| `idx-*/` | 单个索引目录 |
| `vcs-*/` | VCS 缓存目录 |
| `raw/` | 原始文件存储 |
| `tri/` | 三 gram 索引文件 |
| `metadata.gob` | 索引元数据 |
| `excluded_files.json` | 排除文件记录 |

---

*文档结束*
