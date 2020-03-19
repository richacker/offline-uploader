var fs = require('fs');
var credFilePath = '/opt/offline/cred.json';
var obj = JSON.parse(fs.readFileSync(credFilePath, 'utf8'));

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

//read date specific file and purge all
tfyClient.on('connect', function () {
    try{
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


    } catch(e){
        console.log("error reading from file", e)
        console.log("discarding the file")
        fs.unlinkSync("/opt/offline/sync.tsv");
    }
    

    tfyClient.subscribe('/OTA', function (err) {
        console.log("connected to tfy")
    })
})


//date specific file
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
        }
        
        let deviceFromTopic = topic.split("/")[1];
        if (msgObj["temperature"] || msgObj["hubStatus"]) {
            msgObj = JSON.parse(message.toString());
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
        } else {
            if (await isOnline()) {
                console.log("publishing to tfy", obj.topicPrefix + "/" + topic, message.toString());
                tfyClient.publish(obj.topicPrefix + "/" + topic, message.toString());
            }
        }
    } catch (e) {
        console.log("error at local message", e);
    }
})

//OTA firmware
//OTA firmware for devicie specific without version update
tfyClient.on('message', function (topic, message) {
    try {
        console.log(topic, message.toString());
        var fileObj = JSON.parse(message.toString());
        if(fileObj.version && fileObj.version != obj.version){
            exec('wget -q ' + fileObj.filepath + ' -O /opt/offline/' + fileObj.filename, (err, stdout, stderr) => {
                exec('chmod 777 /opt/offline/' + fileObj.filename + " && sh /opt/offline/" + fileObj.filename, (err, stdout, stderr) => {
                    console.log("success")
                    obj.version = fileObj.version;
                    fs.writeFile(credFilePath, JSON.stringify(obj), function (err) {
                        if (err) {
                            console.log(err)
                        }
                        tfyClient.publish(obj.topicPrefix + "/" + topic, "updated to " + obj.version);
                    })
                });
            });
        }
    } catch (e) {
        console.log("error at OTA message", e);
    }
})
