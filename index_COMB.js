const express = require('express')
const { create, MessageMedia } = require('@open-wa/wa-automate')
const bodyParser = require('body-parser')

const app = express()
const PORT = 3030
const TOKEN_SECRETO =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzY29wZSIasdfgfdwefkVBRCIsIkassfwfrwsfgdRSIsIkNPQlYuUkVBRCIsIkNPQlYuV'

let client // para manter o cliente ativo fora do escopo da função

// Middleware
app.use(bodyParser.json())

create({
  sessionId: 'COMBC_RIVIERA',
  multiDevice: true,
  headless: true,
  qrTimeout: 0,
}).then((_client) => {
  client = _client
  console.log('🤖 Cliente do WhatsApp iniciado com sucesso!')
})

// Rota de envio de mensagem
app.post('/send-message', async (req, res) => {
  console.log(`📩 Requisição recebida para envio`)

  const authHeader = req.headers['authorization']

  if (!authHeader || authHeader !== `Bearer ${TOKEN_SECRETO}`) {
    console.log(`🔒 Acesso negado: token inválido`)
    return res.status(401).json({ error: 'Não autorizado: token inválido' })
  }

  const { number, message, fileUrl } = req.body

  if (!number || (!message && !fileUrl)) {
    console.log(`⚠️ Campos obrigatórios ausentes`)
    return res
      .status(400)
      .json({ error: 'Número e mensagem ou arquivo são obrigatórios' })
  }

  const chatId = number.includes('@c.us') ? number : `${number}@c.us`

  try {
    if (fileUrl) {
      const media = await MessageMedia.fromUrl(fileUrl)
      await client.sendFile(chatId, media.data, 'arquivo', message || '')
      console.log(`✅ Arquivo enviado para ${number}`)
      return res.status(200).json({ status: 'Arquivo enviado com sucesso!' })
    }

    await client.sendText(chatId, message)
    console.log(`✅ Mensagem enviada para ${number}`)
    return res.status(200).json({ status: 'Mensagem enviada com sucesso!' })
  } catch (err) {
    console.error('❌ Erro ao enviar:', err)
    return res.status(500).json({ error: 'Erro ao enviar mensagem ou arquivo' })
  }
})

// Inicializa servidor
app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`)
})
