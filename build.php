<?php

// Super strict, fail on warning
error_reporting(E_ALL);
ini_set('display_errors', 1);
function exception_error_handler($errno, $errstr, $errfile, $errline ) {
    throw new ErrorException($errstr, $errno, 0, $errfile, $errline);
}
set_error_handler("exception_error_handler");

include 'src/Header.php';
include 'src/Navigation.php';
include 'src/Page.php';
include 'src/SimpleContent.php';
include 'src/Site.php';
include 'src/SoftwareContent.php';
include 'src/SoftwareContentFactory.php';

$softwareFactory = new SoftwareContentFactory();

$software = new Page('Software', 'software.html', new SimpleContent('content-software.phtml'));
$m4lDSM = new Page('Device Snapshot Manager', 'software-m4l-device-snapshot-manager.html', $softwareFactory->deviceSnapshotManager());
$m4lWAI = new Page('Where Am I', 'software-m4l-where-am-i.html', $softwareFactory->whereAmI());
$home = new Page('ChipPanFire', 'index.html', new SimpleContent('content-homepage.phtml'));
$music = new Page('Music', 'music.html', new SimpleContent('content-music.phtml'));
$contact = new Page('Contact', 'contact.html', new SimpleContent('content-contact.phtml'));

$allPages = array($home, $music, $software, $m4lDSM, $m4lWAI, $contact);
$navPages = array($home, $music, $software, $contact);

$site = new Site($allPages, new Navigation($navPages));
$site->clearLastBuild();
$site->render();
