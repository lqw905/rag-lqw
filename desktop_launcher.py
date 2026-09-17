"""
RAG-GK 桌面端原生独立窗口客户端 (Native Desktop Client)
基于 pywebview (WebView2 内核) + FastAPI/Uvicorn 本地知识库服务。
"""

import os
import sys
import time
import socket
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

def wait_for_server_ready(url: str, timeout: float = 10.0) -> bool:
    """轮询等待后端服务完全就绪（健康检查接口返回 200）"""
    import urllib.request
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=0.8) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.1)
    return False

def find_available_port(start_port: int = 8000, max_attempts: int = 20) -> int:
    """动态探测可用端口，防止端口占用导致卡死"""
    for p in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return start_port

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
        try:
            self.server.run()
        except Exception as e:
            print(f"[!] 后端服务异常: {e}")

    def stop(self):
        self.server.should_exit = True

class WindowAPI:
    """供前端 js_api 调用的原生窗口控制桥接类"""
    def __init__(self):
        self.window = None

    def set_window(self, window):
        self.window = window

    def minimize(self):
        if self.window:
            try:
                self.window.minimize()
            except Exception as e:
                print(f"[!] 最小化异常: {e}")

    def maximize(self) -> bool:
        if not self.window:
            return False
        try:
            # WinForms FormWindowState: Normal = 0, Minimized = 1, Maximized = 2
            is_max = (int(self.window.native.WindowState) == 2)
            if is_max:
                self.window.restore()
                return False
            else:
                self.window.maximize()
                return True
        except Exception:
            try:
                self.window.maximize()
            except Exception:
                pass
            return True

    def is_maximized(self) -> bool:
        if not self.window:
            return False
        try:
            return (int(self.window.native.WindowState) == 2)
        except Exception:
            return False

    def close(self):
        def _terminate():
            time.sleep(0.05)
            try:
                if self.window:
                    self.window.destroy()
            except Exception:
                pass
            os._exit(0)
        threading.Thread(target=_terminate, daemon=True).start()

def main():
    init_environment()

    # 导入 FastAPI app 与 settings
    from app.config import settings
    from app.main import app

    # 自动探测可用端口，防止双开或旧端口占用冲突
    default_port = settings.PORT or 8000
    actual_port = find_available_port(default_port)
    server_url = f"http://127.0.0.1:{actual_port}"

    print("=" * 65)
    print("      RAG-GK 知识库智能问答系统 - 原生极简无边框桌面客户端")
    print("=" * 65)
    print(f"[*] 后端服务地址: {server_url} (端口: {actual_port})")
    print(f"[*] 正在拉起极简沉浸式独立窗口 (WebView2 Frameless)...")
    print("=" * 65 + "\n")

    # 1. 启动后台 Uvicorn 服务线程
    server_thread = ServerThread(app, host="127.0.0.1", port=actual_port)
    server_thread.start()

    # 2. 主动轮询等待后端服务就绪（通常仅需 0.4~0.8 秒，最长保障等待 10 秒）
    wait_for_server_ready(server_url, timeout=10.0)

    # 3. 初始化窗口控制桥接对象与 FastAPI 双通道端点
    window_api = WindowAPI()

    @app.post("/api/window/minimize")
    def api_window_minimize():
        window_api.minimize()
        return {"status": "ok"}

    @app.post("/api/window/maximize")
    def api_window_maximize():
        is_max = window_api.maximize()
        return {"is_maximized": is_max}

    @app.get("/api/window/state")
    def api_window_state():
        return {"is_maximized": window_api.is_maximized()}

    @app.post("/api/window/close")
    def api_window_close():
        window_api.close()
        return {"status": "closing"}

    # 4. 创建原生独立沉浸式无边框窗口（Frameless，彻底根除系统原生标题栏与一切冗余图标）
    window = webview.create_window(
        title="RAG-GK 知识库问答系统",
        url=server_url,
        width=1380,
        height=880,
        min_size=(980, 680),
        frameless=True,
        easy_drag=False,
        js_api=window_api,
        text_select=True,
        zoomable=True
    )
    window_api.set_window(window)

    # 5. 监听窗口关闭事件：强制瞬间彻底退出进程，绝不留僵尸后台
    def on_window_closed():
        try:
            server_thread.stop()
        except Exception:
            pass
        os._exit(0)

    window.events.closed += on_window_closed

    # 6. 阻塞运行原生窗口
    try:
        webview.start(debug=False)
    finally:
        os._exit(0)

if __name__ == "__main__":
    main()
