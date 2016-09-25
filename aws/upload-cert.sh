#!/bin/bash

aws iam upload-server-certificate --server-certificate-name chippanfire.com --certificate-body file:///home/ec2-user/chippanfire.com-cert/cert.pem --private-key file:///home/ec2-user/chippanfire.com-cert/privkey.pem --certificate-chain file:///home/ec2-user/chippanfire.com-cert/chain.pem --path /chippanfire/

# aws iam list-server-certificates