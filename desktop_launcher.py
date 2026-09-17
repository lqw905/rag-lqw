"""
RAG-GK 桌面端原生独立窗口客户端 (Native Desktop Client)
基于 pywebview (WebView2 内核) + FastAPI/Uvicorn 本地知识库服务。
"""

import os
import sys
import time
import shutil
import threading
from pathlib import Path
import uvicorn
import webview

# 确定运行根目录
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).parent.resolve()
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR)).resolve()
else:
    APP_DIR = Path(__file__).parent.resolve()
    BUNDLE_DIR = APP_DIR

# 将工作目录切换到安装/程序所在目录，确保相对路径读写正确（如 ./data/）
os.chdir(APP_DIR)

# 确保在无控制台（GUI模式/console=False）下将日志写入本地 logs/app.log 供排查
log_dir = APP_DIR / "logs"
log_dir.mkdir(exist_ok=True)
try:
    log_file = open(log_dir / "app.log", "a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = log_file
    if sys.stderr is None:
        sys.stderr = log_file
except Exception:
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def init_environment():
    """检测并初始化 .env 配置文件"""
    env_file = APP_DIR / ".env"
    if not env_file.exists():
        src_example = APP_DIR / ".env.example"
        if not src_example.exists():
            src_example = BUNDLE_DIR / ".env.example"
        
        if src_example.exists():
            try:
                shutil.copy(src_example, env_file)
                print("[*] [配置初始化] 检测到首次运行，已自动生成 .env 配置文件。")
            except Exception as e:
                print(f"[!] [配置初始化] 复制 .env 失败: {e}")

class ServerThread(threading.Thread):
    """在后台守护线程中启动并管理 Uvicorn 服务"""
    def __init__(self, app, host: str, port: int):
        super().__init__(daemon=True)
        self.config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="warning"
        )
        self.server = uvicorn.Server(self.config)

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True

def main():
    init_environment()

    # 导入 FastAPI app 与 settings
    from app.config import settings
    from app.main import app

    port = settings.PORT or 8000
    host = settings.HOST if settings.HOST not in ("0.0.0.0", "::") else "127.0.0.1"
    server_url = f"http://{host}:{port}"

    print("=" * 65)
    print("      RAG-GK 知识库智能问答系统 - 原生桌面客户端")
    print("=" * 65)
    print(f"[*] 后端服务地址: {server_url}")
    print(f"[*] 正在拉起原生应用窗口 (WebView2)...")
    print("=" * 65 + "\n")

    # 1. 启动后台 Uvicorn 服务线程
    server_thread = ServerThread(app, host=settings.HOST, port=port)
    server_thread.start()

    # 2. 等待端口就绪
    time.sleep(0.6)

    # 3. 创建原生独立窗口（无浏览器边框/地址栏，完全独立的原生窗口）
    window = webview.create_window(
        title="RAG-GK 知识库问答系统",
        url=server_url,
        width=1380,
        height=880,
        min_size=(980, 680),
        text_select=True,
        zoomable=True
    )

    # 4. 阻塞运行原生窗口（用户关闭窗口后自动唤醒退出）
    try:
        webview.start(debug=True)
    finally:

        print("\n[*] 检测到窗口已关闭，正在安全退出后端服务...")
        server_thread.stop()

if __name__ == "__main__":
    main()
