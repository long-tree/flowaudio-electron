const { contextBridge, ipcRenderer } = require('electron');

let CozeAPI;
try {
  // 明确抛出缺失提示，避免 preload 静默失败
  ({ CozeAPI } = require('@coze/api'));
} catch (err) {
  console.error('[preload] 加载 @coze/api 失败，请在项目根目录执行 npm install');
  throw err;
}

// Coze workflow client
const cozeClient = new CozeAPI({
  token: '',
  baseURL: 'https://api.coze.cn',
  allowPersonalAccessTokenInBrowser: true, // preload 在 sandbox 中被视作 browser，需要显式允许 PAT
});

const activeStreams = new Map();
let streamCounter = 0;

async function startStream(input = {}, onEvent) {
  const params = {
    workflow_id: '7574737601769340934',
    parameters: {
    "pic_input": "https://p26-bot-workflow-sign.byteimg.com/tos-cn-i-mdko3gqilj/753475da83e542e8b07f430f8085692f.png~tplv-mdko3gqilj-image.image?rk3s=81d4c505&x-expires=1795962260&x-signature=%2BfaGLUG8KSPBAaltGV%2FugafKdl0%3D&x-wf-file_name=%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE+2025-06-28+202506.png",
    "process_input": "chrome,iqyi,bilibili",
    "text_input": ""
    },
  };

  if (input.text_input) params.parameters.text_input = input.text_input;
  if (input.process_input) params.parameters.process_input = input.process_input;
  if (input.pic_input) params.parameters.pic_input = input.pic_input;

  const runId = `flow-${++streamCounter}`;
  const state = { stopped: false };
  activeStreams.set(runId, state);

  (async () => {
    try {
      const stream = await cozeClient.workflows.runs.stream(params);
      for await (const packet of stream) {
        if (state.stopped) break;
        onEvent?.({ runId, ...packet });
        if (packet.event === 'Error' || packet.event === 'Done' || packet.event === 'Interrupt') break;
      }
    } catch (err) {
      onEvent?.({ runId, event: 'Error', error_message: err.message });
    } finally {
      activeStreams.delete(runId);
    }
  })();

  return runId;
}

function stopStream(runId) {
  const state = activeStreams.get(runId);
  if (state) state.stopped = true;
}

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('dialog:openFile', filePath),
  sayHello: (name) => ipcRenderer.invoke('grpc:sayHello', name),
  callGrpc: (method, ...args) => ipcRenderer.invoke(`grpc:${method}`, ...args),
});

contextBridge.exposeInMainWorld('flowBridge', {
  startStream,
  stopStream,
});
