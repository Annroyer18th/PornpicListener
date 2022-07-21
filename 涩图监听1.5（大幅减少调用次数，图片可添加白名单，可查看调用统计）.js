import path from 'path';
import request from 'request';
import schedule from "node-schedule";
import moment from "moment";
import { segment } from "oicq";
import fetch from "node-fetch";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import fs from "fs";
import { promisify } from "util";
import { pipeline } from "stream";
// const dirpath = "lib/example/setudata";//json文件的路径
const dirpath = "resources/setu/setudata";//json文件的路径
const filename = `setudata`//json文件的文件名

//【使用条款】：
// 1.本插件仅设计用于识别并撤回qq群内不良图片，警告和禁言发送不良图片的群成员，以维护群内健康清朗和谐的聊天环境。
// 2.请不要将本插件用于除维护群聊健康清朗和谐以环境外的其他用途，否则请自行承担该行为产生的一切法律后果，与插件作者无关。
// 3.您需要在同意本条款的前提下才能使用本插件。


//若控制台报错请尝试在Yunzai目录下执行： cnpm install baidu-aip-sdk    或者： npm install baidu-aip-sdk 
//！！！注意！！！修改插件任意处的任何内容后，都务必重启云崽，否则会对同一张图片重复判定
//！！！注意！！！修改插件任意处的任何内容后，都务必重启云崽，否则会对同一张图片重复判定


//【请先完成如下配置项0 1 2 3 4 5 6】=================================================================================\\\


//==【0】. 若您同意本插件使用条款，请在下方license=""的引号中填入：我同意使用条款
let agreelicense = "我才不同意什么使用条款 "


//==【1】. 请按照 https://www.wolai.com/x3bbeHstB15LAge9jdqr6y 的教程，配置并在下面填入百度图片内容识别key。
var APP_ID = "你的 App ID";
var API_KEY = "你的 Api Key";
var SECRET_KEY = "你的 Secret Key";


//==【2】. 下方是全局策略，没有单独定制策略的群会默认走全局策略。false表示该功能为关闭状态，true表示该功能为开启状态，可按需修改。 (注意是false不是flase) 
let isChiDuShi_ = true;    //色图是否保存本地  (在/resources/setu文件夹中)
let iscehui_ = false;      //是否撤回色图（需要机器人是管理员）
let isWarn_ = false;       //是否@发图人进行提醒or警告
let isTellMaster_ = true;  //监听到涩图后是否私聊通知主人
let isMute_ = false;       //是否禁言发色图的人
let mutetime_ = 1;         //禁言时间，单位分钟，需要填整数，最小为1,最大俺也不清楚，应该是30天x24小时x60分钟

var independentcfg = new Array()
independentcfg = [


    //==【3】. 下方是单独群策略，可以针对不同群定制个性化策略。false表示该功能为关闭状态，true表示该功能为开启状态，可按需修改。 (注意是false不是flase) 
    //==== 每一行是一个群，从左到右依次为：[群号,是否存本地，是否撤回，是否警告，是否通知主人，是否禁言，禁言时长]    可按需添行 
    [114514, false, false, false, false, true, 114],
    [1919810, false, false, false, false, true, 514],
]


//==【4】. 下面是警告的内容： (可自行更换引号中的内容) 
let warntext = "不许色色！"


//==【5】. 在下面[方括号]中填写触发色图时需要通知的QQ，【如果不填】则会推送给【全部主人】
let qq_ = []; //多个QQ请用英文逗号,隔开  例如： let qq_ = [114514,1919810];


//==【6】.设置监听的白名单群和黑名单群。【如果不填】则默认监听【所有群】
let whitelist = [];  //白名单。将群号填入[中括号]内，则只监听该群。多个群号请用英文逗号,隔开
let blacklist = [];  //黑名单。仅在白名单为空时生效。将群号填入[中括号]内，则不会监听该群。多个群号请用英文逗号,隔开


//【配置完毕】=================================================================================================///


