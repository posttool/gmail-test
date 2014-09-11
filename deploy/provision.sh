#!/bin/sh
sudo su

apt-get update

apt-get install -y build-essential --no-install-recommends
apt-get install -y python-software-properties
apt-get install -y redis-server --no-install-recommends

add-apt-repository ppa:chris-lea/node.js
add-apt-repository ppa:dhor/myway

apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/mongodb.list

apt-get update

apt-get install -y graphicsmagick
apt-get install -y nodejs
apt-get install -y mongodb-10gen

sudo apt-get install build-essential python-dev --no-install-recommends
sudo apt-get install python-pip
sudo pip install pymongo