const {
  Client,
  Intents,
  Permissions,
  MessageButton,
  MessageEmbed,
  MessageActionRow,
  MessageCollector,
  Message
} = require('discord.js')
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES
  ],
  partials: ['CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION', 'USER'],
  restTimeOffset: 50
})
const config = require('./config.json')

// https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Math/random
const getRandomInt = (min, max) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min) + min)
}

/**
 * クラウド変数でユーザーを認証する。
 * @param {string} id ID
 * @param {string} username ユーザー名
 * @returns {Promise<boolean>} ユーザーは変数を設定したかどうか
 */
async function verifyByCloudVariable(id, username) {
  const req = await fetch(
    `https://clouddata.scratch.mit.edu/logs?projectid=${config.projectId}&limit=40&offset=0`
  )
  const json = await req.json()
  if (!Array.isArray(json)) throw new Error('Invalid JSON format')
  return json.some(element => element.user === username && element.value === id)
}
/**
 * スタジオコメントでユーザーを認証する。
 * @param {string} discordUsername Discord ユーザー名
 * @param {string} username ユーザー名
 * @returns {Promise<boolean>} ユーザーはコメントしたかどうか
 */
async function verifyByComment(discordUsername, username) {
  const req = await fetch(
    `https://api.scratch.mit.edu/studios/${config.studioId}/comments?offset=0&limit=40`
  )
  const json = await req.json()
  if (!Array.isArray(json)) throw new Error('Invalid JSON format')
  return json.some(
    element =>
      element.author.username === username &&
      element.content === `${discordUsername}です。よろしくお願いします。`
  )
}

require('dotenv').config()

client.on('ready', bot => {
  console.log(`Logged in as ${client.user.tag}.`)
  setTimeout(() =>
    bot.user.setActivity(
      `${client.ws.ping}ms | Node.js ${process.version}`,
      5000
    )
  )
})

client.on('messageCreate', message => {
  if (
    message.content === '!scratchauth' &&
    message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
  ) {
    const embed = new MessageEmbed()
      .setTitle('Scratch 認証')
      .setDescription(
        '🦖 下のボタンを押して、ScratchのアカウントとDiscordアカウントの紐付けを開始してください。'
      )
      .setColor('GREEN')
    const button = new MessageButton()
      .setCustomId('verify')
      .setStyle('SUCCESS')
      .setLabel('認証')
    message.channel.send({
      embeds: [embed],
      components: [new MessageActionRow().addComponents(button)]
    })
  }
})

