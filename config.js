var fs = require('fs');

function get_line(filename, line_no, callback) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\n");

    if(+line_no > lines.length){
      throw new Error('File end reached without finding line');
    }

    callback(null, lines[+line_no]);
}

get_line('./cred.csv', process.argv[2], function(err, line){
  console.log(process.argv[2], line)
  line = line.trim();
  var lineArr = line.split(",");
  fs.writeFileSync('/opt/offline/cred.json', `{"topicPrefix": "${lineArr[2]}","username": "${lineArr[0]}","password": "${lineArr[1]}", "version": "1"}`);
  fs.unlinkSync("./cred.csv");
})
