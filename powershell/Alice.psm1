# 模块名称：Alice
# [功能] 自然语言代替程序语言执行命令 附带纠错、历史对话等功能
# 最后更新时间：2025-01-07
# 作者：叁七
[string]$global:historyMessage # 全局变量，用于存储历史消息
function Alice {
    param(
        [string]$inputMessage,
        [switch]$h
    )
    if($h){
        echohelp
    }
    if($inputMessage){
	if($inputMessage -eq 'help'){
        echohelp 
    } else{
        sendRequest -uM $inputMessage -n 3
        return
    }
}
Write-Host "------------------------" -ForegroundColor DarkRed
Write-Host "`n`nAlice is here.`n`n" -ForegroundColor Magenta
Write-Host "------------------------" -ForegroundColor DarkRed
$structAlice = 0;# Alice内部变量，传递Alice模式值，初始为0，即执行模式
    # 进入Alice模式
    while ($true) {
    Write-Host -NoNewline -ForegroundColor Green "Alice "
    Write-Host -NoNewline "$(Get-Location)> "
    
    # 使用 Read-Host 获取用户输入
    [string] $inputMessage = Read-Host       # 检查用户是否输入了退出命令
        if ($inputMessage -eq 'exit') {
            Write-Host "`n退出Alice...`n" -ForegroundColor Green
            Write-Host "Have a nice day~" -ForegroundColor Yellow
            break
        }
        if ($inputMessage -eq 'help') {
            echohelp
            continue
        }
        # 检查输入是否为 !Alice 加一个数字
        if ($inputMessage -match '^!Alice\s*(\d+)') {
            $validNumbers = 0,1, 2, 3  # 预定义的有效数字集合
            $number = [int]$matches[1]
            if($validNumbers -contains $number){
            $structAlice = $number
            Write-Host "`n已将structAlice的值设置为 $number`n" -ForegroundColor Green
            continue
            }else{
                Write-Host "Alice接收到无效数字,操作无效" -ForegroundColor Red
                continue
            }
        }
        # 将用户输入的命令作为字符串
        $command = $inputMessage 

        # 检查是否接收到命令
        if ([string]::IsNullOrEmpty($command)) {
            continue
        }

        try{
        # 执行命令
        Invoke-Expression $command 
        } catch [System.Management.Automation.CommandNotFoundException]{
	    Write-Host "Alice接收到命令，正在尝试理解…" -ForegroundColor Blue

            # 命令未定义的异常，用Alice0号提示词发送请求
            sendRequest -uM $inputMessage   -n $structAlice         
        }catch [System.Exception]{
	    Write-Host "发现错误，Alice正在尝试纠错…" -ForegroundColor DarkRed
            # 其他异常，用纠错提示词发送请求
            sendRequest -uM $inputMessage   -n 1
        }
    }
}

