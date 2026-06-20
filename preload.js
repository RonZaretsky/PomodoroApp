const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  updateTooltip: (text) => ipcRenderer.send('update-tooltip', text),
  updateIcon: (progress) => ipcRenderer.send('update-icon', progress),
});
