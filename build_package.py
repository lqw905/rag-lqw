"""
RAG-GK 一键打包构建流水线 (One-Click Build Pipeline)
1. 编译前端 React Vite 静态页面 (npm run build)
2. 调用 PyInstaller 固化 Python 后端运行环境 (rag_gk.spec -> dist/RAG-GK/)
3. 调用 NSIS 编译器生成 Windows 安装程序 (installer.nsi -> dist/RAG-GK_v1.0.0_Setup.exe)
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# 保证 Windows 控制台输出不产生编码崩溃
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

ROOT_DIR = Path(__file__).parent.resolve()
WEB_DIR = ROOT_DIR / "web"
DIST_DIR = ROOT_DIR / "dist"
PACKAGING_DIR = ROOT_DIR / "packaging"

def find_makensis() -> str:
    """查找 makensis.exe 路径"""
    which_nsis = shutil.which("makensis")
    if which_nsis:
        return which_nsis
    
    candidates = [
        Path(r"C:\Program Files (x86)\NSIS\makensis.exe"),
        Path(r"C:\Program Files\NSIS\makensis.exe"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "NSIS" / "makensis.exe"
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return ""

def find_pyinstaller() -> str:
    """查找虚拟环境中的 pyinstaller.exe"""
    venv_pyinstaller = ROOT_DIR / ".venv" / "Scripts" / "pyinstaller.exe"
    if venv_pyinstaller.exists():
        return str(venv_pyinstaller)
    which_pyinstaller = shutil.which("pyinstaller")
    if which_pyinstaller:
        return which_pyinstaller
    return "pyinstaller"

def run_step(name: str, cmd: list, cwd: Path = ROOT_DIR):
    """执行构建子任务"""
    print("\n" + "=" * 60)
    print(f"[*] [步骤] {name}")
    print(f"[>] 命令: {' '.join(cmd)}")
    print(f"[>] 目录: {cwd}")
    print("=" * 60)
    res = subprocess.run(cmd, cwd=str(cwd))
    if res.returncode != 0:
        print(f"\n[!] [错误] 步骤 '{name}' 执行失败，返回码: {res.returncode}")
        sys.exit(res.returncode)
    print(f"[+] [成功] 步骤 '{name}' 完成！\n")

def main():
    print("=" * 65)
    print("         RAG-GK 自动化打包构建流水线 (PyInstaller + NSIS)")
    print("=" * 65)

    # 1. 检查 NSIS 编译器
    makensis_path = find_makensis()
    if not makensis_path:
        print("[!] 未检测到 NSIS 编译器 (makensis.exe)！")
        print("    请确认 NSIS 是否安装，或手动添加到系统环境变量。")
        sys.exit(1)
    print(f"[+] 找到 NSIS 编译器: {makensis_path}")

    # 2. 检查 PyInstaller
    pyinstaller_path = find_pyinstaller()
    print(f"[+] 找到 PyInstaller: {pyinstaller_path}")

    # 3. 步骤 1：前端编译
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    run_step("1. 编译 React Vite 前端静态资源", [npm_cmd, "run", "build"], cwd=WEB_DIR)

    # 检查 web/dist/index.html
    web_dist_index = WEB_DIR / "dist" / "index.html"
    if not web_dist_index.exists():
        print("[!] 前端构建输出不存在: web/dist/index.html")
        sys.exit(1)

    # 4. 步骤 2：PyInstaller 目录打包
    spec_file = ROOT_DIR / "rag_gk.spec"
    run_step("2. PyInstaller 打包 Python 独立环境", [pyinstaller_path, "--clean", "--noconfirm", str(spec_file)], cwd=ROOT_DIR)

    bundle_exe = DIST_DIR / "RAG-GK" / "RAG-GK.exe"
    if not bundle_exe.exists():
        print(f"[!] PyInstaller 未能生成目标程序: {bundle_exe}")
        sys.exit(1)

    # 5. 步骤 3：NSIS 生成安装程序
    nsi_file = PACKAGING_DIR / "installer.nsi"
    run_step("3. NSIS 编译生成 Windows 安装包", [makensis_path, "/INPUTCHARSET", "UTF8", str(nsi_file)], cwd=PACKAGING_DIR)


    # 6. 检查输出成果
    installer_exe = DIST_DIR / "RAG-GK_v1.0.0_Setup.exe"
    if installer_exe.exists():
        size_mb = installer_exe.stat().st_size / (1024 * 1024)
        print("\n" + "=" * 65)
        print("[*] 全部打包流程顺利完成！")
        print(f"[*] 安装包输出路径: {installer_exe}")
        print(f"[*] 安装包文件大小: {size_mb:.2f} MB")
        print("[*] 您可以将此安装包分发给任何 Windows 10/11 用户直接安装运行！")
        print("=" * 65 + "\n")
    else:
        print("[!] 未找到最终安装包，请检查 NSIS 编译日志。")

if __name__ == "__main__":
    main()
