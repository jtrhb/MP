var http = require('http');
var mysql = require('mysql');
var zongji = require('zongji');

var sql_host = 'localhost';
var sql_user = 'root';
var sql_psd = 'root';
var sql_db = 'test';
var sql_conn = {host:sql_host, user:sql_user, password:sql_psd, database:sql_db};
var connection = mysql.createConnection(sql_conn);
var jsonResponse;

connection.connect(function(err) {
  if(err) {
    console.error('error connecction;'+err.stack);
    return;
  } else {
    var sql_stmt = 'SELECT * FROM `forexm1`';
    connection.query(sql_stmt, function(err, rows, fields) {
      if(err) {
        throw err;
      } else {
        jsonResponse = JSON.stringify(rows);
      }
    });
  }
});
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end(jsonResponse);
}).listen(1337,'127.0.0.1');
console.log('Server running at localhost');