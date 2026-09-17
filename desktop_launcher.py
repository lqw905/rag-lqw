"""
RAG-GK 桌面端一键启动主程序 (Desktop Launcher)
用于打包后独立运行：初始化工作环境、拉起 FastAPI/Uvicorn 服务、自动唤起浏览器。
"""

import os
import sys
import time
import shutil
import threading
import webbrowser
from pathlib import Path

# 确定运行根目录
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).parent.resolve()
    # PyInstaller 临时解压资源目录
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR)).resolve()
else:
    APP_DIR = Path(__file__).parent.resolve()
    BUNDLE_DIR = APP_DIR

# 保证 Windows 控制台输出不因编码中断
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 将工作目录切换到安装/程序所在目录，确保相对路径读写正确（如 ./data/）
os.chdir(APP_DIR)

def init_environment():
    """检测并初始化 .env 配置文件"""
    env_file = APP_DIR / ".env"
    if not env_file.exists():
        # 优先从程序目录找 .env.example
        src_example = APP_DIR / ".env.example"
        if not src_example.exists():
            # 否则从打包临时资源目录找
            src_example = BUNDLE_DIR / ".env.example"
        
        if src_example.exists():
            try:
                shutil.copy(src_example, env_file)
                print("[*] [配置初始化] 检测到首次运行，已自动生成 .env 配置文件。")
            except Exception as e:
                print(f"[!] [配置初始化] 复制 .env 失败: {e}")

def open_browser_delayed(url: str, delay: float = 1.5):
    """延迟并在后台自动打开默认浏览器访问前端界面"""
    time.sleep(delay)
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"[!] 自动唤起浏览器失败: {e}，请手动访问 {url}")


def main():
    init_environment()

    # 导入 FastAPI app 与 settings
    from app.config import settings
    from app.main import app
    import uvicorn

    port = settings.PORT or 8000
    display_host = "127.0.0.1" if settings.HOST in ("0.0.0.0", "::") else settings.HOST
    web_url = f"http://{display_host}:{port}"

    print("=" * 65)
    print("      RAG-GK 知识库智能问答系统 - 桌面客户端")
    print("=" * 65)
    print(f" 状态: 服务已启动")
    print(f" 地址: {web_url}")
    print(f" 提示: 正在自动打开浏览器，如未弹出请手动在浏览器输入上述地址。")
    print(f" 退出: 关闭本控制台窗口即可终止运行。")
    print("=" * 65 + "\n")

    # 异步唤起浏览器
    threading.Thread(target=open_browser_delayed, args=(web_url,), daemon=True).start()

    # 启动 Uvicorn (以 app 实例对象直接启动，规避动态字符串模块导入在 PyInstaller 中的兼容问题)
    uvicorn.run(app, host=settings.HOST, port=port, log_level="info")

if __name__ == "__main__":
    main()
