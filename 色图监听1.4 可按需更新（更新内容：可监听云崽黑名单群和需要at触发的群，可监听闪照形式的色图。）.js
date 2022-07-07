import path from 'path';
import request from 'request';
import { segment } from "oicq";
import fetch from "node-fetch";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import fs from "fs";
import { promisify } from "util";
import { pipeline } from "stream";


//【使用条款】：
// 1.本插件仅设计用于识别并撤回qq群内不良图片，警告和禁言发送不良图片的群成员，以维护群内健康清朗和谐的聊天环境。
// 2.请不要将本插件用于除维护群聊健康清朗和谐以环境外的其他用途，否则请自行承担该行为产生的一切法律后果，与插件作者无关。
// 3.您需要在同意本条款的前提下才能使用本插件。


//如果报错，请在Yunzai目录下执行： cnpm install baidu-aip-sdk    或者： npm install baidu-aip-sdk 
//！！！注意！！！修改插件任意处的任何内容后，都务必重启云崽，否则会对同一张图片重复判定


//【请先完成如下配置项0 1 2 3 4 5 6】=================================================================================\\\


//==【0】. 若您同意本插件使用条款，请在下方agreelicense=""的引号中填入：我同意使用条款
let agreelicense = " 我才不同意什么使用条款 "


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
	[213938015, true, false, true, true, false, 1440],//云崽群
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


const _path = process.cwd();
Bot.on("message.group", (e) => {
	for (let val of e.message) {
		var msgdata;
		// console.log("用户消息内容类型为：" + val.type)
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
	//判定黑白名单
	if (whitelist.length != 0) {
		if (!whitelist.includes(e.group_id))
			return false
	} else if (blacklist.length != 0)
		if (blacklist.includes(e.group_id))
			return false

	var AipContentCensorClient = require("baidu-aip-sdk").contentCensor;
	var client = new AipContentCensorClient(APP_ID, API_KEY, SECRET_KEY);

	client.imageCensorUserDefined(msgdata.url, 'url').then(function (data) {
		if (data.error_code == 14) {
			console.log("【色图监听】：IAM认证失败，请确认你的百度apikey有效并且填写正确。")
			return false;
		}
		if (data.error_code == 18) {
			console.log("【色图监听】：触发QPS限制。可能是请求频率过高，或你没有在百度云控制台开通“内容审核-图像”资源，或开通时间过短（小于15分钟）")
			return false;
		}
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
		console.log("【色图监听】：群", msgdata.groupName, "的监听策略：存本地", isChiDuShi, "，撤回", iscehui, "，警告", isWarn, "，转发主人", isTellMaster, "，禁言", isMute, "，禁言时长", mutetime, "分钟")
		if (data.conclusionType == 2 || data.conclusionType == 3) {
			console.log("【色图监听】：发现违规图片！");
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
					"检测到色图：", segment.image(msgdata.url),
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
		} else console.log("【色图监听】：图片安全！")
	},
		(err) => {
			if (err.code == "ESOCKETTIMEDOUT")
				console.error("【色图监听】：检测超时");
			else
				console.error("【色图监听】：", err);
		});
	return false;
}

export async function savepic(url, data) {
	let path = "resources/setu";

	if (!fs.existsSync(path)) {
		fs.mkdirSync(path);
	}
	const response = await fetch(url);
	if (!response.ok) {
		console.log("【色图监听】：图片下载失败。。");
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
