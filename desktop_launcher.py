"""
RAG-GK 桌面端原生独立窗口客户端 (Native Desktop Client)
基于 pywebview (WebView2 内核) + FastAPI/Uvicorn 本地知识库服务。
"""

import os
import sys
import time
import socket
import shutil
import ctypes
import threading
from ctypes import wintypes
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

# 窗口标题：既作为窗口标题，也是单实例唤醒时 FindWindow 的查找依据，故集中定义
WINDOW_TITLE = "RAG-GK 知识库问答系统"

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

def get_taskbar_icon() -> str:
    """获取 App 图标（窗口 / 任务栏 / Alt+Tab / 最小化预览共用）。

    图标为"黑色圆角方块 + 白色书本"，源图自带的米白色底已抠成透明，因此任务栏上
    不会再出现白框。必须使用真实图标：窗口一旦没有图标，任务栏会退化成通用的
    黑色占位方块。

    标题栏最左侧那个小图标也会用到同一份图标（Windows 不允许标题栏与任务栏分别设置
    不同图标），它的可见性由 apply_native_window_style() 的配色方案削弱。
    """
    candidates = [
        APP_DIR / "app.ico",
        BUNDLE_DIR / "app.ico",
        APP_DIR / "packaging" / "app.ico",
        BUNDLE_DIR / "packaging" / "app.ico",
    ]
    for c in candidates:
        if c.exists():
            return str(c.resolve())

    print("[!] 未找到 App 图标 app.ico")
    return ""


# =============================================================================
# 单实例保护
# =============================================================================
# 双开是真实的数据风险：两个实例会各自占用端口（第二个自动退到 8001），但**共用同一份
# ./data/chroma_db 与 ./data/bm25_indices**，同时读写同一批索引文件，存在损坏风险。
# 这里用 Windows 命名互斥体把进程锁成单实例。
#
# 命名要点：用 "Local\" 前缀 —— 只在当前登录会话内互斥。多用户/快速用户切换时各自
# 运行一份是合理的；而 Chroma 数据位于用户目录，本来也不该跨会话共享。

_MUTEX_NAME = "Local\\RAG-GK-SingleInstance-{8F1C2A64-3B7D-4E19-9A55-0D6E7C1B2F30}"
ERROR_ALREADY_EXISTS = 183
_mutex_handle = None  # 持有到进程结束，确保互斥体不被释放

WM_CLOSE = 0x0010
SW_RESTORE = 9


def _activate_existing_window(app_dir: Path) -> bool:
    """把已在运行的实例窗口激活到前台。

    优先按窗口标题查找；标题可能被系统改写（例如带后缀），因此再退一步按进程名匹配。
    返回是否成功激活。
    """
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    user32.FindWindowW.restype = wintypes.HWND
    user32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
    user32.SetForegroundWindow.argtypes = [wintypes.HWND]

    exe_name = Path(sys.executable).name if getattr(sys, "frozen", False) else "python.exe"

    def try_activate() -> bool:
        hwnd = user32.FindWindowW(None, WINDOW_TITLE)
        if not hwnd:
            # 退路：按进程可执行文件名找可见主窗口
            found = []

            @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
            def enum_cb(h, _):
                if not user32.IsWindowVisible(h):
                    return True
                if user32.GetWindowTextLengthW(h) == 0:
                    return True
                pid = wintypes.DWORD()
                user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
                if pid.value == os.getpid():
                    return True
                proc = kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
                if not proc:
                    return True
                try:
                    buf = ctypes.create_unicode_buffer(1024)
                    size = wintypes.DWORD(1024)
                    if kernel32.QueryFullProcessImageNameW(proc, 0, buf, ctypes.byref(size)):
                        if Path(buf.value).name.lower() == exe_name.lower():
                            found.append(h)
                finally:
                    kernel32.CloseHandle(proc)
                return True

            user32.EnumWindows(enum_cb, 0)
            hwnd = found[0] if found else None

        if not hwnd:
            return False

        # 最小化的先还原，再抢前台
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)
        return True

    # 已运行实例可能还在启动中（窗口尚未创建），轮询等一会儿
    for _ in range(40):
        if try_activate():
            return True
        time.sleep(0.25)
    return False


