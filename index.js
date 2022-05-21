const express = require('express')
const cors = require('cors')
const path = require('path');
const whitelist = {
    "http://localhost:8000": true,
    "http://localhost:3000": true,
};

const jsonServer = require('json-server');
const { endOfToday, differenceInMonths, endOfMonth, differenceInDays } = require('date-fns');
const { default: axios } = require('axios');
const corsOptions = {
    origin: (origin, callback) => {
        const hasValidOrigin = !origin || whitelist[origin];

        if (hasValidOrigin) return callback(null, true)

        console.info("[api]: blocked by cors: " + origin);

        callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    optionsSuccessStatus: 200 // retro-compatibility
}



const server = jsonServer.create()
const router = jsonServer.router('transacoes.json')
const middlewares = jsonServer.defaults()
server.use(cors(corsOptions));
server.use(express.json());
server.get('/cadastrar', function (req, res) {
    res.sendFile(path.join(__dirname, '/criaEmprestimo.html'));
})
server.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/veEmprestimo.html'));
})
server.use(jsonServer.rewriter({
    '/obterEmprestimosEntre?nomeCredor=:nomeCredor&nomeDevedor=:nomeDevedor': '/emprestimos',
}))
server.post('/registraLog', async function (req, res) {
    const loan = {
        ...req.body,
        dataDeletado: new Date().toISOString(),
    };
    delete loan.id;

    await axios.post(`http://localhost:3000/logs/`, loan);
    return res.json("ok")
})
server.delete('/quitarEmprestimo/', async function (req, res) {
    const {
        emprestimoId: loanId,
        senhaCredor: senhaInserida
    } = req.query;

    try {
    
        const {
            data: loan
        } = await axios.get(`http://localhost:3000/emprestimos/` + loanId)
    
        const { nomeCredor } = loan;
    
        const {
            data: usuarios
        } = await axios.get(`http://localhost:3000/usuarios/?nome=` + nomeCredor)
        const [credor] = usuarios
        const senhaValida = credor?.senha

        const validaSenha  = (senha) => senha === senhaValida;

        const isValidPassword = validaSenha(senhaInserida);
    
        if (!isValidPassword) return res.status(403).json("Acesso bloqueado, senha errada amigo");
        await axios.post(`http://localhost:3000/registraLog/`, loan);
        await axios.delete(`http://localhost:3000/emprestimos/` + loanId);
    
    
        return res.status(200).json("ok")
    } catch (error) {
        console.log(error.message);
        return res.status(500).json(error.message)
    }
})


server.post('/cadastraEmprestimo', async function (req, res) {
    try {
        const {
            senhaDoDevedor,
            nomeDevedor,
            nomeCredor,
            valor,
            data,
        } = req.body
        const {
            data: usuarios
        } = await axios.get(`http://localhost:3000/usuarios/?nome=${nomeCredor}&nome=${nomeDevedor}` );
    
        const [dadosCredor, dadosDevedor] = usuarios;
        const hasValidUsers = !!dadosCredor && !!dadosDevedor;
        if(!hasValidUsers) return res.status(404).json({
            message: "Credor Ou Devedor não encontrado",
            type: "invalid_user"
        });
        const senhaValida = dadosDevedor?.senha

        const validaSenha  = (senhaInserida) => senhaInserida === senhaValida;

        const hasValidPassword = validaSenha(senhaDoDevedor);
    
        if(!hasValidPassword) return res.status(403).json({
            message: "Senha do devedor errada",
            type: "wrong_password"
        });
        const payload = {
            senhaDoDevedor,
            nomeDevedor,
            nomeCredor,
            valor,
            data,
        }
        await axios.post(`http://localhost:3000/emprestimos/`, payload);
    
        return res.status(200).json(payload)
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            error: error.message
        })
    }

})
server.get('/obterValorCorrigido', async function (req, res) {
    const finalDoMes = endOfMonth(new Date());

    const [
        { data: juros },
        { data: loans }
    ] = await Promise.all([
        axios.get("http://localhost:3000/juros"),
        axios.get("http://localhost:3000/emprestimos")
    ])

    const {
        taxaDeJurosMensal,
        taxaDeJurosDiario
    } = juros;
    const valorCorrigidoPorEmprestimo = loans.reduce((acc, emprestimo) => {
        const {
            valor: valorOriginal,
            data: dataEmprestimo
        } = emprestimo;
        const quantidadeDeMesesEntreAsDatas = differenceInMonths(
            new Date(dataEmprestimo),
            finalDoMes,
        );
        const quantidadeDeDiasEntreAsDatas = differenceInDays(
            new Date(dataEmprestimo),
            finalDoMes,
        );
        const jurosMensais = quantidadeDeMesesEntreAsDatas * +taxaDeJurosMensal;
        const jurosDiarios = quantidadeDeDiasEntreAsDatas * +taxaDeJurosDiario;

        const valorCorrigido = valorOriginal * jurosMensais * jurosDiarios;

        acc[emprestimo.id] = {
            valorCorrigido,
            valorOriginal,
        }
        return acc;
    }, {});

    res.json(valorCorrigidoPorEmprestimo)
})
server.use(middlewares)
server.use(router)


server.listen(3000, () => {
    console.log('JSON Server is running')
})
