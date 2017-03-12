# chippanfire-site

Generation of the (static) chippanfire site

## Why
I wanted to make my own static site to learn a bunch of things. In the two iterations (one PHP, one JS/Webpack) I've covered:
- applying bootstrap/CSS through fairly direct manipulation of HTML markup (without a framework doing the heavy lifting for me)
- hosting static sites on AWS S3, using AWS Cloudfront and Letsencrypt to serve the site over HTTPS
- bundling/transpiling assets as part of build to target a variety browsers (currently using Webpack)
- templating HTML files (initially done via custom PHP, now using EJS)

## Setup/Editing
Each page in the site uses a common document, header, and navigation template (stored in `/templates`)
The layout of the site is configured in `chippanfire.js`
Each page has its own HTML template (also in `/templates`)

## Build
NPM and webpack do all the work here, and output a full site to ``./dist/``

```
npm install
cd metronome-app
npm install
cd ..
npm run build
```

## Deploy
The site is hosted in an S3 bucket. Deployment is as simple as pushing the contents of the /dist folder to S3 using the AWS cli, via `npm run deploy`

Note that HTML pages are deployed with a 24 hours cache time (changes published within 24 hours, can manually invalidate) whilst everything else has a 1 year cache

## AWS & Infrastructure
I've elected to use Cloudformation to configure the necessary AWS resources for hosting/serving the site.

This **should** be automatable via the creation of a single stack via AWS Cloudformation, however, there's at least one chicken/egg scenario that prevents this.
Specifically, I need to have uploaded a SSL cert before I can create a Cloudfront Distribution that uses it. I desire an EC2 instance role with permissions to upload that
cert. I therefore cannot create that role and the Cloudfront Distribution in the same stack... The process I used was

- Create Role (upload *partial* cloudformation template)
- Create ec2 instance that assumes role (console)
- Upload cert (ec2)
- Create OAI user for cloudfront (console)
- Create remaining resources (upload *full* cloudformation template)
- Check out code (ec2)
- build site (ec2)
- deploy site (ec2)
- Update NS records (DNS provider)

*Note the cloudformation template configures index.html as the route document for the site. It is necessary to update
the account where my domain is registered to point the main DNS record at the AWS nameservers for the* **hosted zone** *created*

## HTTPS
To support pages that send/receive MIDI SYSEX with the Web Audio API, the site needs to run on HTTPS (this is also good practice anyhow). I use [certbot](https://certbot.eff.org/) to acquire certs from [Let's Encrypt](https://letsencrypt.org/) to power this.

**Install certbot (local machine)**
```
brew update
brew install certbot
```

**Acquire certificate (local machine)**
```
mkdir -p ~/letsencrypt/log
mkdir -p ~/letsencrypt/lib
certbot certonly --manual -d chippanfire.com -d www.chippanfire.com --logs-dir ~/letsencrypt/log/ --config-dir ~/letsencrypt/ --work-dir ~/letsencrypt/
```
_note use of custom output directories, instead of the root owned /etc/letsencrypt used by default_

**Copy certs to EC2 (local machine)**
```
scp -r ~/letsencrypt/live/chippanfire.com/*.pem USER@EC2_PUBLIC_DNS:chippanfire.com-cert
```
**Upload and use certificate (EC2, using aws-cli)**
```
aws iam delete-server-certificate --server-certificate-name chippanfire.com-old #delete previous backup
aws iam update-server-certificate --server-certificate-name chippanfire.com --new-server-certificate-name chippanfire.com-old # backup current cert
aws iam upload-server-certificate --server-certificate-name chippanfire.com --certificate-body file:///home/ec2-user/chippanfire.com-cert/cert.pem --private-key file:///home/ec2-user/chippanfire.com-cert/privkey.pem --certificate-chain file:///home/ec2-user/chippanfire.com-cert/chain.pem --path /cloudfront/chippanfire/
# aws iam list-server-certificates to get cert ID
```

*Note the path must include **/cloudfront** and end with a trailing slash. With an incorrect path cloudformation gives a misleading error about "The specified SSL certificate doesn't exist, isn't valid, or doesn't include a valid certificate chain"*

**Update cloudfront**

Update stack via the AWS console, providing the IAM certificate ID of the just
uploaded cert as the certificate ID template parameter
