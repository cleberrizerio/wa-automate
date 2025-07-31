// db.js
const mysql = require("mysql2");

function createConnection() {
    return mysql.createConnection({
        host: "srv893.hstgr.io",
        user: "u198398501_floratti",
        password: "yTl1@^*8",
        database: "u198398501_floratti",
    });
}

module.exports = createConnection;
