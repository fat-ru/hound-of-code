# Hound 用户管理与仓库配置 - 开发方案设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 项目名称 | Hound |
| 功能模块 | 用户管理、仓库配置、认证授权 |
| 文档版本 | v1.0 |
| 创建日期 | 2025-01-18 |
| 状态 | 已实现 |

---

## 一、功能概述

### 1.1 新增功能

本模块为Hound增加了以下功能：

1. **用户认证系统**
   - 用户注册、登录、登出
   - JWT Token认证
   - 角色权限管理（管理员/普通用户）

2. **用户管理界面**
   - 用户列表展示
   - 用户搜索、添加、编辑、删除
   - 角色分配

3. **仓库配置界面**
   - 可视化仓库配置
   - 仓库列表CRUD操作
   - 仓库搜索

4. **权限控制**
   - 游客可搜索代码（无需登录）
   - 普通用户可配置仓库
   - 管理员可管理用户和仓库

### 1.2 设计目标

- **易用性**：用户无需编辑JSON文件即可配置仓库
- **安全性**：JWT认证、保护敏感操作
- **可扩展性**：SQLite存储、支持未来扩展

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         客户端浏览器                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      前端页面                                │   │
│  │  ┌───────────┐  ┌────────────┐  ┌──────────────────────┐   │   │
│  │  │login.html │  │register.html│  │   settings.html     │   │   │
│  │  └───────────┘  └────────────┘  └──────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │              JavaScript Modules                      │   │   │
│  │  │  auth.js  │  user-settings.js  │  repo-settings.js  │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬────────────────────────────────────┘
                               │ HTTP/REST + JWT Token
┌──────────────────────────────┴────────────────────────────────────┐
│                       Hound Server (houndd)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   HTTP Server (:6080)                       │   │
│  │  ┌───────────────┐  ┌───────────────────────────────────┐  │   │
│  │  │   公开API     │  │         认证API                   │  │   │
│  │  │  /api/v1/repos│  │  /api/v1/auth/register (公开)     │  │   │
│  │  │  /api/v1/search│  │  /api/v1/auth/login (公开)       │  │   │
│  │  │  /api/v1/excludes│  │  /api/v1/auth/me (需认证)      │  │   │
│  │  └───────────────┘  └───────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │              用户管理API (仅管理员)                  │   │   │
│  │  │  GET    /api/v1/users        - 获取用户列表        │   │   │
│  │  │  POST   /api/v1/users        - 创建用户            │   │   │
│  │  │  GET    /api/v1/users/:id    - 获取用户详情        │   │   │
│  │  │  PUT    /api/v1/users/:id    - 更新用户            │   │   │
│  │  │  DELETE /api/v1/users/:id    - 删除用户            │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │           仓库配置API (管理员/普通用户)              │   │   │
│  │  │  GET    /api/v1/repos/config  - 获取配置列表       │   │   │
│  │  │  POST   /api/v1/repos/config  - 创建配置           │   │   │
│  │  │  GET    /api/v1/repos/config/:id - 获取配置       │   │   │
│  │  │  PUT    /api/v1/repos/config/:id - 更新配置       │   │   │
│  │  │  DELETE /api/v1/repos/config/:id - 删除配置       │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   认证中间件                                 │   │
│  │  - Token验证                                                │   │
│  │  - 角色检查                                                 │   │
│  │  - 上下文注入                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬────────────────────────────────────┘
                               │
┌──────────────────────────────┴────────────────────────────────────┐
│                         数据存储层                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐   │
│  │  SQLite Database     │  │     JSON Config File            │   │
│  │  (用户、仓库配置)     │  │     (原有仓库索引配置)           │   │
│  │  hound.db            │  │     config.json                 │   │
│  └──────────────────────┘  └──────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 数据库 | SQLite 3 | 嵌入式关系型数据库，无需独立服务 |
| 认证 | JWT (golang-jwt/jwt v5) | 无状态Token认证 |
| 前端认证 | localStorage | Token存储 |
| 前端HTTP | XMLHttpRequest | 原生AJAX请求 |

---

## 三、数据库设计

### 3.1 用户表 (users)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTOINCREMENT | 用户ID |
| username | TEXT | UNIQUE, NOT NULL | 用户名 |
| password_hash | TEXT | NOT NULL | 密码哈希 |
| role | TEXT | NOT NULL | 角色 (admin/user) |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |

### 3.2 仓库配置表 (repo_configs)