client.on('interactionCreate', async i => {
  if (!i.isButton()) return
  if (i.customId === 'verify') {
    await i.deferReply({ ephemeral: true })
    let msg
    try {
      msg = await i.member.send('😎 あなたのScratchユーザー名を送信してください。')
    } catch (e) {
      if (e.toString().includes('to this user'))
        return i.followUp('❌ DMの送信ができません。DM設定を変更し、もう一度お試しください。')
    }
    await i.followUp('🤔 DMを確認してください。')
    /**
     *
     * @param {any} mci
     */
    async function finish(mci) {
      await mci.followUp(
        `🎉 認証が完了しました！\n認証済スタジオもありますので是非お越しください～\nhttps://scratch.mit.edu/studios/${config.studioId}/`
      )
      i.member.roles.push(...config.verifiedRoles)
      if (config.loggingChannel) {
        const log = []
        if (config.logging.includes('scratch.username'))
          log.push({
            name: 'Scratchユーザー名',
            value: `[${scratchName}](https://scratch.mit.edu/users/${scratchName})`
          })
        if (config.logging.includes('discord.tag'))
          log.push({
            name: 'Discordユーザー#タグ',
            value: i.user.tag
          })
        if (config.logging.includes('discord.username'))
          log.push({
            name: 'Discordユーザー名',
            value: i.user.username
          })
        if (config.logging.includes('discord.id'))
          log.push({
            name: 'DiscordID',
            value: i.user.id
          })
        if (config.logging.includes('uuid'))
          log.push({
            name: '検証用ID',
            value: id
          })
        client.channels.cache.get(config.loggingChannel).send({
          embeds: [
            {
              title: '認証成功',
              fields: log
            }
          ]
        })
        collector.stop()
      }
    }
    /**
     *
     * @param {Message} message メッセージ
     * @param {string} username Scratch ユーザー名
     */
    function handleButton2(message, username) {
      const collector = message.createMessageComponentCollector()
      collector.on('collect', async mci => {
        await mci.deferReply()
        try {
          if (await verifyByComment(i.member.username, username)) {
            collector.stop()
            return finish(mci)
          } else {
            return mci.followUp(
              '❌ まだキャッシュに反映されていないか、コメントされていないようです。30秒後にもう一度お試しください。'
            )
          }
        } catch (e) {
          console.error(e)
          return mci.followUp(
            '❌ エラーが発生しました。時間が経ったらもう一度お試しください。'
          )
        }
      })
    }
    /**
     * @param {Message} message メッセージ
     * @param {string} id ID
     * @param {string} username Scratch ユーザー名
     */
    function handleButton(message, id, username) {
      const collector = message.createMessageComponentCollector()
      collector.on('collect', async mci => {
        await mci.deferReply()
        switch (mci.customId) {
          case 'verify': {
            try {
              if (await verifyByCloudVariable(id, username)) {
                collector.stop()
                return finish(mci)
              } else {
                return mci.followUp(
                  '❌ まだキャッシュに反映されていないか、設定されていないようです。30秒後にもう一度お試しください。'
                )
              }
            } catch (e) {
              console.error(e)
              return mci.followUp(
                '❌ エラーが発生しました。時間が経ったらもう一度お試しください。'
              )
            }
          }
          case 'other': {
            collector.stop()
            const callback = new MessageButton()
              .setCustomId('auth')
              .setStyle('SUCCESS')
              .setLabel('コメントしました')
            await message.edit({
              content: `⭐ おや、New Scratcher の方ですね！\nこのスタジオ (https://scratch.mit.edu/studios/${config.studioId}/) に以下のコメントを送ってください。`,
              embeds: [
                {
                  description: `\`\`\`\n${i.member.username}です。よろしくお願いします。\n\`\`\``
                }
              ],
              components: [new MessageActionRow().addComponents(callback)]
            })
            return handleButton2(message, username)
          }
        }
        return mci.followUp('無効な操作です。')
      })
    }
    /**
     *
     * @type {MessageCollector}
     */
    const collector = msg.channel.createMessageCollector({
      filter: m => m.author.id === i.user.id
    })
    collector.on('collect', async m => {
      const am = await m.channel.send(
        'ユーザー名を確認しています。<a:load:918373770241138708>'
      )
      try {
        const req = await fetch(
          `https://api.scratch.mit.edu/users/${encodeURIComponent(
            m.cleanContent
          )}`
        )
        const json = await req.json()
        if (json?.code !== 'NotFound') {
          const callback = new MessageButton()
            .setCustomId('auth')
            .setStyle('SUCCESS')
            .setLabel('プロジェクトに入力しました')
          const other = new MessageButton()
            .setCustomId('other')
            .setStyle('PRIMARY')
            .setLabel('クラウド変数が使えない')
          collector.stop()
          const id = `${getRandomInt(1e9, 1e10 - 1).toString()}`
          await am.edit({
            content: `😎 ${json.username} さん、いらしゃいませ！\n次に、下のコード(\`XXXXXXXXX\`形式)を、https://scratch.mit.edu/projects/${config.projectId}/fullscreen/ に入力してください。`,
            embeds: [
              {
                description: `\`\`\`\n${id}\n\`\`\``
              }
            ],
            components: [
              new MessageActionRow()
                .addComponents(callback)
                .addComponents(other)
            ]
          })
          return handleButton(am, json.username)
        } else {
          return am.edit(
            '❌ Scratchユーザーが存在しません。正しいユーザー名を入力してください。'
          )
        }
      } catch (e) {
        console.error(e)
        return am.edit(
          '❌ APIにいくつかの問題が発生したようです。時間が経ったらもう一度お試しください。'
        )
      }
    })
  }
})

process.on('uncaughtException', console.error)
client.login(process.env.TOKEN)
