const { ipcMain } = require('electron');
const { app, BrowserWindow } = require('electron');

const fs = require('fs');
const path = require('path'); 
let subprocesses = [];//存储子进程

// 读取sysmconfig.json文件内容
const configPath = path.join(__dirname, 'sysmconfig.json'); // 假设config.json与Untitled-1.js在同一目录下
const systemMessageType = JSON.parse(fs.readFileSync(configPath, 'utf8'));



// 应用窗口主程序
let win;
let signal;
let controller;
let conversationHistory = '';
function createWindow() {
    win = new BrowserWindow({
        width: 650,
        height: 500,
        webPreferences: {
            nodeIntegration: true, // 允许在渲染进程中使用Node.js
            contextIsolation: false // 禁用上下文隔离，以允许访问Node.js
        }
        
     });
    win.setMenu(null);
    win.loadFile('index.html'); // 加载index.html文件
    sendRequest("",false);//初始化，第一次信息ai总是接收不到
}

app.whenReady().then(() => {

    createWindow();
    win.on('close', function (e) {

        if (conversationHistory == '') {
            // 阻止默认关闭事件
            e.preventDefault();
            aliceChatlog();
            console.log("关闭前记录了对话历史");
        }
    });

});


ipcMain.on('render-send-reload-request',(event,text)=>{
    saveHistorylog(text,false);
    win.reload();
});
// 监听渲染进程返回的值，并不只用于接收历史记录但目前是这样
ipcMain.once('renderer-value-response', (event, value, id) => {
    
            if (id === 'conversationHistory') {
                saveHistorylog(value,true);
            } else {
                console.error('历史保存记录接收到了错误的ID');
            }
        });

//监听请求并接收
ipcMain.on('render-send-fetch-request', (event, value, url,reqvalue) => { 
    //console.log(`接收到fetch并开始执行`);
    sendRequest(value,url,reqvalue);
    
});





//主体部分
       
        let userAsk='最终目标：';//用于自反命令的全局参数，只有在下一个exe命令时被改变
        let selfexehistory='';//命令执行记录，在下一次exe命令时重置
        let isExecuteMode=false;//是否自反,会在Execute模式下改变，在每次请求时和被使用时被重置为false
