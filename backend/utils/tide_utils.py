import os
import sys
import subprocess
import re

# TideFinger 脚本所在目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TF_DIR = os.path.join(BASE_DIR, "tools", "TideFinger")
TF_SCRIPT = os.path.join(TF_DIR, "TideFinger.py")

# 用于移除 ANSI 颜色控制码
ANSI_RE = re.compile(r'\x1b\[[0-9;]*m')

def detect_tidefinger(url):
    """
    调用 TideFinger.py -u <url>，解析 stdout 中 Banner: 和 CMS_finger:。
    返回 dict { banner: str, cms: str }
    """
    cmd = [sys.executable, TF_SCRIPT, "-u", url]
    proc = subprocess.run(cmd, cwd=TF_DIR, capture_output=True, text=True)
    raw = proc.stdout + proc.stderr
    # 去掉 ANSI 颜色码
    clean = ANSI_RE.sub("", raw)
    banner = ""
    cms = ""
    for line in clean.splitlines():
        line = line.strip()
        if line.startswith("Banner:"):
            # Banner: 后面的内容
            banner = line.split("Banner:", 1)[1].strip()
        elif line.startswith("CMS_finger:"):
            cms = line.split("CMS_finger:", 1)[1].strip()
    # 如果没有识别到，则显式 "未识别"
    if not banner:
        banner = "未识别"
    if not cms:
        cms = "未识别"
    return {"banner": banner, "cms": cms}