```sql
CREATE TABLE repo_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    vcs_type TEXT NOT NULL DEFAULT 'git',
    display_name TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    ms_between_polls INTEGER DEFAULT 30000,
    vcs_config TEXT,
    exclude_dot_files INTEGER DEFAULT 0,
    enable_poll_updates INTEGER DEFAULT 1,
    enable_push_updates INTEGER DEFAULT 0,
    auto_generated_files TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_repo_configs_name ON repo_configs(name);
CREATE INDEX idx_repo_configs_enabled ON repo_configs(enabled);
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER | PK | 配置ID |
| name | TEXT | - | 仓库标识名 |
| url | TEXT | - | 仓库URL |
| branch | TEXT | 'main' | 默认分支 |
| vcs_type | TEXT | 'git' | VCS类型 |
| display_name | TEXT | - | 显示名称 |
| enabled | INTEGER | 1 | 是否启用 |
| ms_between_polls | INTEGER | 30000 | 轮询间隔(ms) |
| vcs_config | TEXT | - | VCS认证配置 |
| exclude_dot_files | INTEGER | 0 | 排除点文件 |
| enable_poll_updates | INTEGER | 1 | 启用轮询 |
| enable_push_updates | INTEGER | 0 | 启用推送 |
| auto_generated_files | TEXT | - | 自动生成文件列表 |

---

## 四、API接口设计

### 4.1 认证API

#### 4.1.1 注册用户

```
POST /api/v1/auth/register
Content-Type: application/json

Request:
{
    "username": "admin",
    "password": "password123"
}

Response (200):
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "id": 1,
        "username": "admin",
        "role": "admin",
        "createdAt": "2025-01-18T10:00:00Z"
    }
}
```

**规则**：
- 第一个注册的用户自动成为 `admin` 角色
- 后续注册的用户默认为 `user` 角色

#### 4.1.2 用户登录

```
POST /api/v1/auth/login
Content-Type: application/json

Request:
{
    "username": "admin",
    "password": "password123"
}

Response (200):
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "id": 1,
        "username": "admin",
        "role": "admin",
        "createdAt": "2025-01-18T10:00:00Z"
    }
}
```

#### 4.1.3 获取当前用户

```
GET /api/v1/auth/me
Authorization: Bearer <token>

Response (200):
{
    "id": 1,
    "username": "admin",
    "role": "admin",
    "createdAt": "2025-01-18T10:00:00Z"
}
```

### 4.2 用户管理API (仅管理员)

#### 4.2.1 获取用户列表

```
GET /api/v1/users
Authorization: Bearer <token>

Response (200):
{
    "users": [
        {
            "id": 1,
            "username": "admin",
            "role": "admin",
            "createdAt": "2025-01-18T10:00:00Z"
        }
    ],
    "totalCount": 1
}
```

#### 4.2.2 创建用户

```
POST /api/v1/users
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
    "username": "newuser",
    "password": "password123",
    "role": "user"
}
```

#### 4.2.3 更新用户

```
PUT /api/v1/users/:id
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
    "username": "updateduser",
    "password": "newpassword",  // 可选
    "role": "admin"
}
```

#### 4.2.4 删除用户

```
DELETE /api/v1/users/:id
Authorization: Bearer <token>
```

### 4.3 仓库配置API (管理员/普通用户)

#### 4.3.1 获取仓库配置列表

```
GET /api/v1/repos/config?q=search_term
Authorization: Bearer <token>

Response (200):
{
    "repoConfigs": [
        {
            "id": 1,
            "name": "my-repo",
            "url": "https://github.com/user/repo.git",
            "branch": "main",
            "vcsType": "git",
            "displayName": "My Repository",
            "enabled": true,
            "createdAt": "2025-01-18T10:00:00Z"
        }
    ],
    "totalCount": 1
}
```

#### 4.3.2 创建仓库配置

```
POST /api/v1/repos/config
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
    "name": "my-repo",
    "url": "https://github.com/user/repo.git",
    "branch": "main",
    "vcsType": "git",
    "displayName": "My Repository",
    "enabled": true
}
```

#### 4.3.3 更新仓库配置

```
PUT /api/v1/repos/config/:id
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
    "name": "updated-repo",
    "url": "https://github.com/user/repo.git",
    "branch": "develop",
    "enabled": true
}
```

#### 4.3.4 删除仓库配置

```
DELETE /api/v1/repos/config/:id
Authorization: Bearer <token>
```

### 4.4 公开API (无需认证)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/repos` | GET | 获取已索引的仓库列表 |
| `/api/v1/search` | GET | 搜索代码 |
| `/api/v1/excludes` | GET | 获取排除文件列表 |

---

## 五、权限设计

### 5.1 角色说明

| 角色 | 搜索 | 用户管理 | 仓库管理 |
|------|------|---------|---------|
| 游客 | ✅ | ❌ | ❌ |
| 普通用户 (user) | ✅ | ❌ | ✅ |
| 管理员 (admin) | ✅ | ✅ | ✅ |

### 5.2 首个用户规则

- 系统启动后，第一个调用 `/api/v1/auth/register` 的用户自动分配 `admin` 角色
- 后续用户默认为 `user` 角色，需管理员在界面中添加

---

## 六、前端设计

### 6.1 新增页面

| 页面 | 路径 | 访问权限 | 功能 |
|------|------|---------|------|
| 登录页 | `/login` | 公开 | 用户登录 |
| 注册页 | `/register` | 公开 | 用户注册（首个用户成为admin） |
| 设置页 | `/settings` | 登录用户 | 设置入口 |
| 用户设置 | `/settings#users` | 仅管理员 | 用户CRUD |
| 仓库设置 | `/settings#repos` | 管理员/普通用户 | 仓库CRUD |