def acquire_single_instance_lock() -> bool:
    """尝试取得单实例锁。

    返回 True 表示当前进程是唯一实例，可以继续启动；
    返回 False 表示已有实例在运行（此时已尝试把它的窗口唤到前台），当前进程应退出。
    """
    global _mutex_handle

    if os.name != "nt":
        return True

    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]

        ctypes.set_last_error(0)
        handle = kernel32.CreateMutexW(None, False, _MUTEX_NAME)
        last_error = ctypes.get_last_error()

        if not handle:
            # 互斥体本身创建失败（极少见）：不阻断启动，只记录
            print(f"[!] 创建单实例互斥体失败（错误码 {last_error}），跳过单实例保护")
            return True

        if last_error == ERROR_ALREADY_EXISTS:
            # 已被其它实例持有：这个句柄没用了，关掉；互斥体仍归首个实例所有
            kernel32.CloseHandle(handle)
            return False

        _mutex_handle = handle
        return True
    except Exception as e:
        print(f"[!] 单实例检查异常，按继续启动处理: {e}")
        return True


def _log_line(message: str) -> None:
    """把诊断信息同时写进 logs/app.log。

    打包后 console=False，sys.stdout 既不是 None 也不指向有效控制台，print 会静默丢失；
    而且 stdout 被重定向到文件时是块缓冲，进程用 os._exit 退出不会 flush。
    这里直接以行缓冲追加日志文件，确保"为什么没启动"这件事一定留得下痕迹。
    """
    try:
        with open(APP_DIR / "logs" / "app.log", "a", encoding="utf-8", buffering=1) as f:
            f.write(message + "\n")
    except Exception:
        pass
    try:
        print(message, flush=True)
    except Exception:
        pass


def _notify_already_running() -> None:
    """双开时给用户一个可见反馈（打包后无控制台，print 看不到）。"""
    try:
        ctypes.windll.user32.MessageBoxW(
            None,
            "RAG-GK 已经在运行中。\n\n已为你切换到正在运行的窗口，本次启动已取消。",
            "RAG-GK",
            0x00000040,  # MB_ICONINFORMATION
        )
    except Exception:
        pass


def _enforce_single_instance() -> None:
    """模块级入口：非首个实例时唤醒已有窗口并直接退出进程。"""
    if acquire_single_instance_lock():
        return

    _log_line("[*] 检测到 RAG-GK 已在运行，正在唤醒已有窗口并退出本次启动。")
    activated = _activate_existing_window(APP_DIR)
    _log_line(f"[*] 已有窗口唤醒{'成功' if activated else '失败（可能仍在启动中）'}。")
    if not activated:
        _notify_already_running()
    os._exit(0)


# =============================================================================
# 无边框窗口支持
# =============================================================================
# 去掉系统标题栏后，Windows 不再提供缩放边框与标题栏拖动，需要自行接管窗口过程。
#
# 为什么用 ctypes 直接替换 WNDPROC，而不用 pythonnet 的 NativeWindow 子类化：
# 实测子类化后窗口过程会递归溢出（maximum recursion depth exceeded），
# 且 WM_NCHITTEST 的命中结果全部退化成 HTCLIENT，八个方向的缩放热区同时失效。
# 这里用 SetWindowLongPtrW + CallWindowProcW，是 Win32 的标准做法，稳定可靠。

_WNDPROC_TYPE = ctypes.WINFUNCTYPE(
    ctypes.c_ssize_t, wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM
)
_original_wndproc = None
_wndproc_hook = None  # 必须持有引用，否则回调会被 GC 回收导致窗口过程失效

# 与前端自绘标题栏保持一致：h-9 = 36px
TITLEBAR_HEIGHT = 36
RESIZE_BORDER = 6
# 右上角自绘窗口按钮与参数设置区域占用的宽度（逻辑像素）。该区域排除在拖动带之外，
# 确保窗口控制按钮与检索参数按钮都能正常接收点击。
WINDOW_CONTROLS_WIDTH = 260