// 插件使用中如果遇到问题可@渔火反馈    渔糕就读的幼稚园：924017116    Yunzai-Bot插件库：https://github.com/HiArcadia/Yunzai-Bot-plugins-index
// v 1.0 
// v 1.1 修复了一些bug,增加apikey失效提醒
// v 1.2 修复了单独群策略会影响全局策略的bug  转发给主人的信息中增加了色图置信度
// v 1.3 修复了有多个主人时无法向主人发送消息的bug；推送改为列出该图片全部违规类型；新增检测到色图时推送给指定人；新增群黑白名单；存本地改为使用置信度最高的违规类型来命名图片；更新了使用条款
// v 1.4 可监听到云崽黑名单群和需要at触发的群。可监听到闪照形式的色图。
// v 1.5 保存接口返回的鉴定结果,再次收到同一张图不再消耗次数。可将图片加入白名单,加入后将忽略该图。可查看最近三日调用次数和费用统计


export const rule = {
    wlist: {
        reg: "^#*加入监听白名单(.*)$",
        // reg: "^bmd(.*)$",
        priority: 5000,
        describe: "【#例子】开发简单示例演示",
    },
    report: {
        // reg: "^tj$",
        reg: "^#*监听(报表|统计)$",
        priority: 5000,
        describe: "【#例子】开发简单示例演示",
    },
};

Bot.on("message.group", (e) => {
    for (let val of e.message) {
        var msgdata;
        switch (val.type) {
            case "flash":
            case "image":
                msgdata = {
                    "url": val.url,
                    "groupName": e.group_name,
                    "nickName": e.sender.nickname,
                }
                HpicListener(msgdata, e)
        }
    }

})



export async function HpicListener(msgdata, e) {
    // 如果是白名单图片则返回
    if (await checkwhite(msgdata.url)) {
        console.log("【涩图监听】：白名单图片")
        await addcount(2)
        return false
    }
    //判定群黑白名单
    if (whitelist.length != 0) {
        if (!whitelist.includes(e.group_id))
            return false
    } else if (blacklist.length != 0)
        if (blacklist.includes(e.group_id))
            return false

    // 尝试从本地获取鉴定结果
    let data = await localQuery(msgdata.url)
    if (data) {
        await addcount(2)
        console.log("【涩图监听】：本地使用本地记录")
        deal(data, e, msgdata)
    }
    // 如果没有本地记录则调用接口鉴定
    else {
        var AipContentCensorClient = require("baidu-aip-sdk").contentCensor;
        var client = new AipContentCensorClient(APP_ID, API_KEY, SECRET_KEY);
        client.imageCensorUserDefined(msgdata.url, 'url').then(async function (data) {
            // console.log(data)
            if (data.error_code == 14) {
                console.log("【涩图监听】：IAM认证失败，请确认你的百度apikey有效并且填写正确。")
                return false;
            }
            if (data.error_code == 18) {
                console.log("【涩图监听】：触发QPS限制。可能是请求频率过高，或你没有在百度云控制台开通“内容审核-图像”资源，或开通时间过短（小于15分钟）")
                return false;
            }
            await localRecord(data, msgdata.url)
            await addcount(1)
            console.log("【涩图监听】：本次调用接口鉴定")
            deal(data, e, msgdata)
        },
            (err) => {
                if (err.code == "ESOCKETTIMEDOUT")
                    console.error("【涩图监听】：检测超时");
                else
                    console.error("【涩图监听】：", err);
            });
    }
    return false;
}


// ==================图片存本地===================
export async function savepic(url, data) {
    let path = "resources/setu";

    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
    const response = await fetch(url);
    if (!response.ok) {
        console.log("【涩图监听】：图片下载失败。。");
        return false;
    }
    let pictype = "jpg";
    if (response.headers.get("content-type") == "image/gif") {
        pictype = "gif";
    }
    const streamPipeline = promisify(pipeline);
    //取最高置信度的项为图片命名
    let j = 0;
    for (let i = 0; i < data.data.length; i++) {
        if (data.data[i].probability * 1 >= data.data[j].probability * 1)
            j = i;
    }
    await streamPipeline(response.body, fs.createWriteStream(`${path}/${data.data[j].msg}${data.log_id}.${pictype}`));
}


