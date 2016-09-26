- create cdn with cert linked up (/)
- create route 53 record(s) (/)
- get dns record switched to aws nameserver (/)
- http -> https (done in cloudfront) (/)
- 301s for common URLs that are wrong (x) - won't fix
- upload assets with appropriate cache control (currently 300 for all) (/)
- update site code to use versioned filenames for cpf.css, metronome.js, push-wrapper-example.js

- review default security group access settings

Process

Create Role (cloudformation)
Create ec2 instance with role (console)
Upload cert (ec2)
Create OAI user for cloudfront (console)
Create remaining resouces (cloudformation)
Update NS records (DNS provider)
Check out code (ec2)
php build.php
/aws/deploy.sh