def _init_win32():
    """按 32/64 位正确绑定 user32 的函数签名。"""
    user32 = ctypes.WinDLL("user32", use_last_error=True)

    user32.SetWindowLongW.restype = ctypes.c_long
    user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
    user32.GetWindowLongW.restype = ctypes.c_long
    user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.CallWindowProcW.restype = ctypes.c_ssize_t
    user32.CallWindowProcW.argtypes = [
        ctypes.c_void_p, wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM
    ]
    user32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    user32.ScreenToClient.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
    user32.SendMessageW.restype = ctypes.c_ssize_t
    user32.SendMessageW.argtypes = [
        wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM
    ]

    if ctypes.sizeof(ctypes.c_void_p) == 8:
        user32.SetWindowLongPtrW.restype = ctypes.c_void_p
        user32.SetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_void_p]
        user32.GetWindowLongPtrW.restype = ctypes.c_void_p
        user32.GetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int]
        set_proc, get_proc = user32.SetWindowLongPtrW, user32.GetWindowLongPtrW
    else:
        set_proc, get_proc = user32.SetWindowLongW, user32.GetWindowLongW

    return user32, set_proc, get_proc


def _decode_lparam_coords(lparam) -> tuple:
    """把 WM_NCHITTEST 的 lParam 解成屏幕坐标（低 16 位 x / 高 16 位 y，均为有符号）。"""
    value = int(lparam)
    size = ctypes.sizeof(ctypes.c_void_p)
    raw = (value & ((1 << (size * 8)) - 1)).to_bytes(size, "little", signed=False)
    x = int.from_bytes(raw[0:2], "little", signed=True)
    y = int.from_bytes(raw[2:4], "little", signed=True)
    return x, y


def install_frameless_hooks(window) -> bool:
    """接管窗口过程：实现八向缩放 + 顶部标题带拖动/双击最大化。

    命中规则（客户区坐标，按 DPI 缩放）：
      - 四边缘 6px 内      -> HTLEFT/HTRIGHT/HTTOP/HTBOTTOM（八向缩放）
      - 顶部 36px 带       -> HTCAPTION（拖动、双击最大化、Win+方向键贴靠）
      - 其余               -> HTCLIENT（正常交给网页处理点击/选择）

    注意：顶部带整体交给 HTCAPTION 后，落在该带的**窗口按钮**会收不到点击事件。
    因此窗口按钮放在侧栏最下方，避开顶部标题带。
    """
    global _original_wndproc, _wndproc_hook

    try:
        user32, set_proc, get_proc = _init_win32()

        GWL_WNDPROC, GWL_STYLE = -4, -16
        WM_NCCALCSIZE, WM_NCHITTEST = 0x0083, 0x0084
        WS_CAPTION, WS_THICKFRAME = 0x00C00000, 0x00040000
        SWP_FLAGS = 0x0001 | 0x0002 | 0x0004 | 0x0020 | 0x0010

        HTCLIENT, HTCAPTION = 1, 2
        HTLEFT, HTRIGHT, HTTOP, HTTOPLEFT, HTTOPRIGHT = 10, 11, 12, 13, 14
        HTBOTTOM, HTBOTTOMLEFT, HTBOTTOMRIGHT = 15, 16, 17

        hwnd = wintypes.HWND(int(window.native.Handle.ToInt32()))

        def wndproc(h, msg, wparam, lparam):
            try:
                if msg == WM_NCCALCSIZE and wparam:
                    # 客户区铺满整个窗口，不保留任何标题栏空白
                    return 0

                if msg == WM_NCHITTEST:
                    x, y = _decode_lparam_coords(lparam)
                    pt = wintypes.POINT(x, y)
                    user32.ScreenToClient(h, ctypes.byref(pt))
                    rect = wintypes.RECT()
                    user32.GetClientRect(h, ctypes.byref(rect))

                    try:
                        scale = (user32.GetDpiForWindow(h) or 96) / 96.0
                    except Exception:
                        scale = 1.0
                    border = max(4, int(RESIZE_BORDER * scale))
                    titlebar = max(24, int(TITLEBAR_HEIGHT * scale))

                    left = pt.x < border
                    right = pt.x >= rect.right - border
                    top = pt.y < border
                    bottom = pt.y >= rect.bottom - border

                    if top and left:
                        return HTTOPLEFT
                    if top and right:
                        return HTTOPRIGHT
                    if bottom and left:
                        return HTBOTTOMLEFT
                    if bottom and right:
                        return HTBOTTOMRIGHT
                    if left:
                        return HTLEFT
                    if right:
                        return HTRIGHT
                    if top:
                        return HTTOP
                    if bottom:
                        return HTBOTTOM

                    # 顶部拖动带：整体交给系统当标题栏（拖动 / 双击最大化 / 贴靠）。
                    # 但右上角是自绘窗口按钮所在区域，必须留给网页接收点击，
                    # 否则按钮会被当成标题栏而完全点不动。
                    controls_left = rect.right - int(WINDOW_CONTROLS_WIDTH * scale)
                    in_controls = pt.x >= controls_left and pt.y < max(
                        36, int(TITLEBAR_HEIGHT * scale)
                    )

                    if 0 <= pt.y < titlebar:
                        if in_controls:
                            return HTCLIENT
                        return HTCAPTION
                    return HTCLIENT
            except Exception as e:
                print(f"[!] 窗口过程处理异常: {e}")

            return user32.CallWindowProcW(_original_wndproc, h, msg, wparam, lparam)

        _wndproc_hook = _WNDPROC_TYPE(wndproc)
        _original_wndproc = get_proc(hwnd, GWL_WNDPROC)

        # 保留 WS_THICKFRAME（贴靠动画/阴影需要），去掉 WS_CAPTION（系统标题栏）
        style = user32.GetWindowLongW(hwnd, GWL_STYLE)
        style = (style | WS_THICKFRAME) & ~WS_CAPTION
        user32.SetWindowLongW(hwnd, GWL_STYLE, style)

        set_proc(hwnd, GWL_WNDPROC, ctypes.cast(_wndproc_hook, ctypes.c_void_p))
        user32.SetWindowPos(hwnd, None, 0, 0, 0, 0, SWP_FLAGS)
        print("[*] 无边框窗口已就绪（八向缩放 + 顶部拖动）")
        return True
    except Exception as e:
        print(f"[!] 安装无边框窗口钩子失败（窗口仍可用，但可能无法拖拽缩放）: {e}")
        return False