// ==========================根据获取到的图片判定结果进行处理======================
export async function deal(data, e, msgdata) {
    let isChiDuShi = isChiDuShi_;
    let iscehui = iscehui_;
    let isWarn = isWarn_;
    let isTellMaster = isTellMaster_;
    let isMute = isMute_;
    let mutetime = mutetime_;

    for (let i = 0; i < independentcfg.length; i++)
        if (independentcfg[i][0] * 1 == e.group_id * 1) {
            isChiDuShi = independentcfg[i][1];
            iscehui = independentcfg[i][2];
            isWarn = independentcfg[i][3];
            isTellMaster = independentcfg[i][4];
            isMute = independentcfg[i][5];
            mutetime = independentcfg[i][6];
            break;
        }
    if (agreelicense.trim() != "\u6211\u540c\u610f\u4f7f\u7528\u6761\u6b3e") {
        console.log("\u3010\u8272\u56fe\u76d1\u542c\u3011\uff1a\u540c\u610f\u63d2\u4ef6\u4f7f\u7528\u6761\u6b3e\u65b9\u53ef\u4f7f\u63d2\u4ef6" +
            "\u751f\u6548\uff0c\u8bf7\u524d\u5f80\u63d2\u4ef6\u7b2c\u3010\u0030\u3011\u914d\u7f6e\u9879\u8fdb\u884c\u914d\u7f6e");
        return false
    }
    console.log("【涩图监听】：群", msgdata.groupName, "的监听策略：存本地", isChiDuShi, "，撤回", iscehui, "，警告", isWarn, "，转发主人", isTellMaster, "，禁言", isMute, "，禁言时长", mutetime, "分钟")
    if (data.conclusionType == 2 || data.conclusionType == 3) {
        console.log("【涩图监听】：发现违规图片！");
        if (isChiDuShi) {
            savepic(msgdata.url, data)
        }
        if (iscehui) {
            e.group.recallMsg(e.message_id);
        }
        if (isMute) {
            e.group.muteMember(e.sender.user_id, mutetime * 60);
        }
        if (isWarn) {
            e.reply([segment.at(e.user_id), " ", segment.text(warntext)])
        }
        if (isTellMaster) {
            //构造通知内容
            let one = [];
            let msg = [
                "检测到涩图：", segment.image(msgdata.url),
                "来自群：", e.group_name,
                "\n发送者：", e.sender.card,]
            for (let i = 0; i < data.data.length; i++) {
                one = [
                    "\n--------------------",
                    "\n类型：", data.data[i].msg,
                    "\n置信度：", (data.data[i].probability * 100).toFixed(2), "%",
                ];
                msg = msg.concat(one);
            }

            //向特定的人发送通知
            if (qq_.length == 0) {
                for (let i of BotConfig.masterQQ) {  //发送给所有主人
                    let userId = i
                    Bot.pickUser(userId).sendMsg(msg)
                }
            } else {
                for (let i of qq_) { //发送给指定的人
                    let userId = i
                    Bot.pickUser(userId).sendMsg(msg)
                }
            }
        }
    }
    else console.log("【涩图监听】：图片安全！")
    return false
}


// =======================在本地查询判定记录并返回,若无记录则返回0 参数是图片url==========================
export async function localQuery(url) {
    let md5 = await getmd5(url)
    let data = await readJSON(dirpath, filename)
    for (let jdjg of data.jdjg) {
        if (jdjg.MD5 == md5)
            return jdjg.data
    }
    return 0
}


