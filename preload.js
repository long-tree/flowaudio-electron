const { contextBridge, ipcRenderer } = require('electron');
const { CozeAPI } = require('@coze/api');

// Coze workflow client
const cozeClient = new CozeAPI({
  token: 'pat_JmVtS89Ru052QdVwrAMYDy2SHd2bRx2YUyti2vfxKELoUbVLv48tleBCRe2D4m0D',
  baseURL: 'https://api.coze.cn',
});

const activeStreams = new Map();
let streamCounter = 0;

async function startStream(input = {}, onEvent) {
  const params = {
    workflow_id: '7574737601769340934',
    parameters: {},
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
