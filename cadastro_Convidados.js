//Declaração de variaveis
const numero = msg.from
if (!sessoesCadastro[numero]) {
  sessoesCadastro[numero] = {
    etapa: 'cpf',
    dados: {},
  }
  await client.sendMessage(
    numero,
    '📝 Olá! Vamos começar seu cadastro. Por favor, informe seu *CPF* (apenas números).'
  )
  return
}

const sessao = sessoesCadastro[numero]

//Condição para sair do atendimento de cadastro
if (msg.body.trim().toLowerCase() === 'sair') {
  await chat.changeLabels([])
  delete sessoes[numero]
  await client.sendMessage(
    numero,
    '🙋‍♂️ O atendimento automático de cadastro foi encerrado. Caso tenha mais dúvidas ou precise de suporte, estou à disposição! 👋'
  )
  return
}

//Iniciando a sessão de cadastro
switch (sessao.etapa) {
  //Tratamento para o CPF digitado
  case 'cpf':
    const cpf = msg.body.replace(/\D/g, '')

    if (!/^\d{11}$/.test(cpf)) {
      await client.sendMessage(
        numero,
        '❌ Opa! Esse CPF parece estar incorreto. Envie somente os 11 dígitos, sem pontos ou traços.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

    if (!validarCPF(cpf)) {
      await client.sendMessage(
        numero,
        '❌ Opa! Esse CPF parece estar incorreto. Dá uma conferida e tenta novamente, por favor.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

    try {
      const usuario = await buscarUsuarioPorCPF(cpf)
      sessao.dados.cpf = cpf
      sessao.existeUsuario = !!usuario

      if (usuario) {
        await client.sendMessage(
          numero,
          `✅ Identificamos que este CPF já está vinculado ao nome: *${usuario.nome}*.`
        )
        sessao.etapa = 'dataEvento'
        console.log(usuario)
        sessao.dados.nome = usuario.nome
        await client.sendMessage(
          numero,
          '📅 Vamos lá! Me envie a data do evento no formato DD/MM/AAAA (ex: 15/08/2025), por favor.'
        )
      } else {
        sessao.etapa = 'nome'
        await client.sendMessage(
          numero,
          '✅ Obrigado por informar seu CPF! Agora me envie seu *nome completo*, por favor.'
        )
      }
      return
    } catch (e) {
      await client.sendMessage(
        numero,
        '⚠️ Ocorreu um erro ao consultar o CPF. Por favor, tente novamente mais tarde.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      delete sessoesCadastro[numero]
      return
    }

  case 'nome':
    if (!msg.body.trim()) {
      await client.sendMessage(
        numero,
        '❌ Ops! O nome não pode estar em branco. Por favor, digite seu nome.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.nome = msg.body.trim()
    sessao.etapa = 'nascimento'
    await client.sendMessage(
      numero,
      '📅 Qual é a sua *data de nascimento*? Envie no formato DD/MM/AAAA (ex: 04/05/1989), por favor.'
    )
    return

  case 'nascimento':
    const nascimentoInput = msg.body.trim()

    // Verifica o formato DD/MM/AAAA
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(nascimentoInput)) {
      await client.sendMessage(
        numero,
        '❌ Formato inválido. Use DD/MM/AAAA (ex: 04/05/1989).\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

    // Quebra a data e cria objeto
    const [diaNasc, mesNasc, anoNasc] = nascimentoInput.split('/').map(Number)
    const dataNascimento = new Date(anoNasc, mesNasc - 1, diaNasc)
    const hojeData = new Date()

    // Verifica se a data é válida
    if (
      dataNascimento.getDate() !== diaNasc ||
      dataNascimento.getMonth() !== mesNasc - 1 ||
      dataNascimento.getFullYear() !== anoNasc
    ) {
      await client.sendMessage(
        numero,
        '❌ Data inválida. Verifique se digitou corretamente.\nUse o formato DD/MM/AAAA.'
      )
      return
    }

    // Verifica idade mínima (18 anos)
    const idade = hojeData.getFullYear() - anoNasc
    const mesAtual = hojeData.getMonth() + 1
    const diaAtual = hojeData.getDate()

    const aniversarioEsteAno =
      mesAtual > mesNasc || (mesAtual === mesNasc && diaAtual >= diaNasc)

    const idadeFinal = aniversarioEsteAno ? idade : idade - 1

    if (idadeFinal < 18) {
      await client.sendMessage(
        numero,
        '❌ Você precisa ter pelo menos 18 anos para continuar.'
      )
      return
    }

    // Se passou na validação
    sessao.dados.nascimento = nascimentoInput
    sessao.etapa = 'sexo'
    await client.sendMessage(
      numero,
      '🚻 Informe seu *sexo* Responda com:\n\n1.*Masculino*\n2.*Feminino*'
    )
    return

  case 'sexo':
    const s = msg.body.trim()
    let sexoFormatado = ''

    if (s === '1') {
      sexoFormatado = 'M'
    } else if (s === '2') {
      sexoFormatado = 'F'
    } else {
      await client.sendMessage(
        numero,
        '❌ Opção inválido. Responda com numero:\n\n1.*Masculino*\n2.*Feminino*\n\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

    sessao.dados.sexo = sexoFormatado
    sessao.etapa = 'email'
    await client.sendMessage(
      numero,
      '✉️ Me passa seu e-mail pra gente enviar as notas fiscais, ok?'
    )
    return

  case 'email':
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.body.trim())) {
      await client.sendMessage(
        numero,
        '❌ E-mail inválido. Por favor, envie um e-mail válido para garantir o envio das suas notas fiscais.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.email = msg.body.trim()
    sessao.etapa = 'cep'
    await client.sendMessage(
      numero,
      '🏡 Por favor, envie seu CEP com apenas números, sem pontos ou traços, por exemplo: 29124368.'
    )
    return

  case 'cep':
    const cepDigitado = msg.body.trim().replace(/\D/g, '')

    // Verifica se é um CEP válido (8 dígitos)
    if (!/^\d{8}$/.test(cepDigitado)) {
      await client.sendMessage(
        numero,
        '❌ CEP inválido. Envie apenas os 8 dígitos, por exemplo: 29124368.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

    try {
      const resposta = await axios.get(
        `https://viacep.com.br/ws/${cepDigitado}/json/`
      )

      if (resposta.data.erro) {
        // CEP não encontrado
        sessao.dados.cep = cepDigitado
        sessao.etapa = 'rua'
        await client.sendMessage(
          numero,
          '🔍 Não foi possível localizar o endereço pelo CEP. Informe o *Nome da rua*.'
        )
        return
      }

      const { logradouro, bairro, localidade, uf } = resposta.data

      sessao.dados.cep = cepDigitado
      sessao.dados.rua = logradouro
      sessao.dados.bairro = bairro
      sessao.dados.cidade = localidade

      sessao.etapa = 'confirmar_endereco'
      await client.sendMessage(
        numero,
        `📍 Endereço encontrado:\n\n*Rua:* ${logradouro}\n*Bairro:* ${bairro}\n*Cidade:* ${localidade} - ${uf}\n\nEstá correto? (Responda com *Sim* ou *Não*)`
      )
    } catch (erro) {
      console.error('Erro ao buscar CEP:', erro)
      sessao.etapa = 'rua'
      await client.sendMessage(
        numero,
        '❌ Erro ao consultar o CEP. Por favor, Informe o *Nome da rua*.'
      )
    }
    return

  case 'confirmar_endereco':
    const respostaConfirmacao = msg.body.trim().toLowerCase()

    if (respostaConfirmacao === 'sim') {
      sessao.etapa = 'numeroResi'
      await client.sendMessage(numero, '🏠 Informe o *número da residência*.')
      return
    } else if (respostaConfirmacao === 'não' || respostaConfirmacao === 'nao') {
      sessao.etapa = 'rua'
      await client.sendMessage(numero, '📍 Informe o *Nome da rua*.')
      return
    } else {
      await client.sendMessage(
        numero,
        '❌ Responda apenas com *Sim* ou *Não*, por favor.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

  case 'numeroResi':
    if (!msg.body.trim()) {
      await client.sendMessage(
        numero,
        '❌ Número não pode estar vazio. Se sua residência não tiver número, digite SN.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.numeroResidencia = msg.body.trim()
    sessao.etapa = 'dataEvento'
    await client.sendMessage(
      numero,
      '📅 E quando vai ser esse evento especial? Me manda a data assim: DD/MM/AAAA (ex: 04/06/2027).'
    )
    return

  case 'rua':
    if (!msg.body.trim()) {
      await client.sendMessage(
        numero,
        '❌ Opa! Preciso que você informe o nome da rua pra continuar.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.rua = msg.body.trim()
    sessao.etapa = 'numeroResidencia'
    await client.sendMessage(numero, '🏠 Informe o *número da residência*.')
    return

  case 'numeroResidencia':
    if (!msg.body.trim()) {
      await client.sendMessage(
        numero,
        '❌ Número não pode estar vazio. Se sua residência não tiver número, digite SN.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.numeroResidencia = msg.body.trim()
    sessao.etapa = 'bairro'
    await client.sendMessage(numero, '🏘️ Informe o seu *bairro*.')
    return

  case 'bairro':
    if (!msg.body.trim()) {
      await client.sendMessage(
        numero,
        '❌ Opa! Preciso que você informe o *bairro*.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.bairro = msg.body.trim()
    sessao.etapa = 'cidade'
    await client.sendMessage(numero, '🏙️ Informe a sua *cidade*.')
    return

  case 'cidade':
    if (!msg.body.trim()) {
      await client.sendMessage(
        numero,
        '❌ Opa! Preciso que você informe a *Cidade* (EX: Vila Velha).\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.cidade = msg.body.trim()
    sessao.etapa = 'dataEvento'
    await client.sendMessage(
      numero,
      '📅 E quando vai ser esse evento especial? Me manda a data assim: DD/MM/AAAA (ex: 04/06/2027).'
    )
    return

  case 'dataEvento':
    const dataInformada = msg.body.trim()

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataInformada)) {
      await client.sendMessage(
        numero,
        '❌ Formato inválido. Use DD/MM/AAAA (ex: 04/05/1989).\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

    const [dia, mes, ano] = dataInformada.split('/')
    const dataFormatada = `${ano}-${mes}-${dia}`

    // Verifica se a data é maior que hoje
    const hoje = new Date()
    const dataEvento = new Date(`${ano}-${mes}-${dia}T00:00:00`)

    // Zera horas de hoje para comparar corretamente
    hoje.setHours(0, 0, 0, 0)

    if (dataEvento <= hoje) {
      await client.sendMessage(
        numero,
        '❌ A data do evento deve ser a partir de *amanhã*. Informe uma nova data.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }

    const eventoExistente = await buscarEventoPorData(dataFormatada)

    if (eventoExistente) {
      await client.sendMessage(
        numero,
        `⚠️ Já existe um evento agendado para *${dataInformada}*.\nPor favor, envie outra data disponível ou se quiser encerrar o atendimento, digite SAIR.`
      )
      return
    }

    // Continua o fluxo data disponivel
    sessao.dados.dataEvento = dataInformada
    sessao.etapa = 'horaEvento'
    await client.sendMessage(
      numero,
      '⏰ Que horas vai começar seu evento? Me envie no formato HH:MM (ex: 19:30).'
    )
    return

  case 'horaEvento':
    if (!/^\d{2}:\d{2}$/.test(msg.body.trim())) {
      await client.sendMessage(
        numero,
        '❌ Horário inválido. Use o formato HH:MM — por exemplo, se o evento começa às 7 e meia da noite, informe 19:30.\nSe quiser encerrar o atendimento, digite SAIR.'
      )
      return
    }
    sessao.dados.horaEvento = msg.body.trim()
    sessao.etapa = 'duracaoEvento'
    await client.sendMessage(
      numero,
      '🕒 E a festa vai durar quanto tempo? Me diz em horas (ex: 4).'
    )
    return

  case 'duracaoEvento':
    const horas = parseInt(msg.body.trim())

    if (isNaN(horas) || horas < 4 || horas > 6) {
      await client.sendMessage(
        numero,
        '❌ Duração inválida. Envie um número entre *4 e 6 horas*.\nSe quiser encerrar o atendimento, digite *SAIR*.'
      )
      return
    }

    sessao.dados.duracaoEvento = horas
    sessao.etapa = 'tipoEvento'
    await client.sendMessage(
      numero,
      '👥 Por favor, selecione o tipo de evento:\n\n1. Aniversário Infantil\n2. Aniversário\n3. 15 Anos\n4. Chá Revelação\n5. Chá de Bebê\n6. Casamento\n7. Noivado\n8. Lazer'
    )
    return

  case 'tipoEvento':
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

    const escolha = parseInt(msg.body.trim())

    // Verifica se a escolha é válida
    if (isNaN(escolha) || escolha < 1 || escolha > opcoesEvento.length) {
      await client.sendMessage(
        numero,
        '❌ Opção inválida! Por favor, escolha um número de 1 a 8 referente ao tipo de evento:\n\n' +
          opcoesEvento.map((op, i) => `${i + 1}. ${op}`).join('\n')
      )
      return
    }

    const tipoSelecionado = opcoesEvento[escolha - 1]
    sessao.dados.tipo = tipoSelecionado
    sessao.etapa = 'qtdConvidados'

    await client.sendMessage(
      numero,
      `👀 Tipo de evento selecionado: *${tipoSelecionado}*\n\nAgora, me diga: quantas pessoas você está esperando para a festa?`
    )
    return

  case 'qtdConvidados':
    const qtd = parseInt(msg.body.trim())

    if (isNaN(qtd) || qtd <= 0) {
      await client.sendMessage(
        numero,
        '❌ Quantidade inválida. Envie um número maior que 0.\nSe quiser encerrar o atendimento, digite *SAIR*.'
      )
      return
    }

    if (qtd > 200) {
      await client.sendMessage(
        numero,
        '⚠️ A lotação máxima do nosso espaço é de *200 convidados*. Por favor, envie um número igual ou menor que 200.'
      )
      return
    }

    sessao.dados.qtdConvidados = qtd
    sessao.etapa = 'confirmacaoDados'

    if (sessao.existeUsuario) {
      await client.sendMessage(
        numero,
        `✅ Confere pra mim: seus dados estão certinhos?\n\n🧾 *Dados de seu evento:*\nNome: ${sessao.dados.nome}\nEvento: ${sessao.dados.dataEvento} às ${sessao.dados.horaEvento}\nTipo: ${sessao.dados.tipo}\nDuração: ${sessao.dados.duracaoEvento} horas\nConvidados: ${sessao.dados.qtdConvidados}`
      )
    } else {
      await client.sendMessage(
        numero,
        `✅ Confere pra mim: seus dados estão certinhos? 🎉\n\n🧾 *Seus dados pessoais:*\nNome: ${sessao.dados.nome}\nCPF: ${sessao.dados.cpf}\nSexo: ${sessao.dados.sexo}\nE-mail: ${sessao.dados.email}\nCEP: ${sessao.dados.cep}\nEndereço: ${sessao.dados.rua}, ${sessao.dados.numeroResidencia}, ${sessao.dados.bairro}, ${sessao.dados.cidade}-ES\n🧾 *Dados de seu evento:*\nEvento: ${sessao.dados.dataEvento} às ${sessao.dados.horaEvento}\nDuração: ${sessao.dados.duracaoEvento} horas\nConvidados: ${sessao.dados.qtdConvidados}`
      )
    }

  case 'confirmacaoDados':
    const resposta = msg.body.trim().toLowerCase()
    if (resposta === 'sim') {
      try {
        if (sessao.existeUsuario) {
          //Já tem cadastro na tabela de UsuarioPortal
          const idCliente = await buscarIdClientePorCpf(sessao.dados.cpf)
          if (idCliente) {
            sessao.dados.idCliente = idCliente
            await salvarCadastroNoBancoEvento(sessao.dados)
            await client.sendMessage(
              numero,
              '✅ Seu evento foi salvo com sucesso no nosso sistema! 🎉'
            )
          }
        } else {
          //Tem que cadastrar em duas tabelas UsuarioPortal e EventoPortal
          sessao.dados.numero = numero
          await cadastrarUsuarioEEvento(sessao.dados)
          await client.sendMessage(
            numero,
            '✅ Seus dados foram salvos com sucesso no nosso sistema! 🎉'
          )
        }
        await client.sendMessage(
          numero,
          `✅ Cadastro finalizado com sucesso! 🎉`
        )
        console.log('📦 Dados cadastrados:', sessao.dados)
        await chat.changeLabels([])
        delete sessoes[numero] // Finaliza a sessão
      } catch (err) {
        await client.sendMessage(
          numero,
          '⚠️ Ocorreu um erro ao salvar seus dados. Por favor, tente novamente mais tarde.'
        )
        console.error('Erro ao salvar cadastro:', err)
      }
    } else if (resposta === 'não' || resposta === 'nao') {
      await chat.changeLabels([])
      await client.sendMessage(
        numero,
        '❌ Cadastro cancelado. Obrigado e tenha um excelente dia!'
      )
      await client.sendMessage(
        numero,
        '🙋‍♂️ O atendimento automático de cadastro foi encerrado. Caso tenha mais dúvidas ou precise de suporte, estou à disposição! 👋'
      )
      delete sessoes[numero]
    } else {
      await client.sendMessage(
        numero,
        '❓ Por favor, responda apenas com *sim* para confirmar ou *não* para cancelar.'
      )
    }
}

return