// =========================将调用接口获得的数据写入本地 参数是接口返回的鉴定信息和图片url ==========================================
export async function localRecord(res, url) {
    let md5 = await getmd5(url)
    let newjd = {
        "MD5": md5,
        "url": url,
        "data": res
    }
    // 读出json
    let data = await readJSON(dirpath, filename)
    data.jdjg.push(newjd)
    // 重新写回json文件中
    await writeJson(dirpath, filename, data)
    return true
}


// ======================调用记录中调用次数加一.参数为1表示是接口判定,参数为2表示是本地判定================
export async function addcount(type) {

    let date = moment(Date.now()).format('YYYY-MM-DD')
    // console.log(date)
    let Data = await readJSON(dirpath, filename)

    if (Data.statistics.length != 0 && Data.statistics[Data.statistics.length - 1].date == date) {
        if (type == 1)
            Data.statistics[Data.statistics.length - 1].callapi++
        else if (type == 2)
            Data.statistics[Data.statistics.length - 1].native++
        else
            return 0
    }
    else {
        let newsta = {
            "date": date,
            "callapi": type == 1 ? 1 : 0,
            "native": type == 2 ? 1 : 0
        }
        Data.statistics.push(newsta)
    }
    await writeJson(dirpath, filename, Data)
    // console.log(Data.statistics)
    return true
}


// ======================汇报涩图监听统计数据=====================
export async function report(e) {
    // 读出json
    let data = await readJSON(dirpath, filename)
    let tj = data.statistics
    // console.log(tj)
    // console.log(tj.length)
    if (tj.length == 0) {
        e.reply("还没有统计数据哦")
        return true
    }
    let msg = []
    for (let i = tj.length - 1, j = 0; j < 3; i--, j++) {
        if (i < 0)
            break
        let temp = [
            j != 0 ? "\n\n" : "",
            "┏", j == 0 ? "今" : j == 1 ? "昨" : "前", "日统计\n",
            "┣鉴定次数：", segment.text(tj[i].callapi * 1 + tj[i].native * 1), "次\n",
            "┣本地鉴定：", segment.text(tj[i].native), "次\n",
            "┣调用接口：", segment.text(tj[i].callapi), "次\n",
            "┗鉴定费用：", segment.text((tj[i].callapi * (5 / 10000)).toFixed(2)), "元",
        ]
        msg = msg.concat(temp)
    }
    e.reply(msg)
    return true
}


// =============将指定图片加入白名单====================
export async function wlist(e) {
    if (!e.isMaster) return true
    if (e.hasReply) {
        // console.log(e);
        let reply;
        if (e.isGroup) {
            reply = (await e.group.getChatHistory(e.source.seq, 1)).pop()?.message;
        } else {
            reply = (await e.friend.getChatHistory(e.source.time, 1)).pop()?.message;
        }
        if (reply) {
            e.message = reply
        }
        // return true
    }
    let count = 0
    let existed = 0
    for (let val of e.message) {
        switch (val.type) {
            case "flash":
            case "image":
                if (await checkwhite(val.url))
                    existed++
                else {
                    // console.log(val.url)
                    await addwhite(val.url)
                    count++
                }
        }
    }
    if (count || existed)
        e.reply([
            count ? `成功将${count}张图片加入白名单~` : "未能将指定图片加入白名单,", existed ? `\n有${existed}张图片已在白名单中~` : ""
        ])
    else
        e.reply("请在命令后带上图片,或对图片回复此命令")
    return true
}


// ==================传入图片url返回md5值================
export async function getmd5(url) {
    // let temp = url.split("-")
    // console.log(temp[temp.length - 1])
    // temp = temp[temp.length - 1].split("/")
    // console.log(temp)
    // console.log(url)
    // console.log("【url】：",url)
    var temp = url.match(/[0-9a-fA-F]{19,}/g);  // c佬的正则匹配取md5好厉害!
    // console.log("【temp】:",temp)
    return temp[0]
}


