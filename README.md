# chippanfire-site

Generation of the (static) chippanfire site

## Why
A super-lightweight "framework" to generate a bunch of static HTML pages that all have a common layout. I wanted to minimise the amount of HTML I had to hand-crank to be just the 'content' of each page.

I'm interested in playing around with (bootstrap powered) responsive web without a 'bulky' framework sitting between me and the raw HTML/CSS

I opted for PHP as it is already installed on my machine (zero setup), and I've used it enough in the past to be wrestle it into submission fairly easily...

## Setup/Editing
Each page in the site uses a common document, header, navigation and footer.
The layout of the site is configured in build.php.
HTML snippets (stored as .phtml) for each element of a page are stored in src/template

## Build
Use PHP to generate the static html assets by running the following from the top-level folder

```php build.php```

Note that by default the assets/links will have absolute URLs, as required for live builds.
When building for development a build parameter should be used that makes the build generate relative URLs for all assets/links

```php build.php relative-links```

## Deploy
The site is hosted in an S3 bucket. Deployment is as simple as pushing the contents of the /site folder to S3 using the AWS cli

```
cd ./site/

# HTML pages (24 hours cache) - changes published within 24 hours (can manually invalidate)
aws s3 sync . s3://chippanfire.com/ --delete --exclude "*" --include "*.html" --cache-control max-age=86400

# everything else (1 year cache)
aws s3 sync . s3://chippanfire.com/ --delete --cache-control max-age=31536000
```

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
the account where my domain is registered to point the main DNS record at the AWS nameservers for the created **hosted zone***

## HTTPS
To support pages that send/receive MIDI SYSEX with the Web Audio API, the site needs to run on HTTPS (this is also good practice anyhow). I used [certbot](https://certbot.eff.org/) to acquire certs from [Let's Encrypt](https://letsencrypt.org/) to power this.

**Install certbot**
```
brew update
brew install certbot
```

**Acquire certificate**
To acquire a cert on my local machine:

```
mkdir -p ~/letsencrypt/log
mkdir -p ~/letsencrypt/lib
certbot certonly --manual -d chippanfire.com -d www.chippanfire.com --logs-dir ~/letsencrypt/log/ --config-dir ~/letsencrypt/ --work-dir ~/letsencrypt/
```
_note use of custom output directories, instead of the root owned /etc/letsencrypt used by default_


**Upload and use certificate**
The AWS cli is used to upload certs (to IAM). The ID of the uploaded cert is used in the cloudformation template to specify what cert to use with Cloudfront (for enabling HTTPS on the site)

```
aws iam upload-server-certificate --server-certificate-name chippanfire.com --certificate-body file:///home/ec2-user/chippanfire.com-cert/cert.pem --private-key file:///home/ec2-user/chippanfire.com-cert/privkey.pem --certificate-chain file:///home/ec2-user/chippanfire.com-cert/chain.pem --path /cloudfront/chippanfire/
# aws iam list-server-certificates to get cert ID
```

*Note the path must include **/cloudfront** and end with a trailing slash. With an incorrect path cloudformation gives a misleading error about "The specified SSL certificate doesn't exist, isn't valid, or doesn't include a valid certificate chain"*