# 当前 pywebview 窗口引用（供 WindowApi 使用）。
# 刻意放在模块级而不是 WindowApi 的属性上：pywebview 会用
# webview.util.generate_js_object() 反射扫描 js_api 实例的全部属性来生成 JS 代理，
# 一旦实例上挂着 window，就会顺着 window.native -> Form -> Font -> FontFamily...
# 无限递归（实测栈溢出 generate_js_object/get_functions，表现为窗口"未响应"、
# 后端僵死）。不给它任何可遍历的对象属性即可规避。
_window_ref = None


class WindowApi:
    """暴露给前端自绘窗口按钮的接口（pywebview js_api）。

    ⚠ 不要在本类实例上保存 window / native 等任何 pywebview 对象，否则
    generate_js_object 会递归溢出导致整个窗口卡死（详见 _window_ref 处注释）。
    """

    def minimize(self):
        try:
            _window_ref.minimize()
        except Exception as e:
            print(f"[!] 最小化失败: {e}")

    def toggle_maximize(self):
        """最大化 / 还原，并返回切换后的状态供前端更新按钮图标。"""
        try:
            if _window_ref.native.WindowState == 2:  # FormWindowState.Maximized
                _window_ref.restore()
            else:
                _window_ref.maximize()
            return self.is_maximized()
        except Exception as e:
            print(f"[!] 最大化/还原失败: {e}")
            return False

    def is_maximized(self) -> bool:
        try:
            return _window_ref.native.WindowState == 2
        except Exception:
            return False

    def close_window(self):
        try:
            _window_ref.destroy()
        except Exception:
            os._exit(0)