// ==============将一张图加入到白名单,参数是这张图的url=============
export async function addwhite(url) {
    let md5 = await getmd5(url)
    // console.log(md5)
    // 构造一个数组成员
    let newWhite = {
        "MD5": md5,
        "url": url
    }
    // 读出json
    let data = await readJSON(dirpath, filename)
    // 将刚才构造的成员push进白名单数组bmd中
    data.bmd.push(newWhite)
    // 重新写回json文件中
    await writeJson(dirpath, filename, data)
    return true
}


// =================判断白名单中有没有这个图，参数是这张图的url==============
export async function checkwhite(url) {
    let md5 = await getmd5(url)
    // 读出json
    let data = await readJSON(dirpath, filename)
    // 逐个判断bmd中的每个成员
    for (var member of data.bmd) {
        // 如果该成员的MD5值等于md5,就返回true
        if (member.MD5 == md5)
            return true
    }
    // 如果没找到对应的MD5，说明白名单中没有这个图，返回false
    return false
}


// =================从白名单删除一张图，参数是这张图的url===============
export async function delwhite(url) {
    let md5 = await getmd5(url)
    // 读出json
    let data = await readJSON(dirpath, filename)
    for (var i = 0; i < data.bmd.length; i++) {
        // 如果该MD5值等于md5,就去掉这个数组成员
        if (data.bmd[i].MD5 == md5) {
            data.bmd.splice(i, 1)
            // 把处理后的data写回json文件里
            await writeJson(dirpath, filename, data)
            return true
        }
    }
    // 如果并没有找到这张图，那么返回-1
    return -1
}


// ===================读json(文件路径,文件名)===================
async function readJSON(fpath, fname) {

    // 如果文件名没带json后缀就加上json后缀
    if (!/\.json$/.test(fname)) {
        fname = fname + ".json";
    }

    // 如果不存在路径
    if (!fs.existsSync(fpath)) {
        // 就创建这个路径
        fs.mkdirSync(fpath);
    }

    // 如果路径下没有对应json文件，就创建这个json文件
    if (!fs.existsSync(`${fpath}/${fname}`)) {
        // const streamPipeline = promisify(pipeline);
        // 创建时写入空的json框架如下：
        let temp = {
            // 这个用来存图片白名
            "bmd": [],
            // 这个用来存图片黑名单
            "hmd": [],
            // 这个用来存鉴定结果
            "jdjg": [],
            // 这个用来存调用统计
            "statistics": [],

            "temp1": [],
            "temp2": []
        }
        // 写入到文件中
        fs.writeFileSync(`${fpath}/${fname}`, JSON.stringify(temp));
    }
    // 读出对应文件
    let jsonRet = fs.readFileSync(`${fpath}/${fname}`, "utf8");
    //将二进制的数据转换为字符串
    jsonRet = jsonRet.toString()
    // 将字符串转为对象并返回
    return JSON.parse(jsonRet);
}


//==================== 写json(文件路径,文件名,要写入的内容)=================
async function writeJson(fpath, fname, data, space = "\t") {

    // 如果文件名没带json后缀就加上json后缀
    if (!/\.json$/.test(fname)) {
        fname = fname + ".json";
    }

    // 如果不存在路径
    if (!fs.existsSync(fpath)) {
        // 就创建这个路径
        fs.mkdirSync(fpath);
    }

    // 如果路径下没有对应json文件，就创建这个json文件
    if (!fs.existsSync(`${fpath}/${fname}`)) {
        // const streamPipeline = promisify(pipeline);
        // 创建时写入空的json框架如下：
        let temp = {
            // 这个用来存图片白名
            "bmd": [],
            // 这个用来存图片黑名单
            "hmd": [],
            // 这个用来存鉴定结果
            "jdjg": [],
            // 这个用来存调用统计
            "statistics": [],

            "temp1": [],
            "temp1": []
        }
        // 写入到文件中
        fs.writeFileSync(`${fpath}/${fname}`, JSON.stringify(temp));
    }
    // 将传来的data写入json中
    return fs.writeFileSync(`${fpath}/${fname}`, JSON.stringify(data, null, space));
}