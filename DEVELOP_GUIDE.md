# Develop Guide

## Environment

1. `wsl` or `mac`
2. node 12

### For Mac ARM (Apple Silicon)

由于 Node 12 没有官方的 darwin-arm64 预编译版本，需要手动安装 x64 版本（通过 Rosetta 运行）：

1. 安装 mise（如果未安装）：`brew install mise`，使用其他node版本管理工具参考其版本管理方式
2. 手动安装 Node 12 x64 版本：
   
```bash
# 创建 mise 的 node 安装目录，目录名后缀 _x64 用于区分官方 arm64 版本（如果存在）
mkdir -p ~/.local/share/mise/installs/node/12.22.12_x64

# 从阿里云镜像下载 Node 12 的 darwin-x64 版本并解压到目标目录
# --strip-components=1 去除压缩包内的顶层目录（node-v12.22.12-darwin-x64）
curl -fsSL https://mirrors.aliyun.com/nodejs-release/v12.22.12/node-v12.22.12-darwin-x64.tar.gz | tar xz -C ~/.local/share/mise/installs/node/12.22.12_x64 --strip-components=1

# 通知 mise 重新扫描安装目录，使其识别新安装的 node 版本
mise reshim node@12.22.12_x64
mise ls
```

3. 在项目中使用：

```bash
# 进入 x86_64 模式的 zsh（通过 Rosetta 运行），后续的 node 和 npm 命令将在此环境下执行
arch -x86_64 zsh

# 设置编译标志，确保原生依赖包（如 node-gyp 编译的模块）以 x86_64 架构编译，这是让依赖 native 模块的包（如 node-sass、sqlite3 等）正常工作的关键
export ARCHFLAGS="-arch x86_64"

# 项目中使用 node 12
mise use node@12.22.12_x64
```


## Install Dependencies
```
yarn
```

## Add develop config
create `server/local_config.yaml`, see `doc/access-backend.md`

## Run
```
yarn start
```

## Preview Kube Icon
```
yarn preview-kube-icon
```
