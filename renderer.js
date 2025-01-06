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

//ai补全
let booleanValue = false; // 初始化布尔值
const suggestions = document.getElementById('suggestions');
let abortController; // 定义一个变量来控制请求的中断
const MAX_SUGGESTIONS = 5; // 设置最大展示数量

userInput.addEventListener('input', async () => {
    if(booleanValue){
    const inputValue = userInput.value.trim();
    suggestions.innerHTML = ''; // 清空当前建议

    // 如果输入不为空
    if (inputValue &&!inputValue == "") {
        // 中断之前的请求
        if (abortController) {
            abortController.abort();
        }
        
        // 创建新的AbortController实例
        abortController = new AbortController();
        
        try {
            const systemPrompt = `
            - 对发送内容生成三个可能的补全
            - 补全内容应最小程度地延申，应当选择最简洁的补全
            - 每个补全以不使用逗号分隔的单句文本形式返回
            - 保持补全内容不改变原输入的内容及其在句子中的位置
            - 主题限定在计算机领域，并确保补全与输入紧密相关
            - 如果用户输入不完整字母，则优先补全为有效命令行指令或代码，且代码仅以文本形式返回限制为一行，不添加注释
            - 如用户输入中文，请确保补全符合中文语境，保持逻辑连贯性
            - 补全内容需最大程度贴合用户需求，按照合理的可能性降序排列`;

            const response = await fetch(defaultUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "inputs": "<|system|>\n" + systemPrompt + "\n<|end|>\n<|user|>\n" + inputValue + "\n<|end|>\n<|assistant|>",
                    "ft_token": ""
                }),
                signal: abortController.signal // 将控制信号传入请求中
            });

            if (!response.ok) {
                throw new Error('网络响应不是 OK');
            }

            const text = await response.text();
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const jsonArray = lines.map(line => JSON.parse(line));

            const aiResponse = parseJsonObjects(jsonArray);
            console.log(aiResponse);
            displaySuggestions(aiResponse);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('请求已被中断');
            } else {
                console.error('获取建议时出错:', error);
            }
        }
    } else {
        suggestions.style.display = 'none'; // 输入框为空时隐藏建议
    }
}else{//boolean value 为false 的else
    suggestions.style.display = 'none';
}
});

function parseJsonObjects(jsonArray) {
    let outputText = '';
    jsonArray.forEach(obj => {
        if (obj.delta) {
            outputText += obj.delta;
        }
    });
    return outputText;
}

function displaySuggestions(aiResponse) {
    let responseLines = aiResponse.split('\n').slice(0, MAX_SUGGESTIONS); // 限制展示的数量

    responseLines.forEach(line => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        suggestionItem.innerText = line;
        suggestionItem.onclick = () => {
            userInput.value = line; // 点击建议后填充输入框
            suggestions.innerHTML = ''; // 清空建议
            suggestions.style.display = 'none'; // 隐藏建议
        };
        suggestions.appendChild(suggestionItem);
    });

    suggestions.style.display = responseLines.length ? 'block' : 'none'; // 根据是否有建议来显示或隐藏
}
//补全按钮
        document.getElementById('toggleButton').addEventListener('click', function() {
            booleanValue = !booleanValue; // 反转布尔值
            this.classList.toggle('active'); // 切换按钮状态
            suggestions.style.display = 'none';
        });