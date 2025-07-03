import subprocess
import re


def run_nmap_traceroute(target: str, timing: str = "T4",
                        os_detect: bool = False,
                        service_detect: bool = False,
                        ports: str = None):
    """
    调用 nmap -A 并根据参数附加 -T
    解析输出，只保留每行最后出现的 IPv4 地址作为 hop。
    在拓扑前端添加 localhost (127.0.0.1) 节点作为 hop 0。
    最后一跳以 traceroute 中捕获的最后一个 IP 为终点（不使用域名 target）。
    """
    cmd = ["nmap", f"-{timing}", "-A", "-v"]
    if os_detect:
        cmd.append("-O")
    if service_detect:
        cmd.append("-sV")
    if ports:
        cmd.extend(["-p", ports])
    cmd.append(target)

    proc = subprocess.run(cmd, capture_output=True, text=True)
    log = proc.stdout or proc.stderr or ""

    # 解析 traceroute 部分，提取所有 IPv4
    hops = []
    in_tr = False
    for line in log.splitlines():
        if line.startswith("TRACEROUTE"):
            in_tr = True
            continue
        if in_tr:
            if not line.strip():
                break
            # 跳过纯星号行
            if re.match(r"\s*\d+\s+\*+", line):
                continue
            # 找出所有 IPv4，取最后一个
            ips = re.findall(r'(\d{1,3}(?:\.\d{1,3}){3})', line)
            if ips:
                hops.append(ips[-1])

    # 构建拓扑节点/边
    nodes = []
    edges = []
    # hop 0: localhost
    nodes.append({"id": "127.0.0.1", "label": "localhost"})
    prev = "127.0.0.1"

    for ip in hops:
        if ip != prev:
            nodes.append({"id": ip, "label": ip})
            edges.append({"from": prev, "to": ip})
            prev = ip

    # 确保至少有两节点：localhost 和最后一跳
    if len(nodes) < 2:
        # 如果 traceroute 没返回，直接将目标 IP 作为第二节点
        nodes.append({"id": target, "label": target})
        edges.append({"from": "127.0.0.1", "to": target})

    return {
        "log": log,
        "topology": {"nodes": nodes, "edges": edges}
    }
