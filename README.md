# sthfornoth

项目源码

用户输入说明：
在输入前加入词组前缀可进入不同模式

Alice 命令执行模式，可发送代码

0/1  策略判断

ds  错误纠正，返回纯文本

dc  错误纠正，继续执行命令（程序内部命令，一般不需要用户输入）

输入框按上下箭头可查找命令历史

回车键快速输入

输入exit或ecs也可以退出

退出会保存历史记录到桌面，记得修改历史记录保存的路径

ctrl+D中断命令执行和会话请求

Sanqi分支增加了自反模式，可用于长流程命令，有很高风险，尚在测试

