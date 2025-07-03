$(function() {
  const ALL_FIELDS = [
    "ip","port","protocol","country","country_name","region","city","longitude","latitude",
    "asn","org","host","domain","os","server","icp","title","jarm","header","banner",
    "cert","base_protocol","link","cert.issuer.org","cert.issuer.cn","cert.subject.org",
    "cert.subject.cn","tls.ja3s","tls.version","cert.sn","cert.not_before","cert.not_after",
    "cert.domain"
  ];

  let fpCache = null;     // FOFA 缓存
  let tideCache = null;   // TideFinger 缓存
  let nmapCache = null;


  function setTitle(text) {
    $('#page-title').text(text);
  }

  // 初始化三个 Pane
  function initPanes() {
    $('#content-area').html(`
      <div class="d-flex flex-column h-100">
        <div class="bookmarks mb-3">
          <div class="bookmark active" data-method="fofa">资产探测</div>
          <div class="bookmark" data-method="finger">指纹探测</div>
          <div class="bookmark" data-method="nmap">拓扑探测</div>
        </div>
        <div id="fofa-pane">
          <div id="fofa-form-area"></div>
          <div id="fofa-table-area" style="flex-grow:1;overflow:auto;"></div>
        </div>
        <div id="tide-pane" style="display:none;">
          <div id="tide-form-area"></div>
          <div id="tide-table-area" style="flex-grow:1;overflow:auto;"></div>
        </div>
        <div id="nmap-pane" style="display:none;">
          <div id="nmap-form-area"></div>
          <div id="nmap-log-area" style="white-space:pre-wrap; background:#f8f9fa; padding:1rem; height:30%; overflow:auto;"></div>
          <div class="topo-title">网络拓扑图</div>
          <div id="nmap-topo-area"></div>
        </div>
      </div>
    `);
    bindTabClicks();
  }

  function bindTabClicks() {
    $('.bookmark').off().click(function() {
      $('.bookmark').removeClass('active');
      $(this).addClass('active');
      $('#fofa-pane, #tide-pane, #nmap-pane').hide();
      const m = $(this).data('method');
      if (m === 'fofa') {
        $('#fofa-pane').show();
        setTitle('资产探测 - Fofa');
        renderFofaTab();
      } else if (m === 'finger') {
        $('#tide-pane').show();
        setTitle('指纹探测 - TideFinger');
        renderTideTab();
      } else {
        $('#nmap-pane').show();
        setTitle('拓扑探测 - nmap');
        renderNmapTab();
      }
    });
  }


  // FOFA: 渲染表单 & 结果
  function renderFofaTab() {
    // 表单
    $('#fofa-form-area').html(`
      <label>返回字段：</label>
      <div id="field-list"></div>
      <button id="add-param" class="btn btn-sm btn-outline-primary mb-3">+ 添加查询条件</button>
      <div id="param-list"></div>
      <div class="d-flex justify-content-between mb-3">
        <button id="submit-query" class="btn btn-primary">开始查询</button>
        <button id="export-xlsx" class="btn btn-success" disabled>导出 XLSX</button>
      </div>
    `).show();
    // 填字段
    const fldList = $('#field-list').empty();
    ALL_FIELDS.forEach(f => {
      fldList.append(
        $(`<label><input type="checkbox" value="${f}" ${["ip","port","protocol","title"].includes(f)?"checked":""}> ${f}</label>`)
      );
    });
    // 事件
    $('#add-param').off().click(() => {
      const row = $(`
        <div class="param-row mb-2">
          <select class="form-select param-field">
            <option value="">字段</option>
            <option value="domain">domain</option>
            <option value="ip">ip</option>
            <option value="port">port</option>
            <option value="app">app</option>
          </select>
          <input type="text" class="form-control param-value" placeholder="值">
          <button class="btn btn-outline-danger btn-remove">&times;</button>
        </div>
      `);
      $('#param-list').append(row);
      row.find('.btn-remove').click(() => row.remove());
    });
    $('#submit-query').off().click(() => {
      const fields = $('#field-list input:checked').map((i,el)=>el.value).get();
      if (!fields.length) return alert('请至少选择一个返回字段');
      const parts = [];
      $('#param-list .param-row').each(function() {
        const f=$(this).find('.param-field').val();
        const v=$(this).find('.param-value').val().trim();
        if(f&&v) parts.push(`${f}="${v}"`);
      });
      if (!parts.length) return alert('请至少添加一个查询条件');
      $('#fofa-table-area').html('<p>查询中…</p>');
      $.getJSON('/api/fingerprint',{q:parts.join(' && '),fields:fields.join(',')},res=>{
        if(res.error){
          $('#fofa-table-area').html(`<p class="text-danger">${res.error}</p>`);
          return;
        }
        fpCache={fields,res:res.results};
        renderFpTable();
      });
    });
    // 导出
    $('#export-xlsx').off().click(()=>{
      if(!fpCache) return;
      $.ajax({
        url:'/api/fingerprint/export',
        method:'POST',
        contentType:'application/json',
        data:JSON.stringify({fields:fpCache.fields,results:fpCache.res}),
        xhrFields:{responseType:'blob'},
        success(blob){
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url; a.download='result.xlsx'; a.click();
          URL.revokeObjectURL(url);
        }
      });
    });
    // 如果已有缓存，渲染
    if(fpCache) renderFpTable();
  }

  function renderFpTable() {
    const {fields,res:results} = fpCache;
    let html=`<div class="table-responsive" style="max-height:calc(100% - 20px);">
      <table class="table table-striped table-bordered mb-0"><thead><tr>`;
    fields.forEach(h=> html+=`<th>${h}</th>`);
    html+=`</tr></thead><tbody>`;
    results.forEach(row=>{
      html+='<tr>';
      row.forEach(c=> html+=`<td>${c}</td>`);
      html+='</tr>';
    });
    html+=`</tbody></table></div>`;
    $('#fofa-table-area').html(html);
    $('#export-xlsx').prop('disabled',false).show();
  }

  // TideFinger: 渲染表单 & 结果
  function renderTideTab() {
    $('#tide-form-area').html(`
      <div class="param-row mb-3">
        <input type="text" id="tide-url" class="form-control" placeholder="请输入 URL，如 https://example.com">
        <button id="tide-submit" class="btn btn-warning ms-2">开始探测</button>
      </div>
    `).show();
    // 如果有缓存，恢复
    if(tideCache) {
      $('#tide-url').val(tideCache.url);
      $('#tide-table-area').html(tideCache.html);
      return;
    }
    $('#tide-table-area').html('<p class="text-muted">等待探测...</p>');
    $('#tide-submit').off().click(()=>{
      const url=$('#tide-url').val().trim();
      if(!url) return alert('请输入目标 URL');
      $('#tide-table-area').html('<p>探测中…</p>');
      $.getJSON('/api/tidefinger',{url},res=>{
        if(res.error){
          $('#tide-table-area').html(`<p class="text-danger">${res.error}</p>`);
          return;
        }
        const banners=res.banner.split(/\s*\|\s*/).filter(Boolean);
        const bannerHtml=`
          <p><strong>Banner:</strong></p>
          <div class="badge-container mb-3">
            ${banners.map(i=>`<span class="badge badge-item">${i}</span>`).join('')}
          </div>`;
        const cmsHtml=`
          <p><strong>CMS_finger:</strong>
            <span class="badge badge-cms">${res.cms}</span>
          </p>`;
        const fullHtml=bannerHtml+cmsHtml;
        $('#tide-table-area').html(fullHtml);
        tideCache={url,html:fullHtml};
      });
    });
  }

  // Vis.js 拓扑绘制
  function drawTopology(topology) {
    const container = document.getElementById('nmap-topo-area');
    const data = {
      nodes: new vis.DataSet(topology.nodes),
      edges: new vis.DataSet(topology.edges)
    };
    const options = {
      layout: { improvedLayout: true },
      nodes: { shape: 'dot', size: 16 },
      edges: { arrows: 'to' },
      physics: { stabilization: true, barnesHut: { gravitationalConstant: -8000 } }
    };
    new vis.Network(container, data, options);
  }

  function renderNmapTab() {
    // 如果已经初始化过，先清空
    $('#nmap-form-area').html(`
      <div class="mb-2">
        <label>目标 URL/IP：</label>
        <input type="text" id="nmap-target" class="form-control" placeholder="例如 192.168.1.1">
      </div>
      <div class="mb-2">
        <label>扫描速度：</label>
        <select id="nmap-timing" class="form-select">
          <option value="T0">Paranoid (T0)</option>
          <option value="T1">Sneaky (T1)</option>
          <option value="T2">Polite (T2)</option>
          <option value="T3">Normal (T3)</option>
          <option value="T4" selected>Aggressive (T4)</option>
          <option value="T5">Insane (T5)</option>
        </select>
      </div>
      <div class="form-check form-check-inline mb-2">
        <input class="form-check-input" type="checkbox" id="nmap-os">
        <label class="form-check-label" for="nmap-os">启用 OS 检测 (-O)</label>
      </div>
      <div class="form-check form-check-inline mb-2">
        <input class="form-check-input" type="checkbox" id="nmap-sv">
        <label class="form-check-label" for="nmap-sv">服务版本检测 (-sV)</label>
      </div>
      <div class="mb-2">
        <label>端口范围 (-p)：</label>
        <input type="text" id="nmap-ports" class="form-control" placeholder="如 1-1000,8080">
      </div>
      <button id="nmap-submit" class="btn btn-info">开始拓扑探测</button>
    `);

    // 恢复缓存
    if (nmapCache) {
      $('#nmap-target').val(nmapCache.target);
      $('#nmap-timing').val(nmapCache.timing);
      $('#nmap-os').prop('checked', nmapCache.os_detect);
      $('#nmap-sv').prop('checked', nmapCache.service_detect);
      $('#nmap-ports').val(nmapCache.ports || '');
      $('#nmap-log-area').text(nmapCache.log);
      drawTopology(nmapCache.topology);
      return;
    }

    $('#nmap-log-area').text('等待探测…').show();
    $('#nmap-topo-area').empty();

    $('#nmap-submit').off().click(() => {
      const target = $('#nmap-target').val().trim();
      if (!target) return alert('请填写目标 IP');
      const timing = $('#nmap-timing').val();
      const os_detect = $('#nmap-os').is(':checked');
      const service_detect = $('#nmap-sv').is(':checked');
      const ports = $('#nmap-ports').val().trim() || null;

      $('#nmap-log-area').text('探测中…请稍候');
      $.getJSON('/api/nmap', {
        target, timing,
        os_detect, service_detect,
        ports
      }, res => {
        if (res.error) {
          $('#nmap-log-area').text(res.error);
          return;
        }
        $('#nmap-log-area').text(res.log);
        drawTopology(res.topology);
        // 缓存整个状态
        nmapCache = { target, timing, os_detect, service_detect, ports, log: res.log, topology: res.topology };
      });
    });
  }

  // 全局缓存
  let nucleiCache = null;
  let xrayCache = null;
  let smartCache = null;
  // 记住当前正在查看的漏洞扫描子工具，用于初始渲染
  let lastVulnTool = 'nuclei';

  // 漏洞扫描页面
  function renderVuln() {
    setTitle('漏洞扫描');
    $('#content-area').html(`
      <div class="d-flex flex-column h-100">
        <div class="bookmarks mb-3">
          <div class="bookmark" data-tool="nuclei">Nuclei 扫描</div>
          <div class="bookmark" data-tool="xray">Xray 扫描</div>
        </div>
        <!-- Nuclei 面板 -->
        <div id="vuln-nuclei" class="flex-grow-1">
          <div class="param-row mb-2">
            <input type="text" id="nuclei-target" class="form-control" placeholder="FOFA 语句 或 URL/IP">
            <button id="submit-nuclei" class="btn btn-primary ms-2">开始 Nuclei</button>
          </div>
          <pre id="nuclei-result" class="flex-grow-1 overflow-auto bg-light p-3"></pre>
        </div>
        <!-- Xray 面板 -->
        <div id="vuln-xray" class="flex-grow-1" style="display:none;">
          <div class="param-row mb-2">
            <input type="text" id="xray-target" class="form-control" placeholder="输入 URL，例如 https://example.com">
            <button id="submit-xray" class="btn btn-warning ms-2">开始 Xray</button>
          </div>
          <pre id="xray-result" class="flex-grow-1 overflow-auto bg-light p-3"></pre>
        </div>
      </div>
    `);

    // 书签切换逻辑
    $('.bookmark').off().click(function() {
      const tool = $(this).data('tool');
      lastVulnTool = tool;  // 记录当前
      $('.bookmark').removeClass('active');
      $(this).addClass('active');
      if (tool === 'nuclei') {
        $('#vuln-nuclei').show();
        $('#vuln-xray').hide();
      } else {
        $('#vuln-nuclei').hide();
        $('#vuln-xray').show();
      }
      // 切换时恢复缓存
      if (tool === 'nuclei' && nucleiCache) {
        $('#nuclei-target').val(nucleiCache.target);
        $('#nuclei-result').text(nucleiCache.result);
      }
      if (tool === 'xray' && xrayCache) {
        $('#xray-target').val(xrayCache.target);
        $('#xray-result').text(xrayCache.result);
      }
    });

    // 初次渲染后，激活上次的子工具，并恢复缓存
    $(`.bookmark[data-tool="${lastVulnTool}"]`).trigger('click');

    // Nuclei 扫描按钮
    $('#submit-nuclei').off().click(() => {
      const q = $('#nuclei-target').val().trim();
      if (!q) return alert('请输入 FOFA 语句 或 URL/IP');
      $('#nuclei-result').text('扫描中…');
      $.getJSON('/api/vuln_scan', { q }, res => {
        let out = res.error
          ? `错误：${res.error}`
          : (res.raw_output || '(无输出)');
        $('#nuclei-result').text(out);
        // 缓存
        nucleiCache = { target: q, result: out };
      });
    });

    // Xray 扫描按钮
    $('#submit-xray').off().click(() => {
      const tgt = $('#xray-target').val().trim();
      if (!tgt) return alert('请输入 URL 以供 Xray 扫描');
      $('#xray-result').text('扫描中…');
      $.ajax({
        url: '/api/xray',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ target: tgt }),
        success(res) {
          let out = res.error
            ? `错误：${res.error}`
            : (res.output || '(无输出)');
          $('#xray-result').text(out);
          // 缓存
          xrayCache = { target: tgt, result: out };
        },
        error(xhr) {
          const err = `请求失败：${xhr.responseText}`;
          $('#xray-result').text(err);
          xrayCache = { target: tgt, result: err };
        }
      });
    });
  }

  $('#menu-vuln').click(e=>{e.preventDefault();renderVuln(); setTitle('漏洞扫描');});
  // 初始渲染
  $('#menu-fingerprint').click(e=>{e.preventDefault();initPanes();renderFofaTab(); setTitle('资产探测 - Fofa');});

    // 新增：智能攻击（占位）
