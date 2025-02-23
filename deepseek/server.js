require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs'); // 文件系统模块
const path = require('path'); // 路径模块
const sessionsDir = __dirname; // 会话目录
const OpenAI = require('openai');
const chatlistAmount =12;//允许的上下文数目
const app = express();
const port = process.env.PORT || 3000;

const tools = require('./tools.json');// AI工具列表
const tool_functions = require('./tool_functions'); //工具方法 

// 初始化 OpenAI
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
});

const beta = new OpenAI({
    baseURL: 'https://api.deepseek.com/beta',
    apiKey: process.env.DEEPSEEK_API_KEY
});

// 辅助AI配置
const sumAssist_apiKey=process.env.ASSISTANT_API_KEY;
const sumAssist_url=process.env.ASSISTANT_URL;
const sumAssist_systemPrompt=process.env.ASSISTANT_SUMPROMPT;
const judgeEmotion_systemPrompt=process.env.ASSISTANT_EMOTION;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 维护对话历史
const sessionHistory = new Map();
// 每次运行服务器打印余额

const axios = require('axios');

let config = {
  method: 'get',
maxBodyLength: Infinity,
  url: 'https://api.deepseek.com/user/balance',
  headers: { 
    'Accept': 'application/json', 
    'Authorization': 'Bearer '+process.env.DEEPSEEK_API_KEY
  }
};

axios(config)
.then((response) => {
    let data = response.data;
  // 检查账户是否可用
if (data.is_available) {
    // 遍历balance_infos数组
    data.balance_infos.forEach(info => {
        // 构建余额信息字符串
        const balanceInfoText = `余额：${info.total_balance}元`;

        // 打印余额信息到终端
        console.log(balanceInfoText);
    });
} else {
    console.log('账户当前不可用。');
}

})
.catch((error) => {
  console.log(error);
});
// 返回Alice配置信息
app.get('/config-alice', async (req, res) => {
    try{
        const readhistory=await ReadHistory();
        sessionHistory.set('alice',[{role:'system',content:'历史摘要'},...readhistory]);
        res.json({
        AlicePrompt: process.env.ALICE_PROMPT,
        });
        console.log('Alice初始化完成');
    } catch (error) {
        console.error('Alice初始化失败:', error);
  }
});
// 处理聊天请求
app.post('/chat', async (req, res) => {
    try {
        let { sessionId, systemPrompt, message,model, temperature } = req.body;
        
        // 初始化或获取对话历史
        if (!sessionHistory.has(sessionId)) {
            sessionHistory.set(sessionId, []);
        }
    
        const history = sessionHistory.get(sessionId);
           // 检查最后一个消息的 role
           const lastRole = history.length > 0 ? history[history.length - 1].role : null;
            // 如果最后一个消息的 role 不是 "assistant"，则先添加一个空的 "assistant" 消息
           if (lastRole !== "assistant") {
               history.pop();
           }
           // 控制历史记录长度
            if (history.length >= chatlistAmount+1 && sessionId =='alice') {
                let pickupHistory = '';
                pickupHistory=history.shift().content; // 移除最早的条目
                const outdateHistory = [];
                for (let i = 0; i < 8; i++) {
                    if (history.length > 0) {
                        outdateHistory.push(history.shift()); // 移除最早的条目并添加到outdateHistory
                    }
                }
                //替换历史记录总结
                try {
                    const sumHistoryText = await sumHistory(outdateHistory);
                    console.log('历史记录总结：'+sumHistoryText);
                    history.unshift({ role: "system", content: pickupHistory+sumHistoryText }); // 添加到最前端
                    sessionHistory.set('alice', history);
                }catch (error) {
                    console.error('历史记录总结失败：', error);
                }
            }

           
        // 添加用户消息到历史
        history.push({ role: "user", content: `[${new Date().toLocaleString()}]`+message ,timeStamp:`${new Date().toLocaleString()}`});
        // 创建完整消息列表
        const messages = [
            { role: "system", content: systemPrompt},
            ...history
        ];
        console.log('\n\x1b[32m对话请求：\x1b[0m\n');
        console.log('sessionId:', sessionId);
        console.log('model:', model);
        console.log('messages:', messages);
        

        // 调用API
        const completion = await openai.chat.completions.create({
            model: model || 'deepseek-chat',
            messages,
            tools,
            temperature: temperature || 0.7,
            max_tokens: 4096,
            stream:true
        });

        // 添加助手回复到历史
        let reasoning_content = '';
        let message_content = '';
    for await (const part of completion) {
        const part_reasoning_content = part.choices[0].delta.reasoning_content||'';
        const part_message_content = part.choices[0].delta.content||'';
        /*console.log(part_reasoning_content,part_message_content);*/
        res.write(JSON.stringify({ part_reasoning_content,part_message_content })+'\n');
        reasoning_content += part_reasoning_content;
        message_content += part_message_content;
    }
        res.end();
        history.push({ role: "assistant", content: message_content });
        if(sessionId=='alice' && message_content){
            await SaveHistory({ role: "user", content: `[${new Date().toLocaleString()}]`+message, timeStamp:`${new Date().toLocaleString()}`});
            await SaveHistory({ role: "assistant", content: message_content,timeStamp:`${new Date().toLocaleString()}` });
        }
       console.log('会话响应完毕');
        
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: error.message,
            code: error.status || 500
        });
    }
});