async function sendRequest(message,url,reqmessage){
        if(!url){
            url="https://fc.fittenlab.cn/codeapi/chat";
        }
        if(!reqmessage){
            reqmessage=" ";
        }
        console.log("发送的请求："+message);
        isExecuteMode=false;
 // 判断前缀并设置不同的系统提示词
        let systemPrompt;
        let userMessage;
        let inputMessage = message.split(' ')[0]; // 获取用户输入的前缀
        switch (inputMessage) {

        case 'Alice':
            systemPrompt = systemMessageType.CODE;
            userMessage = message.replace(inputMessage + ' ', ''); //如果有特殊前缀则在输入中去掉，以下同
            break;
        case 'ch':
            systemPrompt = systemMessageType.EXECUTE;
            userMessage = message.replace(inputMessage + ' ', '');//自反模式首个命令
            userAsk="最终目标："+userMessage;
            selfexehistory ="";//重置命令执行记录
            isExecuteMode=true;
            break;
        case 'self':
            systemPrompt = systemMessageType.SELFEXE;
            userMessage = message.replace(inputMessage + ' ', '');
            isExecuteMode=true;
            break;//自反，用户提供参数也要用self
        case '0/1':
            systemPrompt = systemMessageType.EVALUATE;
            userMessage = message.replace(inputMessage + ' ', '');
            break;
        case 'default:stop':
        case 'ds':
            systemPrompt = systemMessageType.ERROR;
            userMessage = message.replace(inputMessage + ' ', '');
            break;
        case 'default:continue':
        case 'dc':
            systemPrompt = systemMessageType.ERROR_CODE;
            userMessage = message.replace(inputMessage + ' ', '');
            break;
        case 'com':
            systemPrompt = systemMessageType.COMPLETE;
            userMessage = message.replace(inputMessage + ' ', '');
        case 'exit':
            aliceChatlog();
            break;
        //跳过ai请求直接执行命令
        case 'shell':
        case 'sh':
        case 'bash':
        case 'Bash':
        case 'powershell':
        case 'ps':
        case 'cmd':
        case 'batch':
        case 'Batch':
        case 'javascript':
        case 'js':
        case 'py':
        case 'python':
            userMessage = message.replace(inputMessage + ' ', '');
            executeCommand(userMessage,inputMessage);
            return;
        default:
            systemPrompt = systemMessageType.DEFAULT;
            userMessage = message;
            break;
    }
        // 创建一个 AbortController 实例
        controller = new AbortController();

        // 获取 signal 对象
        signal = controller.signal;
        let abortornot;
        signal.addEventListener('abort',
  () => abortornot=true
);       
        let inputs;
        inputs="<|system|>\n"+ systemPrompt+"\n<|end|>\n"+reqmessage+"<|user|>\n"+userMessage+"\n<|end|>\n<|assistant|>";
        console.log(inputs);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
    "inputs":inputs,
    "ft_token":"",
}),
            signal: signal
        };

    userInputplaceHolder("AI响应中…");

    try {

        const response = await fetch(url, options).catch(error => {
            if (error.name === 'AbortError') {
                console.log('请求已取消');
            } else {
                console.error('请求出错:', error);
            }
        });
        if (!response.ok) {
            throw new Error('网络响应不是ok');
        }
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const jsonArray = lines.map(line => JSON.parse(line));

        function parseJsonObjects(jsonArray) {
            let outputText = '';
            jsonArray.forEach(obj => {
                if (obj.delta) {
                    outputText += obj.delta;
                }
            });
            return outputText;
        }

        const aiResponse = parseJsonObjects(jsonArray);
        console.log(aiResponse);
        // 检查首行和末行是否为 ```
        let responseLines = aiResponse.split('\n');
        responseLines = responseLines.filter(line => line.trim() !== '' && !line.trim().startsWith('#'));
        const firstLine = responseLines[0].trim();
        const lastLine = responseLines[responseLines.length - 1].trim();
        if (firstLine.startsWith('```') && lastLine.startsWith('```')) {
            // 获取脚本类型
            const scriptType = firstLine.substring(3).trim().toLowerCase(); // 去掉```
            const scriptContent = responseLines.slice(1, -1).join('\n'); // 获取中间内容
            var inputContent = scriptContent;//将文本作为变量         
            executeCommand(inputContent,scriptType);
   
}
 else {
            // 普通回复
            appendMessage(aiResponse, false);
            // 恢复用户输入框状态

            userInputplaceHolder("输入内容…"); // 恢复提示
        }
    } catch (error) {
        console.error('请求出错:', error);
        if (abortornot) {
            abortornot = false;
            appendMessage('会话已取消', false);
        } else {
            appendMessage('AI正在睡觉.zZ', false);
        }// 恢复用户输入框状态

        userInputplaceHolder("输入内容…"); // 恢复提示
    }
}
function aliceChatlog() {
    // 当窗口加载完成后发送请求到渲染进程
    win.webContents.send('main-get-value-request', { elementId: 'conversationHistory' });
}

function userInputplaceHolder(text) {
    win.webContents.send('main-holder-text-change', { text: text });
}
function saveHistorylog(value,exit){
    const filePath = "C:\\Users\\28171\\Desktop\\aliceChatlog.txt"; // 文件路径
    const now = new Date();
    const currentTimeString = now.toISOString();
                conversationHistory ="\n"+currentTimeString+"\n"+value;
            // 写入文件
            fs.appendFile(filePath,conversationHistory, (err) => {
                    if (err) {
                        appendMessage('写入文件时出错,强行退出将不保存此次历史记录:'+err,false);
                    } else {
                        console.log(`历史记录已保存到: ${filePath}`);
                    if(exit){
                        app.quit();
                    }else{
                        conversationHistory='';
                    }
                    }
                    
                });
}
function appendMessage(aiResponse,value){
win.webContents.send('main-append-message',{aiResponse:aiResponse,value:value});
}

ipcMain.on('interrupt-subprocesses', (event) => {
    console.log("接收到中断的请求");
    //console.log("当前进程："+subprocesses[0]);
    // 取消fetch请求
    if (controller) {
        console.log("存在可取消的fetch");
    }
    controller.abort();
    //取消子进程
    subprocesses.forEach((proc) => {
                try {
                    //console.log("已中断");
                    proc.kill('SIGINT'); // 安全地中断子进程
                    appendMessage("已中断命令执行",false);
                    userInputplaceHolder("输入内容…");
                } catch (err) {
                    console.error(`中断子进程时出错: ${err}`);
                }
            });
            subprocesses = []; // 清空子进程数组
}
);

