const express = require('express')
const { create } = require('@open-wa/wa-automate')
const bodyParser = require('body-parser')

const filtroMensagens = require('./filtroMensagens_Convidados')
const cadastro = require('./cadastro_Convidados')

const { buscarConvidado, updateConvidado } = require('./functions_Convidados')

const TOKEN_SECRETO =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzY29wZSIasdfgfdwefkVBRCIsIkassfwfrwsfgdRSIsIkNPQlYuUkVBRCIsIkNPQlYuV'
const PORT = process.env.PORT || 3020

const app = express()
app.use(bodyParser.json())

let globalClient = null
const sessoesCadastro = {}

create({
  sessionId: 'session-Convidados',
  multiDevice: true,
  headless: true,
  qrTimeout: 0,
}).then((client) => {
  globalClient = client

  console.log('✅ Cliente do WhatsApp conectado.')

  client.onMessage(async (msg) => {
    const numero = msg.from
    const isGroup = msg.isGroupMsg
    if (!filtroMensagens(msg, { isGroup })) return

    //const etiquetas = await client.getChatLabels(numero)
    const chat = await client.getChatById(numero)
    const etiquetas = chat.labels || []

    if (etiquetas.includes('9')) {
      const telefoneEditado = numero.replace('@c.us', '').slice(2)
      const dadosConvidado = await buscarConvidado(telefoneEditado)
      const idEvento = dadosConvidado?.idEvento ?? null

      if (msg.body === '1') {
        await client.sendText(
          numero,
          `🎉 *Presença Confirmada!*

👤 *Convidado:* ${dadosConvidado.nomeConvidado}
👥 *Acompanhantes:* ${dadosConvidado.acompanhantes}
📅 *Data:* ${dadosConvidado.dataEvento}
⏰ *Horário:* ${dadosConvidado.horaEvento}`
        )
        await client.sendText(
          numero,
          `📩 *Seu Convite Digital está aqui!*
Apresente-o na entrada.`
        )
        await client.sendFileFromUrl(
          numero,
          `http://cliente.floratticerimonial.com.br/${dadosConvidado.qrcode}`,
          'qrcode.png'
        )
        await updateConvidado(telefoneEditado, 1, idEvento)
        await client.removeLabels(numero, ['9'])
      } else if (msg.body === '2') {
        await client.sendText(
          numero,
          `Entendido! Sua ausência foi registrada. 🌸`
        )
        await updateConvidado(telefoneEditado, 2, idEvento)
        await client.removeLabels(numero, ['9'])
      } else if (msg.body === '3') {
        await client.sendText(numero, `Sem pressa! Quando decidir, nos avise.`)
        await updateConvidado(telefoneEditado, 3, idEvento)
      } else {
        await client.sendText(numero, `❓ Responda com 1, 2 ou 3.`)
      }
    } else if (etiquetas.includes('10')) {
      await cadastro(msg, client, sessoesCadastro)
    } else {
      await client.sendText(
        numero,
        `📵 Este número não recebe mensagens. Entre em contato pelo telefone (27) 3035-6136.`
      )
    }
  })
})

app.post('/send-message', async (req, res) => {
  const { authorization } = req.headers
  if (authorization !== `Bearer ${TOKEN_SECRETO}`)
    return res.status(401).json({ error: 'Token inválido' })

  const { number, message, fileUrl, labelName } = req.body
  const chatId = number.includes('@c.us') ? number : `${number}@c.us`

  try {
    if (fileUrl) {
      await globalClient.sendFileFromUrl(chatId, fileUrl, 'file', message || '')
    } else {
      await globalClient.sendText(chatId, message)
    }

    if (labelName) {
      await globalClient.addLabel(chatId, labelName)
    }

    res.status(200).json({ status: 'Enviado com sucesso' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao enviar' })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`)
})
