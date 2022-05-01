const { Client, Intents, Permissions, MessageButton, MessageEmbed, MessageActionRow, MessageCollector, Message } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES], partials: ["CHANNEL", "GUILD_MEMBER", "MESSAGE", "REACTION", "USER"], restTimeOffset: 50 });
const { default: axios } = require("axios");
const { randomBytes } = require("crypto");
const config = require("./config");
const cmds=[];
const cmdfuncs=[];

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}


require("dotenv").config();

client.on("ready", () => console.log(`Logged in as ${client.user.tag}.`));

client.on("messageCreate", (message) => {
  if (message.content === "!scratchauth" && message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
    const embed = new MessageEmbed()
      .setTitle("Scratch認証")
      .setDescription("下のボタンを押して、ScratchのアカウントとDiscordアカウントの紐付けを開始してください。")
      .setColor("GREEN");
    const button = new MessageButton()
      .setCustomId("verify")
      .setStyle("SUCCESS")
      .setLabel("認証");
    message.channel.send({ embeds: [embed], components: [new MessageActionRow().addComponents(button)] });
  }

  if (message.content.startsWith("!run") && message.author.id === "845998854712721408") {
    const [command, ...args] = message.content.slice(1).trim().split(/ +/g);
    const code = args.join(" ");
    if (code.replaceAll(" ", "") === '"じっきー"==="マロニー"') return message.channel.send("```js\ntrue\n```")
      const result = new Promise((resolve) => resolve(eval(code)));
      return result
        .then(async (output) => {
          if (typeof output !== "string") {
            output = require("util").inspect(output, { depth: 0 });
          }
          if (output.includes(message.client.token)) {
                      output = output.replace(message.client.token, "[TOKEN]");
          }
          if (output.length > 1980) {
            message.channel.send({
              content: "実行結果が長すぎます。",
              files: [
                new MessageAttachment(Buffer.from(output, "utf8"), "result.js"),
              ],
            });
          } else {
            message.channel.send(`\`\`\`js\n${output}\n\`\`\``);
          }
        })
        .catch(async (err) => {
          err = err.toString();
          if (err.includes(message.client.token)) {
            err = err.replace(message.client.token, "[TOKEN]");
          }
          message.channel.send(`\`\`\`js\n${err}\n\`\`\``);
        });
  }
});

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;
  if (i.customId === "verify") {
    await i.deferReply({ ephemeral: true });
    i.member.send("あなたのScratchユーザー名を送信してください。")
      .then(async (msg) => {
        await i.followUp("DMを確認してください。")
        /**
         * 
         * @type {MessageCollector}
         */
        const collector = msg.channel.createMessageCollector({ filter: (m) => m.author.id === i.user.id });
        let scratchName = "";
        let uuid = "";
        collector.on("collect", async (m) => {
          const am = await m.channel.send("ユーザー名を確認中です。<a:load:918373770241138708>");
          axios({
            url: `https://api.scratch.mit.edu/users/${encodeURIComponent(m.cleanContent)}`,
            responseType: "json",
            method: "get"
          })
            .then(() => {
              scratchName = m.cleanContent;
              const but = new MessageButton()
                .setCustomId("auth")
                .setStyle("SUCCESS")
                .setLabel("プロジェクトに入力しました");
              uuid = `${getRandomInt(984932532).toString()}`;
              am.edit({ content: "ユーザー名の確認ができました。\n次に、下のコード(`XXXXXXXXX`形式)を、https://scratch.mit.edu/projects/673753313/fullscreen/ に入力してください。\nもしあなたがNew Scratcherの場合こちらに問い合わせてください：https://scratch.mit.edu/studios/31009600/comments", embeds: [{
                description: `\`\`\`\n${uuid}\n\`\`\``
              }], components: [new MessageActionRow().addComponents(but)] });
              
              collector.stop();
              return handleButton(am);
            })
            .catch(() => {
              return am.edit("Scratchユーザーが存在しません。正しいユーザー名を入力してください。");
            })
        })

        /**
         * 
         * @param {Message} message
         */
        async function handleButton(message) {
          const collector = message.createMessageComponentCollector();
          collector.on("collect", async (mci) => {
            await mci.deferReply();
            const { data } = await axios({
              url: `https://clouddata.scratch.mit.edu/logs?projectid=673753313&limit=40&offset=0`,
              responseType: "json",
              method: "get"
            });
            if (data.find(element => element.user === scratchName && element.value === uuid)) {
              mci.followUp("認証が完了しました！\n認証済スタジオもありますので是非お越しください～\nhttps://scratch.mit.edu/studios/31009600/");
              for (const role of config.verifiedRoles) {
                i.member.roles.add(role);
              };
              if (config.loggingChannel) {
                const log = [];
                if (config.logging.includes("scratch.username")) log.push({
                  name: "Scratchユーザー名",
                  value: `[${scratchName}](https://scratch.mit.edu/users/${scratchName})`
                });
                if (config.logging.includes("discord.tag")) log.push({
                  name: "Discordユーザー#タグ",
                  value: i.user.tag
                });
                if (config.logging.includes("discord.username")) log.push({
                  name: "Discordユーザー名",
                  value: i.user.username
                });
                if (config.logging.includes("discord.id")) log.push({
                  name: "DiscordID",
                  value: i.user.id
                });
                if (config.logging.includes("uuid")) log.push({
                  name: "検証用ID",
                  value: uuid
                });
                client.channels.cache.get(config.loggingChannel).send({
                  embeds: [{
                    title: "認証成功",
                    fields: log
                  }]
                })
              }
            } else {
              mci.followUp("まだキャッシュに反映されていないか、設定されていないようです。30秒後にもう一度お試しください。");
            }
          })
        }
      })
      .catch(e => {
        if (e.toString().includes("to this user")) return i.followUp("DMの送信ができません。DM設定を変更してください。");
      })
  }
});

process.on('uncaughtException', console.error)
client.login(process.env.BOT_TOKEN);
