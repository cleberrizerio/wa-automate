const moment = require('moment')
const axios = require('axios')
const createConnection = require('./conexao')

async function buscarConvidado(telefoneEditado) {
  return new Promise((resolve, reject) => {
    const connection = createConnection()
    connection.connect()

    const query = `
      SELECT * FROM lista_convidados lc 
      INNER JOIN eventos_portal ep ON lc.id_evento = ep.ID_EVENTO 
      WHERE lc.telefone_convidado = ? AND ep.CONCLUIDO = '0'
      AND ep.DATA_EVENTO BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 5 DAY)
      GROUP BY lc.telefone_convidado
    `

    connection.query(query, [telefoneEditado], async (err, rows) => {
      connection.end()

      if (err) {
        console.error('Erro na consulta:', err)
        return reject(err)
      }

      if (!rows || rows.length === 0) {
        return resolve(null)
      }

      const convidado = rows[0]
      const dataEventoC = moment(convidado.DATA_EVENTO).format('DD/MM/YYYY')
      const horaEventoC = moment(convidado.HORA_INICIO, 'HH:mm:ss').format(
        'HH:mm'
      )

      try {
        const acompanhantes = await buscarAcompanhantes(
          convidado.id_evento,
          telefoneEditado
        )

        resolve({
          nomeConvidado: convidado.Nome_convidade,
          qrcode: convidado.qRCode,
          dataEvento: dataEventoC,
          horaEvento: horaEventoC,
          idEvento: convidado.id_evento,
          acompanhantes: acompanhantes,
        })
      } catch (erro) {
        return reject(erro)
      }
    })
  })
}

function buscarAcompanhantes(idEvento, telefone) {
  return new Promise((resolve, reject) => {
    const connection = createConnection()
    connection.connect()

    const query = `
      SELECT Nome_convidade FROM lista_convidados 
      WHERE id_evento = ? AND telefone_convidado LIKE ? 
      ORDER BY id ASC
    `

    connection.query(query, [idEvento, telefone], (err, rows) => {
      connection.end()

      if (err) {
        console.error('Erro ao buscar acompanhantes:', err)
        return reject(err)
      }

      if (!rows || rows.length <= 1) {
        return resolve('Sem Acompanhantes')
      }

      // Ignora o primeiro (titular) e pega os acompanhantes
      const nomes = rows.slice(1).map((r) => r.Nome_convidade)
      resolve(nomes.join(', '))
    })
  })
}

const updateConvidado = async (telefoneConvidado, valorQRCode, idEvento) => {
  const connection = createConnection()

  return new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        console.error('Erro ao conectar ao banco de dados:', err)
        reject(err)
        return
      }

      const updateQuery = `
          UPDATE lista_convidados lc
          INNER JOIN eventos_portal ep ON lc.id_evento = ep.ID_EVENTO
          SET lc.sendQRCode = ?
          WHERE lc.telefone_convidado LIKE ? AND lc.id_evento = ? AND ep.CONCLUIDO = '0'
        `

      connection.query(
        updateQuery,
        [valorQRCode, telefoneConvidado, idEvento],
        (err, result) => {
          connection.end()

          if (err) {
            console.error('Erro ao executar o UPDATE com JOIN:', err)
            reject(err)
          } else if (result.affectedRows > 0) {
            console.log(
              `QRCode marcado como '${valorQRCode}' para ${telefoneConvidado} e ID ${idEvento}`
            )
            resolve('atualizado')
          } else {
            console.log(
              `Nenhum convidado atualizado para ${telefoneConvidado} e ID ${idEvento}`
            )
            resolve('nao_encontrado')
          }
        }
      )
    })
  })
}

async function buscarUsuarioPorCPF(cpf) {
  return new Promise((resolve, reject) => {
    const connection = createConnection()
    connection.connect()
    console.log('Dentro da Function: ', cpf)
    const query = `SELECT * FROM usuarios_portal WHERE CPF = ? LIMIT 1`

    connection.query(query, [cpf], (err, results) => {
      connection.end()

      if (err) {
        console.error('Erro ao buscar CPF:', err)
        return reject(err)
      }

      if (!results || results.length === 0) {
        return resolve(null)
      }

      return resolve(results[0])
    })
  })
}

async function buscarEventoPorData(dataEvento) {
  return new Promise((resolve, reject) => {
    const connection = createConnection()
    connection.connect()

    const query = 'SELECT * FROM eventos_portal WHERE DATA_EVENTO = ? LIMIT 1'

    connection.query(query, [dataEvento], (err, results) => {
      connection.end()

      if (err) {
        console.error('Erro ao buscar evento por data:', err)
        return reject(err)
      }

      if (!results || results.length === 0) {
        return resolve(null)
      }

      return resolve(results[0])
    })
  })
}

function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.charAt(9))) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.charAt(10))) return false

  return true
}

async function salvarCadastroNoBancoEvento(dados) {
  // Convertendo a dataEvento para o formato do MySQL (yyyy-mm-dd)
  const partesData = dados.dataEvento.split('/')
  const dataFormatada = `${partesData[2]}-${partesData[1]}-${partesData[0]}`
  const connection = createConnection()
  const query = `
    INSERT INTO eventos_portal 
    (ID_CLIENTE, TIPO_EVENTO, DATA_EVENTO, HORA_INICIO, TEMPO, QUANTIDADE) 
    VALUES (?, ?, ?, ?, ?, ?)
  `
  const values = [
    dados.idCliente,
    dados.tipo,
    dataFormatada,
    dados.horaEvento,
    dados.duracaoEvento,
    dados.qtdConvidados,
  ]

  await connection.execute(query, values)
  await connection.end()
}

async function cadastrarUsuarioEEvento(dados) {
  // Tratamento do número
  dados.numero = dados.numero.replace(/\D/g, '') // Remove tudo que não for número
  if (dados.numero.startsWith('55')) {
    dados.numero = dados.numero.substring(2)
  }

  // Convertendo a nascimento para o formato do MySQL (yyyy-mm-dd)
  const partesData = dados.nascimento.split('/')
  dados.nascimento = `${partesData[2]}-${partesData[1]}-${partesData[0]}`
  console.log(dados)
  const connection = createConnection()
  try {
    const insertUsuarioSql = `
      INSERT INTO usuarios_portal 
        (login, nome, CPF, nascimento, sexo, email, endereco, numero, bairro, cidade, cep) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    const valores = [
      dados.numero,
      dados.nome,
      dados.cpf,
      dados.nascimento,
      dados.sexo,
      dados.email,
      dados.rua,
      dados.numeroResidencia,
      dados.bairro,
      dados.cidade,
      dados.cep,
    ]

    await connection.execute(insertUsuarioSql, valores)
    console.log('✅ Usuário cadastrado com sucesso!')
    await connection.end()
    await new Promise((res) => setTimeout(res, 1000)) // 100ms

    // Buscar ID após o insert
    console.log(dados.cpf)
    const usuario = await buscarUsuarioPorCPF(dados.cpf)
    console.log(usuario)
    id = usuario.ID
    if (!id) {
      console.error('❌ Não foi possível obter o ID do cliente.')
      return
    }

    dados.idCliente = id
    await salvarCadastroNoBancoEvento(dados)
  } catch (erro) {
    console.error('❌ Erro ao cadastrar usuário e evento:', erro)
  }
}

module.exports = {
  buscarConvidado,
  updateConvidado,
  buscarUsuarioPorCPF,
  buscarEventoPorData,
  validarCPF,
  salvarCadastroNoBancoEvento,
  cadastrarUsuarioEEvento,
}