function executeCommand(inputContent,scriptType){
  // 确定文件扩展名
            let fileExtension;
            let shell;
            console.log(scriptType);
            switch (scriptType) {
                case 'sh':
                case 'shell':
                case 'Bash':
                case 'bash':
                    fileExtension = 'sh';
                    inputContent +='\nread -p \'waiting…\'';
                    shell='D:\\BaiduNetdiskDownload\\Git\\git-bash.exe';
                    break;
                case 'Python':
                case 'python':
                case 'py':
                    fileExtension = 'py';
                    inputContent += '\ninput("waiting")';
                    break;
                case 'JavaScript':
                case 'javascript':
                case 'js':
                    fileExtension = 'js';
                    inputContent += ' \nconsole.log("waiting");\nsetInterval(() => {}, 1000); ';
                    break;
                case 'PowerShell':
                case 'powershell':
                case '':
                case 'ps':
                    fileExtension = 'ps1';
                    shell='powershell';
                    break;
                case 'cmd':
                case 'Batch':
                case 'batch':
                    fileExtension = 'bat';
                    shell='cmd';
                    break;
                default:
                    if(isExecuteMode){
                        fileExtension = 'ps1';
                        shell='powershell';
                    }
                    sendRequest("dc "+scriptType+'是不支持的脚本类型，支持bash、python、javaScript、batch');
                    appendMessage(`AI回复了不支持的脚本类型:${scriptType}，正在返回ai重新生成`, false);
                    userInputplaceHolder("AI重新生成命令中…");
                    return;
            }
            let fileName;
            if(shell){
                 fileName = inputContent;
            }else{
               
            shell = 'powershell';
            // 创建脚本文件
             fileName = `aliceScript.${fileExtension}`;
            const fs = require('fs');
            fs.writeFileSync(fileName, inputContent);
            }
           


    
        userInputplaceHolder(`命令执行中，此次执行的shell为：${shell}`);
    
        console.log(inputContent);
    // 执行脚本并同步获取输出
try {
    const { spawn } = require('child_process');
    let proc = spawn(fileName, { shell: shell });

    // 处理标准输出
    proc.stdout.on('data', (data) => {
        const stdout = data.toString();
        if (isExecuteMode) { // 自反的输出
            appendMessage(`本步骤命令执行成功\n${inputContent}`, false);
            sendRequest('self \n' + userAsk + "\n上一次命令执行成功：\n" + inputContent + "命令输出：\n" + stdout + selfexehistory);
            selfexehistory += `命令执行历史记录：\n${inputContent}\n执行结果：${stdout}\n`;
        } else {
            appendMessage(`${stdout}`, false);
            userInputplaceHolder("输入内容…"); // 恢复提示
        }
    });

    // 处理标准错误输出
    proc.stderr.on('data', (data) => {
        const stderr = data.toString();
        appendMessage(`错误输出: ${stderr}`, false);
        
        if (isExecuteMode) {
            sendRequest('self 执行失败\n' + userAsk + "\n上一次命令：\n" + inputContent + "\n错误：" + stderr + selfexehistory);
            selfexehistory += `命令执行历史记录：\n${inputContent}\n此命令失败\n`;
        } else {
            sendRequest('ds ' + stderr); // 发送标准错误输出给 AI
        }
    });

    // 处理子进程退出事件
    proc.on('close', (code) => {
        if (code !== 0) {
            appendMessage(`执行错误: 子进程以状态码 ${code} 退出`, false);
            userInputplaceHolder("执行失败，返回错误信息给AI");
            sendRequest('ds ' + inputContent + ` 执行失败，状态码: ${code}`); // 发送错误消息给 AI
        }
    });

    subprocesses.push(proc);
} catch (error) {
    console.error(`捕获到异常: ${error.message}`);
    userInputplaceHolder("捕获到异常，返回错误信息给AI");
    sendRequest('ds ' + error.message); // 发送错误消息给 AI
}
}