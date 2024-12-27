const { ipcRenderer } = require('electron');

const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const urlInput = document.getElementById('urlInput');
const defaultUrl = 'https://fc.fittenlab.cn/codeapi/chat';
const modeId=document.getElementById('comboBox');
let conversationHistory = " "; // 历史对话记录
let history = []; // 存储用户命令历史
let historyIndex = -1; // 当前历史索引
const fs = require('fs');

// 历史命令文件路径
const historyFilePath = "C:\\Users\\28171\\Desktop\\aliceChatlog.txt";

// 加载历史命令
function loadHistory(filePath) {
    console.log("历史命令正在读取");
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        const commands = [];
const processedCommands = new Set(); // 使用Set来存储已经处理过的命令

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<|user|>')) {
        const startIndex = lines[i].indexOf('<|user|>') + '<|user|>'.length;
        let commandLine = lines[i].substring(startIndex);
        let endIndex = commandLine.indexOf('<|end|>');
        
        if (endIndex !== -1) {
            commandLine = commandLine.substring(0, endIndex).trim();
            // 检查命令行是否已存在
            if (!processedCommands.has(commandLine)) {
                commands.push(commandLine);
                processedCommands.add(commandLine); // 添加到已处理集合
            }
        } else {
            let tempCommand = commandLine;
            for (let j = i + 1; j < lines.length; j++) {
                endIndex = lines[j].indexOf('<|end|>');
                if (endIndex !== -1) {
                    tempCommand += lines[j].substring(0, endIndex).trim();
                    i = j; // 更新i以跳过已经处理的行
                    break;
                } else {
                    tempCommand += lines[j];
                }
            }
            tempCommand = tempCommand.trim();
            // 检查命令行是否已存在
            if (!processedCommands.has(tempCommand)) {
                commands.push(tempCommand);
                processedCommands.add(tempCommand); // 添加到已处理集合
            }
        }
    }
}

        console.log("历史命令读取完毕");
        return commands.reverse();
    } catch (err) {
        // 如果文件不存在，返回空数组
        console.error("历史命令读取失败，检查历史记录保存路径；若首次启用，则忽略此错误");
        return [];
    }
}

// 发送按钮点击事件
sendButton.onclick = sendMessage;

// 回车发送消息事件
userInput.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// 处理箭头键事件，用于浏览历史记录
userInput.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowUp') {
        if(!history[0]){
            history = loadHistory(historyFilePath);
        }
        if (historyIndex < history.length - 1) {
            historyIndex++; // 增加索引
            userInput.value = history[historyIndex]; // 更新输入框内容
        }
    } else if (event.key === 'ArrowDown') {
        if (historyIndex > 0) {
            historyIndex--; // 减少索引
            userInput.value = history[historyIndex]; // 更新输入框内容
        } else if (historyIndex === 0) {
            historyIndex = -1; // 重置索引，清空输入框
            userInput.value = ''; // 为空显示
        }
    }
});

function sendMessage() {

    const message =modeId.value+ userInput.value;
    if (message) {
        appendMessage(`${message}`, true);
        userInput.value = ''; // 清空输入框
        sendRequest(conversationHistory,message); // 发送请求
        conversationHistory += `<|user|>\n ${message}\n<|end|>\n`;
        
        // 将当前消息添加到历史记录
        history.unshift(message); // 添加到历史记录顶部
        historyIndex = -1; // 重置历史索引
    }
}

function appendMessage(message, isUser) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    if (isUser) {
        messageElement.classList.add('user-message');
    } else {
        messageElement.classList.add('ai-message');
        //console.log("AI输出回复");
    }
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 滚动到底部
}
// 发送请求到API

 function sendRequest(historymessgae,message) {
             // 使用用户输入的 URL，如果没有输入则使用默认的 URL
        const url = urlInput.value.trim() || defaultUrl;

        ipcRenderer.send('render-send-fetch-request', message,url,historymessgae);
        //console.log("发送fetch请求");
    }
           
// 监听主进程的请求
ipcRenderer.on('main-get-value-request',  (event,arg) => {
    let value="";
    //console.log("接收到消息");
   if(arg.elementId=='conversationHistory'){
       value= conversationHistory;
       //console.log("消息id正确:"+arg.elementId);
   }
  // 将获取到的值和附加的响应返回给主进程
  ipcRenderer.send('renderer-value-response',value , "conversationHistory");
  console.log("回复了消息");
});
//监听禁启用输入框请求
ipcRenderer.on('main-holder-text-change',  (event,arg) => {
    userInput.placeholder=arg.text;
    if(arg.text==="输入内容…"){
        userInput.disabled =false;
    }else{
        userInput.disabled =true;
    }
});
//监听发送信息请求
ipcRenderer.on('main-append-message',  (event,arg) => {
    appendMessage(arg.aiResponse,arg.value);
    //console.log("airesponse");
    conversationHistory+=("<|assistant|>\n"+ arg.aiResponse+"\n<|end|>\n");
});
//中断子进程
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'd') {
        console.log("尝试中断进程");
        event.preventDefault(); // 阻止默认行为
        ipcRenderer.send('interrupt-subprocesses');
    }
});
