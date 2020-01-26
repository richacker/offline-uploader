var fs = require('fs');
var obj = JSON.parse(fs.readFileSync('/opt/offline/cred.json', 'utf8'));

var mqtt = require('mqtt')
var localClient = mqtt.connect('mqtt://localhost')
var tfyClient = mqtt.connect(`mqtt://mqtt.tfy.ai`, { "username": obj.username, "password": obj.password });
const isOnline = require('is-online');
const readline = require('readline');

const { exec } = require('child_process');


localClient.on('connect', function () {
    localClient.subscribe('zigbee2mqtt/#', function (err) {
        console.log("subscribed: ", Date.now());
    })
})

tfyClient.on('connect', function () {

    //check if something exists in file & publish
    if (fs.existsSync("/opt/offline/sync.tsv")) {
        let rl = readline.createInterface({
            input: fs.createReadStream("/opt/offline/sync.tsv")
        });

        // event is emitted after each line
        rl.on('line', function (line) {
            var lineArr = line.split("\t");
            console.log("publishing offline content to tfy: ", lineArr[0], lineArr[1]);
            tfyClient.publish(lineArr[0], lineArr[1]);
        });

        // end
        rl.on('close', function (line) {
            fs.unlinkSync("/opt/offline/sync.tsv");
            console.log('Uploaded & deleted!!');
        });
    }

    tfyClient.subscribe('/OTA', function (err) {
        console.log("connected to tfy")
    })
})

localClient.on('message', function (topic, message) {
    
    try {
        console.log(topic, message.toString());
        let msgObj = {};
        if(topic == "zigbee2mqtt/bridge/state"){
            if(message.toString() == "online"){
                msgObj = {"hubStatus": 1}
            } else if(message.toString() == "offline"){
                msgObj = {"hubStatus": 0}
            }
        }  else {
            msgObj = JSON.parse(message.toString());
        }
        
        let deviceFromTopic = topic.split("/")[1];
        if (msgObj["temperature"] || msgObj["hubStatus"]) {
            (async () => {
                if (await isOnline()) {
                    console.log("publishing to tfy", obj.topicPrefix + "/" + deviceFromTopic, JSON.stringify(msgObj));
                    tfyClient.publish(obj.topicPrefix + "/" +deviceFromTopic, JSON.stringify(msgObj));
                } else if (await isOnline() == false) {
                    console.log("storing offline");
                    //put into file
                    msgObj["date"] = Date.now();
                    fs.appendFileSync('/opt/offline/sync.tsv', `${obj.topicPrefix}/${deviceFromTopic}\t${JSON.stringify(msgObj)}\n`);
                }
            })()
        }
    } catch (e) {
        console.log("error at local message", e);
    }
})

//OTA firmware
tfyClient.on('message', function (topic, message) {
    try {
        console.log(topic, message.toString());
        console.log(topic, message.toString());
        var fileObj = JSON.parse(message.toString());
        if(fileObj.version && fileObj.version != obj.version){
            exec('wget -q ' + fileObj.filepath + ' -O ' + fileObj.filename, (err, stdout, stderr) => {
                exec('chmod 777 ' + fileObj.filename + " && /opt/offline/" + fileObj.filename, (err, stdout, stderr) => {
                    console.log("success")
                });
            });
        }
    } catch (e) {
        console.log("error at OTA message", e);
    }
})
