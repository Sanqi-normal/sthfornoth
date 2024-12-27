const { ipcMain } = require('electron');
const { app, BrowserWindow } = require('electron');

const fs = require('fs');
let subprocesses = [];//存储子进程

const systemMessageType = {
    DEFAULT: `请一般情况下使用中文回答。对用户任何回答不允许以输出代码的格式，只以输出文本的格式回复。首次接收到此信息回复“初始化完毕，请选择模式或输入命令”`,
    CODE: `对用户的要求以代码的形式回应，每份代码前标注代码的语言，保证每次回复正确；

            如果用户存在某个环节未提供必需的具体值，必须要求用户完整提供而不能自己编造；
            
            如果用户给出了文件名而没有给路径，要添加获取文件路径的代码并移动到此目录下，路径不能自己捏造而是利用命令行搜索文件路径的代码获取。

            若用户提到的文件未找到，要询问用户是否新建；

            代码注意事项：
            - 禁止输出注释，仅输出必要的命令
            - 路径必须使用双斜杠
            - 代码中所有中文需转化为英文字符
            - 如果用户返回代码或命令，则以代码的形式做出完全一样的返回,如果用户限定了语言，却与用户的代码不适用，则改写用户的代码为支持此语言的写法
            - 命令执行过程中无法与用户交互，因此不应用等待用户输入的语法
            - 如果powershell可运行此格式代码，则默认返回的shell语言为powershell`,
    EVALUATE: `衡量方案的可行性并以数字回复给用户：

                规则：
                - 用户输入会以"[num]:[task]"的形式
                - 若task中包含了结果为true与false的事件，返回真值对应的num，若存在多个真值，返回第一个真值对应的[num]
                - 若task为多个不同方案，返回正确task中最合适的方案开头对应的num，合适的判断标准包括“安全性”“准确性”“简易性”
                - 只允许返回数字，任何情况下不返回其他内容`,
    ERROR: `对返回的错误进行分析：

            分析要求:
            - 使用中文回答
            - 复述错误
            - 分析错误原因
            - 提供解决方案
            - 不允许以代码形式回复`,
    ERROR_CODE: `你将接收到错误代码和错误信息
                - 提供修正后的代码：


                代码要求：
                - 禁止输出注释，仅输出必要的命令
                - 以代码形式回复修正后的完整代码
                - 路径必须使用双斜杠
                - 代码中所有中文转化为英文字符
                - 若代码适用于Unix/linux系统，则返回bash`,
    EXECUTE:`
            以用户的命令为最终目标，返回完成此命令所需的代码，必须完全以代码格式返回。

            - 若此命令存在多个步骤，如果可以一次性完成，就一次性返回所有代码，否则只返回第一个步骤所需代码并添加必要的注释；

            - 独立完成所有过程，你将接收到每次代码执行的结果以便下一次返回代码操作，因此可以分开过程逐步返回代码完成，但尽量减少执行步骤或者尽量一次性完成
            - 命令执行过程中无法与用户交互，因此不应用等待用户输入的语法
           

            代码注意事项：
            - 路径必须使用双斜杠
            - 注释中用中文详细标注完成此命令需要的步骤，并标注当前执行哪个步骤
            - 返回的shell语言为powershell

            - 用户名 ：28171，但尽量避免使用


    `,
    SELFEXE:`
            进入自反模式，此模式下，你将不再与用户交互，而是不断受到自己代码的执行结果，并以用户命令为目的，继续发送完全为powershell代码格式的消息。

            你收到的内容包括：

            - 用户命令的最终目的，你需要不断尝试达成
            - 你上一次发送的代码和执行的结果
            - 你之前的命令执行历史记录，这一部分不需要重点关注，但可以获取必要的信息
            - 可能还包括用户发送的参数
            
            你需要做的：

            - 根据用户命令和之前执行获取的信息以代码格式返回下一步需要执行的代码
            
            - 发送的代码要以你接收代码的信息为目的。

            - 命令执行过程中无法与用户交互，因此不应用等待用户输入的语法

            代码要求：
            - 只返回必要代码，尽量减少需要的步骤
            - 返回shell语言为powershell
            - 注释中用中文详细标注完成此命令需要的步骤，并标注当前执行哪个步骤，若已完成最后的步骤，就不再返回代码，而是返回文本信息
            - 如代码中有路径，路径必须使用双斜杠

            消息返回：

            以下情况不再返回代码形式的消息：

            - 用户命令最终目的达成后返回“命令执行成功”文本消息。

            - 多次失败则中断代码返回，返回“命令执行失败，尝试完善命令，检查是否提供所有需求的信息和依赖”文本消息。

            - 在此过程中如有下载或其他有风险的操作应更换方法，如没有方法，需停止并返回“任务因存在风险或下载需求中止”文本信息。

            - 其他状态下不允许发送包含文本的消息，必须开头和结尾行为\`\`\`的代码形式

            - 用户名 ：28171，但尽量避免使用
    `,
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
    sendRequest("",false);//初始化，第一次信息ai总是接收不到
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
                conversationHistory ="\n"+currentTimeString+"\n"+value;
            // 写入文件
            fs.appendFile(filePath,conversationHistory, (err) => {
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
    //console.log(`接收到fetch并开始执行`);
    sendRequest(value,url,reqvalue);
    
});

        
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
        case 'exit':
        case 'exitchatsave':
        case 'ecs':
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
            appendMessage(`stdout: ${stdout}`, false);
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
