import os
import io
from flask import Flask, render_template, request, send_file, jsonify
from flask_restful import Api, Resource
from utils.fofa_utils import query_assets, scan_vulnerabilities
from utils.tide_utils import detect_tidefinger   
from utils.nmap_utils import run_nmap_traceroute
from utils.xray_utils import run_xray_scan
from utils.ai_utils import SparkAI, build_smart_prompt, parse_attack_graph_from_ai

from xlsxwriter import Workbook

def create_app():
    app = Flask(__name__,
                static_folder="../frontend/static",
                template_folder="../frontend/templates")
    api = Api(app)

    class FingerprintResource(Resource):
        def get(self):
            q = request.args.get("q", "")
            fields_param = request.args.get("fields", "")
            if not q:
                return {"error": "请提供查询语句 q"}, 400
            if not fields_param:
                return {"error": "请至少选择一个输出字段"}, 400
            fields = fields_param.split(",")
            hdrs, results = query_assets(q, fields)
            return {"fields": hdrs, "results": results}, 200

    class FingerprintExportResource(Resource):
        def post(self):
            """
            接收 JSON: { fields: [...], results: [[...],[...],...] }
            直接根据这些数据生成 XLSX，不再重新查询。
            """
            data = request.get_json()
            fields = data.get("fields", [])
            results = data.get("results", [])
            if not fields or not isinstance(results, list):
                return {"error": "参数无效"}, 400

            output = io.BytesIO()
            wb = Workbook(output, {'in_memory': True})
            ws = wb.add_worksheet("结果")
            # 写表头
            for c, h in enumerate(fields):
                ws.write(0, c, h)
            # 写内容
            for r, row in enumerate(results, start=1):
                for c, v in enumerate(row):
                    ws.write(r, c, v)
            wb.close()
            output.seek(0)
            return send_file(
                output,
                as_attachment=True,
                download_name="fofa结果.xlsx",
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

    class VulnScanResource(Resource):
        def get(self):
            q = request.args.get("q", "")
            if not q:
                return {"error": "请提供扫描目标 q"}, 400
            raw = scan_vulnerabilities(q)
            return {"raw_output": raw}, 200

    
    class TideFingerResource(Resource):
        def get(self):
            url = request.args.get("url", "")
            if not url:
                return {"error": "请提供参数 url"}, 400
            result = detect_tidefinger(url)
            return result, 200

    class NmapResource(Resource):
        def get(self):
            target = request.args.get("target", "")
            timing = request.args.get("timing", "T4")
            os_detect = request.args.get("os_detect", "false") == "true"
            service_detect = request.args.get("service_detect", "false") == "true"
            ports = request.args.get("ports", None)

            if not target:
                return {"error": "请提供参数 target"}, 400

            result = run_nmap_traceroute(
                target=target,
                timing=timing,
                os_detect=os_detect,
                service_detect=service_detect,
                ports=ports
            )
            return result, 200

    class XrayScanResource(Resource):
        def post(self):
            data = request.get_json() or {}
            target = data.get("target", "").strip()
            if not target:
                return {"error": "请提供扫描目标 target"}, 400
            output = run_xray_scan(target)
            return {"output": output}, 200

    class SmartAttackResource(Resource):
        def post(self):
            data = request.get_json()
            if not data:
                return {"error": "缺少输入"}, 400
            data = request.get_json()
            user_prompt = data.get("prompt", "")

            query = build_smart_prompt(data)
            if user_prompt:
                query += f"\n【用户输入提示】\n{user_prompt.strip()}\n"
            spark = SparkAI()
            result = spark.analyze(query)
            graph = parse_attack_graph_from_ai(result)

            return {
                "analysis": result,
                "graph": graph
            }, 200


    # 在所有 add_resource 调用之后，加入：
    api.add_resource(SmartAttackResource, "/api/smart_attack_ai")
    api.add_resource(XrayScanResource, "/api/xray")
    api.add_resource(NmapResource, "/api/nmap")

    api.add_resource(TideFingerResource, "/api/tidefinger")
    api.add_resource(FingerprintResource, "/api/fingerprint")
    api.add_resource(FingerprintExportResource, "/api/fingerprint/export")
    api.add_resource(VulnScanResource, "/api/vuln_scan")

    @app.route("/")
    def dashboard():
        return render_template("dashboard.html")

    return app

if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5000, debug=True)
