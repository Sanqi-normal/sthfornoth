const { ipcMain } = require('electron');
const { app, BrowserWindow } = require('electron');

const fs = require('fs');
let subprocesses = [];//存储子进程

const systemMessageType = {
    DEFAULT: `请一般情况下使用中文回答。对用户任何回答不允许以输出代码的格式，只以输出文本的格式回复。`,
    CODE: `对用户的要求以代码的形式回应，每份代码前标注代码的语言，保证每次回复正确；

            如果用户存在某个环节未提供具体值，如:
            - 任意需要的文件名
            - 文件内容
            - 具体的路径信息
            必须要求用户完整提供而不能自己编造；

            若用户提到的文件未找到，要询问用户是否新建；

            注意事项：
            - 路径必须使用双斜杠
            - 代码中所有中文需转化为英文字符
            - 如果用户返回代码或命令，则以代码的形式做出完全一样的返回`,
    EVALUATE: `衡量方案的可行性并以数字回复给用户：

                规则：
                - 返回最合适的方案开头对应的数字
                - 只允许返回数字，任何情况下不返回其他内容`,
    ERROR: `对返回的错误进行分析：

            分析要求:
            - 使用中文回答
            - 复述错误
            - 分析错误原因
            - 提供解决方案
            - 不允许以代码形式回复`,
    ERROR_CODE: `提供修正后的代码：


                代码要求：
                - 路径必须使用双斜杠
                - 代码中所有中文转化为英文字符
                - 以代码形式回复修正后的完整代码`,
};


let win;


let signal;
let controller;
let conversationHistory = '';
function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, // 允许在渲染进程中使用Node.js
            contextIsolation: false // 禁用上下文隔离，以允许访问Node.js
        }
    });

    win.loadFile('index.html'); // 加载index.html文件
    
}

app.whenReady().then(() => {

    createWindow();
    win.on('close', function (e) {
    
    if(conversationHistory==''){
    // 阻止默认关闭事件
    e.preventDefault();
    aliceChatlog();
    console.log("关闭前记录了对话历史");
    }
  });

});



// 监听渲染进程返回的值
ipcMain.once('renderer-value-response', (event, value, id) => {
    const filePath = "C:\\Users\\28171\\Desktop\\aliceChatlog.txt"; // 文件路径
    const now = new Date();
    const currentTimeString = now.toISOString();
            if (id === 'conversationHistory') {
                conversationHistory ="\n"+currentTimeString+"\n" + value;
            // 写入文件
            fs.appendFile(filePath, conversationHistory, (err) => {
                    if (err) {
                        appendMessage('写入文件时出错,强行退出将不保存此次历史记录:'+err,false);
                    } else {
                        console.log(`历史记录已保存到: ${filePath}`,false);
                        app.quit();
                    }
                    
                });
            } else {
                console.error('接收到了错误的ID');
            }
        });

//监听请求并接收
ipcMain.on('render-send-fetch-request', (event, value, url,reqvalue) => { 
    console.log(`接收到fetch并开始执行`);
    sendRequest(value,url,reqvalue);
    
});


