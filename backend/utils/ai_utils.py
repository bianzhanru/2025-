# backend/utils/ai_utils.py
import datetime
import json
import base64
import hashlib
import hmac
import ssl
import _thread as thread
from urllib.parse import urlencode, urlparse
import websocket

# 替换为你的信息
APPID = "dcf5c233"
API_KEY = "4c36aa4b0e308c50bc035b393e77d541"
API_SECRET = "OTE0MjU0OTkyY2E5NjdhNWRjYTNiMzQ3"
SPARK_API_URL = "wss://spark-api.xf-yun.com/v1.1/chat"
DOMAIN = "lite"

class Ws_Param:
    def __init__(self, appid, apikey, apisecret, url):
        self.APPID = appid
        self.APIKey = apikey
        self.APISecret = apisecret
        self.host = urlparse(url).netloc
        self.path = urlparse(url).path
        self.url = url

    def create_url(self):
        now = datetime.datetime.utcnow()
        date = now.strftime('%a, %d %b %Y %H:%M:%S GMT')
        signature_origin = f"host: {self.host}\ndate: {date}\nGET {self.path} HTTP/1.1"
        signature_sha = hmac.new(self.APISecret.encode(), signature_origin.encode(), hashlib.sha256).digest()
        sign = base64.b64encode(signature_sha).decode()
        auth_origin = f'api_key="{self.APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="{sign}"'
        authorization = base64.b64encode(auth_origin.encode()).decode()
        v = {"authorization": authorization, "date": date, "host": self.host}
        return self.url + "?" + urlencode(v)

class SparkAI:
    def __init__(self):
        self.result = ""

    def on_message(self, ws, message):
        data = json.loads(message)
        if data['header']['code'] != 0:
            ws.close()
            return
        self.result += data["payload"]["choices"]["text"][0]["content"]
        if data["payload"]["choices"]["status"] == 2:
            ws.close()

    def on_error(self, ws, error):
        self.result = f"WebSocket 错误: {error}"

    def on_close(self, ws, *args):
        pass

    def on_open(self, ws, appid, query):
        def run(*_):
            prompt = {
                "header": {"app_id": appid, "uid": "attack-ai"},
                "parameter": {
                    "chat": {
                        "domain": DOMAIN,
                        "temperature": 0.3,
                        "max_tokens": 1024
                    }
                },
                "payload": {
                    "message": {
                        "text": [
                            {"role": "system", "content": "你是一个网络安全红队攻击策略专家，请仔细分析用户提供的信息，输出推荐攻击路径及策略建议。"},
                            {"role": "user", "content": query}
                        ]
                    }
                }
            }
            ws.send(json.dumps(prompt))
        thread.start_new_thread(run, ())

    def analyze(self, query):
        ws_param = Ws_Param(APPID, API_KEY, API_SECRET, SPARK_API_URL)
        ws_url = ws_param.create_url()
        ws = websocket.WebSocketApp(ws_url,
                                     on_message=self.on_message,
                                     on_error=self.on_error,
                                     on_close=self.on_close)
        ws.on_open = lambda ws: self.on_open(ws, APPID, query)
        ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
        print("✅ AI 返回结果：", self.result.strip())  # 添加这行
        return self.result.strip()

# 可选：攻击图谱解析（模拟）
def parse_attack_graph_from_ai(text):
    return {
        "nodes": [
            {"id": 1, "label": "入口点"},
            {"id": 2, "label": "主机探测"},
            {"id": 3, "label": "漏洞利用"},
            {"id": 4, "label": "权限提升"},
        ],
        "edges": [
            {"from": 1, "to": 2},
            {"from": 2, "to": 3},
            {"from": 3, "to": 4},
        ]
    }

def build_smart_prompt(data):
    lines = ["以下是资产探测、指纹识别、拓扑分析和漏洞扫描的信息，请你基于信息进行综合分析，输出攻击路径建议和潜在薄弱点："]
    for k, v in data.items():
        lines.append(f"\n【{k.upper()} 模块数据】：")
        if isinstance(v, str):
            lines.append(v)
        else:
            lines.append(json.dumps(v, ensure_ascii=False, indent=2))

    print(lines)
    return "\n".join(lines)