def main():
    global _window_ref

    # 0. 单实例保护：放在最前面，避免两个进程同时碰 ./data 下的索引文件。
    #    此时日志已重定向到 logs/app.log，且所有函数均已定义完毕。
    _enforce_single_instance()

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

    # 3. 按任务栏明暗选取 App 图标（窗口 / 任务栏 / 最小化预览共用）
    icon_path = get_taskbar_icon()

    # 4. 创建原生独立窗口
    #    frameless=True：去掉系统标题栏（含最左侧小图标与整行标题文字），
    #    改由网页自己排版；窗口的八向缩放与拖动由 install_frameless_hooks() 补回。
    window_api = WindowApi()
    window = webview.create_window(
        title=WINDOW_TITLE,
        url=server_url,
        width=1380,
        height=880,
        min_size=(900, 600),
        resizable=True,
        frameless=True,
        js_api=window_api,
        text_select=True,
        zoomable=True
    )
    _window_ref = window

    def apply_native_window_style():
        """在 WinForms UI 线程上做最后的原生窗口微调。

        标题栏本身已经在 install_frameless_hooks() 里用 WS_CAPTION 去掉，因此
        这里不再需要任何"把标题栏文字藏起来"的 DWM 配色。

        ⚠ 必须在 UI 线程执行：Handle 等成员会令 WinForms 校验线程归属
        (Control.InvokeRequired)，跨线程访问会与正在处理 Shown 事件的 UI 线程互锁。
        """
        try:
            hwnd = int(window.native.Handle.ToInt32())
            dwmapi = ctypes.WinDLL("dwmapi.dll")

            # 1. 强制浅色沉浸模式 (DWMWA_USE_IMMERSIVE_DARK_MODE = 20)，避免暗色系统主题下
            #    无边框窗口自带深色底闪烁
            value = ctypes.c_int(0)
            dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(value), ctypes.sizeof(value))

            # 2. 无边框窗口的外边框设为 App 底色 #FAF9F6 (DWMWA_BORDER_COLOR = 34)，
            #    去掉系统主题描边，让窗口四边与页面融为一体
            paper = ctypes.c_int(0x00F6F9FA)  # COLORREF 为 0x00BBGGRR
            dwmapi.DwmSetWindowAttribute(hwnd, 34, ctypes.byref(paper), ctypes.sizeof(paper))

            # 3. 确保窗口带图标（任务栏 / Alt+Tab / 最小化预览都依赖它）
            window.native.ShowIcon = True
        except Exception as e:
            print(f"[!] 设置原生窗口样式失败: {e}")

    window_shown = threading.Event()

    def mark_window_shown(*_):
        """只做记录，绝不在 shown 事件里碰原生窗口属性。"""
        window_shown.set()

    def schedule_native_window_style():
        """等窗口真正显示后，再把样式 marshal 回 UI 线程执行。

        反例（曾导致程序完全卡死）：直接在 `window.events.shown` 回调里访问
        window.native。pywebview 的 Event.set() 会为回调另起一个工作线程，而该工作线程
        在窗口刚显示的瞬间访问 WinForms 控件会永久阻塞；同时 UI 线程正卡在
        Shown 事件处理里等这个工作线程，主线程又阻塞在 webview.start() 上等待 UI 线程，
        三方互锁 —— 表现为窗口"未响应"、后端僵死、日志空白。
        """
        if not window_shown.wait(timeout=30):
            print("[!] 等待窗口显示事件超时，跳过原生窗口样式设置")
            return
        # 留出窗口首次绘制的时间，确保控件句柄已稳定
        time.sleep(0.5)
        try:
            from System import Func, Type

            if window.native.InvokeRequired:
                window.native.Invoke(Func[Type](apply_native_window_style))
            else:
                apply_native_window_style()
        except Exception as e:
            print(f"[!] 调度原生窗口样式失败: {e}")

    window.events.shown += mark_window_shown
    threading.Thread(target=schedule_native_window_style, daemon=True).start()

    # 4.1 无边框窗口：接管窗口过程，补回八向缩放与顶部标题带拖动
    #     必须在窗口句柄创建后执行；放在独立线程里等待 shown 事件，避免阻塞主线程。
    def install_hooks_when_ready():
        if not window_shown.wait(timeout=30):
            print("[!] 等待窗口显示事件超时，跳过无边框窗口钩子")
            return
        time.sleep(0.5)
        install_frameless_hooks(window)

    threading.Thread(target=install_hooks_when_ready, daemon=True).start()

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
        if icon_path and os.path.exists(icon_path):
            webview.start(icon=icon_path, debug=False)
        else:
            webview.start(debug=False)
    finally:
        os._exit(0)

if __name__ == "__main__":
    main()
