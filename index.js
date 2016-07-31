var express = require('express');
var path = require('path');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');

var sql_cLimit = 100;
var sql_host = 'localhost';
var sql_user = 'root';
var sql_psd = 'root';
var sql_db = 'test';
var sql_conn = {connectionLimit:sql_cLimit, host:sql_host, user:sql_user, password:sql_psd, database:sql_db};
var pool = mysql.createPool(sql_conn);
var jsonResponse, minTickCount, chartData, allConnections, lastTickData;

pool.getConnection(function(err,connection) {
  if(err) {
    console.error('error connecction;'+err.stack);
    return;
  } else {
    var sql_stmt = 'SELECT * FROM `forexm1`';
    connection.query(sql_stmt, function(err, rows, fields) {
      if(err) {
        throw err;
      } else {
        minTickCount = rows.length;
        chartData = rows;
        jsonResponse = JSON.stringify(rows);
        connection.release();
        getSecUpdate();
        checkMinUpdate();
      }
    });
  }
});

function checkMinUpdate() {
  var minUpdateStmt = 'SELECT ID FROM `forexm1` DESC LIMIT 0,1';
  pool.getConnection(function(err, connection) {
    connection.query(minUpdateStmt, function(err, rows, fields) {
      if(err) {
        throw err;
      } else {
        connection.release();
        if(rows[0]['ID'] > minTickCount) {
          getMinUpdate;
        } else {
          setTimeout(checkMinUpdate, 1000);
        }
      }
    });
  });  
}

function getMinUpdate() {
  var minUpdateStmt = 'SELECT * FROM `forexm1` DESC LIMIT 0,1';
  pool.getConnection(function(err, connection) {
    connection.query(minUpdateStmt, function(err, rows, fields) {
      if(err) {
        throw err;
      } else {
        chartData.push(rows);
        connection.release();
        if(allConnections.length) {
          io.emit('min chart update', JSON.stringify(rows));
          setTimeout(checkMinUpdate,60000);
        } 
      }
    });
  }); 
}

function getSecUpdate() {
  var secUpdateStmt = 'SELECT * FROM `forexsec`';
  pool.getConnection(function(err, connection) {
    connection.query(secUpdateStmt, function(err, rows, fields) {
      if(err) {
        throw err;
      } else {
        lastTickData = rows;
        connection.release();
        if(allConnections.length) {
          io.emit('sec chart update', JSON.stringify(rows));
          setTimeout(getSecUpdate(), 1000);
        }
      }
    });
  });
}


app.use(express.static(path.join(__dirname, 'public'))); //设置环境变量
app.get('/', function(req, res){
  res.sendFile(__dirname + '/tickTest2.html');
});

io.on('connection', function(socket){
  console.log('a user connected');
  allConnections.push(socket);
  socket.emit('init chart update', JSON.stringify(chartData));
  socket.on('chat message', function(msg){
      io.emit('chat message', msg);
  });
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

setInterval(function() {
  io.emit('chat message', '');
},1000);

http.listen(80, function(){
  console.log('listening on *:80');
});