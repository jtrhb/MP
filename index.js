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
var sql_multiple = true;
var sql_conn = {connectionLimit:sql_cLimit, host:sql_host, user:sql_user, password:sql_psd, database:sql_db, multipleStatements:sql_multiple};
var pool = mysql.createPool(sql_conn);
var jsonResponse, minTickCount, chartData, allConnections = [], lastTickData;
var bid = 0, ask = 0, spread = 0, shouldEmitRealtimeUpdate = 1;
var longCount = 10, shortCount = 10;
var longView=["今天看涨","看好非农，小买一点","针型底，必有死猫跳"], shortView=["大盘无药可救","同志们，天台见","呵呵呵呵呵"],neutralView=["张憬帆吃喝嫖赌欠下了3.5个亿","带着他的小姨子跑了","苟利国家生死以，岂因福祸避趋之"];

pool.getConnection(function(err,connection) {
  if(err) {
    console.error('error connecction;'+err.stack);
    return;
  } else {
    var sql_stmt = 'SELECT * FROM `forexm1`; SELECT * FROM `forexsec`';
    connection.query(sql_stmt, function(err, rows, fields) {
      if(err) {
        throw err;
      } else {
        minTickCount = rows[0].length;
        chartData = rows[0];
        lastTickData = rows[1];
        chartData.push(lastTickData[0]);
        //jsonResponse = JSON.stringify(rows);
        connection.release();
        tickUpdate();
        realtimeUpdate();
      }
    });
  }
});

function realtimeUpdate() {
  pool.getConnection(function(err, connection) {
    var realtimesql_stmt = 'SELECT * FROM `forexrealtime`';
    connection.query(realtimesql_stmt, function(err, rows, fields) {
        if(err) {
          throw err;
        } else {
          connection.release();
          if(bid != Number(rows[0]['Bid']) || ask != Number(rows[0]['Ask'])) {
            bid = Number(rows[0]['Bid']);
            ask = Number(rows[0]['Ask']);
            if(allConnections.length) {
                io.emit('bid ask update', JSON.stringify(rows[0]));
              }
          }
          setTimeout(realtimeUpdate, 100);
        }
      });
  });
}

function tickUpdate() {
  pool.getConnection(function(err, connection) {
    var secUpdateStmt = 'SELECT * FROM `forexsec`';
    var checkMinUpdateStmt = 'SELECT `ID` FROM `forexm1` ORDER BY `ID` DESC LIMIT 0,1';
    var minUpdateStmt = 'SELECT * FROM `forexm1` ORDER BY `ID` DESC LIMIT 0,1';
    var jointStmt1 = 'SELECT * FROM `forexsec`; SELECT `ID` FROM `forexm1` ORDER BY `ID` DESC LIMIT 0,1';
    var jointStmt2 = 'SELECT * FROM `forexsec`; SELECT * FROM `forexm1` ORDER BY `ID` DESC LIMIT 0,1';
    connection.query(jointStmt1, function(err, rows, fields) {
      if(err) {
        throw err;
      } else {
        if(rows[1][0]['ID'] > minTickCount) {
          connection.query(jointStmt2, function(err, rows, fields) {
            if(err) {
              throw err;
            } else {
              connection.release();
              lastTickData = rows[0];
              chartData[chartData.length - 1] = rows[1][0];
              chartData.push(lastTickData[0]);
              minTickCount += 1;
              if(allConnections.length) {
                io.emit('min chart update', {min:JSON.stringify(rows[1]), sec:JSON.stringify(lastTickData)});
              }
              setTimeout(tickUpdate,1000);
            }
          });
        } else {
          lastTickData = rows[0];
          chartData[chartData.length - 1] = lastTickData[0];
          if(allConnections.length) {
            io.emit('sec chart update', JSON.stringify(lastTickData));
          }
          connection.release();
          setTimeout(tickUpdate,1000);
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
  socket.emit('update bar percentage', {"long":longCount,"short":shortCount});
  socket.emit('init chart update', JSON.stringify(chartData));
  socket.emit('bid ask update', JSON.stringify({Bid:String(bid),Ask:String(ask)}));
  socket.emit('load comment',{long:longView,neutral:neutralView,short:shortView})
  socket.on('chat message', function(msg){
    switch(msg['dir'])
    {
      case 1:
        longView.push(msg['msg']);
        break;
      case 2:
        neutralView.push(msg['msg']);
        break;
      case 3:
        shortView.push(msg['msg']);
        break;
    }
      io.emit('chat message', msg);
  });
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  socket.on('vote for', function(msg) {
    if(msg == "long") {
      longCount += 1;
      io.emit("update long percentage",longCount);
    } else {
      shortCount += 1;
      io.emit("update short percentage", shortCount);
    }
  })
});

http.listen(80, function(){
  console.log('listening on *:80');
});