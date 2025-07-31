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
    const contact = await client.getContact(msg.from)
    //const nomeContato = contact.name // notifyName não existe especificamente
    //const chat = await msg.getChat()
    const etiqueta = contact.labels || []
    const contato = contact
    const telefoneEditado = contato.id.replace('@c.us', '').slice(2)
    const dadosConvidado = await buscarConvidado(telefoneEditado)
    const idEvento = dadosConvidado?.idEvento ?? null

    //if (!filtroMensagens(msg, chat)) return

    const body = msg.body

    if (body === '1' && etiqueta.includes('9')) {
      if (!dadosConvidado) {
        await client.sendText(
          msg.from,
          'Convidado não encontrado com seu numero de telefone'
        )
        await client.removeLabels(msg.from, etiqueta)
      } else {
        const resposta = `🎉 *Presença Confirmada!*

👤 *Convidado:* ${dadosConvidado.nomeConvidado}
👥 *Acompanhantes:* ${dadosConvidado.acompanhantes}
📅 *Data do Evento:* ${dadosConvidado.dataEvento}
⏰ *Horário:* ${dadosConvidado.horaEvento}

✨ Obrigado por confirmar sua presença! Será um prazer ter você conosco neste momento tão especial.
🌸 Até lá!`
        await client.sendText(msg.from, resposta)

        const resposta2 = `📩 *Seu Convite Digital está aqui!*

Anexamos o QR Code do seu convite, que poderá ser utilizado para facilitar seu acesso ao evento.
Apresente-o na entrada para agilizar sua recepção. 💐
Qualquer dúvida, estamos à disposição.

🌸 Equipe Floratti Cerimonial`
        await client.sendText(msg.from, resposta2)

        const media = await MessageMedia.fromUrl(
          `http://cliente.floratticerimonial.com.br/${dadosConvidado.qrcode}`
        )
        await client.sendMedia(msg.from, media)

        await updateConvidado(telefoneEditado, 1, idEvento)
        await client.removeLabels(msg.from, etiqueta)
      }
    } else if (body === '2' && etiqueta.includes('9')) {
      const resposta = `👋 Oi, ${dadosConvidado.nomeConvidado}!

Vimos que você não poderá comparecer ao evento no dia *${dadosConvidado.dataEvento}*, às *${dadosConvidado.horaEvento}*.

Tudo certo, sua ausência foi anotada aqui e já organizamos tudo certinho por aqui, tá? 😊

Obrigada por avisar!
— Equipe Floratti Cerimonial 🌸`
      await client.sendText(msg.from, resposta)
      await updateConvidado(telefoneEditado, 2, idEvento)
      await client.removeLabels(msg.from, etiqueta)
    } else if (body === '3' && etiqueta.includes('9')) {
      const resposta = `👀 Opa, entendi que você ainda tá na dúvida, ${dadosConvidado.nomeConvidado}!

Sem pressa! Assim que tiver certeza sobre sua presença no evento do dia *${dadosConvidado.dataEvento}*, às *${dadosConvidado.horaEvento}*, é só nos avisar aqui mesmo. 😉

Estamos por aqui!
— Equipe Floratti Cerimonial 🌸`
      await client.sendText(msg.from, resposta)
      await updateConvidado(telefoneEditado, 3, idEvento)
    } else if (etiqueta.includes('9') && body != null) {
      const resposta = `🤔 Ops! Acho que não entendi sua resposta, ${dadosConvidado.nomeConvidado}.

Por favor, responda com um dos números abaixo pra gente confirmar direitinho:

1️⃣ – Sim, confirmo minha presença
2️⃣ – Infelizmente, não poderei comparecer
3️⃣ – Ainda não tenho certeza

Fico no aguardo! 💬
— Equipe Floratti Cerimonial 🌸`
      await client.sendText(msg.from, resposta)
    } else if (etiqueta.includes('10') && body != null) {
      const numero = msg.from

      if (!sessoesCadastro[numero]) {
        sessoesCadastro[numero] = { etapa: 'cpf', dados: {} }
      }
      const sessao = sessoesCadastro[numero]
      const texto = body.trim()

      if (texto.toLowerCase() === 'sair') {
        await client.removeLabels(msg.from, etiqueta)
        delete sessoesCadastro[numero]
        await client.sendText(
          numero,
          `🙋‍♂️ O atendimento automático de cadastro foi encerrado. Caso tenha mais dúvidas ou precise de suporte, estou à disposição! 👋`
        )
        return
      }

      switch (sessao.etapa) {
        case 'cpf': {
          const cpf = body.replace(/\D/g, '')
          if (!/^\d{11}$/.test(cpf) || !validarCPF(cpf)) {
            await client.sendText(
              numero,
              `❌ Opa! Esse CPF parece estar incorreto. Envie somente os 11 dígitos, sem pontos ou traços.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          try {
            const usuario = await buscarUsuarioPorCPF(cpf)
            sessao.dados.cpf = cpf
            sessao.existeUsuario = !!usuario
            if (usuario) {
              sessao.dados.nome = usuario.nome
              sessao.etapa = 'dataEvento'
              await client.sendText(
                numero,
                `✅ Identificamos que este CPF já está vinculado ao nome: *${usuario.nome}*.`
              )
              await client.sendText(
                numero,
                '📅 Vamos lá! Me envie a data do evento no formato DD/MM/AAAA (ex: 15/08/2025), por favor.'
              )
            } else {
              sessao.etapa = 'nome'
              await client.sendText(
                numero,
                '✅ Obrigado por informar seu CPF! Agora me envie seu *nome completo*, por favor.'
              )
            }
          } catch (e) {
            await client.sendText(
              numero,
              `⚠️ Ocorreu um erro ao consultar o CPF. Por favor, tente novamente mais tarde.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            delete sessoesCadastro[numero]
          }
          return
        }
        case 'nome': {
          if (!texto) {
            await client.sendText(
              numero,
              `❌ Ops! O nome não pode estar em branco. Por favor, digite seu nome.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.nome = texto
          sessao.etapa = 'nascimento'
          await client.sendText(
            numero,
            '📅 Qual é a sua *data de nascimento*? Envie no formato DD/MM/AAAA (ex: 04/05/1989), por favor.'
          )
          return
        }
        case 'nascimento': {
          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
            await client.sendText(
              numero,
              `❌ Formato inválido. Use DD/MM/AAAA (ex: 04/05/1989).
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          const [d, m, y] = texto.split('/').map(Number)
          const dn = new Date(y, m - 1, d)
          if (
            dn.getDate() !== d ||
            dn.getMonth() !== m - 1 ||
            dn.getFullYear() !== y
          ) {
            await client.sendText(
              numero,
              '❌ Data inválida. Verifique se digitou corretamente.\nUse o formato DD/MM/AAAA.'
            )
            return
          }
          const hoje = new Date()
          const idade =
            hoje.getFullYear() -
            y -
            (hoje.getMonth() + 1 < m ||
            (hoje.getMonth() + 1 === m && hoje.getDate() < d)
              ? 1
              : 0)
          if (idade < 18) {
            await client.sendText(
              numero,
              '❌ Você precisa ter pelo menos 18 anos para continuar.'
            )
            return
          }
          sessao.dados.nascimento = texto
          sessao.etapa = 'sexo'
          await client.sendText(
            numero,
            '🚻 Informe seu *sexo* Responda com:\n\n1.*Masculino*\n2.*Feminino*'
          )
          return
        }
        case 'sexo': {
          let sexoFormatado = ''
          if (texto === '1') sexoFormatado = 'M'
          else if (texto === '2') sexoFormatado = 'F'
          else {
            await client.sendText(
              numero,
              `❌ Opção inválido. Responda com numero:
\n1.*Masculino*
\n2.*Feminino*
\nSe quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.sexo = sexoFormatado
          sessao.etapa = 'email'
          await client.sendText(
            numero,
            '✉️ Me passa seu e-mail pra gente enviar as notas fiscais, ok?'
          )
          return
        }
        case 'email': {
          const em = texto
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            await client.sendText(
              numero,
              `❌ E-mail inválido. Por favor, envie um e-mail válido para garantir o envio das suas notas fiscais.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.email = em
          sessao.etapa = 'cep'
          await client.sendText(
            numero,
            '🏡 Por favor, envie seu CEP com apenas números, sem pontos ou traços, por exemplo: 29124368.'
          )
          return
        }
        case 'cep': {
          const cep = texto.replace(/\D/g, '')
          if (!/^\d{8}$/.test(cep)) {
            await client.sendText(
              numero,
              `❌ CEP inválido. Envie apenas os 8 dígitos, por exemplo: 29124368.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          try {
            const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`)
            if (res.data.erro) {
              sessao.dados.cep = cep
              sessao.etapa = 'rua'
              await client.sendText(
                numero,
                '🔍 Não foi possível localizar o endereço pelo CEP. Informe o *Nome da rua*.'
              )
            } else {
              sessao.dados.cep = cep
              sessao.dados.rua = res.data.logradouro
              sessao.dados.bairro = res.data.bairro
              sessao.dados.cidade = res.data.localidade
              sessao.etapa = 'confirmar_endereco'
              await client.sendText(
                numero,
                `📍 Endereço encontrado:

*Rua:* ${res.data.logradouro}
*Bairro:* ${res.data.bairro}
*Cidade:* ${res.data.localidade} - ${res.data.uf}

Está correto? (Responda com *Sim* ou *Não*)`
              )
            }
          } catch (err) {
            sessao.etapa = 'rua'
            await client.sendText(
              numero,
              '❌ Erro ao consultar o CEP. Por favor, Informe o *Nome da rua*.'
            )
          }
          return
        }
        case 'confirmar_endereco': {
          if (texto.toLowerCase() === 'sim') {
            sessao.etapa = 'numeroResi'
            await client.sendText(
              numero,
              '🏠 Informe o *número da residência*.'
            )
          } else if (
            texto.toLowerCase() === 'não' ||
            texto.toLowerCase() === 'nao'
          ) {
            sessao.etapa = 'rua'
            await client.sendText(numero, '📍 Informe o *Nome da rua*.')
          } else {
            await client.sendText(
              numero,
              `❌ Responda apenas com *Sim* ou *Não*, por favor.
Se quiser encerrar o atendimento, digite SAIR.`
            )
          }
          return
        }
        case 'numeroResi': {
          if (!texto) {
            await client.sendText(
              numero,
              `❌ Número não pode estar vazio. Se sua residência não tiver número, digite SN.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.numeroResidencia = texto
          sessao.etapa = 'dataEvento'
          await client.sendText(
            numero,
            '📅 E quando vai ser esse evento especial? Me manda a data assim: DD/MM/AAAA (ex: 04/06/2027).'
          )
          return
        }
        case 'rua': {
          if (!texto) {
            await client.sendText(
              numero,
              `❌ Opa! Preciso que você informe o nome da rua pra continuar.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.rua = texto
          sessao.etapa = 'numeroResidencia'
          await client.sendText(numero, '🏠 Informe o *número da residência*.')
          return
        }
        case 'numeroResidencia': {
          if (!texto) {
            await client.sendText(
              numero,
              `❌ Número não pode estar vazio. Se sua residência não tiver número, digite SN.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.numeroResidencia = texto
          sessao.etapa = 'bairro'
          await client.sendText(numero, '🏘️ Informe o seu *bairro*.')
          return
        }
        case 'bairro': {
          if (!texto) {
            await client.sendText(
              numero,
              `❌ Opa! Preciso que você informe o *bairro*.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.bairro = texto
          sessao.etapa = 'cidade'
          await client.sendText(numero, '🏙️ Informe a sua *cidade*.')
          return
        }
        case 'cidade': {
          if (!texto) {
            await client.sendText(
              numero,
              `❌ Opa! Preciso que você informe a *Cidade* (EX: Vila Velha).
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.cidade = texto
          sessao.etapa = 'dataEvento'
          await client.sendText(
            numero,
            '📅 E quando vai ser esse evento especial? Me manda a data assim: DD/MM/AAAA (ex: 04/06/2027).'
          )
          return
        }
        case 'dataEvento': {
          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
            await client.sendText(
              numero,
              `❌ Formato inválido. Use DD/MM/AAAA (ex: 04/05/1989).
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          const [dd, mm, yyyy] = texto.split('/')
          const dataEvento = new Date(`${yyyy}-${mm}-${dd}T00:00:00`)
          const hoje = new Date()
          hoje.setHours(0, 0, 0, 0)
          if (dataEvento <= hoje) {
            await client.sendText(
              numero,
              `❌ A data do evento deve ser a partir de *amanhã*. Informe uma nova data.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          const eventoExistente = await buscarEventoPorData(
            `${yyyy}-${mm}-${dd}`
          )
          if (eventoExistente) {
            await client.sendText(
              numero,
              `⚠️ Já existe um evento agendado para *${texto}*.
Por favor, envie outra data disponível ou se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.dataEvento = texto
          sessao.etapa = 'horaEvento'
          await client.sendText(
            numero,
            '⏰ Que horas vai começar seu evento? Me envie no formato HH:MM (ex: 19:30).'
          )
          return
        }
        case 'horaEvento': {
          if (!/^\d{2}:\d{2}$/.test(texto)) {
            await client.sendText(
              numero,
              `❌ Horário inválido. Use o formato HH:MM — por exemplo, se o evento começa às 7 e meia da noite, informe 19:30.
Se quiser encerrar o atendimento, digite SAIR.`
            )
            return
          }
          sessao.dados.horaEvento = texto
          sessao.etapa = 'duracaoEvento'
          await client.sendText(
            numero,
            '🕒 E a festa vai durar quanto tempo? Me diz em horas (ex: 4).'
          )
          return
        }
        case 'duracaoEvento': {
          const hrs = parseInt(texto)
          if (isNaN(hrs) || hrs < 4 || hrs > 6) {
            await client.sendText(
              numero,
              `❌ Duração inválida. Envie um número entre *4 e 6 horas*.
Se quiser encerrar o atendimento, digite *SAIR*.`
            )
            return
          }
          sessao.dados.duracaoEvento = hrs
          sessao.etapa = 'tipoEvento'
          await client.sendText(
            numero,
            `👥 Por favor, selecione o tipo de evento:
1. Aniversário Infantil
2. Aniversário
3. 15 Anos
4. Chá Revelação
5. Chá de Bebê
6. Casamento
7. Noivado
8. Lazer`
          )
          return
        }
        case 'tipoEvento': {
          const op = parseInt(texto)
          const opcoesEvento = [
            'Aniversário Infantil',
            'Aniversário',
            '15 Anos',
            'Chá Revelação',
            'Chá de Bebê',
            'Casamento',
            'Noivado',
            'Lazer',
          ]
          if (isNaN(op) || op < 1 || op > opcoesEvento.length) {
            await client.sendText(
              numero,
              `❌ Opção inválida! Por favor, escolha um número de 1 a 8 referente ao tipo de evento:
${opcoesEvento.map((x, i) => `${i + 1}. ${x}`).join('\n')}`
            )
            return
          }
          sessao.dados.tipo = opcoesEvento[op - 1]
          sessao.etapa = 'qtdConvidados'
          await client.sendText(
            numero,
            `👀 Tipo de evento selecionado: *${sessao.dados.tipo}*
Agora, me diga: quantas pessoas você está esperando para a festa?`
          )
          return
        }
        case 'qtdConvidados': {
          const qtd = parseInt(texto)
          if (isNaN(qtd) || qtd <= 0) {
            await client.sendText(
              numero,
              `❌ Quantidade inválida. Envie um número maior que 0.
Se quiser encerrar o atendimento, digite *SAIR*.`
            )
            return
          }
          if (qtd > 200) {
            await client.sendText(
              numero,
              `⚠️ A lotação máxima do nosso espaço é de *200 convidados*. Por favor, envie um número igual ou menor que 200.`
            )
            return
          }
          sessao.dados.qtdConvidados = qtd
          sessao.etapa = 'confirmacaoDados'
          const dados = sessao.dados
          const resumo = sessao.existeUsuario
            ? `✅ Confere pra mim: seus dados estão certinhos?\n\n🧾 *Dados de seu evento:*\nNome: ${dados.nome}\nEvento: ${dados.dataEvento} às ${dados.horaEvento}\nTipo: ${dados.tipo}\nDuração: ${dados.duracaoEvento} horas\nConvidados: ${dados.qtdConvidados}`
            : `✅ Confere pra mim: seus dados estão certinhos? 🎉\n\n🧾 *Seus dados pessoais:*\nNome: ${dados.nome}\nCPF: ${dados.cpf}\nSexo: ${dados.sexo}\nE-mail: ${dados.email}\nCEP: ${dados.cep}\nEndereço: ${dados.rua}, ${dados.numeroResidencia}, ${dados.bairro}, ${dados.cidade}-ES\n🧾 *Dados de seu evento:*\nEvento: ${dados.dataEvento} às ${dados.horaEvento}\nDuração: ${dados.duracaoEvento} horas\nConvidados: ${dados.qtdConvidados}`
          await client.sendText(numero, resumo)
          return
        }
        case 'confirmacaoDados': {
          const resp = texto.toLowerCase()
          if (resp === 'sim') {
            try {
              if (sessao.existeUsuario) {
                const idCliente = await buscarIdClientePorCpf(sessao.dados.cpf)
                if (idCliente) {
                  sessao.dados.idCliente = idCliente
                  await salvarCadastroNoBancoEvento(sessao.dados)
                  await client.sendText(
                    numero,
                    '✅ Seu evento foi salvo com sucesso no nosso sistema! 🎉'
                  )
                }
              } else {
                sessao.dados.numero = numero
                await cadastrarUsuarioEEvento(sessao.dados)
                await client.sendText(
                  numero,
                  '✅ Seus dados foram salvos com sucesso no nosso sistema! 🎉'
                )
              }
              await client.sendText(
                numero,
                '✅ Cadastro finalizado com sucesso! 🎉'
              )
              await client.removeLabels(msg.from, etiqueta)
              delete sessoesCadastro[numero]
            } catch (err) {
              await client.sendText(
                numero,
                `⚠️ Ocorreu um erro ao salvar seus dados. Por favor, tente novamente mais tarde.`
              )
            }
          } else if (resp === 'não' || resp === 'nao') {
            await client.sendText(
              numero,
              `❌ Cadastro cancelado. Obrigado e tenha um excelente dia!`
            )
            await client.sendText(
              numero,
              `🙋‍♂️ O atendimento automático de cadastro foi encerrado. Caso tenha mais dúvidas ou precise de suporte, estou à disposição! 👋`
            )
            await client.removeLabels(msg.from, etiqueta)
            delete sessoesCadastro[numero]
          } else {
            await client.sendText(
              numero,
              `❓ Por favor, responda apenas com *sim* para confirmar ou *não* para cancelar.`
            )
          }
          return
        }
      }
    } else if (body != null) {
      const resposta = `📵 Este número não recebe chamadas ou mensagens.
Para dúvidas ou atendimento, entre em contato com a equipe do Floratti Cerimonial pelo telefone: (27) 3035-6136
Agradecemos a compreensão! 💐`
      await client.sendText(msg.from, resposta)
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
