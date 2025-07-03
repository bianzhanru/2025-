import subprocess
import os

# Xray 可执行文件所在目录（相对于 backend/utils）
XRAY_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tools", "xray"))
# Windows 下是 xray.exe；Linux/macOS 可改为 xray
XRAY_BIN = os.path.join(XRAY_DIR, "xray.exe")

def run_xray_scan(target: str) -> str:
    """
    使用 Xray 对单个 target URL 进行 web 扫描，返回控制台输出。
    """
    if not os.path.exists(XRAY_BIN):
        return "Error: xray binary not found"
    cmd = [
        XRAY_BIN,
        "webscan",
        "--url", target
    ]
    try:
        # 在 XRAY_DIR 下运行，捕获 stdout/stderr
        proc = subprocess.run(
            cmd,
            cwd=XRAY_DIR,
            capture_output=True,
            text=True,
            check=False
        )
        out = proc.stdout or ""
        err = proc.stderr or ""
        return out + ("\n" + err if err else "")
    except Exception as e:
        return f"Exception running Xray: {e}"
