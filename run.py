"""
RAG-GK 一键启动器 (One-Click Launcher)
用于同时启动 FastAPI 后端服务与 React Vite 前端服务，并支持优雅退出与自动环境检测。
"""

import os
import sys
import time
import shutil
import signal
import subprocess
import threading
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
WEB_DIR = ROOT_DIR / "web"
VENV_PYTHON = ROOT_DIR / ".venv" / "Scripts" / "python.exe" if sys.platform == "win32" else ROOT_DIR / ".venv" / "bin" / "python"

def get_python_exe() -> str:
    """优先使用项目根目录下的 .venv 虚拟环境 Python"""
    if VENV_PYTHON.exists():
        return str(VENV_PYTHON)
    return sys.executable

def check_environment():
    """检查并自动初始化环境配置"""
    env_file = ROOT_DIR / ".env"
    env_example = ROOT_DIR / ".env.example"
    if not env_file.exists() and env_example.exists():
        print("💡 [配置检测] 未找到 .env，已自动从 .env.example 复制。")
        print("💡 [重要提醒] 请根据需要编辑 .env 填入真实 API 密钥。\n")
        shutil.copy(env_example, env_file)

def check_frontend_deps():
    """检查前端 node_modules 是否存在"""
    node_modules = WEB_DIR / "node_modules"
    if not node_modules.exists():
        print("📦 [前端依赖] 检测到 web/node_modules 不存在，正在执行 npm install ...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        try:
            subprocess.run([npm_cmd, "install"], cwd=str(WEB_DIR), check=True)
            print("✅ [前端依赖] 安装完成！\n")
        except Exception as e:
            print(f"⚠️ [前端依赖] 自动安装失败: {e}，请手动在 web 目录下运行 npm install")

def stream_output(process, prefix: str):
    """实时输出子进程日志并添加彩色前缀"""
    try:
        for line in iter(process.stdout.readline, ""):
            if not line:
                break
            print(f"{prefix} {line.rstrip()}")
    except Exception:
        pass

def kill_process_tree(proc):
    """递归彻底终止进程树（兼容 Windows / Linux）"""
    if proc is None or proc.poll() is not None:
        return
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        else:
            proc.terminate()
            proc.wait(timeout=2)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass

def main():
    print("=" * 60)
    print("🚀 正在启动 RAG-GK 轻量级知识库问答系统...")
    print("=" * 60)

    # 1. 环境自检
    check_environment()
    check_frontend_deps()

    py_exe = get_python_exe()
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    backend_proc = None
    frontend_proc = None

    try:
        # 2. 启动后端 FastAPI
        print(f"📡 [后端启动] 使用 Python: {py_exe}")
        backend_cmd = [py_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(ROOT_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1
        )

        # 3. 启动前端 Vite
        print("💻 [前端启动] 正在启动 Vite 开发服务器...")
        frontend_cmd = [npm_cmd, "run", "dev"]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(WEB_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1
        )

        # 启动日志输出线程
        t_backend = threading.Thread(target=stream_output, args=(backend_proc, "[Backend]"), daemon=True)
        t_frontend = threading.Thread(target=stream_output, args=(frontend_proc, "[Frontend]"), daemon=True)
        t_backend.start()
        t_frontend.start()

        # 等待服务预热并输出提示信息
        time.sleep(2)
        print("\n" + "=" * 60)
        print("🎉 RAG-GK 全栈服务已成功启动！")
        print("🌐 前端交互界面:  http://localhost:5173")
        print("📡 后端接口地址:  http://localhost:8000")
        print("📖 Swagger 文档:  http://localhost:8000/docs")
        print("💡 按 Ctrl + C 可一键安全退出所有服务")
        print("=" * 60 + "\n")

        # 保持主线程运行，监听子进程状态
        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None:
                print("⚠️ [后端退出] 后端进程已意外终止。")
                break
            if frontend_proc.poll() is not None:
                print("⚠️ [前端退出] 前端进程已意外终止。")
                break

    except KeyboardInterrupt:
        print("\n🛑 正在停止所有服务，请稍候...")
    finally:
        kill_process_tree(backend_proc)
        kill_process_tree(frontend_proc)
        print("👋 所有服务已安全停止。")

if __name__ == "__main__":
    main()
