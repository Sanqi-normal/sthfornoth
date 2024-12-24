const { app, BrowserWindow } = require('electron');
console.log("控制台输出");
function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, // 允许在渲染进程中使用Node.js
            contextIsolation: false // 禁用上下文隔离，以允许访问Node.js
        }
    });

    win.loadFile('index.html'); // 加载index.html文件
}

app.whenReady().then(createWindow);

// 处理窗口关闭
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
