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
var bid = 0, ask = 0, spread = 0;

pool.getConnection(function(err,connection) {
  if(err) {
    console.error('error connecction;'+err.stack);
    return;
  } else {
    var realtimeUpdate = function() {
      connection.query(realtimesql_stmt, function(err, rows, fields) {
        if(err) {
          throw err;
        } else {
          connection.release();
          if(bid != Number(rows[0]['Bid']) || ask != Number(rows[0]['Ask'])) {
            bid = rows[0]['Bid'];
            ask = rows[0]['Ask'];
            realtimeUpdate;
          }
        }
      });
    }
    var sql_stmt = 'SELECT * FROM `forexm1`; SELECT * FROM `forexsec`';
    var realtimesql_stmt = 'SELECT * FROM `forexrealtime`';
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

/*
function checkMinUpdate(connection) {
  var minUpdateStmt = 'SELECT `ID` FROM `forexm1` ORDER BY `ID` DESC LIMIT 0,1';
  connection.query(minUpdateStmt, function(err, rows, fields) {
    if(err) {
      throw err;
    } else {
      if(rows[0]['ID'] > minTickCount) {
        //getMinUpdate;
      } else {
        setTimeout(checkMinUpdate(connection), 1000);
      }
    }
  }); 
}

function getMinUpdate(connection) {
  var minUpdateStmt = 'SELECT * FROM `forexm1` ORDER BY `ID` DESC LIMIT 0,1';
  connection.query(minUpdateStmt, function(err, rows, fields) {
    if(err) {
      throw err;
    } else {
      chartData.push(rows);
      if(allConnections.length) {
        io.emit('min chart update', JSON.stringify(rows));
        setTimeout(checkMinUpdate(connection),60000);
      } 
    }
  });
}

function getSecUpdate(connection) {
  var secUpdateStmt = 'SELECT * FROM `forexsec`';
  connection.query(secUpdateStmt, function(err, rows, fields) {
    if(err) {
      throw err;
    } else {
      lastTickData = rows;
      if(allConnections.length) {
        io.emit('sec chart update', JSON.stringify(rows));
        setTimeout(getSecUpdate(connection), 1000);
      }
    }
  });
}
*/

app.use(express.static(path.join(__dirname, 'public'))); //设置环境变量
app.get('/', function(req, res){
  res.sendFile(__dirname + '/tickTest2.html');
});

io.on('connection', function(socket){
  console.log('a user connected');
  allConnections.push(socket);
  chartData;
  socket.emit('init chart update', JSON.stringify(chartData));
  socket.on('chat message', function(msg){
      io.emit('chat message', msg);
  });
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

http.listen(911, function(){
  console.log('listening on *:911');
});