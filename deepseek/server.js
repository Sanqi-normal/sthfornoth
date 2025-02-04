require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// 初始化 OpenAI
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
});

const alice = new OpenAI({
    baseURL: 'https://api.deepseek.com/beta',
    apiKey: process.env.DEEPSEEK_API_KEY
});

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
// 处理聊天请求
app.post('/chat', async (req, res) => {
    try {
        const { sessionId, systemPrompt, message,model, temperature } = req.body;
        
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
        // 添加用户消息到历史
        history.push({ role: "user", content: message });

        // 创建完整消息列表
        const messages = [
            { role: "system", content: systemPrompt },
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
            temperature: temperature || 0.7,
            max_tokens: 1024,
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
        history.push({ role: "assistant", content: message_content });
        res.end();
        
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: error.message,
            code: error.status || 500
        });
    }
});

// 返回Alice命令执行代码
app.post('/alice', async (req, res) => {
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
        const completion = await alice.chat.completions.create({
            model: model || 'deepseek-reasoner',
            messages,
            temperature: temperature || 0,
            max_tokens: 1024,
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


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