function echohelp {
    Write-Host "#####################" -ForegroundColor Blue
    Write-Host "`n" -NoNewline
    Write-Host "Alice逻辑：" -ForegroundColor Green
    Write-Host "`n进入Alice模式直接输入请求`n请求powershell可执行则直接执行，执行失败转纠错，未知命令转ai请求。`n`n输入前添加Alice 前缀可作为AI交流`n" -NoNewline
    Write-Host "`n全局请求函数：" -ForegroundColor Green
    Write-Host "`nsendRequest -uM [inputMessage] -n [num]`n[inputMessage]请求内容`n[num]=0 命令 `n[num]=1 纠错 `n[num]=2 重新返回 `n[num]=3 对话 `n"
    Write-Host "`n内置修改模式命令：" -ForegroundColor Green
    Write-Host "`n!Alice [num]"
    Write-Host "#####################" -ForegroundColor Blue
    
}
function sendRequest {
    param (
        [string]$url = "https://fc.fittenlab.cn/codeapi/chat",
        [int]$n = 0,
        [string]$uM = "用户消息预制，如果你看到此消息，请回复 `Alice没有发现用户命令哦~` "
    )
    [string[]]$sP=@(
"对用户的要求只以powershell的代码形式回应并且不返回除代码外的其他任何文字，保证每次代码语法正确；
    如果用户存在某个环节未提供必需的具体值，必须要求用户完整提供而不能自己编造；
    如果用户给出了文件名而没有给路径，要添加获取文件路径的代码并移动到此目录下，路径不能自己捏造而是利用命令行搜索文件路径的代码获取。
    一般情况下不允许擅自新建任何文件夹和下载任何东西到本地，如有需求需要代码里做出交互请求
    返回注意事项：
    - 返回内容首行和尾行均需以``````开头
    - 任何变量都需要先定义或者通过用户输入获取
    - 确保代码逻辑完整，可以正确执行
    - 路径必须使用双斜杠，如果你在路径中使用变量，确保变量值是正确的路径格式。
    - 代码中所有中文需转化为英文字符
    - 如需与用户交互，必须有完整的交互逻辑，比如等待用户输入值，读取，判断读取值，输出",
    "你将接收到一个错误，以Alice的自称用中文解释此错误产生的原因和解决方法，要求如果属于常见错误，则不拓展，尽量简略。如果不常见，则详细说明",
    "你将接收到一个代码错误，你需根据此错误对代码进行修改，然后以完整的代码形式返回。
代码要求：
    - 首行和尾行均需以``````开头，不应添加代码的解释或是注释
    - 任何变量都需要先定义或者通过用户输入获取
    - 确保代码逻辑完整，可以正确执行
    - 路径必须使用双斜杠
    - 代码中所有中文需转化为英文字符
若无法修改则不返回代码，返回中文文本的错误分析
",
    "你将扮演用户的助理，以Alice的身份用中文与用户交谈，为用户提供帮助"
)    
	# 中文直接传输发现存在问题，可能损坏了，所以unicode编码后再传


    # Write-Host "Alice正在构造请求，本次请求序号：$n"
    $test= EncodeUim "对以下命令只返回代码，不包含其他任何文字"
    if($n -eq 0){
	[string]$hM="<|user|>`n$test`n<|end|>`n"
    }else{
	[string]$hM=$global:historyMessage
    }
    # unicode编码
    $uM = EncodeUim $uM
    $sP[$n] = EncodeUim $sP[$n]
    # 要发送的请求体
    $inputMessages = "<|system|>`n"+$sP[$n]+"`n<|end|>`n$hM<|user|>`n$uM`n<|end|>`n<|assistant|>"
    
    # Write-Host "请求构造完毕，本次请求体：$inputMessages"
    $token = " "
    $body = @{
        "inputs" = $inputMessages
        "ft_token" = $token
    }

    # 记录在消息历史中
    # 放在构造请求之后是避免上传请求时重复传入了当前命令
    # $uM = DecodeUim $uM
    $global:historyMessage += "<|user|>`n$uM`n<|end|>`n"
    # echo "历史对话：`n$global:historyMessage"
    # 定义 Fetch 请求的内容
    $options = @{
        Method =  'POST'
        Headers = @{
            'Content-Type' = 'application/json'
        }
        Body = $body | ConvertTo-Json
    }

    try {
        # 发送 Fetch 请求
        $response = Invoke-RestMethod -Uri $url @options -ErrorAction Stop
        if ($response -eq $null) {
            Write-Host "Website connect is not ok."
            return
        }
        # echo "AI回复的json：`n$response"
        $lines = $response -split "`n" | Where-Object { $_  -ne '' }
        $jsonArray = $lines | ForEach-Object { $line = $_; $line | ConvertFrom-Json }

        function Parse-JsonObjects {
            param ($jsonArray)
            $outputText = ''
            foreach ($obj in $jsonArray) {
                if ($obj.delta) {
                    $outputText += $obj.delta
                }
            }
            return $outputText
        }
        
        $aiResponse = Parse-JsonObjects $jsonArray

        # 检查首行和末行是否为 ```
        $responseLines = $aiResponse -split "`n" | Where-Object { $_  -ne '' -and -not ($_ -like '#*') }
        [string] $firstLine = $responseLines[0] 
        [string] $lastLine = $responseLines[-1] 

        if ($n -eq 0 -and $firstLine.StartsWith('```') -and $lastLine.StartsWith('```')) {
            $scriptContent = $responseLines[1..($responseLines.Count - 2)] -join "`n"
            Write-Host "Alice正在执行：`n" -ForegroundColor Yellow
            Write-Host $scriptContent -ForegroundColor Blue
            $result = Invoke-Expression $scriptContent 
            Write-Host "命令执行完成`n$result" -ForegroundColor Blue
            $global:historyMessage += "<|assistant|>`nAlice执行的命令：`n$scriptContent`n命令执行结果：`n$result`n<|end|>`n"
        } else {
            Write-Host "Alice返回回答中…" -ForegroundColor Blue
            Write-Host $aiResponse
            [string]$decodeResponse = DecodeUim $aiResponse
            Write-Host $decodeResponse
            $global:historyMessage += "<|assistant|>`nAlice返回回答：`n$aiResponse`n<|end|>`n"
        }

    } catch {
        Write-Host "Alice处理请求失败，正在返回失败原因并重新处理:`n $_"
	sendRequest -uM $_   -n 1
    }
}
function EncodeUim {
    param (
        [string]$oS
    )

    # 将每个字符转换为 Unicode 编码形式并构造结果字符串
    $encodedUim = ""

    foreach ($char in $oS.ToCharArray()) {
        $unicode = [int][char]$char
        $encodedUim += "\u" + "{0:X4}" -f $unicode
    }

    return $encodedUim
}
function DecodeUim {
    param (
        [string]$encodedUim
    )

# 使用正则表达式匹配所有\uXXXX格式的编码点
$unicodePoints = [regex]::Matches($encodedUim, '\\u[0-9A-Fa-f]{4}') | ForEach-Object { $_.Value }

$decodedString = ""

foreach ($point in $unicodePoints) {
    if ($point -match '^\\u[0-9A-Fa-f]{4}$') {
        # 提取Unicode编码点并转换为字符
        $unicode = [int]::Parse($point.Substring(2), [System.Globalization.NumberStyles]::HexNumber)
        $decodedString += [char]$unicode
    } else {
        # 如果不符合Unicode编码格式，直接添加到结果字符串
        $decodedString += $point
    }
}


    return $decodedString
}



Export-ModuleMember -Function Alice, sendRequest
