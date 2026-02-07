/**
 * 预览kube-component的icon组件
 * 
 * Usage:
 *   node preview-kube-icon.js ./path/to/spirits.js
 *   node preview-kube-icon.js https://example.com/spirits.js
 * 
 * 注意事项：
 * - 支持自动检测系统代理设置 (HTTPS_PROXY/http_proxy 等环境变量)
 * - HTTPS 请求可能会绕过代理直接连接（解决 TLS 连接问题）
 * - 如果遇到代理连接问题，建议先手动下载文件再使用本地路径
 */
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const { JSDOM } = require('jsdom');

// 默认端口
const DEFAULT_PORT = 3000;

// 安装依赖提示
function checkDependencies() {
  try {
    require('jsdom');
  } catch (e) {
    console.error('缺少依赖 jsdom，请先执行：npm install jsdom');
    process.exit(1);
  }
}

// 获取系统代理设置
function getSystemProxy() {
  const env = process.env;
  return env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
}

// 获取文件内容（支持本地文件和远程URL）
async function getFileContent(targetPath) {
  return new Promise((resolve, reject) => {
    // 判断是否是 URL
    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      const isHttps = targetPath.startsWith('https');
      const client = isHttps ? https : http;
      
      // 检查是否有代理设置
      const proxyUrl = getSystemProxy();
      let options;
      
      if (proxyUrl) {
        console.log(`检测到代理设置: ${proxyUrl}`);
        const proxy = new URL(proxyUrl);
        const target = new URL(targetPath);
        
        // 尝试不同的代理配置方法
        if (isHttps) {
          // 对于 HTTPS，尝试直接连接目标服务器（绕过代理的TLS问题）
          console.log('检测到HTTPS请求，尝试直连...');
          options = {
            hostname: target.hostname,
            port: target.port || 443,
            path: target.pathname + target.search,
            method: 'GET',
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; kube-icon-preview/1.0)',
              'Accept': 'text/javascript,application/javascript,*/*'
            }
          };
        } else {
          // HTTP 可以正常使用代理
          options = {
            hostname: proxy.hostname,
            port: proxy.port || 80,
            path: targetPath,
            method: 'GET',
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; kube-icon-preview/1.0)',
              'Accept': 'text/javascript,application/javascript,*/*',
              'Host': target.host
            }
          };
        }
      } else {
        // 无代理情况
        const url = new URL(targetPath);
        options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'GET',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; kube-icon-preview/1.0)',
            'Accept': 'text/javascript,application/javascript,*/*'
          }
        };
      }

      console.log(`正在请求: ${targetPath}`);
      console.log(`使用协议: ${isHttps ? 'HTTPS' : 'HTTP'}`);
      if (proxyUrl && !isHttps) {
        console.log(`通过代理: ${proxyUrl}`);
      } else if (isHttps) {
        console.log('直连HTTPS服务器（绕过代理TLS问题）');
      }
      
      const req = client.get(options, (res) => {
        console.log(`响应状态码: ${res.statusCode}`);
        console.log(`响应头键名:`, Object.keys(res.headers).slice(0, 5));
        
        if (res.statusCode !== 200) {
          reject(new Error(`请求失败，状态码：${res.statusCode}`));
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { 
          data += chunk; 
          // 显示下载进度
          if (data.length % 10240 === 0) { // 每10KB显示一次
            process.stdout.write('.');
          }
        });
        res.on('end', () => { 
          console.log(`\n下载完成，大小: ${(data.length / 1024).toFixed(2)} KB`);
          resolve(data); 
        });
      });

      // 设置请求超时
      req.setTimeout(isHttps ? 15000 : (proxyUrl ? 30000 : 10000), () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.on('error', (err) => {
        console.error(`详细错误信息:`, err);
        console.error(`错误代码:`, err.code);
        console.error(`错误系统调用:`, err.syscall);
        
        // 如果是HTTPS且有代理，给出建议
        if (isHttps && proxyUrl && (err.code === 'ECONNRESET' || err.message.includes('TLS'))) {
          reject(new Error(`HTTPS通过代理连接失败。建议：1) 检查代理服务器是否支持HTTPS CONNECT；2) 或者先手动下载文件再使用本地路径`));
        } else {
          reject(new Error(`网络请求错误：${err.message}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

    } else {
      // 本地文件（使用 fs 模块，需要引入）
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.resolve(process.cwd(), targetPath);
      fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) {
          reject(new Error(`读取本地文件失败：${err.message}`));
          return;
        }
        resolve(data);
      });
    }
  });
}

// 从JS文件内容中提取SVG代码
function extractSVGFromJS(jsContent) {
  // 匹配SVG标签的正则（匹配完整的svg标签内容）
  const svgRegex = /<svg[\s\S]*?<\/svg>/i;
  const match = jsContent.match(svgRegex);
  
  if (!match) {
    throw new Error('未在文件中找到SVG雪碧图代码');
  }
  
  return match[0];
}

// 解析SVG中的symbol节点
function parseSymbols(svgContent) {
  const dom = new JSDOM(svgContent);
  const document = dom.window.document;
  const symbols = document.querySelectorAll('symbol');
  const result = [];

  symbols.forEach(symbol => {
    const id = symbol.getAttribute('id');
    if (id) {
      result.push({
        id,
        content: symbol.outerHTML
      });
    }
  });

  if (result.length === 0) {
    throw new Error('未在SVG中找到symbol节点');
  }

  return result;
}

// 生成预览HTML
function generatePreviewHTML(svgContent, symbols) {
  // 生成图标展示区域
  const iconItems = symbols.map(symbol => `
    <div class="icon-item">
        <svg class="icon" aria-hidden="true">
            <use xlink:href="#${symbol.id}"></use>
        </svg>
        <div class="icon-name">${symbol.id}</div>
    </div>
  `).join('\n');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>SVG 图标预览</title>
    <style>
        body { 
            padding: 20px; 
            font-family: Arial, sans-serif; 
            background-color: #f5f5f5;
            margin: 0;
        }
        .header {
            background: white;
            padding: 10px 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h2 { 
            color: #333; 
            margin: 0;
            font-size: 18px;
        }
        .count {
            color: #1890ff;
            font-weight: normal;
            margin-left: 10px;
        }
        .icon-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            padding: 0 20px;
        }
        .icon-item { 
            display: flex;
            flex-direction: column;
            align-items: center;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            width: 120px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .icon-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .icon {
            width: 64px;
            height: 64px;
            color: #1890ff; /* 调整图标颜色 */
            transition: color 0.2s;
        }
        .icon-item:hover .icon {
            color: #40a9ff;
        }
        .icon-name {
            margin-top: 8px;
            font-size: 14px;
            color: #666;
            word-break: break-all;
            text-align: center;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            color: #999;
            font-size: 12px;
            padding: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>SVG 图标预览 <span class="count">(${symbols.length} 个图标)</span></h2>
    </div>
    ${svgContent}
    <div class="icon-container">
        ${iconItems}
    </div>
    <div class="footer">
        SVG 图标预览服务 | 按 Ctrl+C 停止服务
    </div>
</body>
</html>
  `;
}

// 自动打开浏览器
function openBrowser(url) {
  let cmd = '';

  switch (process.platform) {
    case 'win32':
      cmd = `start "" "${url}"`;
      break;
    case 'darwin':
      cmd = `open "${url}"`;
      break;
    case 'linux':
      cmd = `xdg-open "${url}"`;
      break;
    default:
      console.log(`请在浏览器中访问：${url}`);
      return;
  }

  exec(cmd, (err) => {
    if (err) {
      console.log(`自动打开浏览器失败，请手动在浏览器中访问：${url}`);
    }
  });
}

// 查找可用端口
function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = http.createServer();
    
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
    
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// 创建HTTP服务
async function createServer(svgContent, symbols) {
  // 查找可用端口
  const port = await findAvailablePort(DEFAULT_PORT);
  
  // 创建服务器
  const server = http.createServer((req, res) => {
    // 只处理根路径请求
    if (req.url === '/' || req.url === '/favicon.ico') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(generatePreviewHTML(svgContent, symbols));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  });

  // 设置服务器超时时间，避免长时间保持连接
  server.timeout = 5000;
  server.keepAliveTimeout = 1000;

  // 启动服务器
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n✅ SVG 图标预览服务已启动`);
    console.log(`🔗 访问地址：${url}`);
    console.log(`⏹️  停止服务：按 Ctrl + C\n`);
    
    // 自动打开浏览器
    openBrowser(url);
  });

  // 标记是否正在关闭
  let isClosing = false;

  // 监听停止信号
  const gracefulShutdown = () => {
    if (isClosing) {
      console.log('\n⚠️  已经在关闭中，请稍候...');
      return;
    }
    
    isClosing = true;
    console.log('\n🛑 正在停止 SVG 图标预览服务...');
    
    // 先停止接收新连接
    server.close(() => {
      console.log('✅ 服务已停止');
      process.exit(0);
    });
    
    // 如果有活跃连接，强制销毁它们
    setTimeout(() => {
      console.log('🔄 清理活跃连接...');
      server.closeAllConnections && server.closeAllConnections();
    }, 1000);
    
    // 设置最终超时强制退出
    setTimeout(() => {
      console.log('⏰ 强制退出...');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

// 主函数
async function main() {
  // 检查命令行参数
  if (process.argv.length < 3) {
    console.error('使用方法：node preview-kube-icon.js <文件路径或URL>');
    console.error('示例：');
    console.error('  node preview-kube-icon.js ./spirits.js');
    console.error('  node preview-kube-icon.js https://example.com/spirits.js');
    process.exit(1);
  }

  // 检查依赖
  checkDependencies();

  const targetPath = process.argv[2];

  try {
    console.log(`正在获取文件内容：${targetPath}`);
    // 1. 获取文件内容
    const content = await getFileContent(targetPath);
    
    // 2. 提取SVG代码
    console.log('正在解析SVG代码...');
    const svgContent = extractSVGFromJS(content);
    
    // 3. 解析symbol节点
    const symbols = parseSymbols(svgContent);
    console.log(`找到 ${symbols.length} 个图标`);
    
    // 4. 创建并启动HTTP服务
    console.log('正在启动预览服务...');
    await createServer(svgContent, symbols);

  } catch (err) {
    console.error('❌ 出错了：', err.message);
    process.exit(1);
  }
}

// 执行主函数
main();