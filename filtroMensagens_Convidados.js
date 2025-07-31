// filtroMensagens.js

function filtroMensagens(msg, groupChat) {
    if (groupChat.isGroup) return false;
    if (msg.isMyContact === true) return false;
    if (msg.isUser === true) return false;
    if (msg.type.toLowerCase() === "e2e_notification") return false;
    if (msg.body === "") return false;
    if (msg.from.includes("@g.us")) return false;

    return true; // passou em todos os filtros
}

module.exports = filtroMensagens;
