var fs = require('fs');
fs.writeFileSync('/var/lib/dietpi/dietpi-autostart/custom.sh', `#!/bin/bash
  /usr/local/bin/forever start -c /usr/local/bin/node /opt/offline/index.js`);