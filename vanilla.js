
var fs = require('fs');

try {

    var credfile = '/opt/offline/cred.json';
    var dockerfile = '/opt/offline/data/configuration.yaml';


    fs.readFile(credfile, { encoding: 'utf-8' }, function (err, creddata) {
        fs.readFile(dockerfile, { encoding: 'utf-8' }, function (err, dockerdata) {
        var JSONCredData = JSON.parse(creddata);



        var newContent = `# Home Assistant integration (MQTT discovery)
homeassistant: false

# allow new devices to join
permit_join: true

# MQTT settings
mqtt:
  # MQTT base topic for zigbee2mqtt MQTT messages
  base_topic: ${JSONCredData.topicPrefix}
  # MQTT server URL
  server: 'mqtt://mqtt.tfy.ai'
  # MQTT server authentication, uncomment if required:
   user: ${JSONCredData.username}
   password: ${JSONCredData.password}

# Serial settings
serial:
  # Location of CC2531 USB sniffer
  port: /dev/ttyACM0`
        var newData = newContent + dockerdata.substring(dockerdata.lastIndexOf("devices:"), dockerdata.length)

        fs.writeFile(dockerfile, newData, function (err) {
            if (err) {
                console.log(err)
            }
        })
    });
});
} catch (e) {
    console.log(e);
}