function renderSmartAttack() {
  $('#content-area').html(`
    <div class="p-4">
      <h4 class="mb-4 text-dark"><i class="bi bi-robot"></i> 智能攻击综合分析</h4>

      <!-- 用户提示词输入 -->
      <div class="mb-4">
        <label for="user-prompt" class="form-label fw-bold">额外分析提示词</label>
        <textarea id="user-prompt" class="form-control rounded-3" rows="3"
          placeholder="例如：请重点分析登录接口漏洞、弱口令利用路径等..."></textarea>
      </div>

      <!-- 中间的小按钮，居中显示 -->
      <div class="text-center mb-4">
        <button id="smart-analyze" class="btn btn-outline-danger btn-sm">
          <i class="bi bi-lightning-charge"></i> 启动分析
        </button>
      </div>

      <!-- 分析结果 -->
      <div class="mb-5">
        <h6 class="text-secondary fw-semibold mb-2">分析结果</h6>
        <pre id="smart-result" class="bg-light border border-secondary-subtle p-3 rounded-3"
             style="min-height:120px; font-family: 'Courier New', monospace;">请点击上方按钮开始分析...</pre>
      </div>

      <!-- 图谱展示 -->
      <div class="mb-3">
        <h6 class="text-primary fw-semibold mb-2">攻击路径图谱</h6>
        <div id="smart-graph" class="border border-primary-subtle rounded-3" style="height: 400px;"></div>
      </div>
    </div>
  `);

  // 恢复缓存内容
  if (smartCache) {
    $('#smart-result').text(smartCache.analysis || "(无结果)");
    $('#user-prompt').val(smartCache.prompt || "");
    drawSmartGraph(smartCache.graph);
  }

  $('#smart-analyze').off().click(() => {
    const userPrompt = $('#user-prompt').val().trim();
    $('#smart-result').html(`<div class="text-muted"><i class="bi bi-hourglass-split"></i> 正在分析中，请稍候...</div>`);

    $.ajax({
      url: "/api/smart_attack_ai",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        fofa: fpCache,
        tide: tideCache,
        nmap: nmapCache,
        xray: xrayCache,
        nuclei: nucleiCache,
        prompt: userPrompt
      }),
      success: res => {
        smartCache = {
          ...res,
          prompt: userPrompt
        };

        $('#smart-result').text(res.analysis || "(无结果)");
        drawSmartGraph(res.graph);
      },
      error: err => {
        $('#smart-result').html(`<span class="text-danger">❌ 错误：${err.responseText || "AI 分析失败"}</span>`);
      }
    });
  });
}




function drawSmartGraph(graph) {
  const container = document.getElementById('smart-graph');
  const data = {
    nodes: new vis.DataSet(graph.nodes),
    edges: new vis.DataSet(graph.edges)
  };
  const options = {
    layout: { improvedLayout: true },
    nodes: { shape: 'box', color: '#FF6F61' },
    edges: { arrows: 'to' }
  };
  new vis.Network(container, data, options);
}

$('#menu-ai').click(e => {
  e.preventDefault();
  setTitle('智能攻击');
  renderSmartAttack();
  drawSmartGraph(graph);
});

  
  // 默认自动点 FOFA
  $('#menu-fingerprint').trigger('click');

});