// 返回Alice命令执行代码
app.post('/code', async (req, res) => {
    try {
        const { sessionId, systemPrompt, message,model, temperature } = req.body;
        // 创建完整消息列表
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user",content:message},
            { role: "assistant", content: "```"+sessionId+"\n", "prefix": true}
        ];
        console.log('\n\x1b[32mAlice请求：\x1b[0m\n');
        console.log('sessionId:', sessionId);
        console.log('model:', model);
        console.log('messages:', messages);
        

        // 调用API
        const completion = await beta.chat.completions.create({
            model: model || 'deepseek-reasoner',
            messages,
            temperature: temperature || 0,
            max_tokens: 4096,
            stop: ["\n```"]
        });

        // 添加助手回复到历史
        const reasoning_content = completion.choices[0].message.reasoning_content
        const message_content = completion.choices[0].message.content;

        res.json({ reasoning_content,message_content });
    } catch (error) {
        //console.error('API Error:', error);
        res.status(500).json({ 
            error: error.message,
            code: error.status || 500
        });
    }
});

// 处理清空对话历史请求
app.post('/reset', async (req, res) => {
    try {
        const { sessionId } = req.body;
        // 清空全局会话历史
        sessionHistory.delete(sessionId);

        res.status(204).send(); // 204 No Content 表示请求成功但没有内容返回
    } catch (error) {
        console.error('重置对话时出错:', error);
        res.status(500).json({ 
            error: error.message,
            code: error.status || 500
        });
    }
});
// 保存对话历史函数
async function SaveHistory(history) {
    const filePath = path.join(sessionsDir, 'alice_history.json');
    try {
        let fileContent = await fs.promises.readFile(filePath, 'utf8');
        const historyList = JSON.parse(fileContent);
        historyList.push(history);
        fileContent = JSON.stringify(historyList,null,2);
        await fs.promises.writeFile(
            filePath,
            fileContent,
            'utf8'
        );
    } catch (error) {
        console.error('追加Alice对话失败：', error);
    }
}

async function ReadHistory() {
    try {
        const filePath = path.join(sessionsDir, 'alice_history.json');
        const fileContent = await fs.promises.readFile(filePath,'utf8');
        const history = JSON.parse(fileContent).slice(-8);
        return history;
    } catch (error) {
        console.error('读取JSON文件出错:', error);
    }
}

async function sumHistory(historylist) {
        // 确保 history 是字符串
        const history = typeof historylist === 'string' ? historylist : JSON.stringify(historylist);

    const sumHistoryResponse = await fetch(sumAssist_url,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
    "inputs":"<|system|>\n"+ sumAssist_systemPrompt+"\n<|end|>\n"+"<|user|>\n"+history+"\n<|end|>\n<|assistant|>",
    "ft_token":sumAssist_apiKey,
    })
    }).catch(error => {
            console.error('辅助AI请求出错:', error);
    });
        if (!sumHistoryResponse.ok) {
            throw new Error('网络响应不是ok');
        };
        const text = await sumHistoryResponse.text();
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
    return aiResponse;

}

async function judgeEmotion(historylist) {
    // 确保 history 是字符串
    const history = typeof historylist === 'string' ? historylist : JSON.stringify(historylist);

const judgeEmotionResponse = await fetch(sumAssist_url,{
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
"inputs":"<|system|>\n"+ judgeEmotion_systemPrompt+"\n<|end|>\n"+"<|user|>\n"+history+"\n<|end|>\n<|assistant|>",
"ft_token":sumAssist_apiKey,
})
}).catch(error => {
        console.error('情绪判断AI请求出错:', error);
});
    if (!judgeEmotionResponse.ok) {
        throw new Error('网络响应不是ok');
    };
    const text = await judgeEmotionResponse.text();
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
return aiResponse;

}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

