const http = require('http');
const Koa = require('koa');
const cors = require('koajs-cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const ws = require('ws');

const koaBody = require('koa-body');

const port = process.env.PORT || 7070;

const app = new Koa();

app.use(cors({
    origin: true
}));

app.use(koaBody({
    urlencoded: true,
}));

const server = http.createServer(app.callback());
const wsServer = new ws.Server({ server });

let clients = new Map();
let nicks = new Map();
let messages = [];

wsServer.on('connection', (ws) => {
    const id = uuidv4();
    clients.set(id, ws);
    ws.on('message', (rawMessage) => {
        const buffer = Buffer.from(rawMessage);
        const { nick, message } = JSON.parse(buffer.toString());
        if(nick) {
            const currNicks = Array.from(nicks.keys()).map((clientId) => nicks.get(clientId));
            const hasNick = currNicks.includes(nick);
            if (hasNick) {
                clients.get(id).send(JSON.stringify({ successNick: false }))
            } else {
                nicks.set(id, nick);
                clients.get(id).send(JSON.stringify({ successNick: true }))

                const currNicks = Array.from(nicks.keys()).map((clientId) => ({id, nick: nicks.get(clientId)}));
                ws.send(JSON.stringify({newMessage: messages}))
                Array.from(clients.keys()).forEach((key) => {
                    const client = clients.get(key)
                    client.send(JSON.stringify({nickNames: currNicks}))
                    const message = {userId: id, messageId: uuidv4(), nick, message: `Присоединился к чату`, date: Date.now()}
                    messages.push(message)

                    if (id!==key) {
                        client.send(JSON.stringify({newMessage: [message]}))
                    }
                })
            }
        }

        if (message) {
            const nick = nicks.get(id);
            Array.from(clients.keys()).forEach((key) => {
                const client = clients.get(key)
                const currMessage = {userId: id, messageId: uuidv4(), nick, message, date: Date.now()}
                messages.push(currMessage)
                client.send(JSON.stringify({newMessage: [currMessage]}))
            })
        }
    })
    ws.on('close', () => {
        const currentNick = nicks.get(id);
        clients.delete(id);
        nicks.delete(id);
        const currNicks = Array.from(nicks.keys()).map((clientId) => ({id, nick: nicks.get(clientId)}));
        Array.from(clients.keys()).forEach((key) => {
            const client = clients.get(key);
            const message = {userId: id, messageId: uuidv4(), nick: currentNick, message: `Покинул чат`, date: Date.now()}
            messages.push(message);
            client.send(JSON.stringify({nickNames: currNicks}));
            client.send(JSON.stringify({newMessage: [message]}))
        })
    })
})

server.listen(port);

