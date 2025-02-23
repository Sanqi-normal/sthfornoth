function get_weather(location) {
    if(location=='beijing'||'北京'||"北京市"){
        return '晴';
    }else{
        return '未查询到城市名';
    }
}

module.exports = {
    get_weather,
};