### 6.2 新增JavaScript模块

| 文件 | 功能 |
|------|------|
| `js/auth.js` | 认证模块：登录、注册、Token管理、API请求封装 |
| `js/user-settings.js` | 用户设置页面组件 |
| `js/repo-settings.js` | 仓库设置页面组件 |
| `js/common.js` | 扩展：Common工具类、导航栏组件 |

### 6.3 导航栏

```
┌─────────────────────────────────────────────────────────────────┐
│ Hound                          Search | Settings | Login | Register
└─────────────────────────────────────────────────────────────────┘

登录后：
┌─────────────────────────────────────────────────────────────────┐
│ Hound                          Search | Settings | admin (admin) | Logout
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、安全设计

### 7.1 密码存储

使用简单的盐值哈希方案：

```go
func HashPassword(password string) string {
    salt := randomBytes(16)
    hash := base64.StdEncoding.EncodeToString([]byte(password + salt))
    return base64.StdEncoding.EncodeToString(salt) + ":" + hash
}
```

**注意**：生产环境建议使用 `golang.org/x/crypto/bcrypt`

### 7.2 Token机制

- Token有效期：24小时
- Token存储：localStorage
- Token传输：Header `Authorization: Bearer <token>`

### 7.3 敏感信息保护

- 密码哈希不返回给前端
- VCS认证配置加密存储

---

## 八、文件变更清单

### 8.1 新增文件

| 文件路径 | 说明 |
|----------|------|
| `data/db.go` | SQLite数据库初始化 |
| `data/user.go` | 用户数据访问层 |
| `data/repo_config.go` | 仓库配置数据访问层 |
| `auth/jwt.go` | JWT认证模块 |
| `api/auth.go` | 认证API处理器 |
| `api/users.go` | 用户管理API处理器 |
| `api/repo_config.go` | 仓库配置API处理器 |
| `ui/assets/login.html` | 登录页面 |
| `ui/assets/register.html` | 注册页面 |
| `ui/assets/settings.html` | 设置页面 |
| `ui/assets/js/auth.js` | 认证前端模块 |
| `ui/assets/js/user-settings.js` | 用户设置前端组件 |
| `ui/assets/js/repo-settings.js` | 仓库设置前端组件 |
| `scripts/init.bat` | Windows构建脚本 |
| `scripts/build.sh` | Linux/Mac构建脚本 |

### 8.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `go.mod` | 添加依赖 |
| `api/api.go` | 添加Context辅助函数 |
| `api/auth.go` | 添加getUserFromContext函数 |
| `web/web.go` | 添加认证中间件和路由保护 |
| `cmds/houndd/main.go` | 添加数据库和认证初始化 |
| `ui/assets/css/hound.css` | 添加认证和设置页面样式 |
| `ui/assets/js/common.js` | 添加Common工具类和导航栏 |

### 8.3 依赖变更

```go
require (
    github.com/blang/semver/v4 v4.0.0
    github.com/golang-jwt/jwt/v5 v5.2.0      // 新增：JWT
    github.com/mattn/go-sqlite3 v1.14.19    // 新增：SQLite
    golang.org/x/mod v0.10.0
)
```

---

## 九、构建与部署

### 9.1 构建命令

```bash
# 安装依赖
go mod tidy

# 构建
go build -o bin/houndd ./cmds/houndd
```

### 9.2 启动命令

```bash
./bin/houndd --conf=config.json --addr=:6080
```

### 9.3 使用流程

1. **首次启动**：启动Hound服务
2. **注册管理员**：访问 `/register`，第一个用户成为管理员
3. **配置仓库**：登录后访问 `/settings`，在仓库设置中添加仓库
4. **用户管理**：管理员可在用户设置中添加其他用户

---

## 十、已知限制

1. **密码哈希**：当前使用简单哈希，生产环境应使用bcrypt
2. **Token刷新**：未实现Token刷新机制，过期需重新登录
3. **会话管理**：使用本地存储，非严格安全
4. **仓库同步**：仓库配置变更后需要重启服务或手动触发索引

---

## 十一、后续优化建议

1. [ ] 使用bcrypt替代简单密码哈希
2. [ ] 实现Token刷新机制
3. [ ] 添加HTTPS支持
4. [ ] 实现仓库配置热更新（无需重启）
5. [ ] 添加密码强度验证
6. [ ] 实现用户锁定机制
7. [ ] 添加操作审计日志

---

## 附录

### A. 快速参考

| 操作 | API | 权限 |
|------|-----|------|
| 搜索代码 | `GET /api/v1/search` | 公开 |
| 查看仓库 | `GET /api/v1/repos` | 公开 |
| 注册 | `POST /api/v1/auth/register` | 公开 |
| 登录 | `POST /api/v1/auth/login` | 公开 |
| 用户管理 | `GET/POST/PUT/DELETE /api/v1/users/*` | admin |
| 仓库配置 | `GET/POST/PUT/DELETE /api/v1/repos/config/*` | admin/user |

### B. 数据库路径

默认数据库位置：`config.json所在目录/hound.db`
