const { ipcRenderer } = require('electron');

const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const urlInput = document.getElementById('urlInput');
const defaultUrl = 'https://fc.fittenlab.cn/codeapi/chat';
let conversationHistory = " "; // 历史对话记录
let history = []; // 存储用户命令历史
let historyIndex = -1; // 当前历史索引

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
    const message = userInput.value;
    if (message) {
        let requestmessage;
        appendMessage(`${message}`, true);
        userInput.value = ''; // 清空输入框
        requestmessage=conversationHistory+"\n用户此次输入:";
        sendRequest(requestmessage,message); // 发送请求
        conversationHistory += `用户先前询问或命令: ${message}\n`;
        
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

 function sendRequest(requestmessage,message) {
             // 使用用户输入的 URL，如果没有输入则使用默认的 URL
        const url = urlInput.value.trim() || defaultUrl;

        ipcRenderer.send('render-send-fetch-request', message,url,requestmessage);
        console.log("发送fetch请求");
    }
           
// 监听主进程的请求
ipcRenderer.on('main-get-value-request',  (event,arg) => {
    let value="";
console.log("接收到消息");
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
    console.log("airesponse");
    conversationHistory+=("AI回复或执行结果："+ arg.aiResponse+"\n");
});
//中断子进程
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'd') {
        console.log("尝试中断进程");
        event.preventDefault(); // 阻止默认行为
        ipcRenderer.send('interrupt-subprocesses');
    }
});