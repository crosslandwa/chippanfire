<?php

// Super strict, fail on warning
error_reporting(E_ALL);
ini_set('display_errors', 1);
function exception_error_handler($errno, $errstr, $errfile, $errline ) {
    throw new ErrorException($errstr, $errno, 0, $errfile, $errline);
}
set_error_handler("exception_error_handler");

include 'src/Header.php';
include 'src/Link.php';
include 'src/Navigation.php';
include 'src/Page.php';
include 'src/SimpleContent.php';
include 'src/Site.php';
include 'src/SoftwareContent.php';
include 'src/SoftwareContentFactory.php';
include 'src/SoftwareHomeContent.php';
include 'src/SoftwareSummary.php';

$softwareFactory = new SoftwareContentFactory();


// TODO yuk - sort this. All into factory?
$m4lDSM = new Page('Device Snapshot Manager', 'software-m4l-device-snapshot-manager.html', $softwareFactory->deviceSnapshotManager(), Link::internal('Device Snapshot Manager', 'software-m4l-device-snapshot-manager.html'));
$m4lWAI = new Page('Where Am I', 'software-m4l-where-am-i.html', $softwareFactory->whereAmI(), Link::internal('Where Am I', 'software-m4l-where-am-i.html'));
$wacNetworkMidi = new Page('Wac Network MIDI', 'software-wac-network-midi.html', $softwareFactory->wacNetworkMidi(), Link::internal('Wac Network MIDI', 'software-wac-network-midi.html'));
$kmkControlScript = new Page('KMK Control Script', 'https://github.com/crosslandwa/kmkControl', $softwareFactory->kmkControlScript(), Link::external('KMK Control Script', 'https://github.com/crosslandwa/kmkControl'));

$softwareSummaries = array(
    new SoftwareSummary($m4lDSM, $softwareFactory->deviceSnapshotManager()),
    new SoftwareSummary($m4lWAI, $softwareFactory->whereAmI()),
    new SoftwareSummary($kmkControlScript, $softwareFactory->kmkControlScript()),
    new SoftwareSummary($wacNetworkMidi, $softwareFactory->wacNetworkMidi())
);

$software = new Page('Software', 'software.html', new SoftwareHomeContent($softwareSummaries), Link::internal('Software', 'software.html'));

$home = new Page('ChipPanFire', 'index.html', new SimpleContent('content-homepage.phtml'), Link::internal('ChipPanFire', 'index.html'));
$music = new Page('Music', 'music.html', new SimpleContent('content-music.phtml'), Link::internal('Music', 'music.html'));
$contact = new Page('Contact', 'contact.html', new SimpleContent('content-contact.phtml'), Link::internal('Contact', 'contact.html'));

$allPages = array($home, $music, $software, $m4lDSM, $m4lWAI, $wacNetworkMidi, $contact);
$navPages = array($home, $music, $software, $contact);

$site = new Site($allPages, new Navigation($navPages));
$site->clearLastBuild();
$site->render();
