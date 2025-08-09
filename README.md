# chippanfire

Generation of the (static) chippanfire site

## Why
I wanted to make my own static site to learn a bunch of things

**Generation 3**
- Uses [React](https://reactjs.org/) as a templating langauge for the HTML generation
  - Transpiling JSX code to vanilla javascript via [Babel](https://babeljs.io/)
- All styling done via custom CSS following [BEM](http://getbem.com/) conventions
- Hosting continues to be via AWS S3/Cloudfront

**Generation 2**
- uses [EJS](https://ejs.co/) to templates to render static HTML
- uses Bootstrap for styling
- bundling/transpiling assets as part of build to target a variety browsers via Webpack
- hosting static sites on AWS S3, using AWS Cloudfront and Letsencrypt to serve the site over HTTPS

**Generation 1**
- PHP used to generate HTML from template files
- uses Bootstrap for styling

## Build

The site's static HTML is generated in two phases:
1. Babel is used to transpile the code in the `/src` directory
    - React is used as a templating language to generate HTML, which is pushed into the `/dist` directory
1. Static assets are included in the build
    - A bash command is used to find/copy assets into the `/dist` directory

```bash
npm run build
# or
npm run watch #automatically re-build whenever changes are made to /src
```

## Run
To see the (locally) built site, start the dev webserver:
```bash
npm run dev-webserver # requires python to be installed on your system
```

Then navigate in your browser to http://localhost:8000/

## Linting

```bash
npm run lint
```

Linting is done with [ESLint](https://eslint.org/) and is configured to conform code to https://standardjs.com/

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
To support pages that send/receive MIDI SYSEX with the Web Audio API, the site needs to run on HTTPS (this is also good practice anyhow). I use [certbot](https://certbot.eff.org/) running on an EC2 instance to acquire certs from [Let's Encrypt](https://letsencrypt.org/) to power this.

**Install certbot**
I installed with pip:
```
pip install --user -U certbot
```

**Acquire certificate**
```
mkdir -p ~/letsencrypt/log
mkdir -p ~/letsencrypt/lib
certbot certonly --manual -d chippanfire.com -d www.chippanfire.com --logs-dir ~/letsencrypt/log/ --config-dir ~/letsencrypt/ --work-dir ~/letsencrypt/
```
_note use of custom output directories, instead of the root owned /etc/letsencrypt used by default_

I'll be presented VALUE and FILENAME pairs by the installer, which I need to make publically accessible via S3:
```
echo VALUE > tmp/FILENAME
aws s3 sync ./tmp/ s3://chippanfire.com/.well-known/acme-challenge/

# and delete them afterwards with (remove the --dryrun option to actually remove them)
aws s3 sync ./tmp/ s3://chippanfire.com/.well-known/acme-challenge/ --delete --dryrun
```

**Upload and use certificate (using aws-cli)**
```
aws iam delete-server-certificate --server-certificate-name chippanfire.com-old #delete previous backup
aws iam update-server-certificate --server-certificate-name chippanfire.com --new-server-certificate-name chippanfire.com-old # backup current cert
aws iam upload-server-certificate --server-certificate-name chippanfire.com --certificate-body file:///home/ec2-user/letsencrypt/live/chippanfire.com/cert.pem --private-key file:///home/ec2-user/letsencrypt/live/chippanfire.com/privkey.pem --certificate-chain file:///home/ec2-user/letsencrypt/live/chippanfire.com/chain.pem --path /cloudfront/chippanfire/
# aws iam list-server-certificates to get cert ID
```

*Note the path must include **/cloudfront** and end with a trailing slash. With an incorrect path cloudformation gives a misleading error about "The specified SSL certificate doesn't exist, isn't valid, or doesn't include a valid certificate chain"*

**Update cloudfront**

Update stack via the AWS console, providing the IAM certificate ID of the just uploaded cert as the certificate ID template parameter
