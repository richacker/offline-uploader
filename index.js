var fs = require('fs');
var credFilePath = '/opt/offline/cred.json';
var obj = JSON.parse(fs.readFileSync(credFilePath, 'utf8'));

var mqtt = require('mqtt')
var localClient = mqtt.connect('mqtt://localhost')
var tfyClient = mqtt.connect(`mqtt://mqtt.tfy.ai`, { "username": obj.username, "password": obj.password });
const isOnline = require('is-online');
const readline = require('readline');

const { exec } = require('child_process');

try {
    if (!fs.existsSync('/opt/offline/offline_files')) {
        fs.mkdirSync('/opt/offline/offline_files');
    }
} catch (e) {
    console.log("some error occured while creating offline file folder", e)
}

localClient.on('connect', function () {
    localClient.subscribe('zigbee2mqtt/#', function (err) {
        console.log("subscribed: ", Date.now());
    })
})

//read date specific file and purge all
tfyClient.on('connect', function () {
    console.log("connected to tfy init")
    try {
        //check if something exists in file & publish
        fs.readdir('/opt/offline/offline_files/', function (err, filenames) {
            if (err) {
                console.log(err);
            }
            filenames.forEach(function (filename) {

                try {
                    filename = '/opt/offline/offline_files/' + filename;
                    if (fs.existsSync(filename)) {
                        let rl = readline.createInterface({
                            input: fs.createReadStream(filename)
                        });

                        // event is emitted after each line
                        rl.on('line', function (line) {
                            var lineArr = line.split("\t");
                            console.log("publishing offline content to tfy: ", lineArr[0], lineArr[1]);
                            tfyClient.publish(lineArr[0], lineArr[1]);
                        });

                        // end
                        rl.on('close', function (line) {
                            fs.unlinkSync(filename);
                            console.log('Uploaded & deleted!!');
                        });
                    }
                } catch (e) {
                    fs.unlinkSync(filename);
                    console.log("error reading from file", e)
                    console.log("discarding the file")
                }

            })

        });
    } catch (e) {
        console.log("error reading from files", e)
        console.log("discarding the file")
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
        if (topic == "zigbee2mqtt/bridge/state") {
            if (message.toString() == "online") {
                msgObj = { "hubStatus": 1 }
            } else if (message.toString() == "offline") {
                msgObj = { "hubStatus": 0 }
            }
        }

        let deviceFromTopic = topic.split("/")[1];
        if (message.toString().indexOf("temperature") || msgObj["hubStatus"]) {
            msgObj = JSON.parse(message.toString());
            (async () => {
                if (await isOnline()) {
                    console.log("publishing to tfy 1", obj.topicPrefix + "/" + deviceFromTopic, JSON.stringify(msgObj));
                    tfyClient.publish(obj.topicPrefix + "/" + deviceFromTopic, JSON.stringify(msgObj));
                } else if (await isOnline() == false) {
                    console.log("storing offline");
                    //put into file
                    msgObj["date"] = Date.now();
                    var d = new Date();
                    d.setHours(0, 0, 0, 0);
                    fs.appendFileSync('/opt/offline/offline_files/sync_' + d.getTime() + '.tsv', `${obj.topicPrefix}/${deviceFromTopic}\t${JSON.stringify(msgObj)}\n`);
                }
            })()
        } else {
            (async () => {
                if (await isOnline()) {
                    console.log("publishing to tfy 2", obj.topicPrefix + "/" + topic, message.toString());
                    tfyClient.publish(obj.topicPrefix + "/" + topic, message.toString());
                }
            })()
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
        if (fileObj.hubId && obj.topicPrefix == fileObj.hubId) {
            exec('wget -q ' + fileObj.filepath + ' -O /opt/offline/' + fileObj.filename, (err, stdout, stderr) => {
                exec('chmod 777 /opt/offline/' + fileObj.filename + " && sh /opt/offline/" + fileObj.filename, (err, stdout, stderr) => {
                    console.log("success")
                    tfyClient.publish(obj.topicPrefix + "/OTA", "updated hub " + obj.topicPrefix);
                });
            });
        } else if (fileObj.version && fileObj.version != obj.version) {
            exec('wget -q ' + fileObj.filepath + ' -O /opt/offline/' + fileObj.filename, (err, stdout, stderr) => {
                exec('chmod 777 /opt/offline/' + fileObj.filename + " && sh /opt/offline/" + fileObj.filename, (err, stdout, stderr) => {
                    console.log("success")
                    obj.version = fileObj.version;
                    fs.writeFile(credFilePath, JSON.stringify(obj), function (err) {
                        if (err) {
                            console.log(err)
                        }
                        tfyClient.publish(obj.topicPrefix + "/OTA", "updated to " + obj.version);
                    })
                });
            });
        }
    } catch (e) {
        console.log("error at OTA message", e);
    }
})
