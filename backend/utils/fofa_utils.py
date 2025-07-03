import os
import sys
from urllib.parse import urlparse
import re
# 定位原版 FofaMap 包目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(BASE_DIR, "tools", "fofamap")

if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

from fofa import Client as FofaClient
from fastcheck import FastCheck
from nuclei import Scan as NucleiScan

def query_assets(query: str, fields: list):
    """
    切到 tools/fofamap 目录，让 FofaClient 去读取同目录下的 fofa.ini。
    fields: 要返回的列名列表
    """
    cwd = os.getcwd()
    try:
        os.chdir(TOOLS_DIR)
        client = FofaClient()
        raw = client.get_data(query, page=1, fields=",".join(fields))
        return raw.get("fields", []), raw.get("results", [])
    finally:
        os.chdir(cwd)

def scan_vulnerabilities(query: str):
    """
    支持两种模式：
    1) 直接扫描：query 以 http:// 或 https:// 开头，或为纯 IPv4，则直接生成一个目标；
    2) FOFA 查询：否则将 query 当作 FOFA 语句，查询资产生成目标列表。
    最终用 NucleiScan.multi_target 扫描 targets.txt。
    """
    cwd = os.getcwd()
    os.chdir(TOOLS_DIR)
    try:
        # 判断直接扫描模式
        if re.match(r'^https?://', query) or re.match(r'^\d{1,3}(\.\d{1,3}){3}$', query):
            targets = []
            if query.startswith("http"):
                targets.append(query.rstrip("/"))
            else:
                # 纯 IP，加上 http:// 前缀
                targets.append(f"http://{query}")
        else:
            # FOFA 批量查询
            client = FofaClient()
            # 查询第一页，带上 protocol,host,port 三字段
            raw = client.get_data(query, page=1, fields="host,protocol,port")
            results = raw.get("results", [])
            targets = []
            for host, proto, port in results:
                pfx = proto if proto.startswith("http") else f"{proto}://"
                targets.append(f"{pfx}{host}:{port}")

        # 写入 targets.txt
        with open("targets.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(sorted(set(targets))))

        # 调用 nuclei 全扫描
        scanner = NucleiScan()
        cmd = scanner.multi_target("targets.txt")
        os.system(cmd)

        # 返回 scan_result.txt
        if os.path.exists("scan_result.txt"):
            return open("scan_result.txt", encoding="utf-8").read()
        return ""
    finally:
        os.chdir(cwd)