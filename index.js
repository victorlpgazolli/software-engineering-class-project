const express = require('express')
const cors = require('cors')
const app = express()
const path = require('path');
const whitelist = {
    "http://localhost:8000": true,
    "http://localhost:3000": true,
};

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


app.use(cors(corsOptions));

app.use(express.json());

const jsonServer = require('json-server');
const { endOfToday, differenceInMonths, endOfMonth, differenceInDays } = require('date-fns');
const { default: axios } = require('axios');
const server = jsonServer.create()
const router = jsonServer.router('transacoes.json')
const middlewares = jsonServer.defaults()
server.get('/cadastrar', function (req, res) {
    res.sendFile(path.join(__dirname, '/criaEmprestimo.html'));
})
server.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/veEmprestimo.html'));
})
server.use(jsonServer.rewriter({
    '/obterEmprestimosEntre?nomeCredor=:nomeCredor&nomeDevedor=:nomeDevedor': '/emprestimos',
    '/cadastraEmprestimo': '/emprestimos',
}))
  
server.delete('/quitarEmprestimo/', async function (req, res) {
    const {
        emprestimoId: loanId,
        senhaCredor
    } = req.query;
    console.log({
        loanId,
senhaCredor
    });
    try {
    
        const {
            data: loan
        } = await axios.get(`http://localhost:3000/emprestimos/` + loanId)
    
        const { nomeCredor } = loan;
    
        const {
            data: usuarios
        } = await axios.get(`http://localhost:3000/usuarios/?nome=` + nomeCredor)
        const [credor] = usuarios
        const isValidPassword = credor.senha === senhaCredor;
        if (!isValidPassword) return res.status(403).json("Acesso bloqueado, senha errada amigo");
    
        await axios.delete(`http://localhost:3000/emprestimos/` + loanId);
    
    
        return res.status(200).json("ok")
    } catch (error) {
        console.log(error);
        return res.status(500).json("Erro")
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