async function sendRequest(message,url,reqmessage){
        if(!url){
            url="https://fc.fittenlab.cn/codeapi/chat";
        }
        if(reqmessage){
            reqmessage=" ";
        }
 // 判断前缀并设置不同的系统提示词
        let systemPrompt;
        let userMessage;
        let inputMessage = message.split(' ')[0]; // 获取用户输入的前缀
        console.log(inputMessage);
        switch (inputMessage) {

        case 'Alice':
            systemPrompt = systemMessageType.CODE;
            userMessage = message.replace(inputMessage + ' ', ''); //如果有特殊前缀则在输入中去掉，以下同
            break;
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
        case 'exit':
        case 'exitchatsave':
        case 'ecs':
            aliceChatlog();
            break;

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
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
    "inputs":"<|system|>\n"+ systemPrompt+"\n<|end|>\n<|user|>\n"+reqmessage+userMessage+"\n<|end|>\n<|assistant|>",
    "ft_token":"",
}),
            signal: signal
        };

    userInputplaceHolder("AI响应中…") ;
    
    
    try {

        const response = await fetch(url,options).catch(error => {
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
        
        // 检查首行和末行是否为 ```
        const responseLines = aiResponse.split('\n');
        const firstLine = responseLines[0].trim();
        const lastLine = responseLines[responseLines.length - 1].trim();

        if (firstLine.startsWith('```') && lastLine.startsWith('```')) {
            // 获取脚本类型
            const scriptType = firstLine.substring(3).trim().toLowerCase(); // 去掉```
            const scriptContent = responseLines.slice(1, -1).join('\n'); // 获取中间内容
            var inputContent = scriptContent;//将文本作为变量         
            // 确定文件扩展名
            let fileExtension;
            let shell;
            switch (scriptType) {
                case 'sh':
                case 'Bash':
                case 'bash':
                    fileExtension = 'sh';
                    inputContent +='\nread -p \'waiting…\'';
                    shell='D:\\BaiduNetdiskDownload\\Git\\git-bash.exe';
                    break;
                case 'Python':
                case 'python':
                    fileExtension = 'py';
                    inputContent += '\ninput("waiting")';
                    break;
                case 'JavaScript':
                case 'javascript':
                    fileExtension = 'js';
                    inputContent += ' \nconsole.log("waiting");\nsetInterval(() => {}, 1000); ';
                    break;
                case 'cmd':
                case 'Batch':
                case 'batch':
                    fileExtension = 'bat';
                    inputContent += "\necho 'waiting'\npause\nexit";
                    shell='cmd';
                    break;
                default:
                    sendRequest("dc "+scriptType+'是不支持的脚本类型，支持bash、python、javaScript、batch');
                    appendMessage('AI回复了不支持的脚本类型，正在返回ai重新生成', false);
                    userInputplaceHolder("AI重新生成命令中…");
                    return;
            }
            let fileName;
            if(shell){
                 fileName = inputContent;
            }else{
               
            shell = process.platform === 'win32' ? process.env.COMSPEC : process.env.SHELL;
            // 创建脚本文件
             fileName = `aliceScript.${fileExtension}`;
            const fs = require('fs');
            fs.writeFileSync(fileName, inputContent);
            }
           


     try{   
        userInputplaceHolder("命令执行中…");
    // 执行脚本并同步获取输出
    
    const { exec } = require('child_process');
    let proc = exec(fileName,{shell:shell},(error, stdout, stderr) => {
            if (error) {
                appendMessage(`执行错误: ${error.message}`,false);
                userInputplaceHolder("执行失败，返回错误信息给AI");
                
                // 如果有错误输出，将 stderr 作为错误消息
                if (stderr) {
                    appendMessage(`错误输出: ${stderr}`,false);
                    sendRequest('dc ' + stderr.toString()); // 发送标准错误输出给 AI
                } else {
                    sendRequest('ds ' + error.message); // 发送错误消息给 AI
                }
            } else {
                appendMessage(`命令执行完成\n输出:${stdout}`, false);
                // 恢复用户输入框状态
                userInputplaceHolder("输入内容…"); // 恢复提示
            }
        }); 
        subprocesses.push(proc);
    } catch (error) {
        console.error(`捕获到异常: ${error.message}`);
        userInputplaceHolder("捕获到异常，返回错误信息给AI");
        sendRequest('ds ' + error.message); // 发送错误消息给 AI
    }
   
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
            abortornot=false;
            appendMessage('会话已取消',false);
        }else{
        appendMessage('AI正在睡觉.zZ', false);
        }// 恢复用户输入框状态
         
        userInputplaceHolder("输入内容…"); // 恢复提示
    }
}
function aliceChatlog(){
     // 当窗口加载完成后发送请求到渲染进程
          win.webContents.send('main-get-value-request',{elementId:'conversationHistory'});
}

function userInputplaceHolder(text){
win.webContents.send('main-holder-text-change',{text:text});
}
function appendMessage(aiResponse,value){
win.webContents.send('main-append-message',{aiResponse:aiResponse,value:value});
}

ipcMain.on('interrupt-subprocesses',(event)=>{
    console.log("接收到中断的请求");
    //console.log("当前进程："+subprocesses[0]);
    // 取消fetch请求
    if(controller){
        console.log("存在可取消的fetch");
    }
    controller.abort();
    //取消子进程
    subprocesses.forEach((proc) => {
                try {
                    //console.log("已中断");
                    proc.kill('SIGINT'); // 安全地中断子进程
                } catch (err) {
                    console.error(`中断子进程时出错: ${err}`);
                }
            });
            subprocesses = []; // 清空子进程数组
}
);
