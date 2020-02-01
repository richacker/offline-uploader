echo "starting setup"
curl -sSL https://get.docker.com | sh
echo $'{\n    "experimental": true\n}' | sudo tee /etc/docker/daemon.json;
sudo service docker restart
mkdir /app
mkdir /app/data
docker pull koenkk/zigbee2mqtt --platform linux/arm/v6
docker run -it -v $(pwd)/data:/app/data --network="host" --restart=always --device=/dev/ttyACM0 -e TZ=Asia/Calcutta -v /run/udev:/run/udev:ro --privileged=true koenkk/zigbee2mqtt &
mkdir /opt/offline
cd /opt/offline
wget https://raw.githubusercontent.com/richacker/offline-uploader/master/index.js
wget https://raw.githubusercontent.com/richacker/offline-uploader/master/cred.csv
wget https://raw.githubusercontent.com/richacker/offline-uploader/master/config.js
wget https://raw.githubusercontent.com/richacker/offline-uploader/master/cron.js
npm i readline
npm i is-online
npm i mqtt
npm i -g forever
echo "setup complete, now run next command: node /opt/offline/config.js <kit number>"
