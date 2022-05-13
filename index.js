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

const jsonServer = require('json-server')
const server = jsonServer.create()
const router = jsonServer.router('transacoes.json')
const middlewares = jsonServer.defaults()
server.get('/cria', function (req, res) {
    res.sendFile(path.join(__dirname, '/criaEmprestimo.html'));
})
server.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/veEmprestimo.html'));
})
server.use(middlewares)
server.use(router)


server.listen(3000, () => {
  console.log('JSON Server is running')
})


