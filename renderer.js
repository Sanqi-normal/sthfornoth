const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
let conversationHistory = ""; // 历史对话记录
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
        appendMessage(`${message}`, true);
        userInput.value = ''; // 清空输入框
        sendRequest(message); // 发送请求
        conversationHistory += `用户先前询问或命令: ${message}\n`;
        
        // 将当前消息添加到历史记录
        history.unshift(message); // 添加到历史记录顶部
        historyIndex = -1; // 重置历史索引
    }
}
// 设置中断信号处理器
function setupSignalHandler() {
    process.on('SIGINT', () => {
        console.log('中断命令执行');
        userInput.disabled = false; // 恢复用户输入框状态
        userInput.placeholder = "输入内容…"; // 恢复提示
        process.exit(); // 退出进程
    });
}

function appendMessage(message, isUser) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    if (isUser) {
        messageElement.classList.add('user-message');
    } else {
        messageElement.classList.add('ai-message');
        console.log("AI输出回复");
    }
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 滚动到底部
}
const systemMessageArray = [10];
systemMessageArray[0] = "请一般情况下使用中文回答。对用户任何回答不允许以输出代码的格式，只以输出文本的格式回复。";
systemMessageArray[1] = "对用户的要求以代码的形式回应，每份代码前标注代码的语言，保证每次回复正确；如果用户存在某个环节未提供具体值，如任意需要的文件名，文件内容，具体的路径信息，必须要求用户完整提供而不能自己编造，且若用户提到的文件未找到，要询问用户是否新建；其中路径切记要加双斜杠；代码中所有中文转化为英文字符；如果用户返回代码或命令，则以代码的形式做出完全一样的返回。";
systemMessageArray[2] = "衡量方案的可行性并以数字回复给用户，第一个方案数字为0，此后依次加1；仅返回方案对应的数字，返回的数字不应超过方案数量，任何情况下不返回其他。";
systemMessageArray[3] = "对返回的错误进行分析，以纯文本的形式回复";
systemMessageArray[4] = "对返回的错误进行分析，更改后以代码形式回复；其中路径切记要加双斜杠；代码中所有中文转化为英文字符；";
// 发送请求到API

    async function sendRequest(message) {
            // 判断前缀并设置不同的系统提示词
        let systemPrompt;
        switch (message.split(' ')[0]) {
            case 'Alice': 
                systemPrompt = systemMessageArray[1];
                break;
            case '0/1':
                systemPrompt = systemMessageArray[2];
                break;
            case 'default:stop':
            case 'ds':
                systemPrompt = systemMessageArray[3];
                break;
            case 'default:continue':
            case 'dc':
                systemPrompt = systemMessageArray[4];
                break;
            default:
                systemPrompt = systemMessageArray[0];
                break;
        }

        const urlInput = document.getElementById('urlInput');
        const defaultUrl = 'https://fc.fittenlab.cn/codeapi/chat';

        // 使用用户输入的 URL，如果没有输入则使用默认的 URL
        const url = urlInput.value.trim() || defaultUrl;
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
    "inputs":"<|system|>\n"+ systemPrompt+"\n<|end|>\n<|user|>\n"+conversationHistory+'用户现在询问或命令：'+message+"\n<|end|>\n<|assistant|>",
    "ft_token":""
   
})
        };

    userInput.disabled = true;
    userInput.placeholder = "AI响应中…";

    try {
        setupSignalHandler();
        const response = await fetch(url, options);
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
            conversationHistory += `AI回复: ${outputText}\n`;
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
            switch (scriptType) {
                case 'bash':
                    fileExtension = 'sh';
                    inputContent +='\nread -p \'waiting…\'';
                    break;
                case 'python':
                    fileExtension = 'py';
                    inputContent += '\ninput("waiting")';
                    break;
                case 'javascript':
                    fileExtension = 'js';
                    inputContent += ' \nconsole.log("waiting");\nsetInterval(() => {}, 1000); ';
                    break;
                case 'batch':
                    fileExtension = 'bat';
                    inputContent += "\npause";
                    break;
                default:
                    sendRequest("dc "+'不支持的脚本类型，支持bash、python、javaScript、batch');
                    appendMessage('AI回复了不支持的脚本类型，正在返回ai重新生成', false);
                    userInput.placeholder = "AI重新生成命令中…";
                    return;
            }
            // 创建脚本文件
            const fileName = `aliceScript.${fileExtension}`;
            const fs = require('fs');
            fs.writeFileSync(fileName, inputContent);

            userInput.placeholder = "命令执行中…";

            const { execSync } = require('child_process');

try {
    setupSignalHandler();
    // 执行脚本并同步获取输出
    const output =execSync(fileName, { encoding: 'utf-8', stdio: 'pipe' }); // 'utf-8' 编码返回结果
    appendMessage(`命令执行完成\n标准输出：${output}`, false);
    // 恢复用户输入框状态
    userInput.disabled = false;
    userInput.placeholder = "输入内容…"; // 恢复提示
    
} catch (error) {
    // 处理错误
    console.error(`执行错误: ${error.message}`);
    userInput.placeholder = "执行失败，返回错误信息给ai";
    
    // 如果有错误输出，将stderr作为错误消息
    if (error.stderr) {
        console.error(`错误输出: ${error.stderr.toString()}`);
        sendRequest('dc '+error.stderr.toString()); // 发送标准错误输出给 AI
    } else {
        sendRequest('ds '+error.message); // 发送错误消息给 AI
    }
} finally {
    
}


        } else {
            // 普通回复
            appendMessage(aiResponse, false);
            // 恢复用户输入框状态
            userInput.disabled = false;
            userInput.placeholder = "输入内容…"; // 恢复提示
        }
    } catch (error) {
        console.error('请求出错:', error);
        appendMessage('AI正在睡觉.zZ', false);
        // 恢复用户输入框状态
        userInput.disabled = false;
        userInput.placeholder = "输入内容…"; // 恢复提示
    }
}
