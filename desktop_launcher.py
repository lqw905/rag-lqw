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

def ensure_transparent_icon() -> str:
    """获取或生成纯透明多尺寸 ico 图标，彻底消除标题栏左侧默认小图标"""
    candidates = [
        APP_DIR / "packaging" / "transparent.ico",
        BUNDLE_DIR / "packaging" / "transparent.ico",
        APP_DIR / "transparent.ico",
        BUNDLE_DIR / "transparent.ico",
    ]
    for c in candidates:
        if c and c.exists():
            return str(c.resolve())

    target = APP_DIR / "transparent.ico"
    try:
        import struct
        sizes = (16, 20, 24, 32, 48, 64, 128, 256)
        num_images = len(sizes)
        header = struct.pack('<HHH', 0, 1, num_images)
        entries, images = [], []
        offset = 6 + 16 * num_images
        for size in sizes:
            w = size if size < 256 else 0
            h = size if size < 256 else 0
            header_size = 40
            color_size = size * size * 4
            row_bytes = ((size + 31) // 32) * 4
            mask_size = row_bytes * size
            image_size = header_size + color_size + mask_size
            entry = struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, image_size, offset)
            entries.append(entry)
            bmp_header = struct.pack('<IIIHHIIIIII', 40, size, size * 2, 1, 32, 0, color_size, 0, 0, 0, 0)
            images.append(bmp_header + (b'\x00' * color_size) + (b'\x00' * mask_size))
            offset += image_size
        ico_data = header + b''.join(entries) + b''.join(images)
        with open(target, 'wb') as f:
            f.write(ico_data)
        return str(target.resolve())
    except Exception as e:
        print(f"[!] 生成多尺寸透明图标失败: {e}")
        return ""

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
    print("      RAG-GK 知识库智能问答系统 - 原生桌面客户端")
    print("=" * 65)
    print(f"[*] 后端服务地址: {server_url} (端口: {actual_port})")
    print(f"[*] 正在拉起原生独立窗口 (WebView2)...")
    print("=" * 65 + "\n")

    # 1. 启动后台 Uvicorn 服务线程
    server_thread = ServerThread(app, host="127.0.0.1", port=actual_port)
    server_thread.start()

    # 2. 主动轮询等待后端服务就绪（通常仅需 0.4~0.8 秒，最长保障等待 10 秒）
    wait_for_server_ready(server_url, timeout=10.0)

    # 3. 获取透明图标以消除标题栏默认图标
    icon_path = ensure_transparent_icon()

    # 4. 创建原生独立窗口（支持自由拉伸缩放、原生贴靠对齐与系统手势）
    window = webview.create_window(
        title="RAG-GK 知识库问答系统",
        url=server_url,
        width=1380,
        height=880,
        min_size=(900, 600),
        resizable=True,
        text_select=True,
        zoomable=True
    )

    def set_white_titlebar():
        """通过 Windows DWM API 定制原生窗口：纯白高雅标题栏、彻底去除系统主题蓝色外边框"""
        try:
            import ctypes
            from ctypes import byref, c_int, sizeof

            hwnd = int(window.native.Handle.ToInt32())
            dwmapi = ctypes.WinDLL("dwmapi.dll")

            # 1. 强制浅色沉浸模式 (DWMWA_USE_IMMERSIVE_DARK_MODE = 20)
            dwmapi.DwmSetWindowAttribute(hwnd, 20, byref(c_int(0)), sizeof(c_int))
            # 2. 标题栏背景设为纯白 (DWMWA_CAPTION_COLOR = 35, 0x00FFFFFF)
            dwmapi.DwmSetWindowAttribute(hwnd, 35, byref(c_int(0x00FFFFFF)), sizeof(c_int))
            # 3. 标题栏文字设为深灰 (DWMWA_TEXT_COLOR = 36, 0x001F2937)
            dwmapi.DwmSetWindowAttribute(hwnd, 36, byref(c_int(0x001F2937)), sizeof(c_int))
            # 4. 外边框设为纯白 (DWMWA_BORDER_COLOR = 34, 0x00FFFFFF)
            dwmapi.DwmSetWindowAttribute(hwnd, 34, byref(c_int(0x00FFFFFF)), sizeof(c_int))
        except Exception as e:
            print(f"[!] 设置标题栏与边框样式失败: {e}")

    window.events.shown += set_white_titlebar

    # 5. 监听窗口关闭事件：强制瞬间彻底退出进程，绝不留僵尸后台
    def on_window_closed():
        try:
            server_thread.stop()
        except Exception:
            pass
        os._exit(0)

    window.events.closed += on_window_closed

    # 6. 阻塞运行原生窗口（传入透明图标彻底消除标题栏默认图标）
    try:
        if icon_path and os.path.exists(icon_path):
            webview.start(icon=icon_path, debug=False)
        else:
            webview.start(debug=False)
    finally:
        os._exit(0)

if __name__ == "__main__":
    main()
